'use strict';

/**
 * Worker: poll outgoing_messages table and dispatch via Baileys.
 *
 * Vercel REST API inserts rows with status='pending'. We claim them with an
 * UPDATE...RETURNING to avoid double-processing, then call sock.sendMessage.
 * On success we mark 'sent' and write a corresponding row in message_logs.
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const bot = require('../bot');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
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
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(res.data);
}

function start() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err: err.message }, 'tick threw'));
  }, config.workerPollMs);
  logger.info({ pollMs: config.workerPollMs, batch: config.workerBatch }, 'worker started');
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop };
