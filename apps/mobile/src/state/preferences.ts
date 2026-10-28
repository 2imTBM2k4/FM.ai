import { create } from 'zustand';
import type {
  AppLanguage,
  CurrencyCode,
  ThemeMode,
} from '@/constants/design-tokens';
import { withDatabase } from '@/data/connection';
import type { Queries } from '@/data/migrate';
import { applyDevSeedData, removeDevSeedData } from '@/data/seed-data';

export interface UserPreferences {
  language: AppLanguage;
  currency: CurrencyCode;
  themeMode: ThemeMode;
  seedEnabled: boolean;
}

interface PreferencesState extends UserPreferences {
  hydrated: boolean;
  pendingTransactionEntry: 'manual' | 'natural' | null;
  hydratePreferences(): Promise<void>;
  setLanguage(language: AppLanguage): Promise<void>;
  setCurrency(currency: CurrencyCode): Promise<void>;
  setThemeMode(themeMode: ThemeMode): Promise<void>;
  setSeedEnabled(enabled: boolean): Promise<void>;
  requestAddTransaction(mode?: 'manual' | 'natural'): void;
  consumeAddTransaction(): 'manual' | 'natural' | null;
}

const PREF_KEYS = {
  language: 'pref_language',
  currency: 'pref_currency',
  themeMode: 'pref_theme_mode',
  seedEnabled: 'pref_seed_enabled',
} as const;

/**
 * Reads a single preference value from the local SQLite settings table.
 */
async function readSettingValue(
  db: Queries,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

/**
 * Upserts a single preference key-value pair into the local SQLite settings table.
 */
async function writeSettingValue(
  db: Queries,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

/**
 * Formats an integer amount in the smallest currency unit into a human-readable currency string.
 * Money is strictly stored and processed as integers (never floating-point).
 */
export function formatCurrencyAmount(
  amountInteger: number,
  currency: CurrencyCode,
  options?: { showPlus?: boolean; compact?: boolean },
): string {
  const safeInteger = Math.trunc(Number.isFinite(amountInteger) ? amountInteger : 0);
  const isNegative = safeInteger < 0;
  const absValue = Math.abs(safeInteger);
  const prefix = isNegative ? '-' : options?.showPlus && absValue > 0 ? '+' : '';

  if (currency === 'USD') {
    // When displaying VND integer amounts in USD mode or integer cents,
    // if amounts are >= 1000 VND, convert using a fixed integer ratio (25,000 VND = 100 cents)
    // so existing local integer VND data displays naturally without floating-point storage.
    const totalCents =
      absValue >= 1000 ? Math.round((absValue * 100) / 25000) : absValue * 100;
    const wholeDollars = Math.floor(totalCents / 100);
    const cents = totalCents % 100;
    if (options?.compact && wholeDollars >= 1000) {
      const compactThousands = (wholeDollars / 1000).toFixed(1).replace(/\.0$/, '');
      return `${prefix}$${compactThousands}k`;
    }
    const formattedDollars = wholeDollars
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${prefix}$${formattedDollars}.${cents.toString().padStart(2, '0')}`;
  }

  if (options?.compact) {
    if (absValue >= 1_000_000_000) {
      const billions = (absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
      return `${prefix}${billions}B ₫`;
    }
    if (absValue >= 1_000_000) {
      const millions = (absValue / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `${prefix}${millions}M ₫`;
    }
    if (absValue >= 1_000) {
      const thousands = Math.round(absValue / 1_000);
      return `${prefix}${thousands}k ₫`;
    }
  }

  const grouped = absValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${prefix}${grouped} ₫`;
}

export const usePreferences = create<PreferencesState>()((set, get) => ({
  language: 'vi',
  currency: 'VND',
  themeMode: 'light',
  seedEnabled: false,
  hydrated: false,
  pendingTransactionEntry: null,

  requestAddTransaction(mode = 'manual') {
    set({ pendingTransactionEntry: mode });
  },

  consumeAddTransaction() {
    const current = get().pendingTransactionEntry;
    if (current !== null) {
      set({ pendingTransactionEntry: null });
    }
    return current;
  },

  async hydratePreferences() {
    try {
      const loaded = await withDatabase(async (db) => {
        const language = await readSettingValue(db, PREF_KEYS.language);
        const currency = await readSettingValue(db, PREF_KEYS.currency);
        const themeMode = await readSettingValue(db, PREF_KEYS.themeMode);
        const seedEnabled = await readSettingValue(db, PREF_KEYS.seedEnabled);
        return {
          language: (language === 'en' || language === 'vi'
            ? language
            : 'vi') as AppLanguage,
          currency: (currency === 'USD' || currency === 'VND'
            ? currency
            : 'VND') as CurrencyCode,
          themeMode: (themeMode === 'dark' || themeMode === 'light'
            ? themeMode
            : 'light') as ThemeMode,
          seedEnabled: seedEnabled === 'true',
        };
      });
      set({ ...loaded, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async setLanguage(language) {
    set({ language });
    try {
      await withDatabase((db) =>
        writeSettingValue(db, PREF_KEYS.language, language),
      );
    } catch {
      // Keep in-memory state if persistence is unavailable in tests.
    }
  },

  async setCurrency(currency) {
    set({ currency });
    try {
      await withDatabase((db) =>
        writeSettingValue(db, PREF_KEYS.currency, currency),
      );
    } catch {
      // Keep in-memory state if persistence is unavailable in tests.
    }
  },

  async setThemeMode(themeMode) {
    set({ themeMode });
    try {
      await withDatabase((db) =>
        writeSettingValue(db, PREF_KEYS.themeMode, themeMode),
      );
    } catch {
      // Keep in-memory state if persistence is unavailable in tests.
    }
  },

  async setSeedEnabled(enabled) {
    set({ seedEnabled: enabled });
    try {
      await withDatabase(async (db) => {
        if (enabled) {
          await applyDevSeedData(db);
        } else {
          await removeDevSeedData(db);
        }
        await writeSettingValue(
          db,
          PREF_KEYS.seedEnabled,
          enabled ? 'true' : 'false',
        );
      });
    } catch {
      // Keep in-memory state if persistence is unavailable in tests.
    }
  },
}));
