-- Cloudflare D1: аккаунты и snapshot-синк (фаза 2 local-first).
-- Применение: wrangler d1 migrations apply kar-sync --remote
-- Локально: wrangler d1 migrations apply kar-sync --local

CREATE TABLE IF NOT EXISTS cf_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cf_sync_snapshots (
  user_id TEXT PRIMARY KEY REFERENCES cf_users (id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  client_id TEXT
);

CREATE INDEX IF NOT EXISTS cf_sync_snapshots_updated_idx ON cf_sync_snapshots (updated_at);
