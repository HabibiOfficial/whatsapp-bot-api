'use strict';

const { json } = require('./_lib/respond');

module.exports = (_req, res) => {
  json(res, 200, { ok: true, service: 'whatsapp-bot-api-web', ts: Date.now() });
};
