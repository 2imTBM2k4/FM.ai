import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  Icon,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { DeleteDataControl } from '@/components/delete-data-control';
import { IconBadge, Screen, styles } from '@/components/screen';
import { GlassCard, Pill } from '@/components/ui';
import {
  DesignSpacing,
  useDesignTheme,
  useFinancePalette,
} from '@/constants/theme';
import { withDatabase } from '@/data/connection';
import { CategoryManager } from '@/features/categories/category-manager';
import { PinSettings } from '@/features/lock/pin-controls';
import { NotificationsView } from '@/features/notifications/notifications-view';
import { vi } from '@/messages/vi';
import {
  exportLocalTransactionsCsv,
  importLocalTransactionsCsv,
} from '@/services/csv-transfer';
import { usePreferences } from '@/state/preferences';

const SAMPLE_CSV = [
  'occurred_on,kind,amount,note,category',
  '2026-10-25,expense,45000,"Phở bò & trà đá",Ăn ngoài',
  '2026-10-26,expense,120000,"Xăng xe đi làm",Xăng xe',
  '2026-10-27,income,2500000,"Thưởng hoàn thành sprint",Thưởng',
].join('\n');

/**
 * Settings screen (Stage 6) providing Language, Currency, Theme Mode (Pastel Sunset / Midnight Aurora),
 * Dev Seed Data toggle, local CSV Export/Import, Category management, Notifications, and PIN security.
 */
export default function Settings() {
  const [managingCategories, setManagingCategories] = useState(false);
  const [viewingNotifications, setViewingNotifications] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvNotice, setCsvNotice] = useState('');
  const [csvError, setCsvError] = useState('');
  const [seedNotice, setSeedNotice] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);

  const palette = useFinancePalette();
  const theme = useDesignTheme();

  const language = usePreferences((state) => state.language);
  const currency = usePreferences((state) => state.currency);
  const themeMode = usePreferences((state) => state.themeMode);
  const seedEnabled = usePreferences((state) => state.seedEnabled);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const setCurrency = usePreferences((state) => state.setCurrency);
  const setThemeMode = usePreferences((state) => state.setThemeMode);
  const setSeedEnabled = usePreferences((state) => state.setSeedEnabled);

  if (managingCategories) {
    return <CategoryManager onClose={() => setManagingCategories(false)} />;
  }
  if (viewingNotifications) {
    return <NotificationsView onClose={() => setViewingNotifications(false)} />;
  }

  const handleToggleSeed = async (nextValue: boolean) => {
    if (seedBusy) return;
    setSeedBusy(true);
    setSeedNotice('');
    try {
      await setSeedEnabled(nextValue);
      setSeedNotice(
        nextValue ? vi.settingsSeedActiveNotice : vi.settingsSeedRemovedNotice,
      );
    } finally {
      setSeedBusy(false);
    }
  };

  const handleExportCsv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    setCsvError('');
    setCsvNotice('');
    try {
      const exported = await exportLocalTransactionsCsv();
      setCsvText(exported);
      setCsvNotice(vi.csvExportSuccess);
    } catch {
      setCsvError(vi.saveError);
    } finally {
      setCsvBusy(false);
    }
  };

  const handleImportCsv = async () => {
    if (csvBusy || !csvText.trim()) return;
    setCsvBusy(true);
    setCsvError('');
    setCsvNotice('');
    try {
      const count = await withDatabase((db) =>
        importLocalTransactionsCsv(db, csvText),
      );
      setCsvNotice(`${vi.csvImportSuccess} (${count})`);
    } catch {
      setCsvError(vi.csvImportError);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <Screen title={vi.settings}>
      {/* 1. Preferences Card: Language, Currency, Theme Mode, Dev Seed Data */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.lg}
        style={{ gap: 14 }}
      >
        <View style={styles.inlineRow}>
          <IconBadge
            icon="palette-swatch-outline"
            bg={theme.brand.primarySoft}
            fg={theme.brand.primary}
            size={40}
            iconSize={20}
          />
          <View style={{ flex: 1 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '800', color: theme.text.primary }}
            >
              {vi.settingsPreferencesTitle}
            </Text>
          </View>
        </View>

        <Divider style={{ backgroundColor: theme.card.border }} />

        {/* Language Selector */}
        <View style={localStyles.settingRow}>
          <Text
            variant="titleSmall"
            style={{ fontWeight: '700', color: theme.text.primary }}
          >
            {vi.settingsLanguageLabel}
          </Text>
          <View style={localStyles.pillGroup}>
            <Pill
              label={vi.settingsLanguageVi}
              tone="primary"
              selected={language === 'vi'}
              size="sm"
              onPress={() => void setLanguage('vi')}
            />
            <Pill
              label={vi.settingsLanguageEn}
              tone="primary"
              selected={language === 'en'}
              size="sm"
              onPress={() => void setLanguage('en')}
            />
          </View>
        </View>

        <Divider style={{ backgroundColor: theme.card.border }} />

        {/* Currency Selector */}
        <View style={localStyles.settingRow}>
          <Text
            variant="titleSmall"
            style={{ fontWeight: '700', color: theme.text.primary }}
          >
            {vi.settingsCurrencyLabel}
          </Text>
          <View style={localStyles.pillGroup}>
            <Pill
              label={vi.settingsCurrencyVnd}
              tone="primary"
              selected={currency === 'VND'}
              size="sm"
              onPress={() => void setCurrency('VND')}
            />
            <Pill
              label={vi.settingsCurrencyUsd}
              tone="primary"
              selected={currency === 'USD'}
              size="sm"
              onPress={() => void setCurrency('USD')}
            />
          </View>
        </View>

        <Divider style={{ backgroundColor: theme.card.border }} />

        {/* Theme Selector (Light Pastel Sunset vs Dark Midnight Aurora) */}
        <View style={{ gap: 8 }}>
          <Text
            variant="titleSmall"
            style={{ fontWeight: '700', color: theme.text.primary }}
          >
            {vi.settingsThemeLabel}
          </Text>
          <View style={localStyles.pillGroup}>
            <Pill
              label={vi.settingsThemeLight}
              icon="weather-sunset"
              tone="primary"
              selected={themeMode === 'light'}
              size="sm"
              onPress={() => void setThemeMode('light')}
            />
            <Pill
              label={vi.settingsThemeDark}
              icon="weather-night"
              tone="primary"
              selected={themeMode === 'dark'}
              size="sm"
              onPress={() => void setThemeMode('dark')}
            />
          </View>
        </View>

        <Divider style={{ backgroundColor: theme.card.border }} />

        {/* Dev Seed Data Toggle */}
        <View style={{ gap: 6 }}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="titleSmall"
                style={{ fontWeight: '700', color: theme.text.primary }}
              >
                {vi.settingsSeedLabel}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.text.secondary, lineHeight: 18 }}
              >
                {vi.settingsSeedDescription}
              </Text>
            </View>
            <Switch
              accessibilityLabel={vi.settingsSeedLabel}
              value={seedEnabled}
              disabled={seedBusy}
              color={theme.brand.primary}
              onValueChange={(value) => void handleToggleSeed(value)}
            />
          </View>
          {!!seedNotice && (
            <Text
              variant="bodySmall"
              style={{ color: theme.finance.incomeText, fontWeight: '700' }}
            >
              {seedNotice}
            </Text>
          )}
        </View>
      </GlassCard>

      {/* 2. Local CSV Import / Export Card */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.lg}
        style={{ gap: 12 }}
      >
        <View style={styles.inlineRow}>
          <IconBadge
            icon="file-delimited-outline"
            bg={palette.tealSoft}
            fg={palette.tealInk}
            size={40}
            iconSize={20}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '800', color: theme.text.primary }}
            >
              {vi.csvSectionTitle}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.text.secondary, lineHeight: 18 }}
            >
              {vi.csvSectionHint}
            </Text>
          </View>
        </View>

        <View style={localStyles.csvButtonsRow}>
          <Button
            mode="contained"
            compact
            icon="tray-arrow-up"
            buttonColor={theme.brand.primary}
            textColor="#FFFFFF"
            disabled={csvBusy}
            loading={csvBusy}
            onPress={() => void handleExportCsv()}
          >
            {vi.csvExportBtn}
          </Button>
          <Button
            mode="outlined"
            compact
            icon="file-document-edit-outline"
            disabled={csvBusy}
            onPress={() => {
              setCsvText(SAMPLE_CSV);
              setCsvError('');
              setCsvNotice('');
            }}
          >
            {vi.csvLoadSampleBtn}
          </Button>
        </View>

        <TextInput
          mode="outlined"
          label={vi.csvInputLabel}
          accessibilityLabel={vi.csvInputLabel}
          multiline
          numberOfLines={4}
          value={csvText}
          onChangeText={(val) => {
            setCsvText(val);
            setCsvError('');
            setCsvNotice('');
          }}
          disabled={csvBusy}
          style={{ maxHeight: 150, fontSize: 12 }}
        />

        <Button
          mode="contained-tonal"
          icon="tray-arrow-down"
          disabled={csvBusy || !csvText.trim()}
          loading={csvBusy}
          onPress={() => void handleImportCsv()}
        >
          {vi.csvImportBtn}
        </Button>

        {!!csvNotice && (
          <Text
            accessibilityLiveRegion="polite"
            variant="bodySmall"
            style={{ color: theme.finance.incomeText, fontWeight: '700' }}
          >
            {csvNotice}
          </Text>
        )}
        {!!csvError && (
          <Text
            accessibilityRole="alert"
            variant="bodySmall"
            style={{ color: palette.danger, fontWeight: '600' }}
          >
            {csvError}
          </Text>
        )}
      </GlassCard>

      {/* 3. Navigation Cards: Categories & Notifications */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.md}
        accessibilityLabel={vi.manageCategories}
        onPress={() => setManagingCategories(true)}
      >
        <View style={styles.row}>
          <View style={[styles.inlineRow, { flex: 1 }]}>
            <IconBadge
              icon="shape-outline"
              bg={palette.primarySoft}
              fg={palette.primaryInk}
              size={42}
              iconSize={22}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.text.primary }}
              >
                {vi.manageCategories}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.text.secondary }}>
                {vi.categoryStructureHint}
              </Text>
            </View>
          </View>
          <Icon source="chevron-right" size={24} color={theme.text.muted} />
        </View>
      </GlassCard>

      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.md}
        accessibilityLabel={vi.notificationsTitle}
        onPress={() => setViewingNotifications(true)}
      >
        <View style={styles.row}>
          <View style={[styles.inlineRow, { flex: 1 }]}>
            <IconBadge
              icon="bell-ring-outline"
              bg={theme.brand.primarySoft}
              fg={theme.brand.primary}
              size={42}
              iconSize={22}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.text.primary }}
              >
                {vi.notificationsTitle}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.text.secondary }}>
                {vi.notificationsSubtitle}
              </Text>
            </View>
          </View>
          <Icon source="chevron-right" size={24} color={theme.text.muted} />
        </View>
      </GlassCard>

      {/* 4. Local Data & Timezone Info Card */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.lg}
        style={{ gap: 12 }}
      >
        <View style={styles.inlineRow}>
          <IconBadge
            icon="database-outline"
            bg={palette.tealSoft}
            fg={palette.tealInk}
            size={38}
            iconSize={20}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '700', color: theme.text.primary }}
            >
              {vi.localData}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.text.secondary, lineHeight: 19 }}
            >
              {vi.localDataDescription}
            </Text>
          </View>
        </View>

        <Divider style={{ backgroundColor: theme.card.border }} />

        <View style={styles.row}>
          <View style={styles.inlineRow}>
            <IconBadge
              icon="clock-outline"
              bg={palette.purpleSoft}
              fg={palette.purpleInk}
              size={34}
              iconSize={18}
            />
            <Text
              variant="titleSmall"
              style={{ fontWeight: '600', color: theme.text.primary }}
            >
              {vi.timeZone}
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ color: theme.text.secondary }}>
            {vi.timeZoneValue}
          </Text>
        </View>
      </GlassCard>

      {/* 5. PIN & Security Card */}
      <GlassCard
        variant="elevated"
        radius="xl"
        padding={DesignSpacing.lg}
        style={{ gap: 12 }}
      >
        <PinSettings />
        <Divider style={{ backgroundColor: theme.card.border }} />
        <View style={{ gap: 4 }}>
          <Text
            accessibilityRole="header"
            variant="titleSmall"
            style={{ fontWeight: '700', color: theme.text.primary }}
          >
            {vi.security}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.text.secondary, lineHeight: 19 }}
          >
            {vi.securityDescription}
          </Text>
        </View>
      </GlassCard>

      {/* 6. Danger Zone Card */}
      <GlassCard variant="elevated" radius="xl" padding={DesignSpacing.lg}>
        <DeleteDataControl />
      </GlassCard>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  csvButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
