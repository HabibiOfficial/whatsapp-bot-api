-- Postgres schema for whatsapp-bot-api.
-- Apply this manually once on Neon (or any Postgres) before starting bot/web.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS api_keys (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT        NOT NULL,
  key          TEXT        UNIQUE NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  rate_limit   INT         NOT NULL DEFAULT 60,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS outgoing_messages (
  id            BIGSERIAL PRIMARY KEY,
  api_key_id    BIGINT      REFERENCES api_keys(id) ON DELETE SET NULL,
  jid           TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  wa_message_id TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outgoing_pending
  ON outgoing_messages (created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS message_logs (
  id         BIGSERIAL PRIMARY KEY,
  api_key_id BIGINT      REFERENCES api_keys(id) ON DELETE SET NULL,
  direction  TEXT        NOT NULL,
  jid        TEXT        NOT NULL,
  message    TEXT,
  type       TEXT,
  status     TEXT        NOT NULL,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON message_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_apikey  ON message_logs (api_key_id);

CREATE TABLE IF NOT EXISTS auto_replies (
  id         BIGSERIAL PRIMARY KEY,
  pattern    TEXT        NOT NULL,
  response   TEXT        NOT NULL,
  match_type TEXT        NOT NULL DEFAULT 'contains',
  enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_state (
  id            INT         PRIMARY KEY DEFAULT 1,
  status        TEXT        NOT NULL DEFAULT 'disconnected',
  user_jid      TEXT,
  user_name     TEXT,
  qr_data_url   TEXT,
  started_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 1)
);

INSERT INTO bot_state (id, status) VALUES (1, 'disconnected')
  ON CONFLICT (id) DO NOTHING;

-- Fixed-window rate limiting counters. One row per (api_key_id, minute bucket).
-- Vercel-side authenticate() does an UPSERT and rejects when count > rate_limit.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  api_key_id   BIGINT      NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window
  ON rate_limit_counters (window_start);
