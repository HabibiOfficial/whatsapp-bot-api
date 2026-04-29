'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');
const { adminAuth, asyncHandler } = require('../middleware');

const router = express.Router();
router.use(adminAuth);

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT id, name, key, enabled, rate_limit, created_at, last_used_at
     FROM api_keys ORDER BY created_at DESC`,
  );
  res.json({ keys: r.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, rateLimit } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const key = `wba_${uuidv4().replace(/-/g, '')}`;
  const r = await db.query(
    `INSERT INTO api_keys (name, key, rate_limit) VALUES ($1, $2, $3)
     RETURNING id, name, key, enabled, rate_limit, created_at`,
    [name, key, rateLimit || 60],
  );
  res.status(201).json(r.rows[0]);
}));

router.patch('/:id/toggle', asyncHandler(async (req, res) => {
  const enabled = !!req.body?.enabled;
  await db.query(`UPDATE api_keys SET enabled = $1 WHERE id = $2`, [enabled, req.params.id]);
  res.json({ ok: true, enabled });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query(`DELETE FROM api_keys WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
