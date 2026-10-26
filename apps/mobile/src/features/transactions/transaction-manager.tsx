import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import { formatVnd, today, validateDate } from '@pfm/domain';
import type { TransactionInput, TransactionFilters } from '@pfm/contracts';
import { TransactionFilterForm } from './transaction-filters';
import { DEBT_KIND_LABELS } from '@/features/debts/labels';
import { memo, useCallback, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  List,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import type { Database } from '@/data/migrate';
import { listCategories, type CategoryRow } from '@/data/categories';
import { listWallets, type WalletRow } from '@/data/repository';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  undoDeleteTransaction,
  listTransactions,
  type TransactionRow,
} from '@/data/transactions';
import { useApp } from '@/state/app';
import { vi } from '@/messages/vi';
import {
  formatAmountInput,
  parseAmountInput,
  manualOccurredAt,
  isFutureDate,
} from './form';

const KINDS = [
  { value: 'expense', label: vi.transactionExpense },
  { value: 'income', label: vi.transactionIncome },
  { value: 'transfer', label: vi.transactionTransfer },
] as const;
type Mode =
  | { type: 'list' }
  | { type: 'filters' }
  | { type: 'form'; row: TransactionRow | null; id: string }
  | { type: 'delete'; row: TransactionRow };

export function TransactionManager({
  onManageRecurring,
  onManageDebts,
}: {
  onManageRecurring(): void;
  onManageDebts(): void;
}) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const filtersRef = useRef<TransactionFilters>({});
  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== '',
  );
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<TransactionRow | null>(null);
  const working = useRef(false);
  const focused = useRef(false);
  const { colors } = useTheme();
  const recurringVersion = useApp((state) => state.recurringVersion);
  const load = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await withDatabase(async (db) => ({
        rows: await listTransactions(db, undefined, filtersRef.current),
        wallets: await listWallets(db, true),
        categories: await listCategories(db, true),
      }));
      setRows(data.rows);
      setMore(data.rows.length === 50);
      setWallets(data.wallets);
      setCategories(data.categories);
      useApp.setState({ wallets: data.wallets.filter((w) => !w.is_archived) });
    } catch {
      setError(vi.transactionsLoadError);
    } finally {
      working.current = false;
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
        setUndo(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Automatic entries refresh this focused list.
    }, [load, recurringVersion]),
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
  const mutate = async (
    action: (db: Database) => Promise<TransactionRow | void>,
    undoing = false,
  ) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    let committed = false;
    try {
      const data = await withDatabase(async (db) => {
        const deleted = await action(db);
        committed = true;
        setUndo(focused.current ? (deleted ?? null) : null);
        return {
          rows: await listTransactions(db, undefined, filtersRef.current),
          wallets: await listWallets(db, true),
        };
      });
      setRows(data.rows);
      setMore(data.rows.length === 50);
      setWallets(data.wallets);
      useApp.setState({ wallets: data.wallets.filter((w) => !w.is_archived) });
      setMode({ type: 'list' });
      setNotice(vi.transactionSaved);
      void useApp.getState().refreshRecurring(true);
    } catch (failure) {
      if (committed) {
        setMode({ type: 'list' });
        setError(vi.walletSavedRefreshFailed);
      } else if (
        failure instanceof Error &&
        failure.message === 'TRANSACTION_CHANGED'
      )
        setError(vi.transactionChanged);
      else
        setError(
          failure instanceof Error && failure.message.startsWith('DEBT_')
            ? vi.debtInvalidBalance
            : undoing
              ? vi.transactionUndoFailed
              : failure instanceof Error &&
                  /^(WALLET_|CATEGORY_)/.test(failure.message)
                ? vi.transactionReferencesInvalid
                : vi.saveError,
        );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const loadMore = async () => {
    if (working.current || !rows.length) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await withDatabase((db) =>
        listTransactions(db, rows.at(-1), filtersRef.current),
      );
      setRows((current) => [
        ...current,
        ...page.filter(
          (row) => !current.some((existing) => existing.id === row.id),
        ),
      ]);
      setMore(page.length === 50);
    } catch {
      setError(vi.transactionsLoadError);
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const edit = useCallback((row: TransactionRow) => {
    setMode({ type: 'form', row, id: row.id });
    setError('');
    setNotice('');
  }, []);
  const remove = useCallback((row: TransactionRow) => {
    setMode({ type: 'delete', row });
    setError('');
    setNotice('');
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: TransactionRow }) => (
      <TransactionItem
        row={item}
        wallets={wallets}
        categories={categories}
        busy={busy || loading}
        onEdit={edit}
        onDelete={remove}
      />
    ),
    [wallets, categories, busy, loading, edit, remove],
  );

  if (mode.type === 'filters')
    return (
      <TransactionFilterForm
        filters={filters}
        wallets={wallets}
        categories={categories}
        busy={busy || loading}
        onBack={back}
        onApply={(next) => {
          filtersRef.current = next;
          setFilters(next);
          setMode({ type: 'list' });
          void load();
        }}
      />
    );
  if (mode.type === 'form')
    return (
      <TransactionForm
        row={mode.row}
        wallets={wallets}
        categories={categories}
        busy={busy || loading}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            mode.row
              ? updateTransaction(
                  db,
                  mode.id,
                  input,
                  new Date().toISOString(),
                  mode.row.updated_at,
                )
              : createTransaction(db, mode.id, input, new Date().toISOString()),
          )
        }
      />
    );
  if (mode.type === 'delete')
    return (
      <Screen title={vi.deleteTransaction}>
        <Text>{vi.transactionDeleteConfirm}</Text>
        <Text>
          {formatVnd(mode.row.amount)} · {mode.row.occurred_on}
        </Text>
        <Text>{mode.row.note}</Text>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </Text>
        )}
        <Button
          mode="contained"
          contentStyle={styles.button}
          disabled={busy}
          loading={busy}
          onPress={() => {
            void mutate((db) =>
              deleteTransaction(db, mode.row.id, mode.row.updated_at),
            );
          }}
        >
          {vi.deleteTransaction}
        </Button>
        <Button contentStyle={styles.button} disabled={busy} onPress={back}>
          {vi.cancel}
        </Button>
      </Screen>
    );
  return (
    <Screen title={vi.transactions} scroll={false}>
      <Button
        disabled={busy || loading}
        contentStyle={styles.button}
        onPress={onManageDebts}
      >
        {vi.debtsTitle}
      </Button>
      <Button
        disabled={busy || loading}
        contentStyle={styles.button}
        onPress={onManageRecurring}
      >
        {vi.recurringTitle}
      </Button>
      <Button
        contentStyle={styles.button}
        disabled={busy || loading}
        onPress={() => setMode({ type: 'filters' })}
      >
        {vi.transactionFilters}
      </Button>
      {hasFilters && <Text>{vi.filterActive}</Text>}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={loading || busy || !wallets.some((w) => !w.is_archived)}
        onPress={() => {
          setMode({ type: 'form', row: null, id: uuid.v4() });
          setError('');
          setNotice('');
        }}
      >
        {vi.addTransaction}
      </Button>
      {!loading && !wallets.some((w) => !w.is_archived) && (
        <Text>{vi.noWallet}</Text>
      )}
      {!!notice && !undo && (
        <Text accessibilityLiveRegion="polite">{notice}</Text>
      )}
      {undo && (
        <View>
          <Text accessibilityLiveRegion="polite">{vi.transactionDeleted}</Text>
          <Text>{vi.transactionUndoDescription}</Text>
          <Button
            contentStyle={styles.button}
            disabled={busy || loading}
            onPress={() => {
              void mutate((db) => undoDeleteTransaction(db, undo), true);
            }}
          >
            {vi.transactionUndo}
          </Button>
        </View>
      )}
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </Text>
          <Button disabled={busy || loading} onPress={load}>
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
          ListEmptyComponent={
            <Text>{hasFilters ? vi.filterEmpty : vi.transactionsEmpty}</Text>
          }
          ListFooterComponent={
            more ? (
              <Button
                contentStyle={styles.button}
                disabled={busy}
                loading={busy}
                onPress={loadMore}
              >
                {vi.transactionMore}
              </Button>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const TransactionItem = memo(function TransactionItem({
  row,
  wallets,
  categories,
  busy,
  onEdit,
  onDelete,
}: {
  row: TransactionRow;
  wallets: WalletRow[];
  categories: CategoryRow[];
  busy: boolean;
  onEdit(row: TransactionRow): void;
  onDelete(row: TransactionRow): void;
}) {
  const { colors } = useTheme();
  const category = categories.find((c) => c.id === row.category_id);
  const parent = categories.find((c) => c.id === category?.parent_id);
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <Text variant="titleMedium">
          {KINDS.find((kind) => kind.value === row.kind)?.label ??
            DEBT_KIND_LABELS[row.kind] ??
            vi.transactionPendingKind}
        </Text>
        <Text variant="titleMedium" style={styles.number}>
          {row.kind === 'expense' ? '−' : row.kind === 'income' ? '+' : ''}
          {formatVnd(row.amount)}
        </Text>
      </View>
      <Text>
        {row.occurred_on} · {wallets.find((w) => w.id === row.wallet_id)?.name}
        {row.to_wallet_id
          ? ` → ${wallets.find((w) => w.id === row.to_wallet_id)?.name ?? ''}`
          : ''}
      </Text>
      {row.kind !== 'transfer' && !row.debt_id && (
        <Text>
          {category
            ? `${parent ? `${parent.name} › ` : ''}${category.name}`
            : vi.transactionUncategorized}
        </Text>
      )}
      {!!row.note && <Text>{row.note}</Text>}
      {!!row.recurring_rule_id && <Text>{vi.recurringEntry}</Text>}
      {
        <View style={styles.row}>
          <Button
            contentStyle={styles.button}
            disabled={busy}
            onPress={() => onEdit(row)}
          >
            {vi.editTransaction}
          </Button>
          <Button
            contentStyle={styles.button}
            disabled={busy}
            onPress={() => onDelete(row)}
          >
            {vi.deleteTransaction}
          </Button>
        </View>
      }
    </View>
  );
});

interface Fields {
  kind: 'expense' | 'income' | 'transfer';
  amount: string;
  walletId: string;
  toWalletId: string;
  categoryId: string;
  date: string;
  note: string;
}

export function TransactionForm({
  row,
  wallets,
  categories,
  busy,
  error,
  onBack,
  onSave,
}: {
  row: TransactionRow | null;
  wallets: WalletRow[];
  categories: CategoryRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(input: TransactionInput): Promise<void>;
}) {
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const {
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      kind:
        row?.kind === 'income' || row?.kind === 'transfer'
          ? row.kind
          : 'expense',
      amount: row ? formatAmountInput(String(row.amount)) : '',
      walletId: row?.wallet_id ?? wallets.find((w) => !w.is_archived)?.id ?? '',
      toWalletId: row?.to_wallet_id ?? '',
      categoryId: row?.category_id ?? '',
      date:
        row?.occurred_on ??
        today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' }),
      note: row?.note ?? '',
    },
  });
  const kind = useWatch({ control, name: 'kind' }),
    walletId = useWatch({ control, name: 'walletId' }),
    date = useWatch({ control, name: 'date' });
  const disabled = busy || isSubmitting;
  const { colors } = useTheme();
  let future = false;
  try {
    future = isFutureDate(date, new Date());
  } catch {
    /* Partial dates are validated on save. */
  }
  const availableCategories = categories.filter(
    (c) =>
      c.kind === kind &&
      (!c.is_archived || (c.id === row?.category_id && kind === row.kind)),
  );
  return (
    <Screen title={row ? vi.editTransaction : vi.addTransaction}>
      <Button contentStyle={styles.button} disabled={disabled} onPress={onBack}>
        {vi.back}
      </Button>
      <Controller
        control={control}
        name="amount"
        rules={{
          validate: (value) => {
            try {
              parseAmountInput(value);
              return true;
            } catch {
              return vi.transactionAmountInvalid;
            }
          },
        }}
        render={({ field, fieldState }) => (
          <View>
            <TextInput
              mode="outlined"
              label={vi.transactionAmount}
              accessibilityLabel={vi.transactionAmount}
              keyboardType="number-pad"
              value={field.value}
              onChangeText={(value) =>
                field.onChange(formatAmountInput(value, field.value))
              }
              onBlur={field.onBlur}
              disabled={disabled}
              error={!!fieldState.error}
              maxLength={20}
            />
            {!!fieldState.error && (
              <HelperText type="error">{fieldState.error.message}</HelperText>
            )}
          </View>
        )}
      />
      {!row?.debt_id && (
        <Text accessibilityRole="header" variant="titleMedium">
          {vi.transactionKind}
        </Text>
      )}
      {!row?.debt_id && (
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <RadioButton.Group
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                setValue('categoryId', '');
                setValue('toWalletId', '');
                setCategoryExpanded(false);
              }}
            >
              {KINDS.map((item) => (
                <RadioButton.Item
                  key={item.value}
                  value={item.value}
                  label={item.label}
                  disabled={disabled}
                  style={{ minHeight: 48 }}
                />
              ))}
            </RadioButton.Group>
          )}
        />
      )}
      <Text accessibilityRole="header" variant="titleMedium">
        {kind === 'transfer'
          ? vi.transactionSourceWallet
          : vi.transactionWallet}
      </Text>
      <Controller
        control={control}
        name="walletId"
        rules={{ required: vi.transactionWalletRequired }}
        render={({ field, fieldState }) => (
          <View>
            <RadioButton.Group
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                setValue('toWalletId', '');
              }}
            >
              {wallets
                .filter((w) => !w.is_archived || w.id === row?.wallet_id)
                .map((w) => (
                  <RadioButton.Item
                    key={w.id}
                    value={w.id}
                    label={`${w.name}${w.is_archived ? ` · ${vi.transactionArchivedReference}` : ''}`}
                    disabled={disabled}
                    style={{ minHeight: 48 }}
                  />
                ))}
            </RadioButton.Group>
            {!!fieldState.error && (
              <HelperText type="error">{fieldState.error.message}</HelperText>
            )}
          </View>
        )}
      />
      {row?.debt_id ? (
        <Text>{DEBT_KIND_LABELS[row.kind]}</Text>
      ) : kind === 'transfer' ? (
        <>
          <Text accessibilityRole="header" variant="titleMedium">
            {vi.transactionDestination}
          </Text>
          <Controller
            control={control}
            name="toWalletId"
            shouldUnregister
            rules={{
              validate: (value) =>
                kind !== 'transfer' ||
                (!!value && value !== walletId) ||
                vi.transactionWalletRequired,
            }}
            render={({ field, fieldState }) => (
              <View>
                <RadioButton.Group
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  {wallets
                    .filter(
                      (w) =>
                        w.id !== walletId &&
                        (!w.is_archived || w.id === row?.to_wallet_id),
                    )
                    .map((w) => (
                      <RadioButton.Item
                        key={w.id}
                        value={w.id}
                        label={`${w.name}${w.is_archived ? ` · ${vi.transactionArchivedReference}` : ''}`}
                        disabled={disabled}
                        style={{ minHeight: 48 }}
                      />
                    ))}
                </RadioButton.Group>
                {!!fieldState.error && (
                  <HelperText type="error">
                    {fieldState.error.message}
                  </HelperText>
                )}
              </View>
            )}
          />
        </>
      ) : (
        <>
          <Text accessibilityRole="header" variant="titleMedium">
            {vi.transactionCategory}
          </Text>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <List.Accordion
                title={
                  availableCategories.find(
                    (category) => category.id === field.value,
                  )?.name ?? vi.transactionUncategorized
                }
                titleNumberOfLines={0}
                expanded={categoryExpanded}
                onPress={() => {
                  if (!disabled) setCategoryExpanded((current) => !current);
                }}
              >
                <RadioButton.Group
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setCategoryExpanded(false);
                  }}
                >
                  <RadioButton.Item
                    value=""
                    label={vi.transactionUncategorized}
                    disabled={disabled}
                    style={{ minHeight: 48 }}
                  />
                  {availableCategories.map((c) => (
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
        </>
      )}
      <Controller
        control={control}
        name="date"
        rules={{
          validate: (value) => {
            try {
              validateDate(value);
              return true;
            } catch {
              return vi.transactionDateInvalid;
            }
          },
        }}
        render={({ field, fieldState }) => (
          <View>
            <TextInput
              mode="outlined"
              label={vi.transactionDate}
              accessibilityLabel={vi.transactionDate}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              error={!!fieldState.error}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {!!fieldState.error && (
              <HelperText type="error">{fieldState.error.message}</HelperText>
            )}
          </View>
        )}
      />
      {future && (
        <Text accessibilityRole="alert">{vi.transactionFutureWarning}</Text>
      )}
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label={vi.transactionNote}
            accessibilityLabel={vi.transactionNote}
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
          />
        )}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={disabled}
        loading={disabled}
        onPress={() => {
          void handleSubmit((values) =>
            onSave({
              kind: row?.debt_id ? row.kind : values.kind,
              debtId: row?.debt_id ?? null,
              amount: parseAmountInput(values.amount),
              walletId: values.walletId,
              toWalletId: values.kind === 'transfer' ? values.toWalletId : null,
              categoryId:
                row?.debt_id || values.kind === 'transfer'
                  ? null
                  : values.categoryId || null,
              occurredOn: values.date,
              occurredAt:
                row && values.date === row.occurred_on
                  ? row.occurred_at
                  : manualOccurredAt(values.date, new Date()),
              note: values.note,
            }),
          )();
        }}
      >
        {vi.saveTransaction}
      </Button>
    </Screen>
  );
}
