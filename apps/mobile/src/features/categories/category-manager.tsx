import { uuid } from 'expo';
import { useFocusEffect } from 'expo-router';
import type { CategoryInput } from '@pfm/contracts';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Icon,
  RadioButton,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import type { Database } from '@/data/migrate';
import {
  archiveCategory,
  restoreCategory,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRow,
} from '@/data/categories';
import { vi } from '@/messages/vi';
import { checkBudgetAlerts } from '@/features/budgets/mobile';
import { useApp } from '@/state/app';

type Mode =
  | { type: 'list' }
  | { type: 'form'; category: CategoryRow | null; id: string }
  | { type: 'archive'; category: CategoryRow };

export function CategoryManager({ onClose }: { onClose(): void }) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [archived, setArchived] = useState(false);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const working = useRef(false);
  const { colors } = useTheme();
  const back = useCallback(() => {
    if (working.current) return;
    if (mode.type === 'list') onClose();
    else {
      setMode({ type: 'list' });
      setError('');
    }
  }, [mode.type, onClose]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => listener.remove();
    }, [back]),
  );
  useEffect(() => {
    let cancelled = false;
    withDatabase((db) => listCategories(db, true))
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(vi.categoriesLoadError);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const reload = async () => {
    if (working.current) return;
    setLoading(true);
    setError('');
    try {
      setRows(await withDatabase((db) => listCategories(db, true)));
    } catch {
      setError(vi.categoriesLoadError);
    } finally {
      setLoading(false);
    }
  };
  const mutate = async (action: (db: Database) => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    let committed = false;
    try {
      const next = await withDatabase(async (db) => {
        await action(db);
        committed = true;
        return listCategories(db, true);
      });
      setRows(next);
      void checkBudgetAlerts();
      void useApp.getState().refreshRecurring(true);
      setMode({ type: 'list' });
      setSaved(true);
    } catch (failure) {
      if (committed) {
        // Do not offer to repeat an already committed creation after a read failure.
        setMode({ type: 'list' });
        setError(vi.walletSavedRefreshFailed);
      } else
        setError(
          failure instanceof Error && failure.message.startsWith('CATEGORY_')
            ? vi.categoryInvalid
            : vi.saveError,
        );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const edit = useCallback((category: CategoryRow) => {
    setMode({ type: 'form', category, id: category.id });
    setError('');
    setSaved(false);
  }, []);
  const archive = useCallback((category: CategoryRow) => {
    setMode({ type: 'archive', category });
    setError('');
    setSaved(false);
  }, []);
  const renderItem = ({ item }: { item: CategoryRow }) => (
    <CategoryItem
      category={item}
      parentName={rows.find((row) => row.id === item.parent_id)?.name}
      onEdit={edit}
      onArchive={archive}
      busy={busy}
      onRestore={(category) =>
        void mutate((db) =>
          restoreCategory(db, category.id, new Date().toISOString()),
        )
      }
    />
  );

  if (mode.type === 'form')
    return (
      <CategoryForm
        category={mode.category}
        rows={rows}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(input) =>
          mutate((db) =>
            mode.category
              ? updateCategory(db, mode.id, input, new Date().toISOString())
              : createCategory(db, mode.id, input, new Date().toISOString()),
          )
        }
      />
    );
  if (mode.type === 'archive')
    return (
      <ArchiveForm
        category={mode.category}
        rows={rows}
        busy={busy}
        error={error}
        onBack={back}
        onSave={(replacement) =>
          mutate((db) =>
            archiveCategory(
              db,
              mode.category.id,
              replacement,
              new Date().toISOString(),
            ),
          )
        }
      />
    );
  const tree = rows
    .filter((row) => !row.parent_id)
    .flatMap((parent) => [
      parent,
      ...rows.filter((row) => row.parent_id === parent.id),
    ]);
  return (
    <Screen title={vi.manageCategories} scroll={false}>
      <View style={styles.row}>
        <Button contentStyle={styles.button} onPress={back}>
          {vi.back}
        </Button>
        <Button
          contentStyle={styles.button}
          mode="contained"
          disabled={loading || busy}
          onPress={() => {
            setMode({ type: 'form', category: null, id: uuid.v4() });
            setError('');
            setSaved(false);
          }}
        >
          {vi.addCategory}
        </Button>
      </View>
      <SegmentedButtons
        value={archived ? 'archived' : 'active'}
        onValueChange={(value) => setArchived(value === 'archived')}
        buttons={[
          { value: 'active', label: vi.walletActive, disabled: busy },
          { value: 'archived', label: vi.walletArchived, disabled: busy },
        ]}
      />
      {archived && <Text>{vi.restoreCategoryHint}</Text>}
      {saved && (
        <Text accessibilityLiveRegion="polite">{vi.categorySaved}</Text>
      )}
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </Text>
          <Button disabled={loading} onPress={reload}>
            {vi.retry}
          </Button>
        </View>
      )}
      {loading ? (
        <ActivityIndicator accessibilityLabel={vi.loading} />
      ) : (
        <FlatList
          style={styles.fill}
          data={tree.filter((row) => !!row.is_archived === archived)}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={<Text>{vi.categoriesEmpty}</Text>}
        />
      )}
    </Screen>
  );
}

const CategoryItem = memo(function CategoryItem({
  category,
  parentName,
  onEdit,
  onArchive,
  onRestore,
  busy,
}: {
  category: CategoryRow;
  parentName?: string;
  onEdit(category: CategoryRow): void;
  onArchive(category: CategoryRow): void;
  onRestore(category: CategoryRow): void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          marginLeft: category.parent_id ? 16 : 0,
        },
      ]}
    >
      <View style={styles.row}>
        <Icon
          source={category.icon ?? 'tag'}
          color={category.color ?? colors.primary}
          size={24}
        />
        <Text variant="titleMedium" style={{ flex: 1 }}>
          {category.name}
        </Text>
      </View>
      <Text>
        {category.kind === 'expense' ? vi.categoryExpense : vi.categoryIncome}
        {parentName ? ` · ${parentName}` : ''}
      </Text>
      {category.is_archived ? (
        <Button
          disabled={busy}
          contentStyle={styles.button}
          onPress={() => onRestore(category)}
        >
          {vi.restoreCategory}
        </Button>
      ) : (
        <View style={styles.row}>
          <Button
            disabled={busy}
            contentStyle={styles.button}
            onPress={() => onEdit(category)}
          >
            {vi.editCategory}
          </Button>
          <Button
            disabled={busy}
            contentStyle={styles.button}
            onPress={() => onArchive(category)}
          >
            {vi.archiveCategory}
          </Button>
        </View>
      )}
    </View>
  );
});

interface Fields {
  name: string;
  kind: CategoryRow['kind'];
  parentId: string;
  isFixedCost: boolean;
  icon: string;
  color: string;
}

function CategoryForm({
  category,
  rows,
  busy,
  error,
  onBack,
  onSave,
}: {
  category: CategoryRow | null;
  rows: CategoryRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(input: CategoryInput): Promise<void>;
}) {
  const {
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>({
    defaultValues: {
      name: category?.name ?? '',
      kind: category?.kind ?? 'expense',
      parentId: category?.parent_id ?? '',
      isFixedCost: !!category?.is_fixed_cost,
      icon: category?.icon ?? '',
      color: category?.color ?? '',
    },
  });
  const kind = useWatch({ control, name: 'kind' });
  const disabled = busy || isSubmitting;
  const { colors } = useTheme();
  const icons = [
    vi.categoryIconTag,
    vi.categoryIconFood,
    vi.categoryIconHome,
    vi.categoryIconCar,
    vi.categoryIconCart,
    vi.categoryIconCash,
  ];
  const colorNames = [
    vi.categoryColorBlue,
    vi.categoryColorGreen,
    vi.categoryColorOrange,
    vi.categoryColorPurple,
  ];
  return (
    <Screen title={category ? vi.editCategory : vi.addCategory}>
      <Button contentStyle={styles.button} disabled={disabled} onPress={onBack}>
        {vi.back}
      </Button>
      <Text>{vi.categoryStructureHint}</Text>
      <Controller
        control={control}
        name="name"
        rules={{
          validate: (value) => !!value.trim() || vi.categoryNameRequired,
        }}
        render={({ field, fieldState }) => (
          <View>
            <TextInput
              mode="outlined"
              label={vi.categoryName}
              accessibilityLabel={vi.categoryName}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              error={!!fieldState.error}
            />
            {!!fieldState.error && (
              <HelperText type="error">{fieldState.error.message}</HelperText>
            )}
          </View>
        )}
      />
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.categoryKind}
      </Text>
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <RadioButton.Group
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              setValue('parentId', '');
            }}
          >
            <RadioButton.Item
              value="expense"
              label={vi.categoryExpense}
              disabled={disabled || !!category}
              style={{ minHeight: 48 }}
            />
            <RadioButton.Item
              value="income"
              label={vi.categoryIncome}
              disabled={disabled || !!category}
              style={{ minHeight: 48 }}
            />
          </RadioButton.Group>
        )}
      />
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.categoryParent}
      </Text>
      {category ? (
        <Text>
          {rows.find((row) => row.id === category.parent_id)?.name ??
            vi.categoryNoParent}
        </Text>
      ) : (
        <Controller
          control={control}
          name="parentId"
          render={({ field }) => (
            <RadioButton.Group
              value={field.value}
              onValueChange={field.onChange}
            >
              <RadioButton.Item
                value=""
                label={vi.categoryNoParent}
                disabled={disabled}
                style={{ minHeight: 48 }}
              />
              {rows
                .filter(
                  (row) =>
                    !row.is_archived && !row.parent_id && row.kind === kind,
                )
                .map((row) => (
                  <RadioButton.Item
                    key={row.id}
                    value={row.id}
                    label={row.name}
                    disabled={disabled}
                    style={{ minHeight: 48 }}
                  />
                ))}
            </RadioButton.Group>
          )}
        />
      )}
      <Controller
        control={control}
        name="isFixedCost"
        render={({ field }) => (
          <View style={styles.row}>
            <Text style={{ flex: 1 }}>{vi.categoryFixed}</Text>
            <Switch
              value={field.value}
              onValueChange={field.onChange}
              accessibilityLabel={vi.categoryFixed}
              disabled={disabled}
            />
          </View>
        )}
      />
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.categoryIcon}
      </Text>
      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <RadioButton.Group value={field.value} onValueChange={field.onChange}>
            <RadioButton.Item
              value=""
              label={vi.categoryDefault}
              disabled={disabled}
              style={{ minHeight: 48 }}
            />
            {CATEGORY_ICONS.map((icon, index) => (
              <View key={icon} style={styles.row}>
                <Icon source={icon} size={24} />
                <RadioButton.Item
                  value={icon}
                  label={icons[index]}
                  disabled={disabled}
                  style={{ flex: 1, minHeight: 48 }}
                />
              </View>
            ))}
          </RadioButton.Group>
        )}
      />
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.categoryColor}
      </Text>
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <RadioButton.Group value={field.value} onValueChange={field.onChange}>
            <RadioButton.Item
              value=""
              label={vi.categoryDefault}
              disabled={disabled}
              style={{ minHeight: 48 }}
            />
            {CATEGORY_COLORS.map((color, index) => (
              <RadioButton.Item
                key={color}
                value={color}
                label={colorNames[index]}
                color={color}
                disabled={disabled}
                style={{ minHeight: 48 }}
              />
            ))}
          </RadioButton.Group>
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
              ...values,
              parentId: values.parentId || null,
              icon: values.icon || null,
              color: values.color || null,
            }),
          )();
        }}
      >
        {vi.saveCategory}
      </Button>
    </Screen>
  );
}

function ArchiveForm({
  category,
  rows,
  busy,
  error,
  onBack,
  onSave,
}: {
  category: CategoryRow;
  rows: CategoryRow[];
  busy: boolean;
  error: string;
  onBack(): void;
  onSave(replacement: string | null): Promise<void>;
}) {
  const [replacement, setReplacement] = useState('');
  const { colors } = useTheme();
  const targets = rows.filter(
    (row) =>
      !row.is_archived &&
      row.kind === category.kind &&
      row.id !== category.id &&
      row.parent_id !== category.id,
  );
  return (
    <Screen title={vi.archiveCategory}>
      <Button contentStyle={styles.button} disabled={busy} onPress={onBack}>
        {vi.back}
      </Button>
      <Text variant="titleLarge">{category.name}</Text>
      <Text>{vi.categoryArchiveDescription}</Text>
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.categoryReassign}
      </Text>
      <Text>{vi.categoryMoveHistory}</Text>
      <RadioButton.Group value={replacement} onValueChange={setReplacement}>
        <RadioButton.Item
          value=""
          label={vi.categoryKeepHistory}
          disabled={busy}
          style={{ minHeight: 48 }}
        />
        {targets.map((row) => (
          <RadioButton.Item
            key={row.id}
            value={row.id}
            disabled={busy}
            style={{ minHeight: 48 }}
            label={
              row.parent_id
                ? `${rows.find((parent) => parent.id === row.parent_id)?.name} › ${row.name}`
                : row.name
            }
          />
        ))}
      </RadioButton.Group>
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
          void onSave(replacement || null);
        }}
      >
        {vi.archiveCategory}
      </Button>
    </Screen>
  );
}
