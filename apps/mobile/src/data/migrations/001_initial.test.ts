import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { INITIAL_SCHEMA } from './001_initial';

let db: DatabaseSync;

// Insert a synthetic transaction into the real migration schema.
function insertTransaction(
  id: string,
  kind: string,
  amount: number,
  extras: {
    destination?: string;
    category?: string;
    debt?: string;
    recurring?: string;
  } = {},
) {
  db.prepare(
    `INSERT INTO transactions
    (id, kind, amount, wallet_id, to_wallet_id, category_id, debt_id, recurring_rule_id, occurred_on, occurred_at, created_at, updated_at)
    VALUES (?, ?, ?, 'wallet-a', ?, ?, ?, ?, '2026-10-23', '2026-10-23T09:00:00+07:00', '2026-10-23T09:00:00+07:00', '2026-10-23T09:00:00+07:00')`,
  ).run(
    id,
    kind,
    amount,
    extras.destination ?? null,
    extras.category ?? null,
    extras.debt ?? null,
    extras.recurring ?? null,
  );
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(INITIAL_SCHEMA);
  db.exec(`INSERT INTO wallets (id, name, kind, initial_balance, created_at, updated_at) VALUES
    ('wallet-a', 'Ví giả lập A', 'cash', 1000000, '2026-10-23T09:00:00+07:00', '2026-10-23T09:00:00+07:00'),
    ('wallet-b', 'Ví giả lập B', 'bank', 0, '2026-10-23T09:00:00+07:00', '2026-10-23T09:00:00+07:00')`);
  db.exec(`INSERT INTO categories (id, name, kind, created_at, updated_at)
    VALUES ('category-a', 'Danh mục giả lập', 'expense', '2026-10-23T09:00:00Z', '2026-10-23T09:00:00Z');
    INSERT INTO debts (id, counterparty_label, direction, created_at, updated_at)
    VALUES ('debt-a', 'Đối tác giả lập', 'borrowed', '2026-10-23T09:00:00Z', '2026-10-23T09:00:00Z');`);
});

afterEach(() => db.close());

describe('initial SQLite schema', () => {
  it('derives both wallet balances from signed transaction flows', () => {
    insertTransaction('income', 'income', 500_000);
    insertTransaction('expense', 'expense', 200_000);
    insertTransaction('transfer', 'transfer', 300_000, {
      destination: 'wallet-b',
    });
    expect(
      db
        .prepare(
          'SELECT wallet_id, balance FROM v_wallet_balance ORDER BY wallet_id',
        )
        .all(),
    ).toEqual([
      { wallet_id: 'wallet-a', balance: 1_000_000 },
      { wallet_id: 'wallet-b', balance: 300_000 },
    ]);
  });

  it('rejects inconsistent transfer and debt linkages', () => {
    expect(() => insertTransaction('a', 'transfer', 1)).toThrow();
    expect(() =>
      insertTransaction('b', 'transfer', 1, { destination: 'wallet-a' }),
    ).toThrow();
    expect(() =>
      insertTransaction('c', 'transfer', 1, {
        destination: 'wallet-b',
        category: 'category-a',
      }),
    ).toThrow();
    expect(() => insertTransaction('d', 'debt_borrow', 1)).toThrow();
    expect(() =>
      insertTransaction('e', 'expense', 1, { debt: 'debt-a' }),
    ).toThrow();
    expect(() =>
      insertTransaction('f', 'transfer', 1, { destination: 'missing-wallet' }),
    ).toThrow();
  });

  it.each([0, -1, 0.5, 100_000_000_001])(
    'rejects invalid stored transaction amount %s',
    (amount) => {
      expect(() => insertTransaction('invalid', 'expense', amount)).toThrow();
    },
  );

  it('prevents duplicate recurring occurrences and preserves explicit skips', () => {
    db.exec(`INSERT INTO recurring_rules
      (id, kind, amount, wallet_id, frequency, start_on, created_at, updated_at)
      VALUES ('rule', 'expense', 100, 'wallet-a', 'monthly', '2026-10-01', '2026-10-01T12:00:00Z', '2026-10-01T12:00:00Z')`);
    insertTransaction('first', 'expense', 100, { recurring: 'rule' });
    expect(() =>
      insertTransaction('second', 'expense', 100, { recurring: 'rule' }),
    ).toThrow();
    db.exec(
      `INSERT INTO recurring_skips (recurring_rule_id, occurred_on) VALUES ('rule', '2026-10-23')`,
    );
    expect(
      db.prepare('SELECT count(*) AS count FROM recurring_skips').get(),
    ).toEqual({ count: 1 });
  });

  it('keeps a single learning mapping even when its category is null', () => {
    const insert =
      db.prepare(`INSERT INTO parse_learning (token_key, kind, category_id, hit_count, updated_at)
      VALUES ('synthetic', 'expense', NULL, 1, '2026-10-23T12:00:00Z')`);
    insert.run();
    expect(() => insert.run()).toThrow();
  });

  it('stores local user messages without an assistant response', () => {
    db.prepare(
      'INSERT INTO chat_messages (id, text, created_at) VALUES (?, ?, ?)',
    ).run('message', 'Câu hỏi giả lập', '2026-10-23T12:00:00Z');
    expect(db.prepare('SELECT text FROM chat_messages').get()).toEqual({
      text: 'Câu hỏi giả lập',
    });
    expect(() =>
      db
        .prepare('INSERT INTO chat_messages VALUES (?, ?, ?)')
        .run('empty', '', '2026-10-23T12:00:00Z'),
    ).toThrow();
  });

  it('starts with clean integrity and foreign-key checks', () => {
    expect(db.prepare('PRAGMA integrity_check').get()).toEqual({
      integrity_check: 'ok',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
