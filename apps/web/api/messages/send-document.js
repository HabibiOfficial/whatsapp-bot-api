'use strict';

const { json, method, readBody } = require('../_lib/respond');
const { authenticate } = require('../_lib/auth');
const { enqueueAndWait, getBotStatus } = require('../_lib/queue');
const { normalizeJid } = require('../_lib/jid');

module.exports = async (req, res) => {
  if (!method(req, res, ['POST'])) return;

  const auth = await authenticate(req);
  if (auth.error) return json(res, auth.error.status, { error: auth.error.message });

  const body = await readBody(req);
  const jid = normalizeJid(body.to || body.jid);
  if (!jid) return json(res, 400, { error: 'invalid `to`' });
  if (!body.url) return json(res, 400, { error: '`url` required' });

  const status = await getBotStatus();
  if (status.status !== 'connected') {
    return json(res, 503, { error: 'bot not connected', bot_status: status.status });
  }

  try {
    const result = await enqueueAndWait(
      auth.apiKey.id,
      jid,
      'document',
      {
        url: body.url,
        filename: body.filename || 'file',
        mimetype: body.mimetype || 'application/octet-stream',
      },
    );
    if (result.timeout) {
      return json(res, 202, { accepted: true, message_id: result.messageId, status: 'pending' });
    }
    if (result.status === 'failed') {
      return json(res, 502, { error: result.error || 'send failed', message_id: result.messageId });
    }
    return json(res, 200, { ok: true, message_id: result.messageId, status: result.status, to: jid });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
};
