'use strict';

const express = require('express');
const db = require('../../db');
const { adminAuth, asyncHandler } = require('../middleware');

const router = express.Router();
router.use(adminAuth);

router.get('/', asyncHandler(async (_req, res) => {
  const r = await db.query('SELECT * FROM auto_replies ORDER BY id DESC');
  res.json({ rules: r.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { pattern, response, matchType } = req.body || {};
  if (!pattern || !response) return res.status(400).json({ error: 'pattern and response required' });
  const r = await db.query(
    `INSERT INTO auto_replies (pattern, response, match_type, enabled)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [pattern, response, matchType || 'contains'],
  );
  res.status(201).json({ id: r.rows[0].id });
}));

router.patch('/:id/toggle', asyncHandler(async (req, res) => {
  const enabled = !!req.body?.enabled;
  await db.query('UPDATE auto_replies SET enabled = $1 WHERE id = $2', [enabled, req.params.id]);
  res.json({ ok: true, enabled });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM auto_replies WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
