'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');
const { adminAuth, asyncHandler } = require('../middleware');

const router = express.Router();
router.use(adminAuth);

const listStmt = db.prepare(
  `SELECT id, name, key, enabled, rate_limit, created_at, last_used_at
   FROM api_keys ORDER BY created_at DESC`,
);
const insertStmt = db.prepare(
  `INSERT INTO api_keys (name, key, rate_limit) VALUES (?, ?, ?)`,
);
const toggleStmt = db.prepare(`UPDATE api_keys SET enabled = ? WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM api_keys WHERE id = ?`);

router.get('/', asyncHandler((req, res) => {
  res.json({ keys: listStmt.all() });
}));

router.post('/', asyncHandler((req, res) => {
  const { name, rateLimit } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const key = `wba_${uuidv4().replace(/-/g, '')}`;
  const result = insertStmt.run(name, key, rateLimit || 60);
  res.status(201).json({ id: result.lastInsertRowid, name, key, enabled: 1 });
}));

router.patch('/:id/toggle', asyncHandler((req, res) => {
  const enabled = req.body?.enabled ? 1 : 0;
  toggleStmt.run(enabled, req.params.id);
  res.json({ ok: true, enabled });
}));

router.delete('/:id', asyncHandler((req, res) => {
  deleteStmt.run(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
