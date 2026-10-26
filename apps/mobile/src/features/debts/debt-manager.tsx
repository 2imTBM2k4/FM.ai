import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import { formatVnd, today } from '@pfm/domain';
import {
  DebtChangesSchema,
  DebtInputSchema,
  DebtRepaymentSchema,
  type DebtChanges,
  type DebtInput,
  type DebtRepayment,
} from '@pfm/contracts';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, BackHandler, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  List,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import {
  createDebt,
  listDebts,
  repayDebt,
  updateDebt,
  type DebtRow,
} from '@/data/debts';
import { listWallets, type WalletRow } from '@/data/repository';
import {
  deleteTransaction,
  listTransactions,
  undoDeleteTransaction,
  updateTransaction,
  type TransactionRow,
} from '@/data/transactions';
import type { Database } from '@/data/migrate';
import { TransactionForm } from '@/features/transactions/transaction-manager';
import {
  formatAmountInput,
  isFutureDate,
  parseAmountInput,
} from '@/features/transactions/form';
import {
  requestRecurringNotifications,
  useRecurringStatus,
} from '@/features/recurring/mobile';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';
import { DEBT_KIND_LABELS } from './labels';

type Submission =
  | { type: 'create'; value: DebtInput }
  | { type: 'metadata'; value: DebtChanges }
  | { type: 'repay'; value: DebtRepayment };
export function DebtManager({ onClose }: { onClose(): void }) {
  const [rows, setRows] = useState<DebtRow[]>([]),
    [wallets, setWallets] = useState<WalletRow[]>([]),
    [history, setHistory] = useState<TransactionRow[]>([]);
  const [selected, setSelected] = useState<DebtRow | null>(null),
    [editing, setEditing] = useState<
      Submission['type'] | TransactionRow | null
    >(null);
  const [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [closed, setClosed] = useState(false),
    [undo, setUndo] = useState<TransactionRow | null>(null);
  const working = useRef(false),
    focused = useRef(false),
    request = useRef(0),
    ids = useRef({ debt: '', transaction: '' });
  const { colors } = useTheme();
  const status = useRecurringStatus();
  const selectedId = selected?.id;
  const load = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    try {
      const next = await withDatabase(async (db) => ({
        debts: await listDebts(db),
        wallets: await listWallets(db, true),
        history: selectedId
          ? await listTransactions(db, undefined, { debtId: selectedId })
          : [],
      }));
      if (token !== request.current) return;
      setRows(next.debts);
      setWallets(next.wallets);
      setHistory(next.history);
      setMore(next.history.length === 50);
      if (selectedId)
        setSelected(next.debts.find((row) => row.id === selectedId) ?? null);
    } catch {
      if (token === request.current) setError(vi.debtLoadError);
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [selectedId]);
  async function loadMore() {
    const token = request.current;
    if (working.current || loading || !selectedId || !history.length) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await withDatabase((db) =>
        listTransactions(db, history.at(-1), { debtId: selectedId }),
      );
      if (token !== request.current) return;
      setHistory((current) => [
        ...current,
        ...page.filter((row) => !current.some((old) => old.id === row.id)),
      ]);
      setMore(page.length === 50);
    } catch {
      setError(vi.debtLoadError);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
        request.current++;
        setUndo(null);
      };
    }, [load]),
  );
  const back = useCallback(() => {
    if (working.current) return;
    setError('');
    setUndo(null);
    if (editing) setEditing(null);
    else if (selected) setSelected(null);
    else onClose();
  }, [editing, selected, onClose]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => listener.remove();
    }, [back]),
  );
  async function mutate(
    action: (db: Database) => Promise<TransactionRow | void>,
  ) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    let committed = false;
    try {
      const deleted = await withDatabase(async (db) => {
        const result = await action(db);
        committed = true;
        return result;
      });
      setUndo(focused.current ? (deleted ?? null) : null);
      setEditing(null);
      await useApp.getState().refreshRecurring(true);
      await load();
    } catch (failure) {
      setError(
        committed
          ? vi.walletSavedRefreshFailed
          : failure instanceof Error && failure.message.startsWith('DEBT_')
            ? vi.debtInvalidBalance
            : failure instanceof Error && failure.message.startsWith('WALLET_')
              ? vi.transactionReferencesInvalid
              : vi.saveError,
      );
      if (committed) setEditing(null);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (editing && typeof editing === 'object')
    return (
      <TransactionForm
        row={editing}
        wallets={wallets}
        categories={[]}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            updateTransaction(
              db,
              editing.id,
              input,
              new Date().toISOString(),
              editing.updated_at,
            ),
          )
        }
      />
    );
  if (typeof editing === 'string')
    return (
      <DebtForm
        key={editing}
        mode={editing}
        debt={selected}
        wallets={wallets}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(submission) =>
          mutate((db) => {
            const timestamp = new Date().toISOString();
            if (submission.type === 'create')
              return createDebt(
                db,
                ids.current.debt,
                ids.current.transaction,
                submission.value,
                timestamp,
              );
            if (!selected) throw new Error('DEBT_NOT_FOUND');
            return submission.type === 'metadata'
              ? updateDebt(db, selected.id, submission.value, timestamp)
              : repayDebt(
                  db,
                  selected.id,
                  ids.current.transaction,
                  submission.value,
                  timestamp,
                );
          })
        }
      />
    );
  return (
    <Screen title={selected ? selected.counterparty_label : vi.debtsTitle}>
      <Button contentStyle={styles.button} disabled={busy} onPress={back}>
        {vi.back}
      </Button>
      {loading && <ActivityIndicator />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      )}
      <Button
        contentStyle={styles.button}
        disabled={loading || busy}
        onPress={() => {
          setError('');
          void load();
        }}
      >
        {vi.refresh}
      </Button>
      {undo && (
        <Button
          contentStyle={styles.button}
          disabled={busy || loading}
          onPress={() => void mutate((db) => undoDeleteTransaction(db, undo))}
        >
          {vi.transactionUndo}
        </Button>
      )}
      {selected ? (
        <>
          <Text>
            {selected.direction === 'borrowed' ? vi.debtBorrowed : vi.debtLent}
          </Text>
          <Text variant="titleLarge">
            {vi.debtOutstanding}: {formatVnd(selected.outstanding)}
          </Text>
          <Text>
            {vi.debtPrincipal}: {formatVnd(selected.principal)} ·{' '}
            {vi.debtRepaid}: {formatVnd(selected.repaid)}
          </Text>
          <Text>
            {selected.status === 'closed' ? vi.debtClosed : vi.debtOpen}
          </Text>
          {selected.due_on && (
            <Text>
              {vi.debtDue}: {selected.due_on}
            </Text>
          )}
          {!!selected.note && <Text>{selected.note}</Text>}
          <View style={styles.row}>
            <Button
              contentStyle={styles.button}
              disabled={busy || loading}
              onPress={() => {
                setError('');
                setEditing('metadata');
              }}
            >
              {vi.debtEdit}
            </Button>
            <Button
              mode="contained"
              contentStyle={styles.button}
              disabled={busy || loading || selected.outstanding <= 0}
              onPress={() => {
                ids.current.transaction = uuid.v4();
                setError('');
                setEditing('repay');
              }}
            >
              {selected.direction === 'borrowed'
                ? vi.debtRepayPaid
                : vi.debtRepayReceived}
            </Button>
          </View>
          <Text accessibilityRole="header" variant="titleMedium">
            {vi.debtHistory}
          </Text>
          {history.map((row) => (
            <View
              key={row.id}
              style={[styles.panel, { backgroundColor: colors.surfaceVariant }]}
            >
              <Text>
                {row.occurred_on} · {DEBT_KIND_LABELS[row.kind]}
              </Text>
              <Text>
                {formatVnd(row.amount)} ·{' '}
                {wallets.find((wallet) => wallet.id === row.wallet_id)?.name}
              </Text>
              {!!row.note && <Text>{row.note}</Text>}
              <View style={styles.row}>
                <Button
                  disabled={busy || loading}
                  contentStyle={styles.button}
                  onPress={() => {
                    setError('');
                    setEditing(row);
                  }}
                >
                  {vi.editTransaction}
                </Button>
                <Button
                  disabled={busy || loading}
                  contentStyle={styles.button}
                  onPress={() =>
                    Alert.alert(
                      vi.deleteTransaction,
                      vi.transactionDeleteConfirm,
                      [
                        { text: vi.cancel, style: 'cancel' },
                        {
                          text: vi.deleteTransaction,
                          style: 'destructive',
                          onPress: () =>
                            void mutate((db) =>
                              deleteTransaction(db, row.id, row.updated_at),
                            ),
                        },
                      ],
                    )
                  }
                >
                  {vi.deleteTransaction}
                </Button>
              </View>
            </View>
          ))}
          {more && (
            <Button
              disabled={busy || loading}
              contentStyle={styles.button}
              onPress={() => void loadMore()}
            >
              {vi.transactionMore}
            </Button>
          )}
        </>
      ) : (
        <>
          <Text>{vi.debtDescription}</Text>
          <Button
            mode="contained"
            disabled={
              busy || loading || !wallets.some((wallet) => !wallet.is_archived)
            }
            contentStyle={styles.button}
            onPress={() => {
              ids.current = { debt: uuid.v4(), transaction: uuid.v4() };
              setError('');
              setEditing('create');
            }}
          >
            {vi.debtAdd}
          </Button>
          <Button
            disabled={busy}
            contentStyle={styles.button}
            onPress={() => setClosed(!closed)}
          >
            {closed ? vi.debtShowOpen : vi.debtShowClosed}
          </Button>
          <Text>{vi.debtReminderHint}</Text>
          <Button
            disabled={busy || loading}
            contentStyle={styles.button}
            onPress={async () => {
              if (working.current) return;
              working.current = true;
              setBusy(true);
              try {
                await requestRecurringNotifications();
              } finally {
                working.current = false;
                setBusy(false);
              }
            }}
          >
            {vi.recurringEnableNotifications}
          </Button>
          {status.permission === 'denied' && (
            <Text>{vi.recurringNotificationDenied}</Text>
          )}
          {status.error && (
            <Text accessibilityRole="alert" style={{ color: colors.error }}>
              {vi.debtNotificationError}
            </Text>
          )}
          {!loading &&
            !rows.some((row) => (row.status === 'closed') === closed) && (
              <Text>{vi.debtEmpty}</Text>
            )}
          {rows
            .filter((row) => (row.status === 'closed') === closed)
            .map((row) => (
              <View
                key={row.id}
                style={[
                  styles.panel,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text variant="titleMedium">{row.counterparty_label}</Text>
                <Text>
                  {row.direction === 'borrowed' ? vi.debtBorrowed : vi.debtLent}
                </Text>
                <Text>
                  {vi.debtOutstanding}: {formatVnd(row.outstanding)}
                </Text>
                {row.due_on && (
                  <Text>
                    {vi.debtDue}: {row.due_on}
                  </Text>
                )}
                <Button
                  disabled={busy || loading}
                  contentStyle={styles.button}
                  onPress={() => {
                    setError('');
                    setUndo(null);
                    setSelected(row);
                  }}
                >
                  {vi.debtDetails}
                </Button>
              </View>
            ))}
        </>
      )}
    </Screen>
  );
}

interface Fields {
  name: string;
  direction: 'borrowed' | 'lent';
  amount: string;
  wallet: string;
  date: string;
  due: string;
  note: string;
}
function DebtForm({
  mode,
  debt,
  wallets,
  busy,
  error,
  onBack,
  onSave,
}: {
  mode: Submission['type'];
  debt: DebtRow | null;
  wallets: WalletRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(submission: Submission): Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      name: debt?.counterparty_label ?? '',
      direction: debt?.direction ?? 'borrowed',
      amount: '',
      wallet: wallets.find((wallet) => !wallet.is_archived)?.id ?? '',
      date: today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' }),
      due: debt?.due_on ?? '',
      note: mode === 'metadata' ? (debt?.note ?? '') : '',
    },
  });
  const [invalid, setInvalid] = useState(false),
    [expanded, setExpanded] = useState(false);
  const date = useWatch({ control, name: 'date' });
  const disabled = busy || isSubmitting,
    { colors } = useTheme();
  let future = false;
  try {
    future = isFutureDate(date, new Date());
  } catch {
    /* Partial date. */
  }
  const fields = [
    ...(mode !== 'repay'
      ? [
          { name: 'name' as const, label: vi.debtCounterparty },
          { name: 'due' as const, label: vi.debtDueInput },
        ]
      : []),
    ...(mode !== 'metadata'
      ? [
          { name: 'amount' as const, label: vi.transactionAmount },
          { name: 'date' as const, label: vi.transactionDate },
        ]
      : []),
    { name: 'note' as const, label: vi.transactionNote },
  ];
  return (
    <Screen
      title={
        mode === 'create'
          ? vi.debtAdd
          : mode === 'metadata'
            ? vi.debtEdit
            : vi.debtRepayment
      }
    >
      <Button disabled={disabled} contentStyle={styles.button} onPress={onBack}>
        {vi.back}
      </Button>
      {debt && (
        <Text>
          {debt.counterparty_label} · {vi.debtOutstanding}:{' '}
          {formatVnd(debt.outstanding)}
        </Text>
      )}
      {mode === 'create' && (
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <RadioButton.Group
              value={field.value}
              onValueChange={field.onChange}
            >
              <RadioButton.Item
                value="borrowed"
                label={vi.debtBorrowed}
                disabled={disabled}
              />
              <RadioButton.Item
                value="lent"
                label={vi.debtLent}
                disabled={disabled}
              />
            </RadioButton.Group>
          )}
        />
      )}
      {mode !== 'metadata' && (
        <Controller
          control={control}
          name="wallet"
          render={({ field }) => (
            <List.Accordion
              title={vi.transactionWallet}
              description={
                wallets.find((wallet) => wallet.id === field.value)?.name ??
                vi.noWallet
              }
              expanded={expanded}
              onPress={() => setExpanded(!expanded)}
            >
              <RadioButton.Group
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setExpanded(false);
                }}
              >
                {wallets
                  .filter((wallet) => !wallet.is_archived)
                  .map((wallet) => (
                    <RadioButton.Item
                      key={wallet.id}
                      value={wallet.id}
                      label={wallet.name}
                      disabled={disabled}
                    />
                  ))}
              </RadioButton.Group>
            </List.Accordion>
          )}
        />
      )}
      {fields.map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label={item.label}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              keyboardType={item.name === 'amount' ? 'number-pad' : 'default'}
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
      {future && mode !== 'metadata' && (
        <Text accessibilityRole="alert">{vi.transactionFutureWarning}</Text>
      )}
      {(invalid || error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error || vi.debtFormInvalid}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={disabled}
        loading={disabled}
        onPress={() =>
          void handleSubmit(async (fields) => {
            let submission: Submission;
            try {
              if (mode === 'metadata')
                submission = {
                  type: 'metadata',
                  value: DebtChangesSchema.parse({
                    counterpartyLabel: fields.name,
                    dueOn: fields.due.trim() || null,
                    note: fields.note,
                  }),
                };
              else if (mode === 'repay')
                submission = {
                  type: 'repay',
                  value: DebtRepaymentSchema.parse({
                    amount: parseAmountInput(fields.amount),
                    walletId: fields.wallet,
                    occurredOn: fields.date.trim(),
                    note: fields.note,
                  }),
                };
              else
                submission = {
                  type: 'create',
                  value: DebtInputSchema.parse({
                    counterpartyLabel: fields.name,
                    direction: fields.direction,
                    amount: parseAmountInput(fields.amount),
                    walletId: fields.wallet,
                    occurredOn: fields.date.trim(),
                    dueOn: fields.due.trim() || null,
                    note: fields.note,
                  }),
                };
            } catch {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            await onSave(submission);
          })()
        }
      >
        {vi.debtSave}
      </Button>
    </Screen>
  );
}
