'use strict';

const db = require('./db');

const POLL_INTERVAL_MS = 250;
const DEFAULT_WAIT_MS = 8000;

/**
 * Enqueue an outgoing message and (optionally) wait for the bot worker to
 * process it. Returns the final row state (sent/failed) or 'pending' if we
 * timed out — caller can return 202 in that case.
 */
async function enqueueAndWait(apiKeyId, jid, type, payload, waitMs = DEFAULT_WAIT_MS) {
  const ins = await db.query(
    `INSERT INTO outgoing_messages (api_key_id, jid, type, payload, status)
     VALUES ($1, $2, $3, $4::jsonb, 'pending')
     RETURNING id, created_at`,
    [apiKeyId, jid, type, JSON.stringify(payload)],
  );
  const messageId = ins.rows[0].id;

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const r = await db.query(
      `SELECT id, status, wa_message_id, error, processed_at
       FROM outgoing_messages WHERE id = $1`,
      [messageId],
    );
    const row = r.rows[0];
    if (row && row.status !== 'pending' && row.status !== 'processing') {
      return { messageId, ...row };
    }
  }
  return { messageId, status: 'pending', timeout: true };
}

async function getBotStatus() {
  const r = await db.query(
    `SELECT status, user_jid, user_name, updated_at FROM bot_state WHERE id = 1`,
  );
  return r.rows[0] || { status: 'unknown' };
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = { enqueueAndWait, getBotStatus };
