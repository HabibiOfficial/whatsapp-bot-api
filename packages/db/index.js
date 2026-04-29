'use strict';

const { Pool } = require('pg');

let pool;

function getPool(connectionString) {
  if (pool) return pool;
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  pool = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=require') || url.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { getPool, query, close };
