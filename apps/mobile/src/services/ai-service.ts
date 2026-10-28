import { formatVnd, monthKey, today } from '@pfm/domain';
import { withDatabase } from '@/data/connection';
import { readDashboard } from '@/data/dashboard';
import type { Queries } from '@/data/migrate';
import { foldSearchText } from '@/data/search-text';

export interface AIChartItem {
  category: string;
  percentage: number;
  amount: number;
  color: string;
}

export interface AIResponsePayload {
  id: string;
  userMessageId: string;
  replyText: string;
  chartTitle?: string;
  chartItems?: AIChartItem[];
  createdAt: string;
}

export interface AIServiceContext {
  balance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  topCategories: { name: string; amount: number }[];
  budgetsCount: number;
  goalsCount: number;
}

export interface AIService {
  /**
   * Sends a user prompt along with local financial context and returns an AI response
   * that may include category percentage bar chart data.
   */
  sendMessage(
    prompt: string,
    context: AIServiceContext,
    userMessageId?: string,
  ): Promise<AIResponsePayload>;
}

const CHART_PALETTE = [
  '#7C5CFF',
  '#FF7AD9',
  '#16A34A',
  '#0EA5E9',
  '#F59E0B',
] as const;

const AI_REPLIES_SETTING_KEY = 'ai_chat_replies_v1';

/**
 * Builds normalized category percentage bar items from actual local category expenses.
 * Falls back to a clearly labeled reference breakdown when no expenses exist yet.
 */
export function buildCategoryChartItems(
  topCategories: { name: string; amount: number }[],
): { items: AIChartItem[]; isSample: boolean } {
  const valid = topCategories.filter(
    (item) => Number.isInteger(item.amount) && item.amount > 0,
  );
  const total = valid.reduce((sum, item) => sum + item.amount, 0);

  if (total > 0 && valid.length > 0) {
    const sliced = valid.slice(0, 5);
    const sliceTotal = sliced.reduce((sum, item) => sum + item.amount, 0);
    const items = sliced.map((item, index) => ({
      category: item.name,
      percentage: Math.max(1, Math.round((item.amount * 100) / sliceTotal)),
      amount: item.amount,
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    }));
    return { items, isSample: false };
  }

  // Fallback reference distribution when the current month has 0 expense transactions
  return {
    isSample: true,
    items: [
      {
        category: 'Ăn uống',
        percentage: 38,
        amount: 3_800_000,
        color: CHART_PALETTE[0],
      },
      {
        category: 'Nhà ở & Hóa đơn',
        percentage: 27,
        amount: 2_700_000,
        color: CHART_PALETTE[1],
      },
      {
        category: 'Di chuyển',
        percentage: 15,
        amount: 1_500_000,
        color: CHART_PALETTE[2],
      },
      {
        category: 'Mua sắm',
        percentage: 12,
        amount: 1_200_000,
        color: CHART_PALETTE[3],
      },
      {
        category: 'Tiết kiệm',
        percentage: 8,
        amount: 800_000,
        color: CHART_PALETTE[4],
      },
    ],
  };
}

/**
 * Mock implementation of AIService with configurable typing delay and real local SQLite data analysis.
 * Can be swapped with a remote proxy implementation later without modifying UI components.
 */
export class MockAIService implements AIService {
  private readonly delayMs: number;

  constructor(options?: { delayMs?: number }) {
    this.delayMs = options?.delayMs ?? 550;
  }

  /**
   * Generates a contextual financial response and category percentage chart after a simulated typing delay.
   */
  async sendMessage(
    prompt: string,
    context: AIServiceContext,
    userMessageId = `msg-${Date.now()}`,
  ): Promise<AIResponsePayload> {
    if (this.delayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.delayMs);
      });
    }

    const normalized = foldSearchText(prompt);
    const { items: chartItems, isSample } = buildCategoryChartItems(
      context.topCategories,
    );
    const createdAt = new Date().toISOString();
    const id = `ai-${userMessageId}`;

    // 1. Budget Planner intent
    if (
      normalized.includes('budget') ||
      normalized.includes('ngan sach') ||
      normalized.includes('ke hoach') ||
      normalized.includes('50 30 20')
    ) {
      const baseIncome =
        context.monthlyIncome > 0 ? context.monthlyIncome : 15_000_000;
      const essentials = Math.round(baseIncome * 0.5);
      const lifestyle = Math.round(baseIncome * 0.3);
      const savings = baseIncome - essentials - lifestyle;

      const budgetChart: AIChartItem[] = [
        {
          category: 'Thiết yếu (50%)',
          percentage: 50,
          amount: essentials,
          color: '#7C5CFF',
        },
        {
          category: 'Linh hoạt (30%)',
          percentage: 30,
          amount: lifestyle,
          color: '#FF7AD9',
        },
        {
          category: 'Tiết kiệm (20%)',
          percentage: 20,
          amount: savings,
          color: '#16A34A',
        },
      ];

      const incomeSourceNote =
        context.monthlyIncome > 0
          ? `Dựa trên thu nhập tháng này của bạn (${formatVnd(context.monthlyIncome)})`
          : `Dựa trên mức thu nhập tham chiếu (${formatVnd(baseIncome)})`;

      return {
        id,
        userMessageId,
        replyText: `${incomeSourceNote}, PFM.ai gợi ý phân bổ ngân sách theo quy tắc 50/30/20: ${formatVnd(essentials)} cho chi phí thiết yếu, ${formatVnd(lifestyle)} cho nhu cầu cá nhân và dành ${formatVnd(savings)} tích lũy.`,
        chartTitle: 'Kế hoạch Ngân sách 50 / 30 / 20 (%)',
        chartItems: budgetChart,
        createdAt,
      };
    }

    // 2. Goal Tracker intent
    if (
      normalized.includes('goal') ||
      normalized.includes('muc tieu') ||
      normalized.includes('tiet kiem')
    ) {
      const savingsRate =
        context.monthlyIncome > 0
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round((context.monthlyNet * 100) / context.monthlyIncome),
              ),
            )
          : 20;

      return {
        id,
        userMessageId,
        replyText: `Số dư khả dụng hiện tại của bạn là ${formatVnd(context.balance)}. Tháng này chênh lệch thu trừ chi đạt ${formatVnd(context.monthlyNet)} (tỷ lệ tích lũy ~${savingsRate}%). Bạn đang theo dõi ${context.goalsCount} mục tiêu tiết kiệm và ${context.budgetsCount} ngân sách.`,
        chartTitle: isSample
          ? 'Cơ cấu chi tiêu mẫu để tối ưu mục tiêu (%)'
          : 'Tỷ trọng chi tiêu hiện tại theo danh mục (%)',
        chartItems,
        createdAt,
      };
    }

    // 3. Spending Insights / Default Financial Analysis intent
    const summaryPrefix =
      context.monthlyExpense > 0
        ? `Trong tháng này, tổng thu của bạn là ${formatVnd(context.monthlyIncome)} và tổng chi là ${formatVnd(context.monthlyExpense)} (còn lại ${formatVnd(context.monthlyNet)}). Dưới đây là biểu đồ phân bổ phần trăm các danh mục chi tiêu lớn nhất:`
        : `Số dư hiện tại của bạn là ${formatVnd(context.balance)}. Tháng này bạn chưa phát sinh khoản chi nào nên dưới đây là biểu đồ tỷ trọng chi tiêu mẫu để bạn tham khảo:`;

    return {
      id,
      userMessageId,
      replyText: summaryPrefix,
      chartTitle: isSample
        ? 'Phân bổ chi tiêu tham khảo theo danh mục (%)'
        : 'Phân bổ chi tiêu thực tế theo danh mục (%)',
      chartItems,
      createdAt,
    };
  }
}

export const defaultAIService: AIService = new MockAIService({ delayMs: 550 });

/**
 * Reads the current month's financial summary from SQLite to pass into AIService.
 */
export async function readAIServiceContext(): Promise<AIServiceContext> {
  const currentMonth = monthKey(
    today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  return withDatabase(async (db) => {
    const dashboard = await readDashboard(db, currentMonth);
    return {
      balance: dashboard.balance,
      monthlyIncome: dashboard.current.income,
      monthlyExpense: dashboard.current.expense,
      monthlyNet: dashboard.current.net,
      topCategories: dashboard.topCategories.map((row) => ({
        name: row.name ?? 'Chưa phân loại',
        amount: row.amount,
      })),
      budgetsCount: dashboard.budgets.length,
      goalsCount: dashboard.goals.length,
    };
  });
}

/**
 * Loads the persisted map of userMessageId -> AIResponsePayload from the local SQLite settings table.
 */
export async function loadPersistedAIReplyMap(
  db: Queries,
): Promise<Record<string, AIResponsePayload>> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    AI_REPLIES_SETTING_KEY,
  );
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as Record<string, AIResponsePayload>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Saves an AIResponsePayload associated with a user message ID into the local SQLite settings table.
 */
export async function savePersistedAIReply(
  db: Queries,
  payload: AIResponsePayload,
): Promise<void> {
  const existing = await loadPersistedAIReplyMap(db);
  existing[payload.userMessageId] = payload;
  // Keep the most recent 60 AI replies to keep local storage compact
  const keys = Object.keys(existing);
  if (keys.length > 60) {
    for (const oldKey of keys.slice(0, keys.length - 60)) {
      delete existing[oldKey];
    }
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    AI_REPLIES_SETTING_KEY,
    JSON.stringify(existing),
  );
}

