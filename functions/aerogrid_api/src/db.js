'use strict';

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Fatal error: DATABASE_URL environment variable is not defined.');
}

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected idle client error in PostgreSQL pool', err.message);
  });
}

module.exports = {
  query: (text, params) =>
    pool ? pool.query(text, params) : Promise.reject(new Error('DATABASE_URL is not configured')),
  pool,
};
