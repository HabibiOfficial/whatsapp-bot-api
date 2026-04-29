'use strict';

const { json, method } = require('./_lib/respond');
const { getBotStatus } = require('./_lib/queue');

module.exports = async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  try {
    const s = await getBotStatus();
    json(res, 200, {
      bot: s.status,
      connected: s.status === 'connected',
      user: s.user_jid ? { jid: s.user_jid, name: s.user_name } : null,
      updated_at: s.updated_at,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};
