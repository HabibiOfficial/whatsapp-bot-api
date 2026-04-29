'use strict';

// Use Neon's HTTP driver — works on Vercel serverless without persistent
// connections. Each query opens a fresh request. We expose a `query` function
// matching the pg-style { rows, rowCount } shape used elsewhere.
const { neon } = require('@neondatabase/serverless');

let sql;

function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  sql = neon(url);
  return sql;
}

async function query(text, params = []) {
  const s = getSql();
  // The neon() return value is callable: sql(text, params) -> rows[].
  const rows = await s(text, params);
  return { rows, rowCount: rows.length };
}

module.exports = { query };
