'use strict';

const bot = require('./bot');
const apiServer = require('./api/server');
const logger = require('./logger');

async function main() {
  await apiServer.listen();
  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception');
});
