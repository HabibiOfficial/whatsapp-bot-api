'use strict';

const logger = require('./logger');
const bot = require('./bot');
const apiServer = require('./api/server');
const worker = require('./worker/outgoing');

async function main() {
  await apiServer.listen();
  bot.start().catch((err) => logger.error({ err }, 'bot startup failed'));
  worker.start();
}

main().catch((err) => {
  logger.error({ err }, 'fatal error');
  process.exit(1);
});

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  try { await worker.stop(); } catch { /* noop */ }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
