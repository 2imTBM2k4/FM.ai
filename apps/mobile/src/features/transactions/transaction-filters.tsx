import {
  TransactionFiltersSchema,
  type TransactionFilters,
} from '@pfm/contracts';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  List,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import type { WalletRow } from '@/data/repository';
import type { CategoryRow } from '@/data/categories';
import { vi } from '@/messages/vi';
import { formatAmountInput, parseAmountInput } from './form';

interface Fields {
  text: string;
  from: string;
  to: string;
  kind: string;
  walletId: string;
  categoryId: string;
  minAmount: string;
  maxAmount: string;
}

export function TransactionFilterForm({
  filters,
  wallets,
  categories,
  busy,
  onApply,
  onBack,
}: {
  filters: TransactionFilters;
  wallets: WalletRow[];
  categories: CategoryRow[];
  busy: boolean;
  onApply(filters: TransactionFilters): void;
  onBack(): void;
}) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      text: filters.text ?? '',
      from: filters.from ?? '',
      to: filters.to ?? '',
      kind: filters.kind ?? '',
      walletId: filters.walletId ?? '',
      categoryId: filters.categoryId ?? '',
      minAmount:
        filters.minAmount === undefined
          ? ''
          : formatAmountInput(String(filters.minAmount)),
      maxAmount:
        filters.maxAmount === undefined
          ? ''
          : formatAmountInput(String(filters.maxAmount)),
    },
  });
  const [error, setError] = useState('');
  const { colors } = useTheme();
  const disabled = busy || isSubmitting;
  const fields = [
    { name: 'text', label: vi.filterText },
    { name: 'from', label: vi.filterFrom },
    { name: 'to', label: vi.filterTo },
    { name: 'minAmount', label: vi.filterMinAmount },
    { name: 'maxAmount', label: vi.filterMaxAmount },
  ] as const;
  return (
    <Screen title={vi.transactionFilters}>
      <Button contentStyle={styles.button} disabled={disabled} onPress={onBack}>
        {vi.back}
      </Button>
      <Text>{vi.filterTextHint}</Text>
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
              disabled={disabled}
              onBlur={field.onBlur}
              keyboardType={
                item.name.includes('Amount')
                  ? 'number-pad'
                  : item.name === 'text'
                    ? 'default'
                    : 'numbers-and-punctuation'
              }
              onChangeText={(value) =>
                field.onChange(
                  item.name.includes('Amount')
                    ? formatAmountInput(value, field.value)
                    : value,
                )
              }
            />
          )}
        />
      ))}
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <FilterChoice
            label={vi.transactionKind}
            value={field.value}
            disabled={disabled}
            onChange={(value) => {
              field.onChange(value);
              setValue('categoryId', '');
            }}
            options={[
              { value: 'expense', label: vi.transactionExpense },
              { value: 'income', label: vi.transactionIncome },
              { value: 'transfer', label: vi.transactionTransfer },
            ]}
          />
        )}
      />
      <Controller
        control={control}
        name="walletId"
        render={({ field }) => (
          <FilterChoice
            label={vi.transactionWallet}
            value={field.value}
            disabled={disabled}
            onChange={field.onChange}
            options={wallets.map((w) => ({
              value: w.id,
              label: `${w.name}${w.is_archived ? ` · ${vi.transactionArchivedReference}` : ''}`,
            }))}
          />
        )}
      />
      <Text>{vi.filterCategoryHint}</Text>
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <FilterChoice
            label={vi.transactionCategory}
            value={field.value}
            disabled={disabled}
            onChange={field.onChange}
            options={categories.map((c) => ({
              value: c.id,
              label: `${c.parent_id ? `${categories.find((p) => p.id === c.parent_id)?.name ?? ''} › ` : ''}${c.name}${c.is_archived ? ` · ${vi.transactionArchivedReference}` : ''}`,
            }))}
          />
        )}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      )}
      <Button
        contentStyle={styles.button}
        mode="contained"
        disabled={disabled}
        onPress={() => {
          void handleSubmit((values) => {
            try {
              const amount = (value: string) =>
                value === ''
                  ? undefined
                  : value === '0'
                    ? 0
                    : parseAmountInput(value);
              const parsed = TransactionFiltersSchema.parse({
                text: values.text,
                from: values.from || undefined,
                to: values.to || undefined,
                kind: values.kind || undefined,
                walletId: values.walletId || undefined,
                categoryId: values.categoryId || undefined,
                minAmount: amount(values.minAmount),
                maxAmount: amount(values.maxAmount),
              });
              onApply(parsed);
            } catch {
              setError(vi.filterInvalid);
            }
          })();
        }}
      >
        {vi.filterApply}
      </Button>
      <Button
        contentStyle={styles.button}
        disabled={disabled}
        onPress={() => onApply({})}
      >
        {vi.filterClear}
      </Button>
    </Screen>
  );
}

function FilterChoice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(value: string): void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <List.Accordion
      title={label}
      description={
        options.find((option) => option.value === value)?.label ?? vi.filterAll
      }
      descriptionNumberOfLines={0}
      expanded={expanded}
      onPress={() => {
        if (!disabled) setExpanded((current) => !current);
      }}
    >
      <RadioButton.Group
        value={value}
        onValueChange={(next) => {
          onChange(next);
          setExpanded(false);
        }}
      >
        {[{ value: '', label: vi.filterAll }, ...options].map((option) => (
          <RadioButton.Item
            key={option.value}
            value={option.value}
            label={option.label}
            disabled={disabled}
            style={{ minHeight: 48 }}
          />
        ))}
      </RadioButton.Group>
    </List.Accordion>
  );
}
