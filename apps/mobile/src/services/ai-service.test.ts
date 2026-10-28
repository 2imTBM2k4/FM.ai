import { describe, expect, it, vi } from 'vitest';
import type { Queries } from '@/data/migrate';
import {
  buildCategoryChartItems,
  loadPersistedAIReplyMap,
  MockAIService,
  savePersistedAIReply,
  type AIServiceContext,
} from './ai-service';

vi.mock('@/data/connection', () => ({
  withDatabase: async () => undefined,
}));

describe('AIService & MockAIService (Stage 3)', () => {
  it('computes real category percentage bar chart items from integer expenses', () => {
    const { items, isSample } = buildCategoryChartItems([
      { name: 'Ăn uống', amount: 3_000_000 },
      { name: 'Nhà ở', amount: 2_000_000 },
      { name: 'Di chuyển', amount: 1_000_000 },
    ]);

    expect(isSample).toBe(false);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      category: 'Ăn uống',
      percentage: 50,
      amount: 3_000_000,
    });
    expect(items[1]).toMatchObject({
      category: 'Nhà ở',
      percentage: 33,
      amount: 2_000_000,
    });
    expect(items[2]).toMatchObject({
      category: 'Di chuyển',
      percentage: 17,
      amount: 1_000_000,
    });
    for (const item of items) {
      expect(Number.isInteger(item.amount)).toBe(true);
      expect(Number.isInteger(item.percentage)).toBe(true);
    }
  });

  it('falls back to sample category breakdown when current month has zero expenses', () => {
    const { items, isSample } = buildCategoryChartItems([]);
    expect(isSample).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(4);
    const totalPercent = items.reduce((sum, item) => sum + item.percentage, 0);
    expect(totalPercent).toBe(100);
    for (const item of items) {
      expect(Number.isInteger(item.amount)).toBe(true);
    }
  });

  it('generates 50/30/20 Budget Planner chart with exact integer sum and zero float drift', async () => {
    const service = new MockAIService({ delayMs: 0 });
    const context: AIServiceContext = {
      balance: 25_000_000,
      monthlyIncome: 10_000_001, // Odd integer to verify zero float drift
      monthlyExpense: 4_000_000,
      monthlyNet: 6_000_001,
      topCategories: [{ name: 'Ăn uống', amount: 4_000_000 }],
      budgetsCount: 2,
      goalsCount: 1,
    };

    const reply = await service.sendMessage(
      'Budget Planner: Lập kế hoạch ngân sách 50/30/20',
      context,
      'msg-budget-1',
    );

    expect(reply.userMessageId).toBe('msg-budget-1');
    expect(reply.chartItems).toHaveLength(3);
    expect(reply.chartItems?.map((i) => i.percentage)).toEqual([50, 30, 20]);

    const sumAmounts =
      reply.chartItems?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
    expect(sumAmounts).toBe(10_000_001);
    for (const item of reply.chartItems ?? []) {
      expect(Number.isInteger(item.amount)).toBe(true);
    }
  });

  it('generates Goal Tracker insights and handles zero-income edge case safely', async () => {
    const service = new MockAIService({ delayMs: 0 });
    const zeroIncomeContext: AIServiceContext = {
      balance: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyNet: 0,
      topCategories: [],
      budgetsCount: 0,
      goalsCount: 2,
    };

    const reply = await service.sendMessage(
      'Goal Tracker: Mục tiêu tiết kiệm',
      zeroIncomeContext,
      'msg-goal-1',
    );

    expect(reply.replyText).toContain('0 ₫');
    expect(reply.replyText).toContain('2 mục tiêu tiết kiệm');
    expect(reply.chartItems?.length).toBeGreaterThan(0);
  });

  it('generates Spending Insights with real category percentage breakdown', async () => {
    const service = new MockAIService({ delayMs: 0 });
    const context: AIServiceContext = {
      balance: 18_500_000,
      monthlyIncome: 25_000_000,
      monthlyExpense: 6_500_000,
      monthlyNet: 18_500_000,
      topCategories: [
        { name: 'Ăn uống', amount: 3_900_000 },
        { name: 'Hóa đơn', amount: 2_600_000 },
      ],
      budgetsCount: 3,
      goalsCount: 2,
    };

    const reply = await service.sendMessage(
      'Spending Insights: Phân tích chi tiêu tháng này',
      context,
      'msg-spend-1',
    );

    expect(reply.replyText).toContain('25.000.000 ₫');
    expect(reply.replyText).toContain('6.500.000 ₫');
    expect(reply.chartItems).toHaveLength(2);
    expect(reply.chartItems?.[0]?.percentage).toBe(60);
    expect(reply.chartItems?.[1]?.percentage).toBe(40);
  });

  it('persists and loads AI replies from the SQLite settings table', async () => {
    const store = new Map<string, string>();
    const fakeDb: Queries = {
      execAsync: async () => undefined,
      runAsync: async (_sql: string, ...params: unknown[]) => {
        const [key, value] = params as [string, string];
        store.set(key, value);
        return { changes: 1, lastInsertRowId: 1 };
      },
      getFirstAsync: async <T>(_sql: string, ...params: unknown[]) => {
        const [key] = params as [string];
        const value = store.get(key);
        return (value ? { value } : null) as T | null;
      },
      getAllAsync: async () => [],
    };

    const emptyMap = await loadPersistedAIReplyMap(fakeDb);
    expect(emptyMap).toEqual({});

    await savePersistedAIReply(fakeDb, {
      id: 'ai-msg-1',
      userMessageId: 'msg-1',
      replyText: 'Phân tích mẫu',
      chartTitle: 'Biểu đồ (%)',
      chartItems: [
        {
          category: 'Ăn uống',
          percentage: 100,
          amount: 150_000,
          color: '#7C5CFF',
        },
      ],
      createdAt: '2026-10-28T00:00:00.000Z',
    });

    const loaded = await loadPersistedAIReplyMap(fakeDb);
    expect(loaded['msg-1']?.replyText).toBe('Phân tích mẫu');
    expect(loaded['msg-1']?.chartItems?.[0]?.amount).toBe(150_000);
  });
});

