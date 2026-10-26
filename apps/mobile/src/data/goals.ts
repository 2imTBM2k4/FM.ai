import { GoalInputSchema, type GoalInput } from '@pfm/contracts';
import type { Database, Queries } from './migrate';
import { requireActiveWallet } from './wallets';

export interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  manual_saved_amount: number;
  funding_wallet_id: string | null;
  deadline_on: string | null;
  status: 'active' | 'achieved' | 'archived';
  progress: number;
  wallet_name: string | null;
}

// Derive completion on every read because a linked wallet can change independently.
export async function listGoals(db: Queries): Promise<GoalRow[]> {
  const rows = await db.getAllAsync<GoalRow>(`SELECT g.*, w.name wallet_name,
    CASE WHEN g.funding_wallet_id IS NULL THEN g.manual_saved_amount ELSE b.balance END progress
    FROM goals g LEFT JOIN wallets w ON w.id=g.funding_wallet_id
    LEFT JOIN v_wallet_balance b ON b.wallet_id=g.funding_wallet_id
    ORDER BY g.created_at,g.id`);
  return rows.map((row) => {
    if (!Number.isSafeInteger(row.progress))
      throw new Error('GOAL_PROGRESS_UNSAFE');
    return {
      ...row,
      status:
        row.status === 'archived'
          ? 'archived'
          : row.progress >= row.target_amount
            ? 'achieved'
            : 'active',
    };
  });
}

export async function saveGoal(
  db: Database,
  id: string,
  input: GoalInput,
  timestamp: string,
  editing: boolean,
) {
  const value = GoalInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const old = editing
      ? await tx.getFirstAsync<GoalRow>('SELECT * FROM goals WHERE id=?', id)
      : null;
    if (editing && (!old || old.status === 'archived'))
      throw new Error('GOAL_NOT_EDITABLE');
    if (
      value.fundingWalletId &&
      value.fundingWalletId !== old?.funding_wallet_id
    )
      await requireActiveWallet(tx, value.fundingWalletId);
    if (editing) {
      await tx.runAsync(
        "UPDATE goals SET name=?,target_amount=?,manual_saved_amount=?,funding_wallet_id=?,deadline_on=?,status='active',updated_at=? WHERE id=?",
        value.name,
        value.targetAmount,
        value.manualSavedAmount,
        value.fundingWalletId,
        value.deadlineOn,
        timestamp,
        id,
      );
    } else {
      await tx.runAsync(
        'INSERT INTO goals (id,name,target_amount,manual_saved_amount,funding_wallet_id,deadline_on,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        id,
        value.name,
        value.targetAmount,
        value.manualSavedAmount,
        value.fundingWalletId,
        value.deadlineOn,
        timestamp,
        timestamp,
      );
    }
  });
}

export function archiveGoal(db: Database, id: string, timestamp: string) {
  return setGoalArchived(db, id, true, timestamp);
}

export function restoreGoal(db: Database, id: string, timestamp: string) {
  return setGoalArchived(db, id, false, timestamp);
}

async function setGoalArchived(
  db: Database,
  id: string,
  archived: boolean,
  timestamp: string,
) {
  await db.transaction(async (tx) => {
    if (!(await tx.getFirstAsync('SELECT id FROM goals WHERE id=?', id)))
      throw new Error('GOAL_NOT_FOUND');
    await tx.runAsync(
      'UPDATE goals SET status=?,updated_at=? WHERE id=?',
      archived ? 'archived' : 'active',
      timestamp,
      id,
    );
  });
}
