'use strict';

/**
 * Shared re-export bridge for Zoho Catalyst serverless deployment
 * (`functions/aerogrid_api/`) and the Express backend (`server/`).
 *
 * Points directly to the single canonical decision engine implementation in
 * `server/src/decision/` and data service in `server/src/services/` so business
 * logic is never duplicated across deployment targets.
 */

const {
  CAVEAT_TEXT,
  DECISION_CONFIG,
  mergeDecisionConfig,
} = require('../../../server/src/decision/config');

const {
  evaluateAirstrip,
  rankAirstrips,
  compareAirstrips,
} = require('../../../server/src/decision/engine');

const {
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
  normalizeAirstripRow,
  AIRSTRIP_DECISION_SQL,
} = require('../../../server/src/services/decisionDataService');

module.exports = {
  CAVEAT_TEXT,
  DECISION_CONFIG,
  mergeDecisionConfig,
  evaluateAirstrip,
  rankAirstrips,
  compareAirstrips,
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
  normalizeAirstripRow,
  AIRSTRIP_DECISION_SQL,
};
