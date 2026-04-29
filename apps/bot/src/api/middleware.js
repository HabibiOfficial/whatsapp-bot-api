'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

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

function extractBearer(req) {
  const auth = req.header('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { adminAuth, asyncHandler };
