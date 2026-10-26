import { useFocusEffect, useRouter } from 'expo-router';
import {
  addMonths,
  formatCompactVnd,
  formatVnd,
  goalProgress,
  monthKey,
  today,
} from '@pfm/domain';
import { useCallback, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  ProgressBar,
  Text,
  useTheme,
} from 'react-native-paper';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import { readDashboard, type Dashboard } from '@/data/dashboard';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';
import { DEBT_KIND_LABELS } from '@/features/debts/labels';
import type { TransactionInput } from '@pfm/contracts';

const PALETTE = [
  '#3677C8',
  '#C16A2D',
  '#3C8665',
  '#8B69B8',
  '#BC547C',
  '#438B99',
  '#858585',
];
const localToday = () =>
  today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' });
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

// Keep percentages in integer basis points until this final display conversion.
function changeLabel(bps: number | null) {
  if (bps === null) return vi.overviewNew;
  return `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${(Math.abs(bps) / 100)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')
    .replace('.', ',')}%`;
}

export function OverviewScreen({
  onWallets,
  onGoals,
}: {
  onWallets(): void;
  onGoals(): void;
}) {
  const [month, setMonth] = useState(() => monthKey(localToday()));
  const [date, setDate] = useState(localToday);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const request = useRef(0);
  const recurringVersion = useApp((state) => state.recurringVersion);
  const { colors } = useTheme();
  const router = useRouter();
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(false);
    setData(null);
    try {
      const next = await withDatabase((db) => readDashboard(db, month));
      if (id !== request.current) return;
      setDate(localToday());
      setData(next);
      useApp.setState({
        wallets: next.wallets.filter((wallet) => !wallet.is_archived),
      });
    } catch {
      if (id === request.current) setError(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [month]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        request.current++;
        listener.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Automatic transactions change the visible statistics.
    }, [load, recurringVersion]),
  );
  return (
    <Screen title={vi.overviewTitle}>
      <View style={styles.row}>
        <Button
          contentStyle={styles.button}
          mode="outlined"
          onPress={onWallets}
        >
          {vi.manageWallets}
        </Button>
        <Button contentStyle={styles.button} mode="outlined" onPress={onGoals}>
          {vi.goals}
        </Button>
      </View>
      <View style={styles.row}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel={vi.budgetPreviousMonth}
          disabled={month <= '0001-06'}
          onPress={() => setMonth(monthKey(addMonths(`${month}-01`, -1)))}
        />
        <Text variant="titleLarge" accessibilityLiveRegion="polite">
          {monthLabel(month)}
        </Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel={vi.budgetNextMonth}
          disabled={month >= '9999-12'}
          onPress={() => setMonth(monthKey(addMonths(`${month}-01`, 1)))}
        />
      </View>
      <View style={styles.row}>
        <Button
          contentStyle={styles.button}
          disabled={month === monthKey(localToday())}
          onPress={() => setMonth(monthKey(localToday()))}
        >
          {vi.overviewCurrentMonth}
        </Button>
        <Button
          contentStyle={styles.button}
          disabled={loading}
          onPress={() => void load()}
        >
          {vi.refresh}
        </Button>
      </View>
      {loading && <ActivityIndicator accessibilityLabel={vi.loading} />}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {vi.overviewLoadError}
        </Text>
      )}
      {data && (
        <>
          <View
            style={[styles.panel, { backgroundColor: colors.primaryContainer }]}
          >
            <Text variant="titleMedium">{vi.overviewLiveBalance}</Text>
            <Text
              variant="headlineMedium"
              style={[styles.number, { color: colors.onPrimaryContainer }]}
            >
              {formatVnd(data.balance)}
            </Text>
            {data.wallets
              .filter((wallet) => !wallet.is_archived)
              .map((wallet) => (
                <View key={wallet.id} style={styles.row}>
                  <Text>{wallet.name}</Text>
                  <Text style={styles.number}>{formatVnd(wallet.balance)}</Text>
                </View>
              ))}
          </View>
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text variant="titleLarge" accessibilityRole="header">
              {vi.overviewMonthSummary}
            </Text>
            <Text>
              {vi.transactionIncome}: {formatVnd(data.current.income)}
            </Text>
            <Text>
              {vi.overviewVersusPrevious}: {changeLabel(data.incomeChangeBps)}
            </Text>
            <Divider />
            <Text>
              {vi.transactionExpense}: {formatVnd(data.current.expense)}
            </Text>
            <Text>
              {vi.overviewVersusPrevious}: {changeLabel(data.expenseChangeBps)}
            </Text>
            <Divider />
            <Text variant="titleMedium">
              {vi.overviewNet}: {formatVnd(data.current.net)}
            </Text>
          </View>
          <CategoryChart data={data} />
          <HistoryChart data={data} />
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text variant="titleLarge" accessibilityRole="header">
              {vi.overviewBudgets}
            </Text>
            {!data.budgets.length && <Text>{vi.overviewNoBudgets}</Text>}
            {data.budgets.map((budget) => (
              <View key={budget.id} style={{ gap: 8 }}>
                <Text variant="titleMedium">
                  {budget.category_name ?? vi.budgetOverall}
                </Text>
                <Text>
                  {formatVnd(budget.spent)} / {formatVnd(budget.amount)}
                </Text>
                <ProgressBar
                  progress={Math.min(1, budget.spent / budget.amount)}
                  color={colors.primary}
                  accessibilityLabel={budget.category_name ?? vi.budgetOverall}
                  accessibilityValue={{
                    min: 0,
                    max: budget.amount,
                    now: Math.min(budget.spent, budget.amount),
                  }}
                />
              </View>
            ))}
            <Button
              contentStyle={styles.button}
              onPress={() => router.navigate('/budgets')}
            >
              {vi.overviewOpenBudgets}
            </Button>
          </View>
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text variant="titleLarge" accessibilityRole="header">
              {vi.overviewCurrentGoals}
            </Text>
            {!data.goals.length && <Text>{vi.goalEmpty}</Text>}
            {data.goals.map((goal) => {
              const progress = goalProgress(
                goal.target_amount,
                goal.progress,
                date,
                goal.deadline_on,
              );
              return (
                <View key={goal.id} style={{ gap: 8 }}>
                  <Text variant="titleMedium">{goal.name}</Text>
                  <Text>
                    {formatVnd(goal.progress)} / {formatVnd(goal.target_amount)}
                  </Text>
                  {progress.achieved ? (
                    <Text>{vi.goalAchieved}</Text>
                  ) : (
                    progress.requiredPerMonth !== null && (
                      <Text>
                        {vi.goalMonthly}: {formatVnd(progress.requiredPerMonth)}
                      </Text>
                    )
                  )}
                </View>
              );
            })}
            <Button contentStyle={styles.button} onPress={onGoals}>
              {vi.goals}
            </Button>
          </View>
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text variant="titleLarge" accessibilityRole="header">
              {vi.overviewRecent}
            </Text>
            {!data.recent.length && <Text>{vi.overviewNoTransactions}</Text>}
            {data.recent.map((row) => (
              <View key={row.id} style={{ gap: 6 }}>
                <Text>
                  {row.occurred_on} ·{' '}
                  {
                    data.wallets.find((wallet) => wallet.id === row.wallet_id)
                      ?.name
                  }
                </Text>
                <Text>
                  {transactionLabel(row.kind)} · {formatVnd(row.amount)}
                </Text>
                {!!row.note && <Text>{row.note}</Text>}
                <Divider />
              </View>
            ))}
            <Button
              contentStyle={styles.button}
              onPress={() => router.navigate('/transactions')}
            >
              {vi.overviewOpenTransactions}
            </Button>
          </View>
        </>
      )}
    </Screen>
  );
}

function transactionLabel(kind: TransactionInput['kind']) {
  return kind === 'expense'
    ? vi.transactionExpense
    : kind === 'income'
      ? vi.transactionIncome
      : kind === 'transfer'
        ? vi.transactionTransfer
        : (DEBT_KIND_LABELS[kind] ?? vi.overviewDebtTransaction);
}

function CategoryChart({ data }: { data: Dashboard }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const groups = [
    ...data.topCategories.map((row, index) => ({
      label: row.name ?? vi.transactionUncategorized,
      value: row.amount,
      color: PALETTE[index],
    })),
    ...(data.otherCategoryAmount
      ? [
          {
            label: vi.overviewOther,
            value: data.otherCategoryAmount,
            color: PALETTE[6],
          },
        ]
      : []),
  ];
  const uncategorized = data.categories.find((row) => row.id === null);
  return (
    <View
      style={[styles.panel, { backgroundColor: colors.surface }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 40)}
    >
      <Text variant="titleLarge" accessibilityRole="header">
        {vi.overviewCategories}
      </Text>
      <Text>{vi.overviewParentCategories}</Text>
      {!groups.length ? (
        <Text>{vi.overviewNoExpenses}</Text>
      ) : (
        <>
          {width > 0 && (
            <View
              style={{ alignItems: 'center' }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <PieChart
                data={groups}
                donut
                radius={Math.min(120, width / 2)}
                innerRadius={Math.min(78, width / 3)}
                innerCircleColor={colors.surface}
                backgroundColor={colors.surface}
              />
            </View>
          )}
          {groups.map((group, index) => (
            <View key={index} style={styles.row}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 1,
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: group.color,
                  }}
                />
                <Text style={{ flexShrink: 1 }}>{group.label}</Text>
              </View>
              <Text style={styles.number}>{formatVnd(group.value)}</Text>
            </View>
          ))}
          {uncategorized &&
            !data.topCategories.some((row) => row.id === null) && (
              <Text>
                {vi.overviewUncategorizedInOther}:{' '}
                {formatVnd(uncategorized.amount)}
              </Text>
            )}
        </>
      )}
    </View>
  );
}

function HistoryChart({ data }: { data: Dashboard }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const hasData = data.months.some((month) => month.income || month.expense);
  const incomeColor = '#3677C8',
    expenseColor = '#C16A2D';
  const bars = data.months.flatMap((month) => [
    {
      value: month.income,
      label: month.month.slice(5),
      frontColor: incomeColor,
      spacing: 4,
    },
    { value: month.expense, frontColor: expenseColor, spacing: 20 },
  ]);
  return (
    <View
      style={[styles.panel, { backgroundColor: colors.surface }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 40)}
    >
      <Text variant="titleLarge" accessibilityRole="header">
        {vi.overviewHistory}
      </Text>
      <Text>{vi.overviewChartLegend}</Text>
      {!hasData ? (
        <Text>{vi.overviewNoHistory}</Text>
      ) : (
        <>
          {width > 48 && (
            <View
              style={{ overflow: 'hidden' }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <BarChart
                data={bars}
                width={width - 48}
                height={180}
                barWidth={12}
                initialSpacing={8}
                endSpacing={8}
                yAxisLabelWidth={48}
                noOfSections={4}
                maxValue={Math.max(1, ...bars.map((bar) => bar.value))}
                yAxisColor={colors.outlineVariant}
                xAxisColor={colors.outlineVariant}
                rulesColor={colors.outlineVariant}
                xAxisLabelTextStyle={{ color: colors.onSurface }}
                yAxisTextStyle={{ color: colors.onSurface, fontSize: 11 }}
                formatYLabel={(value: string) =>
                  formatCompactVnd(Math.round(Number(value)))
                }
                showScrollIndicator
              />
            </View>
          )}
          {data.months.map((month) => (
            <View key={month.month} style={{ gap: 4 }}>
              <Text variant="titleSmall">{monthLabel(month.month)}</Text>
              <Text>
                {vi.transactionIncome}: {formatVnd(month.income)} ·{' '}
                {vi.transactionExpense}: {formatVnd(month.expense)}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
