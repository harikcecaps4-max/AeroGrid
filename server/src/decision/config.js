'use strict';

/**
 * Mandatory decision-support disclaimer surfaced in every evaluation, ranking,
 * comparison response, and UI readout.
 */
const CAVEAT_TEXT =
  "DECISION SUPPORT ONLY — NOT FOR OPERATIONAL OR DISPATCH USE. Evaluations use preliminary geometric, surface, and ISA density-altitude approximations and may include unverified or placeholder records. Always verify against official AIP/DGCA aerodrome charts, site surveys, and the manufacturer's Aircraft Flight Manual (AFM/POH) before flight operations.";

/**
 * Default decision-engine configuration.
 *
 * Weights, safety margins, and density-altitude screening parameters live here
 * rather than being hard-coded across gate/factor modules.
 */
const DECISION_CONFIG = Object.freeze({
  caveat: CAVEAT_TEXT,

  runway: Object.freeze({
    // +30% planning buffer on top of governing OEM takeoff/landing distance
    safetyMarginMultiplier: 1.3,
    // Emit tight-margin warning when net runway surplus is < 15% of factored required distance
    tightMarginRatio: 0.15,
  }),

  elevation: Object.freeze({
    // Preliminary ICAO Doc 9157 / FAA Koch Chart screening rule-of-thumb:
    // +7% required runway distance per 300 m (~1,000 ft) AMSL above sea level
    distancePenaltyPer300m: 0.07,
    referenceStepM: 300,
    // Emit hot/high operational warning at or above 900 m AMSL
    cautionElevationM: 900,
    // Hard ceiling for standard regional micro-airstrip screening (m AMSL)
    maxFieldElevationM: 3500,
    minFieldElevationM: -500,
  }),

  // Factor weights for gate-passing airstrips (sum = 1.00)
  weights: Object.freeze({
    terrain_risk: 0.25,
    catchment_population: 0.20,
    last_mile_access: 0.20,
    nearest_airport_distance: 0.20,
    data_confidence: 0.15,
  }),

  scoring: Object.freeze({
    // Conservative score when a secondary factor field is NULL instead of assuming ideal conditions
    missingFactorScore: 40,
    // Deducted from data_confidence factor score for each NULL factor input (floored at 10)
    missingFieldConfidencePenalty: 10,
    // Minimum weighted score for an unconditioned 'viable' verdict
    viableMinScore: 65,
    terrainScores: Object.freeze({
      low: 100,
      moderate: 70,
      high: 35,
      severe: 10,
    }),
    confidenceScores: Object.freeze({
      high: 100,
      medium: 75,
      low: 45,
      unverified: 20,
    }),
    unpavedSurfaces: Object.freeze(['gravel', 'grass', 'laterite', 'unpaved']),
  }),
});

/**
 * Returns a clean merged config when a caller provides partial overrides
 * (e.g. a different safetyMarginMultiplier in tests or operator preferences).
 *
 * @param {Object} [customConfig]
 * @returns {Object}
 */
function mergeDecisionConfig(customConfig) {
  if (!customConfig || typeof customConfig !== 'object') {
    return DECISION_CONFIG;
  }
  return {
    caveat: customConfig.caveat || DECISION_CONFIG.caveat,
    runway: { ...DECISION_CONFIG.runway, ...(customConfig.runway || {}) },
    elevation: { ...DECISION_CONFIG.elevation, ...(customConfig.elevation || {}) },
    weights: { ...DECISION_CONFIG.weights, ...(customConfig.weights || {}) },
    scoring: {
      ...DECISION_CONFIG.scoring,
      ...(customConfig.scoring || {}),
      terrainScores: {
        ...DECISION_CONFIG.scoring.terrainScores,
        ...((customConfig.scoring && customConfig.scoring.terrainScores) || {}),
      },
      confidenceScores: {
        ...DECISION_CONFIG.scoring.confidenceScores,
        ...((customConfig.scoring && customConfig.scoring.confidenceScores) || {}),
      },
    },
  };
}

module.exports = {
  CAVEAT_TEXT,
  DECISION_CONFIG,
  mergeDecisionConfig,
};
