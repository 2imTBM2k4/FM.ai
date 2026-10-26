import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import { formatVnd, today } from '@pfm/domain';
import { RecurringInputSchema, type RecurringInput } from '@pfm/contracts';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, View } from 'react-native';
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
  listRecurringRules,
  saveRecurringRule,
  setRecurringActive,
  type RecurringRow,
} from '@/data/recurring';
import { listWallets, type WalletRow } from '@/data/repository';
import { listCategories, type CategoryRow } from '@/data/categories';
import type { Database } from '@/data/migrate';
import {
  formatAmountInput,
  parseAmountInput,
} from '@/features/transactions/form';
import { useApp } from '@/state/app';
import { vi } from '@/messages/vi';
import { requestRecurringNotifications, useRecurringStatus } from './mobile';

const FREQUENCIES = [
  { value: 'daily', label: vi.recurringDaily },
  { value: 'weekly', label: vi.recurringWeekly },
  { value: 'monthly', label: vi.recurringMonthly },
  { value: 'yearly', label: vi.recurringYearly },
] as const;
const KINDS = [
  { value: 'expense', label: vi.transactionExpense },
  { value: 'income', label: vi.transactionIncome },
  { value: 'transfer', label: vi.transactionTransfer },
] as const;
const localDate = () =>
  today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' });

export function RecurringManager({ onClose }: { onClose(): void }) {
  const [rows, setRows] = useState<RecurringRow[]>([]),
    [wallets, setWallets] = useState<WalletRow[]>([]),
    [categories, setCategories] = useState<CategoryRow[]>([]);
  const [editing, setEditing] = useState<RecurringRow | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const working = useRef(false),
    newId = useRef('');
  const { colors } = useTheme();
  const status = useRecurringStatus();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await withDatabase(async (db) => ({
        rows: await listRecurringRules(db),
        wallets: await listWallets(db, true),
        categories: await listCategories(db, true),
      }));
      setRows(next.rows);
      setWallets(next.wallets);
      setCategories(next.categories);
      setError('');
    } catch {
      setError(vi.recurringLoadError);
    } finally {
      setLoading(false);
    }
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    await useApp.getState().refreshRecurring();
    await load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const back = useCallback(() => {
    if (working.current) return;
    setError('');
    if (editing !== undefined) setEditing(undefined);
    else onClose();
  }, [editing, onClose]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => listener.remove();
    }, [back]),
  );
  async function mutate(action: (db: Database) => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    let committed = false;
    try {
      await withDatabase(async (db) => {
        await action(db);
        committed = true;
      });
      setEditing(undefined);
      await useApp.getState().refreshRecurring(true);
      await load();
    } catch {
      setError(committed ? vi.walletSavedRefreshFailed : vi.saveError);
      if (committed) setEditing(undefined);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (editing !== undefined)
    return (
      <RecurringForm
        key={editing?.id ?? 'new'}
        row={editing}
        wallets={wallets}
        categories={categories}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            saveRecurringRule(
              db,
              editing?.id ?? newId.current,
              input,
              new Date().toISOString(),
              !!editing,
            ),
          )
        }
      />
    );
  return (
    <Screen title={vi.recurringTitle}>
      <Button contentStyle={styles.button} disabled={busy} onPress={back}>
        {vi.back}
      </Button>
      <Text>{vi.recurringDescription}</Text>
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={busy || loading}
        onPress={() => {
          newId.current = uuid.v4();
          setError('');
          setEditing(null);
        }}
      >
        {vi.recurringAdd}
      </Button>
      <Text>{vi.recurringReminderHint}</Text>
      <Button
        contentStyle={styles.button}
        disabled={busy || loading}
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
      {status.permission === 'granted' && (
        <Text>{vi.recurringNotificationGranted}</Text>
      )}
      {status.hasMore && <Text>{vi.recurringMore}</Text>}
      {(error || status.error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error || vi.recurringRunError}
        </Text>
      )}
      <Button
        contentStyle={styles.button}
        disabled={busy || loading}
        onPress={() => void reload()}
      >
        {vi.refresh}
      </Button>
      {loading && <ActivityIndicator />}
      {!loading && !rows.length && <Text>{vi.recurringEmpty}</Text>}
      {rows.map((row) => (
        <View
          key={row.id}
          style={[styles.panel, { backgroundColor: colors.surfaceVariant }]}
        >
          <Text variant="titleMedium">
            {row.note || KINDS.find((kind) => kind.value === row.kind)?.label}
          </Text>
          <Text>
            {formatVnd(row.amount)} ·{' '}
            {wallets.find((wallet) => wallet.id === row.wallet_id)?.name}
            {row.to_wallet_id
              ? ` → ${wallets.find((wallet) => wallet.id === row.to_wallet_id)?.name ?? ''}`
              : ''}
          </Text>
          <Text>
            {FREQUENCIES.find((f) => f.value === row.frequency)?.label}
            {row.interval_count > 1
              ? ` · ${row.interval_count} ${vi.recurringLegacyInterval}`
              : ''}
          </Text>
          <Text>
            {row.start_on}
            {row.end_on ? ` → ${row.end_on}` : ''}
          </Text>
          <Text>
            {!row.is_active
              ? vi.recurringPaused
              : row.blocked
                ? vi.recurringBlocked
                : vi.recurringActive}
          </Text>
          <View style={styles.row}>
            <Button
              contentStyle={styles.button}
              disabled={busy || loading}
              onPress={() => {
                setError('');
                setEditing(row);
              }}
            >
              {vi.recurringEdit}
            </Button>
            <Button
              contentStyle={styles.button}
              disabled={busy || loading}
              onPress={() =>
                void mutate((db) =>
                  setRecurringActive(
                    db,
                    row.id,
                    !row.is_active,
                    localDate(),
                    new Date().toISOString(),
                  ),
                )
              }
            >
              {row.is_active ? vi.recurringPause : vi.recurringResume}
            </Button>
          </View>
        </View>
      ))}
    </Screen>
  );
}

interface Fields {
  kind: RecurringInput['kind'];
  amount: string;
  wallet: string;
  destination: string;
  category: string;
  note: string;
  start: string;
  end: string;
  frequency: RecurringInput['frequency'];
}
function RecurringForm({
  row,
  wallets,
  categories,
  busy,
  error,
  onBack,
  onSave,
}: {
  row: RecurringRow | null;
  wallets: WalletRow[];
  categories: CategoryRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(input: RecurringInput): Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      kind: row?.kind ?? 'expense',
      amount: row ? formatAmountInput(String(row.amount)) : '',
      wallet: row?.wallet_id ?? wallets.find((w) => !w.is_archived)?.id ?? '',
      destination: row?.to_wallet_id ?? '',
      category: row?.category_id ?? '',
      note: row?.note ?? '',
      start: row?.start_on ?? localDate(),
      end: row?.end_on ?? '',
      frequency: row?.frequency ?? 'monthly',
    },
  });
  const kind = useWatch({ control, name: 'kind' });
  const [invalid, setInvalid] = useState(false),
    [expanded, setExpanded] = useState('');
  const disabled = busy || isSubmitting;
  const { colors } = useTheme();
  const choices = [
    { name: 'kind', label: vi.transactionKind, items: KINDS },
    {
      name: 'wallet',
      label: vi.transactionWallet,
      items: wallets
        .filter((w) => !w.is_archived || w.id === row?.wallet_id)
        .map((w) => ({ value: w.id, label: w.name })),
    },
    ...(kind === 'transfer'
      ? [
          {
            name: 'destination' as const,
            label: vi.transactionDestination,
            items: wallets
              .filter((w) => !w.is_archived || w.id === row?.to_wallet_id)
              .map((w) => ({ value: w.id, label: w.name })),
          },
        ]
      : [
          {
            name: 'category' as const,
            label: vi.transactionCategory,
            items: [
              { value: '', label: vi.recurringUncategorized },
              ...categories
                .filter(
                  (c) =>
                    c.kind === kind &&
                    (!c.is_archived || c.id === row?.category_id),
                )
                .map((c) => ({
                  value: c.id,
                  label: `${c.parent_id ? `${categories.find((p) => p.id === c.parent_id)?.name ?? ''} / ` : ''}${c.name}`,
                })),
            ],
          },
        ]),
    { name: 'frequency', label: vi.recurringFrequency, items: FREQUENCIES },
  ] as const;
  return (
    <Screen title={row ? vi.recurringEdit : vi.recurringAdd}>
      <Button contentStyle={styles.button} disabled={disabled} onPress={onBack}>
        {vi.back}
      </Button>
      {choices.map((choice) => (
        <Controller
          key={choice.name}
          control={control}
          name={choice.name}
          render={({ field }) => (
            <List.Accordion
              title={choice.label}
              description={
                choice.items.find((item) => item.value === field.value)
                  ?.label ?? vi.recurringChoose
              }
              expanded={expanded === choice.name}
              onPress={() =>
                setExpanded(expanded === choice.name ? '' : choice.name)
              }
            >
              <RadioButton.Group
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (choice.name === 'kind') {
                    setValue('category', '');
                    setValue('destination', '');
                  }
                  setExpanded('');
                }}
              >
                {choice.items.map((item) => (
                  <RadioButton.Item
                    key={item.value}
                    value={item.value}
                    label={item.label}
                    disabled={disabled}
                  />
                ))}
              </RadioButton.Group>
            </List.Accordion>
          )}
        />
      ))}
      {(
        [
          { name: 'amount', label: vi.transactionAmount },
          { name: 'start', label: vi.recurringStart },
          { name: 'end', label: vi.recurringEnd },
          { name: 'note', label: vi.transactionNote },
        ] as const
      ).map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label={item.label}
              value={field.value}
              onBlur={field.onBlur}
              disabled={disabled}
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
      <Text>{vi.recurringFormHint}</Text>
      {row && row.interval_count > 1 && (
        <Text>
          {vi.recurringLegacyHint}: {row.interval_count}{' '}
          {vi.recurringLegacyInterval}
        </Text>
      )}
      {(invalid || error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error || vi.recurringInvalid}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={disabled}
        loading={disabled}
        onPress={() =>
          void handleSubmit(async (fields) => {
            let input: RecurringInput;
            try {
              input = RecurringInputSchema.parse({
                kind: fields.kind,
                amount: parseAmountInput(fields.amount),
                walletId: fields.wallet,
                toWalletId:
                  fields.kind === 'transfer' ? fields.destination : null,
                categoryId:
                  fields.kind === 'transfer' ? null : fields.category || null,
                note: fields.note,
                frequency: fields.frequency,
                intervalCount: row?.interval_count ?? 1,
                startOn: fields.start.trim(),
                endOn: fields.end.trim() || null,
              });
            } catch {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            await onSave(input);
          })()
        }
      >
        {vi.recurringSave}
      </Button>
    </Screen>
  );
}
