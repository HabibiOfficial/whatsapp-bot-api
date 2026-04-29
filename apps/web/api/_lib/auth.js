'use strict';

const db = require('./db');

/**
 * Authenticate a request via `x-api-key` header (or `?apikey=` query param)
 * and apply a fixed 1-minute rate-limit window backed by Postgres so it works
 * across cold starts and concurrent serverless containers.
 */
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

  const limited = await checkRate(apiKey);
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

/**
 * Atomic UPSERT against rate_limit_counters keyed by (api_key_id, current
 * minute). Returns true when the resulting count exceeds the per-key limit.
 * The minute bucket is computed via date_trunc on the DB side so all
 * containers agree on window boundaries regardless of clock skew.
 */
async function checkRate(apiKey) {
  const r = await db.query(
    `INSERT INTO rate_limit_counters (api_key_id, window_start, count)
       VALUES ($1, date_trunc('minute', NOW()), 1)
     ON CONFLICT (api_key_id, window_start)
       DO UPDATE SET count = rate_limit_counters.count + 1
     RETURNING count`,
    [apiKey.id],
  );
  const count = r.rows[0]?.count ?? 1;
  return count > apiKey.rate_limit;
}

module.exports = { authenticate };
