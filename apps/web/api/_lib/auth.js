'use strict';

const db = require('./db');

const buckets = new Map(); // api_key_id -> { count, windowStart }

async function authenticate(req) {
  const key = req.headers['x-api-key'] || (req.query && req.query.apikey);
  if (!key) return { error: { status: 401, message: 'missing api key' } };

  const r = await db.query(
    `SELECT id, name, key, enabled, rate_limit FROM api_keys WHERE key = $1`,
    [key],
  );
  if (r.rows.length === 0) return { error: { status: 401, message: 'invalid api key' } };
  const apiKey = r.rows[0];
  if (!apiKey.enabled) return { error: { status: 403, message: 'api key disabled' } };

  const limited = checkRate(apiKey);
  if (limited) {
    return {
      error: {
        status: 429,
        message: `rate limit exceeded (${apiKey.rate_limit}/min)`,
      },
    };
  }

  db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [apiKey.id])
    .catch(() => {}); // fire-and-forget

  return { apiKey };
}

function checkRate(apiKey) {
  const now = Date.now();
  const bucket = buckets.get(apiKey.id) || { count: 0, windowStart: now };
  if (now - bucket.windowStart >= 60000) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  buckets.set(apiKey.id, bucket);
  return bucket.count > apiKey.rate_limit;
}

module.exports = { authenticate };
