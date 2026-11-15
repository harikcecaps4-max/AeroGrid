'use strict';

const express = require('express');
const { CAVEAT_TEXT } = require('../decision/config');
const { evaluateAirstrip, rankAirstrips, compareAirstrips } = require('../decision/engine');
const { validateRequest } = require('../middleware/validate');
const {
  evaluateRequestSchema,
  rankRequestSchema,
  compareRequestSchema,
} = require('../schemas/decisionSchemas');
const {
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
  getAirstripsForDecisionByIds,
} = require('../services/decisionDataService');

const router = express.Router();

function sendNotFound(res, error, extra = {}) {
  return res.status(404).json({
    error,
    ...extra,
    caveat: CAVEAT_TEXT,
  });
}

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

/**
 * POST /api/evaluate
 * Evaluates a single aircraft profile against a single airstrip using the decision engine.
 */
router.post(
  '/evaluate',
  validateRequest({ body: evaluateRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, airstripId } = req.body;
      const [aircraft, airstrip] = await Promise.all([
        getAircraftProfileById(aircraftId),
        getAirstripForDecisionById(airstripId),
      ]);

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`);
      }

      if (!airstrip) {
        return sendNotFound(res, `Airstrip #${airstripId} not found`);
      }

      const evaluation = evaluateAirstrip(aircraft, airstrip);
      return res.status(200).json({
        aircraft,
        airstrip,
        ...evaluation,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/rank
 * Evaluates and ranks airstrips for an aircraft profile with optional filters.
 */
router.post(
  '/rank',
  validateRequest({ body: rankRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, filters } = req.body;
      const aircraft = await getAircraftProfileById(aircraftId);

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`);
      }

      const airstrips = await listAirstripsForDecision();
      const ranked = rankAirstrips(aircraft, airstrips, filters);
      return res.status(200).json({
        ...ranked,
        filters,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/compare
 * Compares 2 to 3 airstrips side-by-side for a selected aircraft profile.
 */
router.post(
  '/compare',
  validateRequest({ body: compareRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, airstripIds } = req.body;
      const [aircraft, { airstrips, missingIds }] = await Promise.all([
        getAircraftProfileById(aircraftId),
        getAirstripsForDecisionByIds(airstripIds),
      ]);

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`);
      }

      if (missingIds.length > 0) {
        return sendNotFound(
          res,
          `Airstrip(s) not found: ${missingIds.join(', ')}`,
          { missingIds },
        );
      }

      const comparison = compareAirstrips(aircraft, airstrips);
      return res.status(200).json(comparison);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
