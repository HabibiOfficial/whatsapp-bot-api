'use strict';

const config = require('./config');
const dbPkg = require('@whatsapp-bot-api/db');
const logger = require('./logger');

dbPkg.getPool(config.databaseUrl);
logger.info({ host: new URL(config.databaseUrl).host }, 'Postgres pool ready');

module.exports = dbPkg;
