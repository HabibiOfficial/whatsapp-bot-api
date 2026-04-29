'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPool, close } = require('./index');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pool = getPool();
  console.log('applying schema to', new URL(process.env.DATABASE_URL).host);
  await pool.query(sql);
  console.log('done');
  await close();
}

main().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
