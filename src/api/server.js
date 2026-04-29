'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('../config');
const logger = require('../logger');

const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apikeys');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const autoreplyRoutes = require('./routes/autoreplies');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'request');
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/keys', apiKeyRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/status', statusRoutes);
  app.use('/api/autoreplies', autoreplyRoutes);

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
  app.get('/login', (_req, res) => res.sendFile(path.join(publicDir, 'login.html')));

  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) logger.error({ err: err.message, stack: err.stack }, 'request error');
    res.status(status).json({ error: err.message || 'internal error' });
  });

  return app;
}

function listen() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(config.port, config.host, () => {
      logger.info({ host: config.host, port: config.port }, 'API server listening');
      resolve(server);
    });
  });
}

module.exports = { createApp, listen };
