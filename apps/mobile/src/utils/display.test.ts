import { describe, expect, it } from 'vitest';
import {
  formatCompactVndShort,
  formatDisplayDate,
  formatDisplayMonth,
  formatDisplayMonthShort,
} from './display';

describe('display formatting', () => {
  it('formats stored dates as Vietnamese day/month/year and leaves invalid values alone', () => {
    expect(formatDisplayDate('2026-10-28')).toBe('28/10/2026');
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });

  it('formats stored month keys for labels and chart axes', () => {
    expect(formatDisplayMonth('2026-10')).toBe('10/2026');
    expect(formatDisplayMonthShort('2026-10')).toBe('T10');
    expect(formatDisplayMonth('bad')).toBe('bad');
  });

  it('formats short Vietnamese compact money without English suffixes', () => {
    expect(formatCompactVndShort(28_500_000)).toBe('28,5 tr');
    expect(formatCompactVndShort(50_000_000)).toBe('50 tr');
    expect(formatCompactVndShort(1_500_000_000)).toBe('1,5 tỷ');
    expect(formatCompactVndShort(-4_350_000)).toBe('-4,4 tr');
    expect(formatCompactVndShort(950)).toBe('950 ₫');
  });
});
