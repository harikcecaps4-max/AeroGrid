'use strict';

const {
  CAVEAT_TEXT,
  DECISION_CONFIG,
  mergeDecisionConfig,
} = require('./decision/config');

const {
  evaluateAirstrip,
  rankAirstrips,
  compareAirstrips,
} = require('./decision/engine');

const {
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
  normalizeAirstripRow,
  AIRSTRIP_DECISION_SQL,
} = require('./services/decisionDataService');

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
