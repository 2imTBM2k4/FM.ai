import { describe, expect, it } from 'vitest';

import { formatCompactVnd, formatVnd, toMoney } from './money';

describe('formatCompactVnd', () => {
  it.each([
    [0, '0 ₫'],
    [999, '999 ₫'],
    [1000, '1k'],
    [30000, '30k'],
    [1500000, '1,5 triệu'],
    [-1500000, '-1,5 triệu'],
    [999999, '1 triệu'],
    [1000000000, '1 tỷ'],
    [100000000000, '100 tỷ'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCompactVnd(value)).toBe(expected);
  });
  it.each([0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects %s',
    (value) => {
      expect(() => formatCompactVnd(value)).toThrow(RangeError);
    },
  );
});

describe('toMoney', () => {
  it.each([0, 999, 1000, 100_000_000_000])('accepts whole VND: %s', (value) => {
    expect(toMoney(value)).toBe(value);
  });

  it.each([
    -1,
    0.5,
    NaN,
    Infinity,
    100_000_000_001,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid or excessive money: %s', (value) => {
    expect(() => toMoney(value)).toThrow(RangeError);
  });
});

describe('formatVnd', () => {
  it.each([
    [0, '0 ₫'],
    [999, '999 ₫'],
    [1000, '1.000 ₫'],
    [1_500_000, '1.500.000 ₫'],
    [-1_500_000, '-1.500.000 ₫'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatVnd(value)).toBe(expected);
  });

  it.each([0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a non-integer or unsafe amount: %s',
    (value) => {
      expect(() => formatVnd(value)).toThrow(RangeError);
    },
  );
});
