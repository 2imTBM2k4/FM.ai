import { useFocusEffect } from 'expo-router';
import { addMonths, formatCompactVnd, monthKey, today } from '@pfm/domain';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Button,
  IconButton,
  ProgressBar,
  Text,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { GlassCard, Pill } from '@/components/ui';
import { DesignSpacing, useDesignTheme, useFinancePalette } from '@/constants/theme';
import { withDatabase } from '@/data/connection';
import { readDashboard, type Dashboard } from '@/data/dashboard';
import { vi } from '@/messages/vi';
import { formatCurrencyAmount, usePreferences } from '@/state/preferences';
import {
  aggregatePeriodSummary,
  computeCategoryAllocation,
} from './stats-summary';

export type StatsRange = 1 | 3 | 6;

const localToday = () =>
  today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' });
const shortMonthLabel = (m: string) => `T${Number(m.slice(5))}`;
const fullMonthLabel = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;

/**
 * Stage 5: Statistics & Analytics screen with time range selector (1M / 3M / 6M),
 * Income vs Expense bar chart, and Category Allocation donut + breakdown list.
 */
export function StatsView({
  onSwitchToBudgets,
}: {
  onSwitchToBudgets(): void;
}) {
  const [anchorMonth, setAnchorMonth] = useState(() => monthKey(localToday()));
  const [rangeMonths, setRangeMonths] = useState<StatsRange>(6);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasLoadedOnce = useRef(false);
  const request = useRef(0);

  const theme = useDesignTheme();
  const palette = useFinancePalette();
  const currency = usePreferences((state) => state.currency);

  const load = useCallback(async () => {
    const currentId = ++request.current;
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(false);
    try {
      const next = await withDatabase((db) => readDashboard(db, anchorMonth));
      if (currentId !== request.current) return;
      hasLoadedOnce.current = true;
      setDashboard(next);
    } catch {
      if (currentId === request.current) setError(true);
    } finally {
      if (currentId === request.current) setLoading(false);
    }
  }, [anchorMonth]);

  useFocusEffect(
    useCallback(() => {
      const frame = requestAnimationFrame(() => {
        void load();
      });
      return () => {
        cancelAnimationFrame(frame);
        request.current++;
      };
    }, [load]),
  );

  const visibleSeries = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.months.slice(6 - rangeMonths);
  }, [dashboard, rangeMonths]);

  const periodSummary = useMemo(
    () => aggregatePeriodSummary(visibleSeries),
    [visibleSeries],
  );

  const categoryAllocation = useMemo(
    () =>
      computeCategoryAllocation(
        dashboard?.topCategories ?? [],
        vi.transactionUncategorized,
      ),
    [dashboard?.topCategories],
  );

  const barData = useMemo(() => {
    return visibleSeries.flatMap((point) => [
      {
        value: Math.round(point.income / 1000),
        label: shortMonthLabel(point.month),
        spacing: 6,
        labelWidth: 34,
        frontColor: theme.finance.income,
      },
      {
        value: Math.round(point.expense / 1000),
        frontColor: theme.finance.expense,
      },
    ]);
  }, [visibleSeries, theme.finance.income, theme.finance.expense]);

  return (
    <Screen
      title={vi.statsTabTitle}
      headerRight={
        <View style={localStyles.modeSwitchRow}>
          <Pill
            label={vi.statsTabTitle}
            icon="chart-box-outline"
            tone="primary"
            selected
            size="sm"
          />
          <Pill
            label={vi.budgetsTabTitle}
            icon="bullseye-arrow"
            tone="glass"
            size="sm"
            onPress={onSwitchToBudgets}
          />
        </View>
      }
    >
      {/* Time Range Selector + Anchor Month Navigator */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.sm}
        style={localStyles.controlsCard}
      >
        <View style={styles.row}>
          <View style={styles.inlineRow}>
            <IconButton
              icon="chevron-left"
              size={20}
              style={{ margin: 0 }}
              accessibilityLabel={vi.budgetPreviousMonth}
              disabled={anchorMonth <= '0001-06'}
              onPress={() =>
                setAnchorMonth(monthKey(addMonths(`${anchorMonth}-01`, -1)))
              }
            />
            <Text
              variant="titleMedium"
              style={[
                styles.number,
                { fontWeight: '800', color: theme.text.primary },
              ]}
            >
              {fullMonthLabel(anchorMonth)}
            </Text>
            <IconButton
              icon="chevron-right"
              size={20}
              style={{ margin: 0 }}
              accessibilityLabel={vi.budgetNextMonth}
              disabled={anchorMonth >= '9999-12'}
              onPress={() =>
                setAnchorMonth(monthKey(addMonths(`${anchorMonth}-01`, 1)))
              }
            />
          </View>

          <View style={localStyles.rangePills}>
            {(
              [
                [1, vi.statsRange1M],
                [3, vi.statsRange3M],
                [6, vi.statsRange6M],
              ] as const
            ).map(([months, label]) => (
              <Pill
                key={months}
                label={label}
                tone="primary"
                selected={rangeMonths === months}
                size="sm"
                onPress={() => setRangeMonths(months)}
              />
            ))}
          </View>
        </View>
      </GlassCard>

      {loading && !dashboard && (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" accessibilityLabel={vi.loading} />
        </View>
      )}

      {error && (
        <GlassCard variant="default" radius="lg" padding={DesignSpacing.md}>
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>
            {vi.overviewLoadError}
          </Text>
          <Button onPress={() => void load()}>{vi.retry}</Button>
        </GlassCard>
      )}

      {dashboard && (
        <>
          {/* 3 Period Summary Cards: Income, Expenses, Net Savings */}
          <View style={localStyles.summaryGrid}>
            <GlassCard
              variant="elevated"
              radius="lg"
              padding={14}
              style={localStyles.summaryCard}
            >
              <Pill label={vi.transactionIncome} tone="income" size="sm" />
              <Text
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.number,
                  { fontWeight: '800', color: theme.finance.incomeText },
                ]}
              >
                {formatCurrencyAmount(periodSummary.totalIncome, currency, {
                  compact: true,
                })}
              </Text>
            </GlassCard>

            <GlassCard
              variant="elevated"
              radius="lg"
              padding={14}
              style={localStyles.summaryCard}
            >
              <Pill label={vi.transactionExpense} tone="expense" size="sm" />
              <Text
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.number,
                  { fontWeight: '800', color: theme.finance.expenseText },
                ]}
              >
                {formatCurrencyAmount(periodSummary.totalExpense, currency, {
                  compact: true,
                })}
              </Text>
            </GlassCard>

            <GlassCard
              variant="elevated"
              radius="lg"
              padding={14}
              style={localStyles.summaryCard}
            >
              <Pill
                label={`${periodSummary.savingsRatePercent}%`}
                tone="savings"
                size="sm"
              />
              <Text
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.number,
                  { fontWeight: '800', color: theme.text.primary },
                ]}
              >
                {formatCurrencyAmount(periodSummary.netSavings, currency, {
                  compact: true,
                  showPlus: true,
                })}
              </Text>
            </GlassCard>
          </View>

          {/* Income vs Expense Grouped Bar Chart */}
          <GlassCard
            variant="elevated"
            radius="xl"
            padding={DesignSpacing.lg}
            style={{ gap: 14 }}
          >
            <View style={styles.row}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '800', color: theme.text.primary }}
              >
                {vi.statsIncomeVsExpense}
              </Text>
              <View style={localStyles.legendRow}>
                <View style={localStyles.legendItem}>
                  <View
                    style={[
                      localStyles.legendDot,
                      { backgroundColor: theme.finance.income },
                    ]}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.text.secondary }}
                  >
                    {vi.transactionIncome}
                  </Text>
                </View>
                <View style={localStyles.legendItem}>
                  <View
                    style={[
                      localStyles.legendDot,
                      { backgroundColor: theme.finance.expense },
                    ]}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.text.secondary }}
                  >
                    {vi.transactionExpense}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ alignItems: 'center', paddingTop: 6 }}>
              <BarChart
                data={barData}
                barWidth={rangeMonths === 1 ? 28 : rangeMonths === 3 ? 18 : 12}
                spacing={rangeMonths === 1 ? 36 : rangeMonths === 3 ? 22 : 16}
                roundedTop
                noOfSections={4}
                height={168}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={theme.card.border}
                yAxisTextStyle={{ color: theme.text.muted, fontSize: 10 }}
                xAxisLabelTextStyle={{
                  color: theme.text.secondary,
                  fontSize: 11,
                  fontWeight: '600',
                }}
                formatYLabel={(label) => `${label}k`}
                isAnimated
              />
            </View>
          </GlassCard>

          {/* Category Allocation Donut Chart + Breakdown List */}
          <GlassCard
            variant="elevated"
            radius="xl"
            padding={DesignSpacing.lg}
            style={{ gap: 16 }}
          >
            <View style={styles.row}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '800', color: theme.text.primary }}
              >
                {vi.statsCategoryAllocation}
              </Text>
              <Pill
                label={fullMonthLabel(anchorMonth)}
                tone="glass"
                size="sm"
              />
            </View>

            {categoryAllocation.items.length === 0 ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.text.secondary, textAlign: 'center' }}
              >
                {vi.statsNoExpenseData}
              </Text>
            ) : (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                  <PieChart
                    donut
                    radius={78}
                    innerRadius={50}
                    innerCircleColor={theme.card.surfaceElevated}
                    data={categoryAllocation.items.map((item) => ({
                      value: item.amount,
                      color: item.color,
                    }))}
                    centerLabelComponent={() => (
                      <View style={{ alignItems: 'center' }}>
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.text.muted }}
                        >
                          {vi.transactionExpense}
                        </Text>
                        <Text
                          variant="labelLarge"
                          style={[
                            styles.number,
                            { fontWeight: '800', color: theme.text.primary },
                          ]}
                        >
                          {formatCompactVnd(categoryAllocation.totalExpense)}
                        </Text>
                      </View>
                    )}
                  />
                </View>

                <View style={{ gap: 12 }}>
                  {categoryAllocation.items.map((item) => (
                    <View key={item.id} style={{ gap: 6 }}>
                      <View style={styles.row}>
                        <View style={localStyles.catLeft}>
                          <View
                            style={[
                              localStyles.legendDot,
                              { backgroundColor: item.color },
                            ]}
                          />
                          <Text
                            variant="bodyMedium"
                            style={{
                              fontWeight: '700',
                              color: theme.text.primary,
                              flexShrink: 1,
                            }}
                          >
                            {item.name}
                          </Text>
                          <Pill
                            label={`${item.percentage}%`}
                            tone="neutral"
                            size="sm"
                          />
                        </View>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.number,
                            {
                              fontWeight: '700',
                              color: theme.text.primary,
                            },
                          ]}
                        >
                          {formatCurrencyAmount(item.amount, currency)}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={Math.min(1, item.percentage / 100)}
                        color={item.color}
                        style={{
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: theme.brand.primarySoft,
                        }}
                      />
                    </View>
                  ))}
                </View>
              </>
            )}
          </GlassCard>
        </>
      )}
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  modeSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlsCard: {
    gap: 8,
  },
  rangePills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
});

