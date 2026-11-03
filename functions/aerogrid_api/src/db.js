'use strict';

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Fatal error: DATABASE_URL environment variable is not defined.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl && databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected idle client error in PostgreSQL pool', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};