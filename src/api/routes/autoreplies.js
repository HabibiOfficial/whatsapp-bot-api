'use strict';

const express = require('express');
const db = require('../../db');
const { adminAuth, asyncHandler } = require('../middleware');

const router = express.Router();
router.use(adminAuth);

const listStmt = db.prepare('SELECT * FROM auto_replies ORDER BY id DESC');
const insertStmt = db.prepare(
  `INSERT INTO auto_replies (pattern, response, match_type, enabled) VALUES (?, ?, ?, ?)`,
);
const toggleStmt = db.prepare('UPDATE auto_replies SET enabled = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM auto_replies WHERE id = ?');

router.get('/', asyncHandler((_req, res) => {
  res.json({ rules: listStmt.all() });
}));

router.post('/', asyncHandler((req, res) => {
  const { pattern, response, matchType } = req.body || {};
  if (!pattern || !response) return res.status(400).json({ error: 'pattern and response required' });
  const result = insertStmt.run(pattern, response, matchType || 'contains', 1);
  res.status(201).json({ id: result.lastInsertRowid });
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
