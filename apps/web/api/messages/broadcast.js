'use strict';

const { json, method, readBody } = require('../_lib/respond');
const { authenticate } = require('../_lib/auth');
const { getBotStatus } = require('../_lib/queue');
const { normalizeJid } = require('../_lib/jid');
const db = require('../_lib/db');

/**
 * Broadcast queues messages and returns immediately. The caller does NOT wait
 * for delivery (bot processes them asynchronously). To check status, query
 * /api/messages/:id later.
 */
module.exports = async (req, res) => {
  if (!method(req, res, ['POST'])) return;

  const auth = await authenticate(req);
  if (auth.error) return json(res, auth.error.status, { error: auth.error.message });

  const body = await readBody(req);
  const recipients = Array.isArray(body.to) ? body.to : [];
  const message = body.message;

  if (recipients.length === 0) return json(res, 400, { error: '`to` must be non-empty array' });
  if (recipients.length > 500) return json(res, 400, { error: 'max 500 recipients per request' });
  if (!message) return json(res, 400, { error: '`message` required' });

  const status = await getBotStatus();
  if (status.status !== 'connected') {
    return json(res, 503, { error: 'bot not connected', bot_status: status.status });
  }

  const queued = [];
  const skipped = [];
  for (const r of recipients) {
    const jid = normalizeJid(r);
    if (!jid) {
      skipped.push({ to: r, error: 'invalid number' });
      continue;
    }
    try {
      const ins = await db.query(
        `INSERT INTO outgoing_messages (api_key_id, jid, type, payload, status)
         VALUES ($1, $2, 'text', $3::jsonb, 'pending') RETURNING id`,
        [auth.apiKey.id, jid, JSON.stringify({ message })],
      );
      queued.push({ to: jid, message_id: ins.rows[0].id });
    } catch (err) {
      skipped.push({ to: jid, error: err.message });
    }
  }

  return json(res, 202, {
    accepted: true,
    queued_count: queued.length,
    skipped_count: skipped.length,
    queued,
    skipped,
  });
};
