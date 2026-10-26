import { toMoney } from '@pfm/domain';
import type { WalletInput } from '@pfm/contracts';

import type { Database, Queries } from './migrate';
import { DEFAULT_WALLET_ID } from './seed';

export interface WalletRow {
  id: string;
  name: string;
  kind: WalletInput['kind'];
  balance: number;
  initial_balance: number;
  is_goal_funding: number;
  is_archived: number;
  sort_order: number;
}

export interface ChatRow {
  id: string;
  text: string;
  created_at: string;
}

export async function readOnboarding(db: Queries) {
  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'onboarding_complete'",
  );
  return result?.value === 'true';
}

export async function finishOnboarding(
  db: Database,
  startingBalance: number,
  timestamp: string,
) {
  toMoney(startingBalance);
  await db.transaction(async (transaction) => {
    if (await readOnboarding(transaction)) return;
    await transaction.runAsync(
      'UPDATE wallets SET initial_balance = ?, updated_at = ? WHERE id = ?',
      startingBalance,
      timestamp,
      DEFAULT_WALLET_ID,
    );
    await transaction.runAsync(
      "INSERT INTO settings (key, value) VALUES ('onboarding_complete', 'true')",
    );
  });
}

export function listWallets(db: Queries, includeArchived = false) {
  return db.getAllAsync<WalletRow>(
    `SELECT w.id, w.name, w.kind, w.initial_balance, w.is_goal_funding, w.is_archived, w.sort_order, b.balance FROM wallets w
     JOIN v_wallet_balance b ON b.wallet_id = w.id
     WHERE (? = 1 OR w.is_archived = 0) ORDER BY w.sort_order, w.created_at, w.id`,
    includeArchived ? 1 : 0,
  );
}

export function listChatMessages(db: Queries, before?: ChatRow) {
  return before
    ? db.getAllAsync<ChatRow>(
        `SELECT id, text, created_at FROM chat_messages WHERE (created_at, id) < (?, ?)
       ORDER BY created_at DESC, id DESC LIMIT 50`,
        before.created_at,
        before.id,
      )
    : db.getAllAsync<ChatRow>(
        'SELECT id, text, created_at FROM chat_messages ORDER BY created_at DESC, id DESC LIMIT 50',
      );
}

export async function saveChatMessage(
  db: Queries,
  id: string,
  text: string,
  timestamp: string,
) {
  const value = text.trim();
  if (!value || value.length > 500) throw new RangeError('CHAT_TEXT_INVALID');
  await db.runAsync(
    'INSERT INTO chat_messages (id, text, created_at) VALUES (?, ?, ?)',
    id,
    value,
    timestamp,
  );
}
