'use strict';

const express = require('express');
const { CAVEAT_TEXT } = require('../decision/config');
const { evaluateAirstrip, rankAirstrips } = require('../decision/engine');
const { validateRequest } = require('../middleware/validate');
const { evaluateRequestSchema, rankRequestSchema } = require('../schemas/decisionSchemas');
const {
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
} = require('../services/decisionDataService');

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
        return res.status(404).json({
          error: `Aircraft profile #${aircraftId} not found`,
          caveat: CAVEAT_TEXT,
        });
      }

      if (!airstrip) {
        return res.status(404).json({
          error: `Airstrip #${airstripId} not found`,
          caveat: CAVEAT_TEXT,
        });
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
        return res.status(404).json({
          error: `Aircraft profile #${aircraftId} not found`,
          caveat: CAVEAT_TEXT,
        });
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

module.exports = router;
