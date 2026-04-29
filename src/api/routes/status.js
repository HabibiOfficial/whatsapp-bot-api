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

router.get('/', adminAuth, asyncHandler((_req, res) => {
  const s = bot.getState();
  const stats = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM api_keys) AS total_keys,
        (SELECT COUNT(*) FROM api_keys WHERE enabled = 1) AS active_keys,
        (SELECT COUNT(*) FROM message_logs) AS total_messages,
        (SELECT COUNT(*) FROM message_logs WHERE direction = 'in') AS incoming,
        (SELECT COUNT(*) FROM message_logs WHERE direction = 'out' AND status = 'sent') AS outgoing,
        (SELECT COUNT(*) FROM message_logs WHERE created_at > datetime('now','-1 day')) AS last_24h`,
    )
    .get();
  res.json({ ...s, stats });
}));

router.get('/qr', adminAuth, asyncHandler((_req, res) => {
  const s = bot.getState();
  res.json({ status: s.status, qrDataUrl: s.qrDataUrl });
}));

router.post('/logout', adminAuth, asyncHandler(async (_req, res) => {
  await bot.logout();
  res.json({ ok: true });
}));

router.get('/logs', adminAuth, asyncHandler((req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const rows = db
    .prepare(
      `SELECT id, api_key_id, direction, jid, message, type, status, error, created_at
       FROM message_logs ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);
  res.json({ logs: rows });
}));

module.exports = router;
