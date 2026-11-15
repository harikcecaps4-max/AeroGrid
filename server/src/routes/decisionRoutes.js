'use strict';

const express = require('express');
const { CAVEAT_TEXT } = require('../decision/config');
const { listAircraftProfiles } = require('../services/decisionDataService');

const router = express.Router();

/**
 * GET /api/aircraft
 * Lists available aircraft performance profiles for decision evaluation.
 */
router.get('/aircraft', async (req, res, next) => {
  try {
    const aircraft = await listAircraftProfiles();
    return res.status(200).json({
      count: aircraft.length,
      aircraft,
      caveat: CAVEAT_TEXT,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
