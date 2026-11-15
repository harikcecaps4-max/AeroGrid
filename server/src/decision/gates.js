'use strict';

const { DECISION_CONFIG } = require('./config');

/**
 * Parses a numeric value strictly, returning null for NULL, undefined,
 * empty strings, booleans, objects, or non-finite values.
 *
 * @param {*} value
 * @returns {number|null}
 */
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean' || typeof value === 'object') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Computes the ISA density-altitude distance multiplier from field elevation.
 *
 * Formula (ICAO Doc 9157 / FAA Koch Chart preliminary screening approximation):
 *   multiplier = 1 + max(0, elevation_m / referenceStepM) * distancePenaltyPer300m
 * With default parameters (referenceStepM = 300, distancePenaltyPer300m = 0.07):
 *   multiplier = 1 + max(0, elevation_m / 300) * 0.07
 *   e.g. sea level (0 m) = 1.00x, 900 m = 1.21x (+21%), 1,500 m = 1.35x (+35%).
 * Fields below sea level clamp max(0, ...) to avoid taking negative-altitude credit.
 *
 * @param {number|string|null|undefined} elevationM
 * @param {Object} [config]
 * @returns {number|null}
 */
function computeElevationMultiplier(elevationM, config = DECISION_CONFIG) {
  const elev = toFiniteNumber(elevationM);
  if (elev === null) return null;
  const step = config.elevation.referenceStepM;
  const penalty = config.elevation.distancePenaltyPer300m;
  const multiplier = 1 + Math.max(0, elev / step) * penalty;
  return Number(multiplier.toFixed(6));
}

function evaluateElevationGateInternal(aircraft, airstrip, config = DECISION_CONFIG) {
  const elev = toFiniteNumber(airstrip && airstrip.elevation_m);
  const { minFieldElevationM, maxFieldElevationM, cautionElevationM, distancePenaltyPer300m, referenceStepM } =
    config.elevation;

  if (elev === null) {
    return {
      gate: {
        name: 'elevation_adjustment',
        pass: false,
        margin: null,
        explanation:
          'Field elevation (elevation_m) is missing (NULL); density-altitude runway adjustment cannot be verified without field elevation data.',
      },
      warning:
        'Missing field elevation (elevation_m): density-altitude adjustment gate failed because missing data never silently passes a gate.',
      caution: false,
    };
  }

  if (elev < minFieldElevationM || elev > maxFieldElevationM) {
    const margin =
      elev > maxFieldElevationM
        ? Math.round((maxFieldElevationM - elev) * 10) / 10
        : Math.round((elev - minFieldElevationM) * 10) / 10;
    const explanation =
      elev > maxFieldElevationM
        ? `Field elevation of ${elev}m AMSL exceeds the ${maxFieldElevationM}m regional operational screening ceiling by ${Math.abs(margin)}m.`
        : `Field elevation of ${elev}m AMSL is below the valid lower bound of ${minFieldElevationM}m.`;
    return {
      gate: {
        name: 'elevation_adjustment',
        pass: false,
        margin,
        explanation,
      },
      warning: explanation,
      caution: false,
    };
  }

  const multiplier = computeElevationMultiplier(elev, config);
  const pctIncrease = ((multiplier - 1) * 100).toFixed(1);
  const margin = Math.round((maxFieldElevationM - elev) * 10) / 10;
  const highElevation = elev >= cautionElevationM;

  return {
    gate: {
      name: 'elevation_adjustment',
      pass: true,
      margin,
      explanation: `Field elevation of ${elev}m AMSL is within the ${maxFieldElevationM}m ceiling (headroom +${margin}m) and applies a +${pctIncrease}% density-altitude distance multiplier (${multiplier.toFixed(2)}x; formula: 1 + max(0, elevation_m / ${referenceStepM}) * ${distancePenaltyPer300m}).`,
    },
    warning: highElevation
      ? `High-elevation airstrip (${elev}m AMSL >= ${cautionElevationM}m): hot-day density altitude can materially reduce climb gradient and payload.`
      : null,
    caution: highElevation,
    multiplier,
  };
}

function evaluateRunwayLengthGateInternal(aircraft, airstrip, config = DECISION_CONFIG) {
  const runwayLengthM = toFiniteNumber(airstrip && airstrip.runway_length_m);
  const takeoffM = toFiniteNumber(
    aircraft && (aircraft.takeoff_distance_m !== undefined && aircraft.takeoff_distance_m !== null
      ? aircraft.takeoff_distance_m
      : aircraft.min_runway_m)
  );
  const landingM = toFiniteNumber(
    aircraft && (aircraft.landing_distance_m !== undefined && aircraft.landing_distance_m !== null
      ? aircraft.landing_distance_m
      : aircraft.min_runway_m)
  );
  const elevMultiplier = computeElevationMultiplier(airstrip && airstrip.elevation_m, config);

  if (runwayLengthM === null || runwayLengthM <= 0) {
    return {
      gate: {
        name: 'runway_length',
        pass: false,
        margin: null,
        explanation: 'Runway length (runway_length_m) is missing or non-positive; runway adequacy cannot be verified.',
      },
      warning: 'Missing or invalid runway_length_m: runway length gate failed because missing data never silently passes.',
      tightMargin: false,
    };
  }

  if (takeoffM === null || takeoffM <= 0 || landingM === null || landingM <= 0) {
    return {
      gate: {
        name: 'runway_length',
        pass: false,
        margin: null,
        explanation: 'Aircraft takeoff/landing distance specification is missing or non-positive; runway adequacy cannot be verified.',
      },
      warning: 'Aircraft performance distance specification is missing or invalid.',
      tightMargin: false,
    };
  }

  const baseRequiredM = Math.max(takeoffM, landingM);
  const safetyMargin = config.runway.safetyMarginMultiplier;

  if (elevMultiplier === null) {
    const seaLevelRequiredM = Math.ceil(Number((baseRequiredM * safetyMargin).toFixed(6)));
    return {
      gate: {
        name: 'runway_length',
        pass: false,
        margin: null,
        explanation: `Available runway is ${runwayLengthM}m (unadjusted sea-level ${safetyMargin}x requirement is ${seaLevelRequiredM}m), but field elevation is missing (NULL) so density-altitude factored runway length cannot be verified.`,
      },
      warning: 'Density-altitude factored runway requirement cannot be confirmed without field elevation (elevation_m).',
      tightMargin: false,
    };
  }

  const requiredDistanceM = Math.ceil(Number((baseRequiredM * safetyMargin * elevMultiplier).toFixed(6)));
  const margin = Math.round((runwayLengthM - requiredDistanceM) * 10) / 10;
  const pass = margin >= 0;
  const tightMargin = pass && margin < requiredDistanceM * config.runway.tightMarginRatio;

  const explanation = pass
    ? `Available runway ${runwayLengthM}m meets elevation-adjusted factored requirement of ${requiredDistanceM}m (base ${baseRequiredM}m × ${safetyMargin}x safety × ${elevMultiplier.toFixed(2)}x density-altitude = ${requiredDistanceM}m; net surplus +${margin}m).`
    : `Available runway ${runwayLengthM}m is shorter than elevation-adjusted factored requirement of ${requiredDistanceM}m (base ${baseRequiredM}m × ${safetyMargin}x safety × ${elevMultiplier.toFixed(2)}x density-altitude = ${requiredDistanceM}m; shortfall ${margin}m).`;

  return {
    gate: {
      name: 'runway_length',
      pass,
      margin,
      explanation,
    },
    warning: tightMargin
      ? `Tight runway margin (+${margin}m, under ${Math.round(config.runway.tightMarginRatio * 100)}% buffer above factored requirement of ${requiredDistanceM}m); verify slope and displaced thresholds.`
      : null,
    tightMargin,
    requiredDistanceM,
  };
}

function evaluateSurfaceGateInternal(aircraft, airstrip, config = DECISION_CONFIG) {
  const rawSurface = airstrip && (airstrip.surface ?? airstrip.surface_name);
  const allowedList = aircraft && aircraft.allowed_surfaces;

  if (!rawSurface || typeof rawSurface !== 'string' || !rawSurface.trim()) {
    return {
      gate: {
        name: 'surface_compatibility',
        pass: false,
        margin: null,
        explanation: 'Airstrip surface type is missing (NULL); surface compatibility cannot be verified.',
      },
      warning: 'Missing airstrip surface type: surface compatibility gate failed because missing data never silently passes.',
      unpaved: false,
    };
  }

  if (!Array.isArray(allowedList) || allowedList.length === 0) {
    return {
      gate: {
        name: 'surface_compatibility',
        pass: false,
        margin: null,
        explanation: 'Aircraft allowed_surfaces list is missing or empty; surface compatibility cannot be verified.',
      },
      warning: 'Aircraft allowed_surfaces list is missing or empty.',
      unpaved: false,
    };
  }

  const surface = rawSurface.trim().toLowerCase();
  const allowed = allowedList.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const pass = allowed.includes(surface);
  const margin = pass ? 0 : -1;
  const unpaved = pass && config.scoring.unpavedSurfaces.includes(surface);

  return {
    gate: {
      name: 'surface_compatibility',
      pass,
      margin,
      explanation: pass
        ? `Surface "${surface}" is compatible with aircraft allowed surfaces (${allowed.join(', ')}).`
        : `Surface "${surface}" is not supported by aircraft allowed surfaces (${allowed.join(', ')}).`,
    },
    warning: unpaved
      ? `Unpaved surface ("${surface}") is allowed by aircraft profile but requires pre-deployment bearing-strength (CBR/PCN), FOD, and monsoon drainage checks.`
      : null,
    unpaved,
  };
}

function evaluateElevationGate(aircraft, airstrip, config = DECISION_CONFIG) {
  return evaluateElevationGateInternal(aircraft, airstrip, config).gate;
}

function evaluateRunwayLengthGate(aircraft, airstrip, config = DECISION_CONFIG) {
  return evaluateRunwayLengthGateInternal(aircraft, airstrip, config).gate;
}

function evaluateSurfaceGate(aircraft, airstrip, config = DECISION_CONFIG) {
  return evaluateSurfaceGateInternal(aircraft, airstrip, config).gate;
}

/**
 * Runs all hard gates and collects operational warnings + conditional flags.
 *
 * @param {Object} aircraft
 * @param {Object} airstrip
 * @param {Object} [config]
 * @returns {{ gates: Array, warnings: string[], flags: Object }}
 */
function evaluateAllGates(aircraft, airstrip, config = DECISION_CONFIG) {
  const elevResult = evaluateElevationGateInternal(aircraft, airstrip, config);
  const runwayResult = evaluateRunwayLengthGateInternal(aircraft, airstrip, config);
  const surfaceResult = evaluateSurfaceGateInternal(aircraft, airstrip, config);

  const gates = [runwayResult.gate, surfaceResult.gate, elevResult.gate];
  const warnings = [runwayResult.warning, surfaceResult.warning, elevResult.warning].filter(Boolean);

  return {
    gates,
    warnings,
    flags: {
      tightRunwayMargin: runwayResult.tightMargin,
      highElevationCaution: elevResult.caution,
      unpavedSurfaceCaution: surfaceResult.unpaved,
    },
  };
}

module.exports = {
  toFiniteNumber,
  computeElevationMultiplier,
  evaluateElevationGate,
  evaluateRunwayLengthGate,
  evaluateSurfaceGate,
  evaluateAllGates,
};
