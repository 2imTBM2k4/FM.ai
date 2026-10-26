import type { Queries } from './migrate';

export interface DebtRow {
  id: string;
  counterparty_label: string;
  direction: 'borrowed' | 'lent';
  due_on: string | null;
  note: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  principal: number;
  repaid: number;
  outstanding: number;
}

// Derive balances from actual cash-flow rows; never trust a cached outstanding amount.
export async function readDebtBalances(
  db: Queries,
  id?: string,
): Promise<DebtRow[]> {
  const rows = await db.getAllAsync<DebtRow & { wrong_kind: number }>(
    `SELECT d.*,
    COALESCE(SUM(CASE WHEN (d.direction='borrowed' AND t.kind='debt_borrow') OR (d.direction='lent' AND t.kind='debt_lend') THEN t.amount ELSE 0 END),0) principal,
    COALESCE(SUM(CASE WHEN (d.direction='borrowed' AND t.kind='debt_repay_paid') OR (d.direction='lent' AND t.kind='debt_repay_received') THEN t.amount ELSE 0 END),0) repaid,
    SUM(CASE WHEN t.id IS NOT NULL AND NOT ((d.direction='borrowed' AND t.kind IN ('debt_borrow','debt_repay_paid')) OR (d.direction='lent' AND t.kind IN ('debt_lend','debt_repay_received'))) THEN 1 ELSE 0 END) wrong_kind
    FROM debts d LEFT JOIN transactions t ON t.debt_id=d.id ${id === undefined ? '' : 'WHERE d.id=?'}
    GROUP BY d.id ORDER BY d.created_at,d.id`,
    ...(id === undefined ? [] : [id]),
  );
  return rows.map((row) => {
    if (row.wrong_kind) throw new Error('DEBT_DIRECTION');
    if (
      !Number.isSafeInteger(row.principal) ||
      !Number.isSafeInteger(row.repaid)
    )
      throw new Error('DEBT_TOTAL_UNSAFE');
    const outstanding = row.principal - row.repaid;
    if (outstanding < 0) throw new Error('DEBT_OVERPAY');
    return {
      ...row,
      outstanding,
      status: outstanding === 0 ? 'closed' : 'open',
    };
  });
}

export async function validateDebtReference(
  db: Queries,
  id: string,
  kind: string,
) {
  const debt = await db.getFirstAsync<{ direction: DebtRow['direction'] }>(
    'SELECT direction FROM debts WHERE id=?',
    id,
  );
  if (!debt) throw new Error('DEBT_NOT_FOUND');
  const valid =
    debt.direction === 'borrowed'
      ? ['debt_borrow', 'debt_repay_paid']
      : ['debt_lend', 'debt_repay_received'];
  if (!valid.includes(kind)) throw new Error('DEBT_DIRECTION');
}

export async function reconcileDebt(
  db: Queries,
  id: string,
  timestamp: string,
) {
  const debt = (await readDebtBalances(db, id))[0];
  if (!debt) throw new Error('DEBT_NOT_FOUND');
  await db.runAsync(
    'UPDATE debts SET status=?,updated_at=? WHERE id=?',
    debt.status,
    timestamp,
    id,
  );
}
