'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const findKey = db.prepare('SELECT * FROM api_keys WHERE key = ? AND enabled = 1');
const touchKey = db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?");

function adminAuth(req, res, next) {
  const token = req.cookies?.admin_token || extractBearer(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') throw new Error('forbidden');
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

function apiKeyAuth(req, res, next) {
  const key = req.header('x-api-key') || req.query.apikey;
  if (!key) return res.status(401).json({ error: 'missing api key' });

  const row = findKey.get(key);
  if (!row) return res.status(401).json({ error: 'invalid api key' });

  touchKey.run(row.id);
  req.apiKey = row;
  next();
}

function extractBearer(req) {
  const auth = req.header('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { adminAuth, apiKeyAuth, asyncHandler };
