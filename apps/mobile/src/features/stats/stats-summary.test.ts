import { describe, expect, it } from 'vitest';
import {
  aggregatePeriodSummary,
  computeCategoryAllocation,
} from './stats-summary';

describe('Stats Summary & Category Allocation (Stage 5)', () => {
  it('handles zero-transaction months with 0 income, 0 expense, 0 net, and 0% savings rate', () => {
    const emptySummary = aggregatePeriodSummary([
      { month: '2026-08', income: 0, expense: 0 },
      { month: '2026-09', income: 0, expense: 0 },
      { month: '2026-10', income: 0, expense: 0 },
    ]);

    expect(emptySummary).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      netSavings: 0,
      savingsRatePercent: 0,
    });

    const emptyAllocation = computeCategoryAllocation([]);
    expect(emptyAllocation).toEqual({ totalExpense: 0, items: [] });
  });

  it('aggregates 1M, 3M, and 6M flows accurately using exact integers', () => {
    const threeMonths = [
      { month: '2026-08', income: 20_000_000, expense: 12_000_000 },
      { month: '2026-09', income: 25_000_000, expense: 15_000_000 },
      { month: '2026-10', income: 30_000_000, expense: 18_000_000 },
    ];

    const summary = aggregatePeriodSummary(threeMonths);
    expect(summary.totalIncome).toBe(75_000_000);
    expect(summary.totalExpense).toBe(45_000_000);
    expect(summary.netSavings).toBe(30_000_000);
    expect(summary.savingsRatePercent).toBe(40);
  });

  it('clamps savings rate to 0% when expenses exceed income (negative net flow)', () => {
    const deficit = aggregatePeriodSummary([
      { month: '2026-10', income: 10_000_000, expense: 14_500_000 },
    ]);

    expect(deficit.netSavings).toBe(-4_500_000);
    expect(deficit.savingsRatePercent).toBe(0);
  });

  it('sorts category allocation descending by amount and preserves integer amounts', () => {
    const allocation = computeCategoryAllocation([
      { id: 'c1', name: 'Di chuyển', amount: 1_000_000 },
      { id: 'c2', name: 'Nhà ở', amount: 5_000_000 },
      { id: 'c3', name: 'Ăn uống', amount: 4_000_000 },
    ]);

    expect(allocation.totalExpense).toBe(10_000_000);
    expect(allocation.items.map((i) => i.name)).toEqual([
      'Nhà ở',
      'Ăn uống',
      'Di chuyển',
    ]);
    expect(allocation.items.map((i) => i.percentage)).toEqual([50, 40, 10]);
  });
});

