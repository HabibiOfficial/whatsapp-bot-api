'use strict';

require('dotenv').config();

const path = require('path');

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const config = {
  databaseUrl: required('DATABASE_URL'),
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: required('ADMIN_PASSWORD'),
  jwtSecret: required('JWT_SECRET'),
  sessionDir: path.resolve(process.env.SESSION_DIR || './auth_info_baileys'),
  botName: process.env.BOT_NAME || 'WinaBot',
  botPrefix: process.env.BOT_PREFIX || '!',
  workerPollMs: parseInt(process.env.WORKER_POLL_MS || '1000', 10),
  workerBatch: parseInt(process.env.WORKER_BATCH || '10', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
