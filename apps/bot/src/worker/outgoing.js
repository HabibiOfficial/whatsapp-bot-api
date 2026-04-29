'use strict';

/**
 * Worker: poll outgoing_messages table and dispatch via Baileys.
 *
 * Vercel REST API inserts rows with status='pending'. We claim them with an
 * UPDATE...RETURNING to avoid double-processing, then call sock.sendMessage.
 * On success we mark 'sent' and write a corresponding row in message_logs.
 */

const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const bot = require('../bot');
const { safeFetchBuffer } = require('./safe-fetch');

const STALE_PROCESSING_MINUTES = 5;
const RECOVERY_INTERVAL_MS = 60_000;

let timer = null;
let recoveryTimer = null;
let running = false;
let activeTick = null;

async function tick() {
  if (running) return;
  running = true;
  let resolveActive;
  activeTick = new Promise((r) => { resolveActive = r; });
  try {
    const sock = bot.getSocket();
    const state = bot.getState();
    if (!sock || state.status !== 'connected') {
      return;
    }

    const claim = await db.query(
      `UPDATE outgoing_messages
         SET status = 'processing', processed_at = NOW()
       WHERE id IN (
         SELECT id FROM outgoing_messages
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       RETURNING id, api_key_id, jid, type, payload`,
      [config.workerBatch],
    );

    for (const row of claim.rows) {
      try {
        await sendOne(sock, row);
        await db.query(
          `UPDATE outgoing_messages SET status='sent', processed_at=NOW() WHERE id=$1`,
          [row.id],
        );
        await db.query(
          `INSERT INTO message_logs (api_key_id, direction, jid, message, type, status)
           VALUES ($1, 'out', $2, $3, $4, 'sent')`,
          [row.api_key_id, row.jid, summarize(row), row.type],
        );
      } catch (err) {
        logger.error({ err: err.message, id: row.id }, 'send failed');
        await db.query(
          `UPDATE outgoing_messages SET status='failed', error=$1, processed_at=NOW() WHERE id=$2`,
          [err.message?.slice(0, 1000), row.id],
        );
        await db.query(
          `INSERT INTO message_logs (api_key_id, direction, jid, message, type, status, error)
           VALUES ($1, 'out', $2, $3, $4, 'failed', $5)`,
          [row.api_key_id, row.jid, summarize(row), row.type, err.message?.slice(0, 500)],
        );
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'worker tick error');
  } finally {
    running = false;
    if (resolveActive) resolveActive();
    activeTick = null;
  }
}

function summarize(row) {
  const p = row.payload || {};
  if (row.type === 'text') return (p.message || '').slice(0, 200);
  if (row.type === 'image') return `[image] ${(p.caption || '').slice(0, 100)}`;
  if (row.type === 'document') return `[document] ${(p.filename || '').slice(0, 100)}`;
  return `[${row.type}]`;
}

async function sendOne(sock, row) {
  const p = row.payload || {};
  switch (row.type) {
    case 'text':
      if (!p.message) throw new Error('payload.message required');
      await sock.sendMessage(row.jid, { text: p.message });
      return;
    case 'image': {
      if (!p.url) throw new Error('payload.url required');
      const buf = await fetchBuffer(p.url);
      await sock.sendMessage(row.jid, { image: buf, caption: p.caption || '' });
      return;
    }
    case 'document': {
      if (!p.url) throw new Error('payload.url required');
      const buf = await fetchBuffer(p.url);
      await sock.sendMessage(row.jid, {
        document: buf,
        mimetype: p.mimetype || 'application/octet-stream',
        fileName: p.filename || 'file',
      });
      return;
    }
    default:
      throw new Error(`unsupported type: ${row.type}`);
  }
}

async function fetchBuffer(url) {
  return safeFetchBuffer(url);
}

/**
 * Reclaim rows that were claimed (status='processing') by a previous worker
 * instance that died before completing. Runs at startup and periodically.
 */
async function recoverStaleProcessing() {
  try {
    const r = await db.query(
      `UPDATE outgoing_messages
         SET status = 'pending', processed_at = NULL
       WHERE status = 'processing'
         AND processed_at < NOW() - ($1::text || ' minutes')::interval
       RETURNING id`,
      [String(STALE_PROCESSING_MINUTES)],
    );
    if (r.rows.length > 0) {
      logger.warn({ count: r.rows.length }, 'recovered stale processing rows');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'recovery query failed');
  }
}

function start() {
  if (timer) return;
  recoverStaleProcessing().catch(() => {});
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err: err.message }, 'tick threw'));
  }, config.workerPollMs);
  recoveryTimer = setInterval(() => {
    recoverStaleProcessing().catch(() => {});
  }, RECOVERY_INTERVAL_MS);
  logger.info({ pollMs: config.workerPollMs, batch: config.workerBatch }, 'worker started');
}

async function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (recoveryTimer) { clearInterval(recoveryTimer); recoveryTimer = null; }
  if (activeTick) {
    logger.info('waiting for in-flight tick to finish');
    await Promise.race([
      activeTick,
      new Promise((res) => setTimeout(res, 10_000)),
    ]);
  }
}

module.exports = { start, stop };
