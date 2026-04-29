'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { adminAuth } = require('../middleware');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== config.adminUsername || password !== config.adminPassword) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = jwt.sign({ sub: username, role: 'admin' }, config.jwtSecret, {
    expiresIn: '7d',
  });
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, token });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

router.get('/me', adminAuth, (req, res) => {
  res.json({ user: req.admin.sub, role: req.admin.role });
});

module.exports = router;
