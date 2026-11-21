'use strict';

const express = require('express');
const { query } = require('../db');
const config = require('../../../../server/src/config/env');

const router = express.Router();

const HEALTH_QUERY_TIMEOUT_MS = 2000;

function queryWithTimeout(sql, timeoutMs) {
  let timer;
  return Promise.race([
    query(sql).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);
}

/**
 * GET /health or /api/health (unauthenticated)
 * Returns { status, database, data_source, time } without exposing connection details.
 * Returns 503 if the database is configured but unreachable.
 */
router.get(['/health', '/api/health'], async (req, res) => {
  const time = new Date().toISOString();

  if (!config.database.isConfigured) {
    return res.status(200).json({
      status: 'ok',
      database: 'not_configured',
      data_source: config.allowFallback ? 'fallback' : 'none',
      time,
    });
  }

  try {
    await queryWithTimeout('SELECT 1', HEALTH_QUERY_TIMEOUT_MS);
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      data_source: 'database',
      time,
    });
  } catch {
    return res.status(503).json({
      status: 'unavailable',
      database: 'unavailable',
      data_source: 'unavailable',
      time,
    });
  }
});

module.exports = router;
