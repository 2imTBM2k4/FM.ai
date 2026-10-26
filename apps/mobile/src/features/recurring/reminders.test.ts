import { expect, it } from 'vitest';
import { buildRecurringReminders } from './reminders';
import type { RecurringRow } from '@/data/recurring';

const rule: RecurringRow = {
  id: 'rule',
  kind: 'expense',
  amount: 100,
  wallet_id: 'wallet',
  to_wallet_id: null,
  category_id: null,
  note: null,
  frequency: 'daily',
  interval_count: 1,
  start_on: '2026-10-27',
  end_on: null,
  last_generated_on: null,
  is_active: 1,
  remind_before_days: 1,
  blocked: 0,
};
it('schedules at 09:00 Vietnam one day before, skips elapsed reminders and bounds the window', () => {
  const early = new Date('2026-10-26T01:00:00Z');
  const items = buildRecurringReminders([rule], new Set(), early, 2);
  expect(items.map((x) => x.at)).toEqual([
    Date.parse('2026-10-26T02:00:00Z'),
    Date.parse('2026-10-27T02:00:00Z'),
  ]);
  expect(
    buildRecurringReminders([rule], new Set(['rule/2026-10-27']), early, 1)[0]
      .date,
  ).toBe('2026-10-28');
  expect(
    buildRecurringReminders(
      [rule],
      new Set(),
      new Date('2026-10-26T03:00:00Z'),
      1,
    )[0].date,
  ).toBe('2026-10-28');
  expect(
    buildRecurringReminders(
      [
        { ...rule, is_active: 0 },
        { ...rule, blocked: 1 },
      ],
      new Set(),
      early,
    ),
  ).toEqual([]);
  expect(
    buildRecurringReminders(
      [{ ...rule, end_on: '2026-10-27' }],
      new Set(),
      early,
    ),
  ).toHaveLength(1);
  expect(buildRecurringReminders([rule], new Set(), early, 0)).toEqual([]);
});
