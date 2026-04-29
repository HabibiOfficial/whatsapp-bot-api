'use strict';

const express = require('express');
const db = require('../../db');
const bot = require('../../bot');
const { adminAuth, asyncHandler } = require('../middleware');

const router = express.Router();

router.get('/public', (_req, res) => {
  const s = bot.getState();
  res.json({ status: s.status, connected: s.status === 'connected' });
});

router.get('/', adminAuth, asyncHandler(async (_req, res) => {
  const s = bot.getState();
  const r = await db.query(
    `SELECT
      (SELECT COUNT(*) FROM api_keys)::int AS total_keys,
      (SELECT COUNT(*) FROM api_keys WHERE enabled = TRUE)::int AS active_keys,
      (SELECT COUNT(*) FROM message_logs)::int AS total_messages,
      (SELECT COUNT(*) FROM message_logs WHERE direction = 'in')::int AS incoming,
      (SELECT COUNT(*) FROM message_logs WHERE direction = 'out' AND status = 'sent')::int AS outgoing,
      (SELECT COUNT(*) FROM message_logs WHERE created_at > NOW() - INTERVAL '1 day')::int AS last_24h,
      (SELECT COUNT(*) FROM outgoing_messages WHERE status = 'pending')::int AS queued`,
  );
  res.json({ ...s, stats: r.rows[0] });
}));

router.get('/qr', adminAuth, asyncHandler((_req, res) => {
  const s = bot.getState();
  res.json({ status: s.status, qrDataUrl: s.qrDataUrl });
}));

router.post('/logout', adminAuth, asyncHandler(async (_req, res) => {
  await bot.logout();
  res.json({ ok: true });
}));

router.get('/logs', adminAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const r = await db.query(
    `SELECT id, api_key_id, direction, jid, message, type, status, error, created_at
     FROM message_logs ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  res.json({ logs: r.rows });
}));

module.exports = router;
