import { beforeEach, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  expoGo: true,
  failMigration: false,
  failBackfill: false,
  calls: [] as string[],
  opened: [] as string[],
}));

vi.mock('expo', () => ({ isRunningInExpoGo: () => native.expoGo }));
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string) => {
    native.opened.push(name);
    const db = {
      name,
      execAsync: async (sql: string) => {
        if (
          sql.includes('CREATE TABLE schema_migrations') &&
          native.failMigration
        )
          throw new Error('INJECTED_MIGRATION_FAILURE');
      },
      runAsync: async () => undefined,
      getFirstAsync: async () => ({ user_version: 0 }),
      getAllAsync: async (sql: string) => {
        if (
          native.failBackfill &&
          sql.includes('SELECT id,note FROM transactions')
        )
          throw new Error('INJECTED_BACKFILL_FAILURE');
        return sql.includes('integrity_check')
          ? [{ integrity_check: 'ok' }]
          : [];
      },
      withTransactionAsync: async (task: () => Promise<void>) => task(),
      closeAsync: async () => {
        native.calls.push(`close:${name}`);
      },
    };
    return db;
  },
  backupDatabaseAsync: async ({
    sourceDatabase,
    destDatabase,
  }: {
    sourceDatabase: { name: string };
    destDatabase: { name: string };
  }) => {
    native.calls.push(`backup:${sourceDatabase.name}->${destDatabase.name}`);
  },
  deleteDatabaseAsync: async (name: string) => {
    native.calls.push(`delete:${name}`);
  },
}));

beforeEach(() => {
  vi.resetModules();
  native.expoGo = true;
  native.failMigration = false;
  native.failBackfill = false;
  native.calls = [];
  native.opened = [];
});

it('snapshots before upgrading and deletes the snapshot only after success', async () => {
  const { withDatabase } = await import('./connection');
  await withDatabase(async () => undefined);
  expect(native.calls).toEqual([
    'backup:pfm-preview.db->pfm-preview-migration.db',
    'close:pfm-preview-migration.db',
    'delete:pfm-preview-migration.db',
  ]);
});

it('restores the snapshot on migration failure, keeps it for recovery, and permits retry', async () => {
  native.failMigration = true;
  const { withDatabase } = await import('./connection');
  await expect(withDatabase(async () => undefined)).rejects.toThrow(
    'INJECTED_MIGRATION_FAILURE',
  );
  expect(native.calls).toEqual([
    'backup:pfm-preview.db->pfm-preview-migration.db',
    'backup:pfm-preview-migration.db->pfm-preview.db',
    'close:pfm-preview-migration.db',
    'close:pfm-preview.db',
  ]);
  native.failMigration = false;
  await expect(withDatabase(async () => 'retried')).resolves.toBe('retried');
});

it('restores the native snapshot and keeps it when the search backfill fails', async () => {
  native.failBackfill = true;
  const { withDatabase } = await import('./connection');
  await expect(withDatabase(async () => undefined)).rejects.toThrow(
    'INJECTED_BACKFILL_FAILURE',
  );
  expect(native.calls).toEqual([
    'backup:pfm-preview.db->pfm-preview-migration.db',
    'backup:pfm-preview-migration.db->pfm-preview.db',
    'close:pfm-preview-migration.db',
    'close:pfm-preview.db',
  ]);
});

it('waits for in-flight operations before closing and deleting both database files', async () => {
  const { withDatabase, deletePreviewData } = await import('./connection');
  await withDatabase(async () => undefined);
  native.calls = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = withDatabase(async () => {
    await pending;
    native.calls.push('write-finished');
  });
  const deletion = deletePreviewData();
  await Promise.resolve();
  expect(native.calls).toEqual([]);
  release();
  await write;
  await deletion;
  expect(native.calls).toEqual([
    'write-finished',
    'close:pfm-preview.db',
    'close:pfm-preview-migration.db',
    'delete:pfm-preview-migration.db',
    'close:pfm-preview.db',
    'delete:pfm-preview.db',
  ]);
  await expect(withDatabase(async () => 'new database')).resolves.toBe(
    'new database',
  );
});

it('refuses unencrypted preview startup outside Expo Go without opening any file', async () => {
  native.expoGo = false;
  const { withDatabase } = await import('./connection');
  await expect(withDatabase(async () => undefined)).rejects.toThrow(
    'PREVIEW_REQUIRES_EXPO_GO',
  );
  expect(native.opened).toEqual([]);
});
