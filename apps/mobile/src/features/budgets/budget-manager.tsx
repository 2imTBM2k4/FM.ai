import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import {
  addMonths,
  budgetThresholds,
  formatVnd,
  monthKey,
  today,
} from '@pfm/domain';
import { BudgetInputSchema, type BudgetInput } from '@pfm/contracts';
import { memo, useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { BackHandler, FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  IconButton,
  List,
  ProgressBar,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import type { Database } from '@/data/migrate';
import {
  createBudget,
  updateBudget,
  setBudgetActive,
  readBudgetMonth,
  type BudgetRow,
} from '@/data/budgets';
import { listCategories, type CategoryRow } from '@/data/categories';
import { vi } from '@/messages/vi';
import {
  formatAmountInput,
  parseAmountInput,
} from '@/features/transactions/form';
import {
  checkBudgetAlerts,
  requestBudgetNotifications,
  testBudgetNotification,
  useBudgetNotifications,
} from './mobile';

type Mode =
  { type: 'list' } | { type: 'form'; row: BudgetRow | null; id: string };

export function BudgetManager() {
  const [month, setMonth] = useState(() =>
    monthKey(today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' })),
  );
  const [rows, setRows] = useState<BudgetRow[]>([]),
    [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const working = useRef(false);
  const { colors } = useTheme();
  const load = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await withDatabase(async (db) => ({
        rows: await readBudgetMonth(db, month),
        categories: await listCategories(db, true),
      }));
      setRows(data.rows);
      setCategories(data.categories);
      void checkBudgetAlerts();
    } catch {
      setError(vi.budgetLoadError);
    } finally {
      working.current = false;
      setLoading(false);
    }
  }, [month]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const back = useCallback(() => {
    if (!working.current) {
      setMode({ type: 'list' });
      setError('');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        if (mode.type === 'list') return false;
        back();
        return true;
      });
      return () => listener.remove();
    }, [mode.type, back]),
  );
  const mutate = useCallback(
    async (action: (db: Database) => Promise<void>) => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      let committed = false;
      try {
        const next = await withDatabase(async (db) => {
          await action(db);
          committed = true;
          return readBudgetMonth(db, month);
        });
        setRows(next);
        setMode({ type: 'list' });
        setNotice(vi.budgetSaved);
        void checkBudgetAlerts();
      } catch {
        if (committed) setMode({ type: 'list' });
        setError(committed ? vi.walletSavedRefreshFailed : vi.saveError);
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [month],
  );
  const edit = useCallback((row: BudgetRow) => {
    setMode({ type: 'form', row, id: row.id });
    setError('');
    setNotice('');
  }, []);
  const toggle = useCallback(
    (row: BudgetRow) => {
      void mutate((db) =>
        setBudgetActive(db, row.id, !row.is_active, new Date().toISOString()),
      );
    },
    [mutate],
  );
  const renderItem = useCallback(
    ({ item }: { item: BudgetRow }) => (
      <BudgetItem
        row={item}
        busy={busy || loading}
        onEdit={edit}
        onToggle={toggle}
      />
    ),
    [busy, loading, edit, toggle],
  );
  if (mode.type === 'form')
    return (
      <BudgetForm
        row={mode.row}
        month={month}
        categories={categories}
        busy={busy || loading}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            mode.row
              ? updateBudget(db, mode.id, input, new Date().toISOString())
              : createBudget(db, mode.id, input, new Date().toISOString()),
          )
        }
      />
    );
  return (
    <Screen title={vi.budgets} scroll={false}>
      <View style={styles.row}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel={vi.budgetPreviousMonth}
          style={{ minWidth: 48, minHeight: 48 }}
          disabled={busy || loading || month === '0001-01'}
          onPress={() => setMonth(monthKey(addMonths(`${month}-01`, -1)))}
        />
        <Text variant="titleMedium">{month}</Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel={vi.budgetNextMonth}
          style={{ minWidth: 48, minHeight: 48 }}
          disabled={busy || loading || month === '9999-12'}
          onPress={() => setMonth(monthKey(addMonths(`${month}-01`, 1)))}
        />
      </View>
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={busy || loading}
        onPress={() => {
          setMode({ type: 'form', row: null, id: uuid.v4() });
          setError('');
          setNotice('');
        }}
      >
        {vi.addBudget}
      </Button>
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </Text>
          <Button disabled={loading || busy} onPress={load}>
            {vi.retry}
          </Button>
        </View>
      )}
      {loading ? (
        <ActivityIndicator accessibilityLabel={vi.loading} />
      ) : (
        <FlatList
          style={styles.fill}
          contentInsetAdjustmentBehavior="automatic"
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
          ListHeaderComponent={<NotificationControls />}
          ListEmptyComponent={<Text>{vi.budgetEmpty}</Text>}
        />
      )}
    </Screen>
  );
}

const BudgetItem = memo(function BudgetItem({
  row,
  busy,
  onEdit,
  onToggle,
}: {
  row: BudgetRow;
  busy: boolean;
  onEdit(row: BudgetRow): void;
  onToggle(row: BudgetRow): void;
}) {
  const { colors } = useTheme();
  const thresholds =
    row.is_active && row.in_period
      ? budgetThresholds(row.spent, row.amount, row.warn_percent)
      : [];
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      <Text variant="titleMedium">
        {row.category_name ?? vi.budgetOverall}
        {row.category_archived ? ` · ${vi.transactionArchivedReference}` : ''}
      </Text>
      <Text>
        {row.start_month}
        {row.end_month ? ` → ${row.end_month}` : ''}
      </Text>
      {!row.is_active && <Text>{vi.budgetPaused}</Text>}
      {!row.in_period ? (
        <Text>{vi.budgetOutsidePeriod}</Text>
      ) : (
        <>
          <Text style={styles.number}>
            {vi.budgetSpent}: {formatVnd(row.spent)}
          </Text>
          <Text style={styles.number}>
            {vi.budgetLimit}: {formatVnd(row.amount)}
          </Text>
          <ProgressBar
            progress={Math.min(1, row.spent / row.amount)}
            color={thresholds.includes(100) ? colors.error : colors.primary}
            accessibilityLabel={vi.budgetSpent}
            accessibilityValue={{
              min: 0,
              max: row.amount,
              now: Math.min(row.spent, row.amount),
            }}
          />
          {!!thresholds.length && (
            <Text accessibilityRole="alert" style={{ color: colors.error }}>
              {thresholds.includes(100)
                ? vi.budgetReached
                : vi.budgetWarning.replace(
                    '{percent}',
                    String(row.warn_percent),
                  )}
            </Text>
          )}
        </>
      )}
      <View style={styles.row}>
        <Button
          contentStyle={styles.button}
          disabled={busy}
          onPress={() => onEdit(row)}
        >
          {vi.editBudget}
        </Button>
        <Button
          contentStyle={styles.button}
          disabled={busy}
          onPress={() => onToggle(row)}
        >
          {row.is_active ? vi.budgetPause : vi.budgetResume}
        </Button>
      </View>
    </View>
  );
});

function NotificationControls() {
  const status = useBudgetNotifications((state) => state.status);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [scheduled, setScheduled] = useState(false),
    [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  const run = async (test: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    setScheduled(false);
    try {
      if (test) setScheduled(await testBudgetNotification());
      else await requestBudgetNotifications();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginBottom: 20, gap: 12 }}>
      {(status === 'denied' || status === 'error' || error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {status === 'denied'
            ? vi.budgetNotificationDenied
            : vi.budgetNotificationError}
        </Text>
      )}
      <List.Accordion
        title={vi.budgetNotifications}
        expanded={expanded}
        onPress={() => setExpanded((current) => !current)}
      >
        <View style={{ gap: 12, padding: 12 }}>
          <Text>{vi.budgetNotificationDescription}</Text>
          {status === 'granted' && <Text>{vi.budgetNotificationGranted}</Text>}
          <Button
            contentStyle={styles.button}
            disabled={busy}
            loading={busy}
            onPress={() => {
              void run(false);
            }}
          >
            {vi.budgetNotificationEnable}
          </Button>
          <Button
            contentStyle={styles.button}
            disabled={busy || status !== 'granted'}
            onPress={() => {
              void run(true);
            }}
          >
            {vi.budgetNotificationTest}
          </Button>
          {scheduled && (
            <Text accessibilityLiveRegion="polite">
              {vi.budgetNotificationTestScheduled}
            </Text>
          )}
        </View>
      </List.Accordion>
    </View>
  );
}

interface BudgetFields {
  amount: string;
  warnPercent: string;
  startMonth: string;
  endMonth: string;
  categoryId: string;
}
function BudgetForm({
  row,
  month,
  categories,
  busy,
  error,
  onBack,
  onSave,
}: {
  row: BudgetRow | null;
  month: string;
  categories: CategoryRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(input: BudgetInput): Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BudgetFields>({
    defaultValues: {
      amount: row ? formatAmountInput(String(row.amount)) : '',
      warnPercent: String(row?.warn_percent ?? 80),
      startMonth: row?.start_month ?? month,
      endMonth: row?.end_month ?? '',
      categoryId: row?.category_id ?? '',
    },
  });
  const [invalid, setInvalid] = useState(false),
    [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  const disabled = busy || isSubmitting;
  const fields = [
    { name: 'amount', label: vi.budgetAmount },
    { name: 'warnPercent', label: vi.budgetWarnPercent },
    { name: 'startMonth', label: vi.budgetStart },
    { name: 'endMonth', label: vi.budgetEnd },
  ] as const;
  return (
    <Screen title={row ? vi.editBudget : vi.addBudget}>
      <Button contentStyle={styles.button} disabled={disabled} onPress={onBack}>
        {vi.back}
      </Button>
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <List.Accordion
            title={vi.transactionCategory}
            description={
              categories.find((c) => c.id === field.value)?.name ??
              vi.budgetOverall
            }
            descriptionNumberOfLines={0}
            expanded={expanded}
            onPress={() => {
              if (!disabled) setExpanded((current) => !current);
            }}
          >
            <RadioButton.Group
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                setExpanded(false);
              }}
            >
              <RadioButton.Item
                value=""
                label={vi.budgetOverall}
                disabled={disabled}
                style={{ minHeight: 48 }}
              />
              {categories
                .filter(
                  (c) =>
                    c.kind === 'expense' &&
                    (!c.is_archived || c.id === row?.category_id),
                )
                .map((c) => (
                  <RadioButton.Item
                    key={c.id}
                    value={c.id}
                    disabled={disabled}
                    style={{ minHeight: 48 }}
                    label={`${c.parent_id ? `${categories.find((p) => p.id === c.parent_id)?.name ?? ''} › ` : ''}${c.name}${c.is_archived ? ` · ${vi.transactionArchivedReference}` : ''}`}
                  />
                ))}
            </RadioButton.Group>
          </List.Accordion>
        )}
      />
      {fields.map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label={item.label}
              accessibilityLabel={item.label}
              value={field.value}
              onBlur={field.onBlur}
              disabled={disabled}
              keyboardType={
                item.name === 'amount' || item.name === 'warnPercent'
                  ? 'number-pad'
                  : 'numbers-and-punctuation'
              }
              onChangeText={(value) =>
                field.onChange(
                  item.name === 'amount'
                    ? formatAmountInput(value, field.value)
                    : value,
                )
              }
            />
          )}
        />
      ))}
      {(invalid || !!error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {invalid ? vi.budgetInvalid : error}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={disabled}
        loading={disabled}
        onPress={() => {
          void handleSubmit(async (values) => {
            let input: BudgetInput;
            try {
              if (!/^\d+$/.test(values.warnPercent))
                throw new Error('INVALID_PERCENT');
              input = BudgetInputSchema.parse({
                amount: parseAmountInput(values.amount),
                warnPercent: Number(values.warnPercent),
                startMonth: values.startMonth,
                endMonth: values.endMonth || null,
                categoryId: values.categoryId || null,
              });
            } catch {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            await onSave(input);
          })();
        }}
      >
        {vi.saveBudget}
      </Button>
    </Screen>
  );
}
