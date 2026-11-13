'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /health or /api/health
 * Comprehensive operational health probe: checks database status, system uptime, and memory usage.
 */
router.get(['/health', '/api/health'], async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'unreachable';
  let dbLatencyMs = null;
  let dbError = null;

  try {
    const dbPingStart = Date.now();
    const result = await query('SELECT 1 AS ok, current_database() as db_name, version() as version');
    dbLatencyMs = Date.now() - dbPingStart;

    if (result && result.rows && result.rows.length > 0) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = 'disconnected';
    dbError = err.message;
  }

  const memoryUsage = process.memoryUsage();
  const isHealthy = dbStatus === 'connected' || !process.env.DATABASE_URL;

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'aerogrid_api',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
      mode: process.env.DATABASE_URL ? 'postgresql_postgis' : 'in_memory_fallback',
    },
    system: {
      node_version: process.version,
      platform: process.platform,
      memory: {
        rss_mb: Math.round((memoryUsage.rss / 1024 / 1024) * 10) / 10,
        heap_used_mb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 10) / 10,
      },
    },
    duration_ms: Date.now() - startTime,
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(payload);
});

module.exports = router;
