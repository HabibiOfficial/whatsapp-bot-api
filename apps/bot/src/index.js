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

process.on('SIGINT', () => { worker.stop(); process.exit(0); });
process.on('SIGTERM', () => { worker.stop(); process.exit(0); });
