'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const db = require('../../db');
const logger = require('../../logger');
const bot = require('../../bot');
const { apiKeyAuth, asyncHandler } = require('../middleware');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => req.apiKey?.rate_limit || 60,
  keyGenerator: (req) => req.apiKey?.key || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(apiKeyAuth, limiter);

const insertLog = db.prepare(
  `INSERT INTO message_logs (api_key_id, direction, jid, message, type, status, error)
   VALUES (?, 'out', ?, ?, ?, ?, ?)`,
);

function normalizeJid(input) {
  if (!input) return null;
  if (input.includes('@')) return input;
  const digits = String(input).replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function ensureConnected() {
  const sock = bot.getSocket();
  const state = bot.getState();
  if (!sock || state.status !== 'connected') {
    const err = new Error('bot not connected');
    err.status = 503;
    throw err;
  }
  return sock;
}

router.post('/send-text', asyncHandler(async (req, res) => {
  const { to, message } = req.body || {};
  const jid = normalizeJid(to);
  if (!jid || !message) return res.status(400).json({ error: 'to and message required' });

  const sock = ensureConnected();
  try {
    const result = await sock.sendMessage(jid, { text: message });
    insertLog.run(req.apiKey.id, jid, message, 'text', 'sent', null);
    res.json({ ok: true, id: result?.key?.id });
  } catch (err) {
    insertLog.run(req.apiKey.id, jid, message, 'text', 'failed', err.message);
    throw err;
  }
}));

router.post('/send-image', asyncHandler(async (req, res) => {
  const { to, url, caption } = req.body || {};
  const jid = normalizeJid(to);
  if (!jid || !url) return res.status(400).json({ error: 'to and url required' });

  const sock = ensureConnected();
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const result = await sock.sendMessage(jid, { image: Buffer.from(data), caption });
  insertLog.run(req.apiKey.id, jid, caption || '[image]', 'image', 'sent', null);
  res.json({ ok: true, id: result?.key?.id });
}));

router.post('/send-document', asyncHandler(async (req, res) => {
  const { to, url, filename, mimetype, caption } = req.body || {};
  const jid = normalizeJid(to);
  if (!jid || !url) return res.status(400).json({ error: 'to and url required' });

  const sock = ensureConnected();
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const result = await sock.sendMessage(jid, {
    document: Buffer.from(data),
    fileName: filename || 'file',
    mimetype: mimetype || 'application/octet-stream',
    caption,
  });
  insertLog.run(req.apiKey.id, jid, filename || '[document]', 'document', 'sent', null);
  res.json({ ok: true, id: result?.key?.id });
}));

router.post('/broadcast', asyncHandler(async (req, res) => {
  const { recipients, message, delayMs } = req.body || {};
  if (!Array.isArray(recipients) || !message) {
    return res.status(400).json({ error: 'recipients[] and message required' });
  }
  const sock = ensureConnected();
  const results = [];
  for (const r of recipients) {
    const jid = normalizeJid(r);
    if (!jid) {
      results.push({ to: r, ok: false, error: 'invalid recipient' });
      continue;
    }
    try {
      await sock.sendMessage(jid, { text: message });
      insertLog.run(req.apiKey.id, jid, message, 'broadcast', 'sent', null);
      results.push({ to: jid, ok: true });
    } catch (err) {
      logger.error({ err: err.message, jid }, 'broadcast item failed');
      insertLog.run(req.apiKey.id, jid, message, 'broadcast', 'failed', err.message);
      results.push({ to: jid, ok: false, error: err.message });
    }
    if (delayMs) await new Promise((r2) => setTimeout(r2, Number(delayMs)));
  }
  res.json({ ok: true, results });
}));

router.get('/check-number', asyncHandler(async (req, res) => {
  const number = req.query.number;
  if (!number) return res.status(400).json({ error: 'number required' });
  const sock = ensureConnected();
  const [result] = await sock.onWhatsApp(String(number).replace(/[^0-9]/g, ''));
  res.json({ exists: Boolean(result?.exists), jid: result?.jid || null });
}));

module.exports = router;
