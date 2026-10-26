import { expect, it } from 'vitest';
import { nextOccurrence, type RecurringSchedule } from './recurring';

it('anchors monthly day 31 rather than drifting after shorter months', () => {
  const rule: RecurringSchedule = {
    startOn: '2028-01-31',
    frequency: 'monthly',
    intervalCount: 1,
  };
  let after = '2028-01-01';
  for (const expected of [
    '2028-01-31',
    '2028-02-29',
    '2028-03-31',
    '2028-04-30',
  ]) {
    expect(nextOccurrence(rule, after)).toBe(expected);
    after = expected;
  }
  expect(nextOccurrence({ ...rule, startOn: '2027-01-31' }, '2027-01-31')).toBe(
    '2027-02-28',
  );
});
it('keeps leap-year anchors, intervals, boundaries and inclusive end dates', () => {
  const yearly: RecurringSchedule = {
    startOn: '2028-02-29',
    frequency: 'yearly',
    intervalCount: 1,
  };
  expect(nextOccurrence(yearly, '2028-02-29')).toBe('2029-02-28');
  expect(nextOccurrence(yearly, '2031-03-01')).toBe('2032-02-29');
  const weekly: RecurringSchedule = {
    startOn: '2026-12-28',
    frequency: 'weekly',
    intervalCount: 2,
    endOn: '2027-01-25',
  };
  expect(nextOccurrence(weekly, '2026-12-28')).toBe('2027-01-11');
  expect(nextOccurrence(weekly, '2027-01-11')).toBe('2027-01-25');
  expect(nextOccurrence(weekly, '2027-01-25')).toBeNull();
  expect(
    nextOccurrence(
      { startOn: '2000-01-01', frequency: 'daily', intervalCount: 1 },
      '2026-12-31',
    ),
  ).toBe('2027-01-01');
  expect(() =>
    nextOccurrence({ ...yearly, intervalCount: 0 }, '2028-01-01'),
  ).toThrow();
  expect(
    nextOccurrence(
      { startOn: '9999-12-31', frequency: 'monthly', intervalCount: 1 },
      '9999-12-31',
    ),
  ).toBeNull();
});
