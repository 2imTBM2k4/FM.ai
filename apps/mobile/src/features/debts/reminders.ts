import { addDays, today } from '@pfm/domain';
import type { DebtRow } from '@/data/debts';
export const DEBT_NOTIFICATION_PREFIX = 'pfm-debt-';
// Schedule only future reminders; overdue reminders are not replayed on app open.
export function buildDebtReminders(
  rows: Pick<DebtRow, 'id' | 'due_on' | 'outstanding'>[],
  now: Date,
) {
  const date = today({ now: () => now, timeZone: 'Asia/Ho_Chi_Minh' });
  return rows.flatMap((row) => {
    if (!row.due_on || row.due_on <= date || row.outstanding <= 0) return [];
    const at = Date.parse(`${addDays(row.due_on, -1)}T09:00:00+07:00`);
    return at > now.getTime()
      ? [
          {
            id: `${DEBT_NOTIFICATION_PREFIX}${row.id}-${row.due_on}`,
            date: row.due_on,
            at,
          },
        ]
      : [];
  });
}
