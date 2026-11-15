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
    // Floor applied when deducting penalties from data_confidence
    minConfidenceScore: 10,
    catchmentBands: Object.freeze([
      Object.freeze({ min: 1000000, score: 100, label: 'major metro catchment (>= 1.0M residents)' }),
      Object.freeze({ min: 500000, score: 85, label: 'strong regional catchment (>= 500k residents)' }),
      Object.freeze({ min: 200000, score: 70, label: 'moderate regional catchment (>= 200k residents)' }),
      Object.freeze({ min: 50000, score: 50, label: 'emerging town catchment (>= 50k residents)' }),
      Object.freeze({ min: 1, score: 30, label: 'small local catchment (< 50k residents)' }),
      Object.freeze({ min: 0, score: 10, label: 'negligible catchment (0 reported)' }),
    ]),
    accessKmBands: Object.freeze([
      Object.freeze({ max: 2, score: 100, label: 'immediate arterial access (<= 2 km)' }),
      Object.freeze({ max: 5, score: 85, label: 'good last-mile access (<= 5 km)' }),
      Object.freeze({ max: 10, score: 65, label: 'moderate transfer distance (<= 10 km)' }),
      Object.freeze({ max: 20, score: 45, label: 'extended last-mile transfer (<= 20 km)' }),
      Object.freeze({ max: Infinity, score: 20, label: 'remote ground access (> 20 km)' }),
    ]),
    airportDistance: Object.freeze({
      idealMinKm: 25,
      idealMaxKm: 150,
      mediumMaxKm: 250,
      longMaxKm: 400,
      // Flag when nearest hub leg consumes > 85% of aircraft nominal range (thin fuel/battery reserve)
      rangeReserveRatio: 0.85,
      rangeConstrainedCapScore: 25,
      scores: Object.freeze({
        ideal: 100,
        closeHub: 75,
        medium: 80,
        long: 55,
        remote: 30,
      }),
    }),
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
  const customAirportDist = (customConfig.scoring && customConfig.scoring.airportDistance) || {};
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
      airportDistance: {
        ...DECISION_CONFIG.scoring.airportDistance,
        ...customAirportDist,
        scores: {
          ...DECISION_CONFIG.scoring.airportDistance.scores,
          ...(customAirportDist.scores || {}),
        },
      },
    },
  };
}

module.exports = {
  CAVEAT_TEXT,
  DECISION_CONFIG,
  mergeDecisionConfig,
};
