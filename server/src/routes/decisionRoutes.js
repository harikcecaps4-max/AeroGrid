'use strict';

const express = require('express');
const { CAVEAT_TEXT } = require('../decision/config');
const { evaluateAirstrip, rankAirstrips, compareAirstrips } = require('../decision/engine');
const { validateRequest } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');
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
router.get('/aircraft', authenticateToken, requireRole('viewer'), async (req, res, next) => {
  try {
    const { aircraft, source } = await listAircraftProfiles({ requestId: req.id });
    return res.status(200).json({
      count: aircraft.length,
      aircraft,
      data_source: source,
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
  authenticateToken,
  requireRole('viewer'),
  validateRequest({ body: evaluateRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, airstripId } = req.body;
      const [aircraftRes, airstripRes] = await Promise.all([
        getAircraftProfileById(aircraftId, { requestId: req.id }),
        getAirstripForDecisionById(airstripId, { requestId: req.id }),
      ]);

      const { aircraft } = aircraftRes;
      const { airstrip, source } = airstripRes;

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`, {
          data_source: aircraftRes.source,
        });
      }

      if (!airstrip) {
        return sendNotFound(res, `Airstrip #${airstripId} not found`, {
          data_source: source,
        });
      }

      const evaluation = evaluateAirstrip(aircraft, airstrip);
      return res.status(200).json({
        aircraft,
        airstrip,
        data_source: source,
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
  authenticateToken,
  requireRole('viewer'),
  validateRequest({ body: rankRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, filters } = req.body;
      const { aircraft, source: aircraftSource } = await getAircraftProfileById(aircraftId, {
        requestId: req.id,
      });

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`, {
          data_source: aircraftSource,
        });
      }

      const { airstrips, source } = await listAirstripsForDecision({ requestId: req.id });
      const ranked = rankAirstrips(aircraft, airstrips, filters);
      return res.status(200).json({
        ...ranked,
        filters,
        data_source: source,
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
  authenticateToken,
  requireRole('viewer'),
  validateRequest({ body: compareRequestSchema }),
  async (req, res, next) => {
    try {
      const { aircraftId, airstripIds } = req.body;
      const [aircraftRes, stripsRes] = await Promise.all([
        getAircraftProfileById(aircraftId, { requestId: req.id }),
        getAirstripsForDecisionByIds(airstripIds, { requestId: req.id }),
      ]);

      const { aircraft } = aircraftRes;
      const { airstrips, missingIds, source } = stripsRes;

      if (!aircraft) {
        return sendNotFound(res, `Aircraft profile #${aircraftId} not found`, {
          data_source: aircraftRes.source,
        });
      }

      if (missingIds.length > 0) {
        return sendNotFound(
          res,
          `Airstrip(s) not found: ${missingIds.join(', ')}`,
          { missingIds, data_source: source },
        );
      }

      const comparison = compareAirstrips(aircraft, airstrips);
      return res.status(200).json({
        ...comparison,
        data_source: source,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
