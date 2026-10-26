import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import { formatVnd, goalProgress, today } from '@pfm/domain';
import { GoalInputSchema, type GoalInput } from '@pfm/contracts';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  List,
  ProgressBar,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import {
  archiveGoal,
  restoreGoal,
  listGoals,
  saveGoal,
  type GoalRow,
} from '@/data/goals';
import { listWallets, type WalletRow } from '@/data/repository';
import type { Database } from '@/data/migrate';
import {
  formatAmountInput,
  parseAmountInput,
} from '@/features/transactions/form';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';

export function GoalManager({ onClose }: { onClose(): void }) {
  const [rows, setRows] = useState<GoalRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [editing, setEditing] = useState<GoalRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archived, setArchived] = useState(false);
  const working = useRef(false),
    newId = useRef('');
  const { colors } = useTheme();
  const recurringVersion = useApp((state) => state.recurringVersion);
  const refresh = useCallback(async () => {
    return withDatabase(async (db) => ({
      goals: await listGoals(db),
      wallets: await listWallets(db, true),
    }));
  }, []);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      refresh()
        .then((next) => {
          if (!cancelled) {
            setRows(next.goals);
            setWallets(next.wallets);
            setError('');
          }
        })
        .catch(() => {
          if (!cancelled) setError(vi.goalLoadError);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Automatic entries can change the linked wallet balance.
    }, [refresh, recurringVersion]),
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
      const next = await withDatabase(async (db) => {
        await action(db);
        committed = true;
        return {
          goals: await listGoals(db),
          wallets: await listWallets(db, true),
        };
      });
      setRows(next.goals);
      setWallets(next.wallets);
      setEditing(undefined);
    } catch {
      setError(committed ? vi.goalRefreshError : vi.saveError);
      if (committed) setEditing(undefined);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (editing !== undefined)
    return (
      <GoalForm
        key={editing?.id ?? 'new'}
        row={editing}
        wallets={wallets}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            saveGoal(
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
  const date = today({ now: () => new Date(), timeZone: 'Asia/Ho_Chi_Minh' });
  return (
    <Screen title={vi.goals}>
      <Button disabled={busy} onPress={back} contentStyle={styles.button}>
        {vi.back}
      </Button>
      <Button
        mode="contained"
        disabled={busy || loading}
        onPress={() => {
          newId.current = uuid.v4();
          setError('');
          setEditing(null);
        }}
        contentStyle={styles.button}
      >
        {vi.addGoal}
      </Button>
      <Button
        disabled={busy}
        onPress={() => setArchived(!archived)}
        contentStyle={styles.button}
      >
        {archived ? vi.goalShowActive : vi.goalShowArchived}
      </Button>
      {loading && <ActivityIndicator />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      )}
      {!!error && (
        <Button
          disabled={busy || loading}
          onPress={() => {
            setLoading(true);
            refresh()
              .then((next) => {
                setRows(next.goals);
                setWallets(next.wallets);
                setError('');
              })
              .catch(() => setError(vi.goalLoadError))
              .finally(() => setLoading(false));
          }}
        >
          {vi.retry}
        </Button>
      )}
      {!loading &&
        !rows.some((row) => (row.status === 'archived') === archived) && (
          <Text>{vi.goalEmpty}</Text>
        )}
      {rows
        .filter((row) => (row.status === 'archived') === archived)
        .map((row) => {
          const progress = goalProgress(
            row.target_amount,
            row.progress,
            date,
            row.deadline_on,
          );
          return (
            <View
              key={row.id}
              style={[styles.panel, { backgroundColor: colors.surfaceVariant }]}
            >
              <Text variant="titleMedium">{row.name}</Text>
              <Text>
                {formatVnd(row.progress)} / {formatVnd(row.target_amount)}
              </Text>
              <ProgressBar
                progress={Math.max(
                  0,
                  Math.min(1, row.progress / row.target_amount),
                )}
                accessibilityLabel={vi.goalProgress}
              />
              <Text>
                {row.wallet_name
                  ? `${vi.goalWallet}: ${row.wallet_name}`
                  : vi.goalManual}
              </Text>
              {row.deadline_on && (
                <Text>
                  {vi.goalDeadline}: {row.deadline_on}
                </Text>
              )}
              {progress.achieved ? (
                <Text>{vi.goalAchieved}</Text>
              ) : (
                <Text>
                  {progress.requiredPerMonth === null
                    ? vi.goalNoDeadline
                    : `${vi.goalMonthly}: ${formatVnd(progress.requiredPerMonth)}`}
                </Text>
              )}
              {archived ? (
                <Button
                  disabled={busy}
                  contentStyle={styles.button}
                  onPress={() =>
                    void mutate((db) =>
                      restoreGoal(db, row.id, new Date().toISOString()),
                    )
                  }
                >
                  {vi.restoreGoal}
                </Button>
              ) : (
                <View style={styles.row}>
                  <Button
                    disabled={busy}
                    contentStyle={styles.button}
                    onPress={() => {
                      setError('');
                      setEditing(row);
                    }}
                  >
                    {vi.editGoal}
                  </Button>
                  <Button
                    disabled={busy}
                    contentStyle={styles.button}
                    onPress={() =>
                      void mutate((db) =>
                        archiveGoal(db, row.id, new Date().toISOString()),
                      )
                    }
                  >
                    {vi.archiveGoal}
                  </Button>
                </View>
              )}
            </View>
          );
        })}
    </Screen>
  );
}

interface Fields {
  name: string;
  target: string;
  manual: string;
  deadline: string;
  wallet: string;
}
function GoalForm({
  row,
  wallets,
  busy,
  error,
  onBack,
  onSave,
}: {
  row: GoalRow | null;
  wallets: WalletRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(input: GoalInput): Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      name: row?.name ?? '',
      target: row ? formatAmountInput(String(row.target_amount)) : '',
      manual: formatAmountInput(String(row?.manual_saved_amount ?? 0)),
      deadline: row?.deadline_on ?? '',
      wallet: row?.funding_wallet_id ?? '',
    },
  });
  const [invalid, setInvalid] = useState(false),
    [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  const walletId = useWatch({ control, name: 'wallet' }),
    disabled = busy || isSubmitting;
  return (
    <Screen title={row ? vi.editGoal : vi.addGoal}>
      <Button disabled={disabled} contentStyle={styles.button} onPress={onBack}>
        {vi.back}
      </Button>
      {(
        [
          { name: 'name', label: vi.goalName },
          { name: 'target', label: vi.goalTarget },
          { name: 'deadline', label: vi.goalDeadline },
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
              disabled={disabled}
              onBlur={field.onBlur}
              keyboardType={item.name === 'target' ? 'number-pad' : 'default'}
              onChangeText={(value) =>
                field.onChange(
                  item.name === 'target'
                    ? formatAmountInput(value, field.value)
                    : value,
                )
              }
            />
          )}
        />
      ))}
      <Text>{vi.goalDeadlineHint}</Text>
      <Controller
        control={control}
        name="wallet"
        render={({ field }) => (
          <List.Accordion
            title={vi.goalSource}
            description={
              wallets.find((wallet) => wallet.id === field.value)?.name ??
              vi.goalManual
            }
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
          >
            <RadioButton.Group
              value={field.value}
              onValueChange={field.onChange}
            >
              <RadioButton.Item
                label={vi.goalManual}
                value=""
                disabled={disabled}
              />
              {wallets
                .filter(
                  (wallet) =>
                    !wallet.is_archived || wallet.id === row?.funding_wallet_id,
                )
                .map((wallet) => (
                  <RadioButton.Item
                    key={wallet.id}
                    label={wallet.name}
                    value={wallet.id}
                    disabled={disabled}
                  />
                ))}
            </RadioButton.Group>
          </List.Accordion>
        )}
      />
      {!walletId && (
        <Controller
          control={control}
          name="manual"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label={vi.goalManual}
              keyboardType="number-pad"
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onChangeText={(value) =>
                field.onChange(formatAmountInput(value, field.value))
              }
            />
          )}
        />
      )}
      <Text>{vi.goalSourceHint}</Text>
      {(invalid || error) && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error || vi.goalInvalid}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        loading={disabled}
        disabled={disabled}
        onPress={() =>
          void handleSubmit(async (fields) => {
            let input: GoalInput;
            try {
              input = GoalInputSchema.parse({
                name: fields.name,
                targetAmount: parseAmountInput(fields.target),
                manualSavedAmount: fields.wallet
                  ? (row?.manual_saved_amount ?? 0)
                  : fields.manual === '0'
                    ? 0
                    : parseAmountInput(fields.manual),
                fundingWalletId: fields.wallet || null,
                deadlineOn: fields.deadline.trim() || null,
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
        {vi.saveGoal}
      </Button>
    </Screen>
  );
}
