'use strict';

const { DECISION_CONFIG } = require('./config');
const { toFiniteNumber } = require('./gates');

const CONFIDENCE_TIERS = ['high', 'medium', 'low', 'unverified'];

function scoreFromMinBands(value, bands) {
  return bands.find((b) => value >= b.min);
}

function scoreFromMaxBands(value, bands) {
  return bands.find((b) => value <= b.max);
}

/**
 * Resolves the shortest last-mile ground access distance (km) from direct column
 * `last_mile_access_km` or falls back to the minimum distance in `access_points`.
 *
 * @param {Object} airstrip
 * @returns {{ km: number|null, fromAccessPoints: boolean }}
 */
function resolveLastMileKm(airstrip) {
  const directKm = toFiniteNumber(airstrip && airstrip.last_mile_access_km);
  if (directKm !== null && directKm >= 0) {
    return { km: directKm, fromAccessPoints: false };
  }

  if (Array.isArray(airstrip && airstrip.access_points)) {
    const validDistances = airstrip.access_points
      .map((ap) => toFiniteNumber(ap && ap.distance_km))
      .filter((d) => d !== null && d >= 0);
    if (validDistances.length > 0) {
      return { km: Math.min(...validDistances), fromAccessPoints: true };
    }
  }

  return { km: null, fromAccessPoints: false };
}

/**
 * Scores `terrain_risk` or falls back to conservative missing-factor penalty.
 *
 * @param {Object} airstrip
 * @param {Object} config
 * @param {string[]} warnings
 * @returns {{ missing: boolean, highTerrainRisk: boolean, factor: { name: string, weight: number, value: number, note: string } }}
 */
function evaluateTerrainFactor(airstrip, config, warnings) {
  const missingScore = config.scoring.missingFactorScore;
  const rawTerrain = airstrip && airstrip.terrain_risk;
  const key = typeof rawTerrain === 'string' ? rawTerrain.trim().toLowerCase() : '';
  const mapped = key ? config.scoring.terrainScores[key] : undefined;

  if (mapped === undefined) {
    warnings.push(
      `Missing terrain_risk (NULL): scored conservatively at ${missingScore}/100; topographical obstacle & approach clearance survey required.`
    );
    return {
      missing: true,
      highTerrainRisk: false,
      factor: {
        name: 'terrain_risk',
        weight: config.weights.terrain_risk,
        value: missingScore,
        note: `Missing (NULL) — scored conservatively at ${missingScore}/100; topographical obstacle survey required.`,
      },
    };
  }

  const highTerrainRisk = key === 'high' || key === 'severe';
  if (highTerrainRisk) {
    warnings.push(
      `Elevated terrain_risk ("${key}"): obstacle clearance paths and one-engine-inoperative / balked-landing climb gradients require verification.`
    );
  }

  return {
    missing: false,
    highTerrainRisk,
    factor: {
      name: 'terrain_risk',
      weight: config.weights.terrain_risk,
      value: mapped,
      note: `Reported terrain risk is "${key}" (${mapped}/100).`,
    },
  };
}

/**
 * Scores `catchment_population` against configured regional catchment brackets.
 *
 * @param {Object} airstrip
 * @param {Object} config
 * @param {string[]} warnings
 * @returns {{ missing: boolean, factor: { name: string, weight: number, value: number, note: string } }}
 */
function evaluateCatchmentFactor(airstrip, config, warnings) {
  const missingScore = config.scoring.missingFactorScore;
  const pop = toFiniteNumber(airstrip && airstrip.catchment_population);

  if (pop === null || pop < 0) {
    warnings.push(
      `Missing catchment_population (NULL): scored conservatively at ${missingScore}/100; passenger/cargo catchment census required.`
    );
    return {
      missing: true,
      factor: {
        name: 'catchment_population',
        weight: config.weights.catchment_population,
        value: missingScore,
        note: `Missing (NULL) — scored conservatively at ${missingScore}/100; catchment census verification required.`,
      },
    };
  }

  const band = scoreFromMinBands(pop, config.scoring.catchmentBands);
  return {
    missing: false,
    factor: {
      name: 'catchment_population',
      weight: config.weights.catchment_population,
      value: band.score,
      note: `${Math.round(pop).toLocaleString('en-US')} estimated catchment — ${band.label}.`,
    },
  };
}

/**
 * Scores last-mile ground connectivity in km using configured distance brackets.
 *
 * @param {Object} airstrip
 * @param {Object} config
 * @param {string[]} warnings
 * @returns {{ missing: boolean, factor: { name: string, weight: number, value: number, note: string } }}
 */
function evaluateLastMileFactor(airstrip, config, warnings) {
  const missingScore = config.scoring.missingFactorScore;
  const { km, fromAccessPoints } = resolveLastMileKm(airstrip);

  if (km === null) {
    warnings.push(
      `Missing last_mile_access_km (NULL): scored conservatively at ${missingScore}/100; last-mile road distance survey required.`
    );
    return {
      missing: true,
      factor: {
        name: 'last_mile_access',
        weight: config.weights.last_mile_access,
        value: missingScore,
        note: `Missing (NULL) — scored conservatively at ${missingScore}/100; last-mile road distance unverified.`,
      },
    };
  }

  const band = scoreFromMaxBands(km, config.scoring.accessKmBands);
  const origin = fromAccessPoints ? 'nearest access_points record' : 'last_mile_access_km';
  return {
    missing: false,
    factor: {
      name: 'last_mile_access',
      weight: config.weights.last_mile_access,
      value: band.score,
      note: `${km.toFixed(1)} km (${origin}) — ${band.label}.`,
    },
  };
}

/**
 * Scores distance to nearest commercial hub airport and checks aircraft range reserves.
 *
 * @param {Object} aircraft
 * @param {Object} airstrip
 * @param {Object} config
 * @param {string[]} warnings
 * @returns {{ missing: boolean, rangeConstrained: boolean, factor: { name: string, weight: number, value: number, note: string } }}
 */
function evaluateNearestAirportFactor(aircraft, airstrip, config, warnings) {
  const missingScore = config.scoring.missingFactorScore;
  const apCfg = config.scoring.airportDistance;
  const rawDist =
    airstrip &&
    (airstrip.nearest_airport_distance_km ?? (airstrip.nearest_airport && airstrip.nearest_airport.distance_km));
  const distKm = toFiniteNumber(rawDist);

  if (distKm === null || distKm < 0) {
    warnings.push(
      `Missing nearest_airport_distance_km (NULL): scored conservatively at ${missingScore}/100; regional hub feeder proximity unverified.`
    );
    return {
      missing: true,
      rangeConstrained: false,
      factor: {
        name: 'nearest_airport_distance',
        weight: config.weights.nearest_airport_distance,
        value: missingScore,
        note: `Missing (NULL) — scored conservatively at ${missingScore}/100; anchor airport distance unverified.`,
      },
    };
  }

  let value;
  let bandNote;
  if (distKm >= apCfg.idealMinKm && distKm <= apCfg.idealMaxKm) {
    value = apCfg.scores.ideal;
    bandNote = `ideal regional hub feeder radius (${apCfg.idealMinKm}–${apCfg.idealMaxKm} km)`;
  } else if (distKm < apCfg.idealMinKm) {
    value = apCfg.scores.closeHub;
    bandNote = `close to commercial hub (< ${apCfg.idealMinKm} km; check Class D/C airspace overlap)`;
  } else if (distKm <= apCfg.mediumMaxKm) {
    value = apCfg.scores.medium;
    bandNote = `viable medium regional feeder distance (${apCfg.idealMaxKm}–${apCfg.mediumMaxKm} km)`;
  } else if (distKm <= apCfg.longMaxKm) {
    value = apCfg.scores.long;
    bandNote = `long regional leg (${apCfg.mediumMaxKm}–${apCfg.longMaxKm} km)`;
  } else {
    value = apCfg.scores.remote;
    bandNote = `remote feeder leg (> ${apCfg.longMaxKm} km)`;
  }

  let rangeConstrained = false;
  const rangeKm = toFiniteNumber(aircraft && aircraft.range_km);
  if (rangeKm !== null && rangeKm > 0 && distKm > rangeKm * apCfg.rangeReserveRatio) {
    value = Math.min(value, apCfg.rangeConstrainedCapScore);
    rangeConstrained = true;
    const pct = Math.round(apCfg.rangeReserveRatio * 100);
    bandNote = `nearest hub (${distKm.toFixed(1)} km) exceeds ${pct}% of aircraft nominal range (${rangeKm} km); reserve margin constrained`;
    warnings.push(
      `Nearest hub airport distance (${distKm.toFixed(1)} km) exceeds ${pct}% of aircraft nominal range (${rangeKm} km); IFR/VFR reserve margin constrained.`
    );
  }

  return {
    missing: false,
    rangeConstrained,
    factor: {
      name: 'nearest_airport_distance',
      weight: config.weights.nearest_airport_distance,
      value,
      note: `${distKm.toFixed(1)} km to nearest hub — ${bandNote}.`,
    },
  };
}

/**
 * Scores airstrip record confidence, degrading by tier per missing factor field.
 *
 * @param {Object} aircraft
 * @param {Object} airstrip
 * @param {Object} config
 * @param {number} missingFactorCount
 * @param {string[]} warnings
 * @returns {{ effectiveConfidence: string, factor: { name: string, weight: number, value: number, note: string } }}
 */
function evaluateConfidenceFactor(aircraft, airstrip, config, missingFactorCount, warnings) {
  const rawConfidence =
    typeof (airstrip && airstrip.data_confidence) === 'string'
      ? airstrip.data_confidence.trim().toLowerCase()
      : 'unverified';

  const startIdx = CONFIDENCE_TIERS.includes(rawConfidence)
    ? CONFIDENCE_TIERS.indexOf(rawConfidence)
    : CONFIDENCE_TIERS.length - 1;
  const baseValue = config.scoring.confidenceScores[CONFIDENCE_TIERS[startIdx]];
  const penalty = missingFactorCount * config.scoring.missingFieldConfidencePenalty;
  const value = Math.max(config.scoring.minConfidenceScore, baseValue - penalty);

  const degradedIdx = Math.min(CONFIDENCE_TIERS.length - 1, startIdx + missingFactorCount);
  const effectiveConfidence = CONFIDENCE_TIERS[degradedIdx];

  if (CONFIDENCE_TIERS[startIdx] === 'low' || CONFIDENCE_TIERS[startIdx] === 'unverified') {
    warnings.push(
      `Airstrip data_confidence is "${CONFIDENCE_TIERS[startIdx]}"; verify runway geometry, surface condition, and obstacles before commitment.`
    );
  }

  const airstripSource = airstrip && airstrip.source;
  if (!airstripSource || /placeholder/i.test(String(airstripSource))) {
    warnings.push(
      `Airstrip source is "${airstripSource || 'unspecified'}" (unverified placeholder data).`
    );
  }

  const aircraftSource = aircraft && aircraft.source;
  if (aircraftSource && /placeholder/i.test(String(aircraftSource))) {
    warnings.push(
      `Aircraft performance values are marked "${aircraftSource}"; verify takeoff/landing distances against OEM AFM.`
    );
  }

  const noteParts = [`Reported confidence "${CONFIDENCE_TIERS[startIdx]}" (base ${baseValue})`];
  if (missingFactorCount > 0) {
    noteParts.push(`-${penalty} pts for ${missingFactorCount} missing field(s) -> effective "${effectiveConfidence}"`);
  }

  return {
    effectiveConfidence,
    factor: {
      name: 'data_confidence',
      weight: config.weights.data_confidence,
      value,
      note: `${noteParts.join(', ')} (${value}/100).`,
    },
  };
}

/**
 * Evaluates weighted non-gate decision factors for an airstrip/aircraft pair.
 *
 * @param {Object} aircraft
 * @param {Object} airstrip
 * @param {Object} [config]
 * @returns {{ factors: Array, warnings: string[], flags: Object, missingFactorCount: number, effectiveConfidence: string }}
 */
function evaluateFactors(aircraft, airstrip, config = DECISION_CONFIG) {
  const warnings = [];
  const terrainRes = evaluateTerrainFactor(airstrip, config, warnings);
  const catchmentRes = evaluateCatchmentFactor(airstrip, config, warnings);
  const lastMileRes = evaluateLastMileFactor(airstrip, config, warnings);
  const airportRes = evaluateNearestAirportFactor(aircraft, airstrip, config, warnings);

  const missingFactorCount = [
    terrainRes.missing,
    catchmentRes.missing,
    lastMileRes.missing,
    airportRes.missing,
  ].filter(Boolean).length;

  const confidenceRes = evaluateConfidenceFactor(
    aircraft,
    airstrip,
    config,
    missingFactorCount,
    warnings
  );

  return {
    factors: [
      terrainRes.factor,
      catchmentRes.factor,
      lastMileRes.factor,
      airportRes.factor,
      confidenceRes.factor,
    ],
    warnings,
    flags: {
      highTerrainRisk: terrainRes.highTerrainRisk,
      rangeConstrained: airportRes.rangeConstrained,
    },
    missingFactorCount,
    effectiveConfidence: confidenceRes.effectiveConfidence,
  };
}

module.exports = {
  evaluateFactors,
};
