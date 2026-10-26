import { expect, it } from 'vitest';
import { budgetThresholds } from './budgets';

it('uses exact inclusive budget thresholds and emits 100 percent once when warning is also 100', () => {
  expect(budgetThresholds(2399999, 3000000, 80)).toEqual([]);
  expect(budgetThresholds(2400000, 3000000, 80)).toEqual([80]);
  expect(budgetThresholds(2999999, 3000000, 80)).toEqual([80]);
  expect(budgetThresholds(3000000, 3000000, 80)).toEqual([80, 100]);
  expect(budgetThresholds(3000001, 3000000, 80)).toEqual([80, 100]);
  expect(budgetThresholds(3000000, 3000000, 100)).toEqual([100]);
  expect(budgetThresholds(9000000000000000, 100000000000, 80)).toEqual([
    80, 100,
  ]);
  for (const args of [
    [-1, 1, 80],
    [1, 0, 80],
    [1, 1, 0],
    [1, 1, 101],
    [0.5, 1, 80],
  ])
    expect(() => budgetThresholds(args[0], args[1], args[2])).toThrow();
});
