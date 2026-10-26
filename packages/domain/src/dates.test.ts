import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  daysInMonth,
  monthIndex,
  monthKey,
  startOfWeek,
  today,
  validateDate,
} from './dates';

describe('calendar dates', () => {
  it.each([
    [2028, 2, 29],
    [2026, 2, 28],
    [2000, 2, 29],
    [1900, 2, 28],
    [2026, 4, 30],
  ])('counts days in %s-%s', (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected);
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-31'],
    ['2026-01-31', -1, '2025-12-31'],
    ['2028-02-29', 12, '2029-02-28'],
  ])('adds months to %s', (date, delta, expected) => {
    expect(addMonths(date, delta)).toBe(expected);
  });

  it('handles week and year boundaries without local-machine timezone dependence', () => {
    expect(startOfWeek('2026-10-23')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(monthKey('2026-10-23')).toBe('2026-10');
    expect(monthIndex('2027-04-30') - monthIndex('2026-10-23')).toBe(6);
  });

  it('uses the injected clock and timezone around midnight', () => {
    const now = () => new Date('2026-10-23T17:01:00Z');
    expect(today({ now, timeZone: 'Asia/Ho_Chi_Minh' })).toBe('2026-10-24');
    expect(today({ now, timeZone: 'UTC' })).toBe('2026-10-23');
  });

  it.each([
    '2026-02-29',
    '2026-02-31',
    '2026-13-01',
    '2026-00-01',
    '2026-10-00',
    '26-10-23',
    '0000-01-01',
  ])('rejects invalid date %s', (date) => {
    expect(() => validateDate(date)).toThrow(RangeError);
  });

  it('rejects invalid months, offsets and invalid clock output', () => {
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
    expect(() => daysInMonth(0, 1)).toThrow(RangeError);
    expect(() => addMonths('0001-01-01', -1)).toThrow(RangeError);
    expect(() => addDays('9999-12-31', 1)).toThrow(RangeError);
    expect(() => addDays('2026-01-01', 0.5)).toThrow(RangeError);
    expect(() => today({ now: () => new Date(NaN), timeZone: 'UTC' })).toThrow(
      RangeError,
    );
  });
});
