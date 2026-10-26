import { describe, expect, it } from 'vitest';

import { ceilDiv, ratioBps, roundHalfUp } from './arithmetic';

describe('exact integer arithmetic', () => {
  it.each([
    [0, 3, 0],
    [1_800_000, 900_000, 2],
    [1_000_001, 500_000, 3],
    [Number.MAX_SAFE_INTEGER, 2, 4_503_599_627_370_496],
  ])('ceilDiv(%s, %s) = %s', (n, d, expected) => {
    expect(ceilDiv(n, d)).toBe(expected);
  });

  it.each([
    [2.5, 1, 3],
    [0.5, 1, 1],
    [-2.5, 1, -3],
    [5, 2, 3],
    [-5, 2, -3],
    [4, 3, 1],
    [5, 3, 2],
    [Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER],
  ])('roundHalfUp(%s, %s) = %s', (n, d, expected) => {
    expect(roundHalfUp(n, d)).toBe(expected);
  });

  it('calculates percentages without overflowing intermediate multiplication', () => {
    expect(ratioBps(9_000_000 - 10_000_000, 10_000_000)).toBe(-1000);
    expect(ratioBps(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(
      10000,
    );
    expect(ratioBps(0, 100)).toBe(0);
    expect(ratioBps(1, 0)).toBeNull();
  });

  it('rejects invalid inputs and unsafe results', () => {
    expect(() => ceilDiv(1, 0)).toThrow(RangeError);
    expect(() => ceilDiv(-1, 2)).toThrow(RangeError);
    expect(() => ceilDiv(1, 0.5)).toThrow(RangeError);
    expect(() => roundHalfUp(Infinity)).toThrow(RangeError);
    expect(() => roundHalfUp(1, -1)).toThrow(RangeError);
    expect(() => ratioBps(1, -1)).toThrow(RangeError);
    expect(() => ratioBps(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});
