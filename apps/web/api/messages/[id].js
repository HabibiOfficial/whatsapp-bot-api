'use strict';

const { json, method } = require('../_lib/respond');
const { authenticate } = require('../_lib/auth');
const db = require('../_lib/db');

module.exports = async (req, res) => {
  if (!method(req, res, ['GET'])) return;

  const auth = await authenticate(req);
  if (auth.error) return json(res, auth.error.status, { error: auth.error.message });

  const id = parseInt(req.query.id, 10);
  if (!id) return json(res, 400, { error: 'invalid id' });

  const r = await db.query(
    `SELECT id, jid, type, status, error, created_at, processed_at, wa_message_id
     FROM outgoing_messages WHERE id = $1 AND api_key_id = $2`,
    [id, auth.apiKey.id],
  );
  if (r.rows.length === 0) return json(res, 404, { error: 'not found' });
  return json(res, 200, r.rows[0]);
};
