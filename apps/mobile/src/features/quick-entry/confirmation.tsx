import { useState } from 'react';
import { Modal, View } from 'react-native';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from 'react-hook-form';
import {
  Button,
  Checkbox,
  HelperText,
  List,
  RadioButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  CONFIDENCE_HIGH,
  formatVnd,
  type ParseResult,
  type ParsedEntry,
  type ParseWarning,
} from '@pfm/domain';
import { Screen, styles } from '@/components/screen';
import { useFinancePalette } from '@/constants/theme';
import { vi } from '@/messages/vi';
import { formatAmountInput, isFutureDate } from '../transactions/form';
import type { EntryDraft, EntryReferences } from './draft';

export const ENTRY_KINDS = [
  { value: 'expense', label: vi.transactionExpense },
  { value: 'income', label: vi.transactionIncome },
  { value: 'transfer', label: vi.transactionTransfer },
  { value: 'debt_borrow', label: vi.debtBorrow },
  { value: 'debt_lend', label: vi.debtLend },
  { value: 'debt_repay_paid', label: vi.debtRepayPaid },
  { value: 'debt_repay_received', label: vi.debtRepayReceived },
] as const;
const WARNINGS: Record<ParseWarning, string> = {
  ASSUMED_THOUSANDS: vi.quickAssumed,
  NON_INTEGER_VND: vi.quickFraction,
  ZERO_AMOUNT: vi.quickZero,
  AMOUNT_TOO_LARGE: vi.quickLarge,
  INVALID_DATE: vi.quickInvalidDate,
  FUTURE_DATE: vi.quickFuture,
  MULTIPLE_AMOUNTS: vi.quickMultiple,
  NO_AMOUNT: vi.quickNoAmount,
  AMBIGUOUS_KIND: vi.quickAmbiguous,
};
export function entryKindLabel(kind: ParsedEntry['kind']) {
  return (
    ENTRY_KINDS.find((item) => item.value === kind)?.label ?? vi.quickUnknown
  );
}

interface Fields {
  entries: EntryDraft[];
}

// A native sheet owns its scrolling/keyboard area, independent of the bottom tab bar.
export function EntryConfirmation({
  result,
  drafts,
  refs,
  busy,
  error,
  onCancel,
  onSave,
}: {
  result: ParseResult;
  drafts: EntryDraft[];
  refs: EntryReferences;
  busy: boolean;
  error: string;
  onCancel(): void;
  onSave(drafts: EntryDraft[]): Promise<void>;
}) {
  const {
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>({ defaultValues: { entries: drafts } });
  const { fields } = useFieldArray({ control, name: 'entries' });
  const values = useWatch({ control, name: 'entries' });
  const disabled = busy || isSubmitting;
  const palette = useFinancePalette();
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal={false}
      onRequestClose={() => {
        if (!disabled) onCancel();
      }}
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={['bottom']}
          style={[styles.fill, { backgroundColor: palette.ground }]}
        >
          <Screen
            title={vi.quickConfirmTitle}
            subtitle={vi.quickConfirmHint}
            onBack={onCancel}
            backDisabled={disabled}
          >
            <Text selectable variant="bodyMedium">
              {result.raw}
            </Text>
            {result.warnings.map((warning) => (
              <Text
                key={warning}
                variant="bodySmall"
                style={{ color: palette.warningInk }}
              >
                {WARNINGS[warning]}
              </Text>
            ))}
            <Text>
              {vi.quickSelectedCount}:{' '}
              {values.filter((entry) => entry.selected).length} /{' '}
              {fields.length}
            </Text>
            {fields.map((field, index) => (
              <CandidateFields
                key={field.id}
                index={index}
                candidate={result.candidates[index]}
                control={control}
                setValue={setValue}
                refs={refs}
                disabled={disabled}
                expandedByDefault={fields.length === 1}
              />
            ))}
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: palette.danger }}>
                {error}
              </Text>
            )}
            <Button
              mode="contained"
              contentStyle={styles.button}
              disabled={disabled || !values.some((entry) => entry.selected)}
              loading={disabled}
              onPress={() =>
                void handleSubmit((values) => onSave(values.entries))()
              }
            >
              {vi.quickSave}
            </Button>
            <Button
              contentStyle={styles.button}
              disabled={disabled}
              onPress={onCancel}
            >
              {vi.cancel}
            </Button>
          </Screen>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Choice({
  label,
  value,
  options,
  disabled,
  onChange,
  low = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange(value: string): void;
  low?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const palette = useFinancePalette();
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 12,
        borderColor: low ? palette.warning : palette.border,
        overflow: 'hidden',
      }}
    >
      <List.Accordion
        title={label}
        description={
          options.find((option) => option.value === value)?.label ??
          vi.quickChoose
        }
        titleNumberOfLines={3}
        descriptionNumberOfLines={4}
        expanded={open}
        onPress={() => {
          if (!disabled) setOpen(!open);
        }}
      >
        <RadioButton.Group
          value={value}
          onValueChange={(value) => {
            onChange(value);
            setOpen(false);
          }}
        >
          {options.map((option) => (
            <RadioButton.Item
              key={option.value}
              label={option.label}
              value={option.value}
              disabled={disabled}
            />
          ))}
        </RadioButton.Group>
      </List.Accordion>
      {low && <HelperText type="info">{vi.quickCheckField}</HelperText>}
    </View>
  );
}

function CandidateFields({
  index,
  candidate,
  control,
  setValue,
  refs,
  disabled,
  expandedByDefault,
}: {
  index: number;
  candidate: ParsedEntry;
  control: Control<Fields>;
  setValue: UseFormSetValue<Fields>;
  refs: EntryReferences;
  disabled: boolean;
  expandedByDefault: boolean;
}) {
  const draft = useWatch({ control, name: `entries.${index}` });
  const [expanded, setExpanded] = useState(expandedByDefault);
  const palette = useFinancePalette();
  const path = `entries.${index}` as const;
  const financialCategory = draft.kind === 'income' || draft.kind === 'expense';
  const newLoan = draft.kind === 'debt_borrow' || draft.kind === 'debt_lend';
  const repayment =
    draft.kind === 'debt_repay_paid' || draft.kind === 'debt_repay_received';
  const wallets = refs.wallets.filter((wallet) => !wallet.is_archived);
  const categories = refs.categories.filter(
    (category) =>
      category.kind === draft.kind &&
      !category.is_archived &&
      (!category.parent_id ||
        refs.categories.some(
          (parent) => parent.id === category.parent_id && !parent.is_archived,
        )),
  );
  const debts = refs.debts.filter(
    (debt) =>
      debt.outstanding > 0 &&
      debt.direction ===
        (draft.kind === 'debt_repay_paid' ? 'borrowed' : 'lent'),
  );
  const textField = (
    name: 'amount' | 'date' | 'note' | 'counterpartyLabel',
    label: string,
    low = false,
  ) => (
    <Controller
      control={control}
      name={`${path}.${name}`}
      render={({ field }) => (
        <View>
          <TextInput
            mode="outlined"
            label={label}
            accessibilityLabel={label}
            value={field.value}
            disabled={disabled || !draft.selected}
            keyboardType={name === 'amount' ? 'number-pad' : 'default'}
            autoCapitalize={name === 'date' ? 'none' : 'sentences'}
            multiline={name === 'note'}
            onBlur={field.onBlur}
            outlineColor={low ? palette.warning : undefined}
            onChangeText={(value) => {
              field.onChange(
                name === 'amount'
                  ? formatAmountInput(value, field.value)
                  : value,
              );
              if (name === 'amount') setValue(`${path}.amountConfirmed`, false);
            }}
          />
          {low && <HelperText type="info">{vi.quickCheckField}</HelperText>}
        </View>
      )}
    />
  );
  const amountLabel = draft.amount || vi.quickNoAmount;
  const formDisabled = disabled || !draft.selected;
  let future = false;
  try {
    future = isFutureDate(draft.date, new Date());
  } catch {
    /* An incomplete date is validated on save. */
  }
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Controller
        control={control}
        name={`${path}.selected`}
        render={({ field }) => (
          <Checkbox.Item
            label={`${index + 1}. ${vi.quickSelect}`}
            status={field.value ? 'checked' : 'unchecked'}
            onPress={() => field.onChange(!field.value)}
            disabled={disabled}
          />
        )}
      />
      <Text variant="titleMedium" style={styles.number}>
        {amountLabel} ₫ · {entryKindLabel(draft.kind)}
      </Text>
      <Text variant="bodySmall">{draft.date || vi.quickInvalidDate}</Text>
      <Button
        mode="outlined"
        contentStyle={styles.button}
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
      >
        {vi.quickDetails}
      </Button>
      {expanded && (
        <>
          <Choice
            label={vi.transactionKind}
            value={draft.kind}
            options={[...ENTRY_KINDS]}
            disabled={formDisabled}
            low={
              candidate.kindConfidence < CONFIDENCE_HIGH ||
              draft.kind === 'unknown'
            }
            onChange={(value) => {
              const choice = ENTRY_KINDS.find((kind) => kind.value === value);
              if (!choice) return;
              setValue(`${path}.kind`, choice.value);
              setValue(`${path}.categoryId`, '');
              setValue(`${path}.toWalletId`, '');
              setValue(`${path}.debtId`, '');
            }}
          />
          {textField(
            'amount',
            vi.transactionAmount,
            candidate.amount.confidence !== 'high',
          )}
          {candidate.explanation.includes('amount.assumed_thousands') && (
            <>
              <Text style={{ color: palette.warningInk }}>
                {vi.quickAssumed}
              </Text>
              <Controller
                control={control}
                name={`${path}.amountConfirmed`}
                render={({ field }) => (
                  <Checkbox.Item
                    label={vi.quickAmountConfirm}
                    status={field.value ? 'checked' : 'unchecked'}
                    disabled={formDisabled}
                    onPress={() => field.onChange(!field.value)}
                  />
                )}
              />
            </>
          )}
          <Choice
            label={
              draft.kind === 'transfer'
                ? vi.transactionSourceWallet
                : vi.transactionWallet
            }
            value={draft.walletId}
            options={wallets.map((wallet) => ({
              value: wallet.id,
              label: wallet.name,
            }))}
            disabled={formDisabled}
            onChange={(value) => setValue(`${path}.walletId`, value)}
          />
          {draft.kind === 'transfer' && (
            <Choice
              label={vi.transactionDestination}
              value={draft.toWalletId}
              options={wallets
                .filter((wallet) => wallet.id !== draft.walletId)
                .map((wallet) => ({ value: wallet.id, label: wallet.name }))}
              disabled={formDisabled}
              onChange={(value) => setValue(`${path}.toWalletId`, value)}
            />
          )}
          {financialCategory && (
            <Choice
              label={vi.transactionCategory}
              value={draft.categoryId}
              disabled={formDisabled}
              low={
                candidate.categoryConfidence < CONFIDENCE_HIGH ||
                (!!candidate.categoryKey && !draft.categoryId)
              }
              options={[
                { value: '', label: vi.transactionUncategorized },
                ...categories.map((category) => ({
                  value: category.id,
                  label: `${category.parent_id ? `${refs.categories.find((parent) => parent.id === category.parent_id)?.name} › ` : ''}${category.name}`,
                })),
              ]}
              onChange={(value) => setValue(`${path}.categoryId`, value)}
            />
          )}
          {newLoan && (
            <>
              {textField('counterpartyLabel', vi.quickCounterparty)}
              <Text variant="bodySmall">{vi.quickNewDebtHint}</Text>
            </>
          )}
          {repayment && (
            <>
              <Choice
                label={vi.quickExistingDebt}
                value={draft.debtId}
                options={debts.map((debt) => ({
                  value: debt.id,
                  label: `${debt.counterparty_label} · ${formatVnd(debt.outstanding)}`,
                }))}
                disabled={formDisabled}
                onChange={(value) => setValue(`${path}.debtId`, value)}
              />
              {!debts.length && <Text>{vi.quickNoDebt}</Text>}
            </>
          )}
          {textField(
            'date',
            vi.transactionDate,
            candidate.date.confidence !== 'high' || !draft.date,
          )}
          {textField('note', vi.transactionNote)}
          {!!candidate.amount.matchedText && (
            <Text variant="bodySmall">
              {vi.quickMatchedAmount}: “{candidate.amount.matchedText}”
            </Text>
          )}
          <List.Accordion title={vi.quickWhy}>
            {candidate.explanation
              .filter(
                (line) =>
                  !line.startsWith('amount.') && !line.startsWith('date.'),
              )
              .map((line, i) => (
                <Text key={i} variant="bodySmall" style={{ padding: 8 }}>
                  {line.replace(
                    / \/ ((?:expense|income)(?:\.[a-z_]+)+)/g,
                    (_, key: string) => {
                      const category = refs.categories.find(
                        (category) => category.system_key === key,
                      );
                      return category ? ` — ${category.name}` : '';
                    },
                  )}
                </Text>
              ))}
          </List.Accordion>
        </>
      )}
      {future && (
        <Text style={{ color: palette.warningInk }}>
          {vi.transactionFutureWarning}
        </Text>
      )}
    </View>
  );
}
