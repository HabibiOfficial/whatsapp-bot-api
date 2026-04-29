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
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  adminUsername: required('ADMIN_USERNAME', 'admin'),
  adminPassword: required('ADMIN_PASSWORD', 'changeme'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  dbPath: path.resolve(process.env.DB_PATH || './data.db'),
  sessionDir: path.resolve(process.env.SESSION_DIR || './auth_info_baileys'),
  botName: process.env.BOT_NAME || 'WinaBot',
  botPrefix: process.env.BOT_PREFIX || '!',
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
