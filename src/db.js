'use strict';

const Database = require('better-sqlite3');
const config = require('./config');
const logger = require('./logger');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    rate_limit INTEGER NOT NULL DEFAULT 60,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    direction TEXT NOT NULL,
    jid TEXT NOT NULL,
    message TEXT,
    type TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_logs_created ON message_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_apikey ON message_logs(api_key_id);

  CREATE TABLE IF NOT EXISTS auto_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    response TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'contains',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

logger.info({ dbPath: config.dbPath }, 'database initialized');

module.exports = db;
