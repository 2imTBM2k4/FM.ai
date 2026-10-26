// Initial local schema; encryption is enabled by the native connection, not this DDL.
export const INITIAL_SCHEMA = String.raw`
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash','bank','ewallet','credit_card','savings','other')),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  initial_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(initial_balance) = 'integer' AND initial_balance BETWEEN -100000000000 AND 100000000000),          -- may be negative (credit card)
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_goal_funding INTEGER NOT NULL DEFAULT 0,          -- provisional, see OD13
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  system_key TEXT UNIQUE,                              -- NULL for custom categories, e.g. 'expense.food.coffee'
  parent_id TEXT REFERENCES categories(id),            -- max depth 2 (parent + child), enforced in code
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
  is_fixed_cost INTEGER NOT NULL DEFAULT 0,            -- used by analysis (fixed vs variable expenses)
  icon TEXT,
  color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  counterparty_label TEXT NOT NULL,                    -- user-entered, local only, never sent to AI
  direction TEXT NOT NULL CHECK (direction IN ('borrowed','lent')),
  due_on TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recurring_rules (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0 AND amount <= 100000000000),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  to_wallet_id TEXT REFERENCES wallets(id),
  category_id TEXT REFERENCES categories(id),
  note TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),     -- 1 = Monday ... 7 = Sunday
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),  -- clamped to the last day of short months
  start_on TEXT NOT NULL,
  end_on TEXT,
  last_generated_on TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  remind_before_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'expense','income','transfer',
    'debt_borrow','debt_lend','debt_repay_paid','debt_repay_received')),
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0 AND amount <= 100000000000),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),      -- for transfer: the source wallet
  to_wallet_id TEXT REFERENCES wallets(id),            -- transfer only: the destination wallet
  category_id TEXT REFERENCES categories(id),          -- expense/income only
  debt_id TEXT REFERENCES debts(id),                   -- debt_* kinds only
  occurred_on TEXT NOT NULL,                           -- 'YYYY-MM-DD' local date
  occurred_at TEXT NOT NULL,                           -- ISO-8601 with offset
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','parsed','recurring','import')),
  recurring_rule_id TEXT REFERENCES recurring_rules(id),
  raw_input TEXT,                                      -- original free text when parsed; stays local
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (kind = 'transfer' AND to_wallet_id IS NOT NULL AND to_wallet_id <> wallet_id
       AND category_id IS NULL AND debt_id IS NULL)
    OR (kind IN ('expense','income') AND to_wallet_id IS NULL AND debt_id IS NULL)
    OR (kind LIKE 'debt\_%' ESCAPE '\' AND to_wallet_id IS NULL AND category_id IS NULL AND debt_id IS NOT NULL)
  )
);
CREATE INDEX idx_tx_occurred_on ON transactions(occurred_on);
CREATE INDEX idx_tx_wallet_date ON transactions(wallet_id, occurred_on);
CREATE INDEX idx_tx_category_date ON transactions(category_id, occurred_on);
CREATE UNIQUE INDEX ux_tx_recurring_once
  ON transactions(recurring_rule_id, occurred_on) WHERE recurring_rule_id IS NOT NULL;

CREATE TABLE recurring_skips (                         -- occurrences the user deleted or moved; never regenerate
  recurring_rule_id TEXT NOT NULL REFERENCES recurring_rules(id),
  occurred_on TEXT NOT NULL,
  PRIMARY KEY (recurring_rule_id, occurred_on)
);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id),          -- NULL = overall monthly budget
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0 AND amount <= 100000000000),
  warn_percent INTEGER NOT NULL DEFAULT 80 CHECK (warn_percent BETWEEN 1 AND 100),
  start_month TEXT NOT NULL,                           -- 'YYYY-MM'
  end_month TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE budget_alerts_sent (
  budget_id TEXT NOT NULL REFERENCES budgets(id),
  month TEXT NOT NULL,
  threshold_percent INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (budget_id, month, threshold_percent)
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL CHECK (typeof(target_amount) = 'integer' AND target_amount > 0 AND target_amount <= 100000000000),
  deadline_on TEXT,
  funding_wallet_id TEXT REFERENCES wallets(id),       -- progress = wallet balance if set
  manual_saved_amount INTEGER NOT NULL DEFAULT 0 CHECK (typeof(manual_saved_amount) = 'integer' AND manual_saved_amount BETWEEN 0 AND 100000000000),      -- progress if no funding wallet
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE parse_learning (                          -- local personalization of the classifier
  token_key TEXT NOT NULL,                             -- normalized token (lowercase, diacritics stripped)
  kind TEXT NOT NULL,
  category_id TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (token_key, kind, category_id)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE ai_usage_local (                          -- display only; the proxy is authoritative
  usage_date TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX ux_parse_learning_nullable_category
  ON parse_learning(token_key, kind, COALESCE(category_id, ''));

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at, id);

CREATE VIEW v_wallet_balance AS
SELECT w.id AS wallet_id,
       w.initial_balance + COALESCE(SUM(CASE
         WHEN t.wallet_id = w.id AND t.kind IN ('income','debt_borrow','debt_repay_received') THEN t.amount
         WHEN t.wallet_id = w.id AND t.kind IN ('expense','debt_lend','debt_repay_paid','transfer') THEN -t.amount
         WHEN t.to_wallet_id = w.id AND t.kind = 'transfer' THEN t.amount
         ELSE 0 END), 0) AS balance
FROM wallets w
LEFT JOIN transactions t ON t.wallet_id = w.id OR t.to_wallet_id = w.id
GROUP BY w.id;
`;
