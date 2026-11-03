'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/health', async (req, res, next) => {
  try {
    const result = await query('SELECT 1 AS ok');
    const isDbConnected = result && result.rows && result.rows.length > 0;

    return res.status(200).json({
      status: 'ok',
      database: isDbConnected ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;