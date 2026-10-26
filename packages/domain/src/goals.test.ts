import { expect, it } from 'vitest';
import { goalProgress } from './goals';

it('uses calendar months and rounds the remaining saving upward', () => {
  expect(goalProgress(10000000, 2000000, '2026-10-23', '2027-04-30')).toEqual({
    monthsLeft: 6,
    requiredPerMonth: 1333334,
    achieved: false,
  });
  expect(
    goalProgress(10000000, 2000000, '2026-10-23', '2026-09-01')
      .requiredPerMonth,
  ).toBe(8000000);
  expect(
    goalProgress(100, 120, '2026-10-23', '2027-04-30').requiredPerMonth,
  ).toBe(0);
  expect(
    goalProgress(100, -20, '2026-10-23', '2026-10-31').requiredPerMonth,
  ).toBe(120);
  expect(goalProgress(100, 20, '2026-10-23', null)).toEqual({
    monthsLeft: null,
    requiredPerMonth: null,
    achieved: false,
  });
});

it('rejects invalid dates and amounts', () => {
  expect(() => goalProgress(0, 0, '2026-10-23', null)).toThrow();
  expect(() => goalProgress(100, 0.5, '2026-10-23', null)).toThrow();
  expect(() => goalProgress(100, 0, '2026-02-30', null)).toThrow();
  expect(() => goalProgress(100, 0, '2026-10-23', '2027-02-30')).toThrow();
});
