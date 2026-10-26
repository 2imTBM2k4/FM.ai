import { expect, it } from 'vitest';
import { buildDebtReminders } from './reminders';
it('reminds open dated debts at 09:00 Vietnam the previous day, skipping settled/undated/elapsed debts', () => {
  const now = new Date('2026-10-26T01:00:00Z');
  const rows = [
    { id: 'ancient', due_on: '0001-01-01', outstanding: 100 },
    { id: 'open', due_on: '2026-10-27', outstanding: 600000 },
    { id: 'closed', due_on: '2026-10-27', outstanding: 0 },
    { id: 'undated', due_on: null, outstanding: 100 },
    { id: 'past', due_on: '2026-10-26', outstanding: 100 },
  ];
  expect(buildDebtReminders(rows, now)).toEqual([
    {
      id: 'pfm-debt-open-2026-10-27',
      date: '2026-10-27',
      at: Date.parse('2026-10-26T02:00:00Z'),
    },
  ]);
  expect(buildDebtReminders(rows, new Date('2026-10-26T03:00:00Z'))).toEqual(
    [],
  );
});
