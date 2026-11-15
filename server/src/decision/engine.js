'use strict';

const { mergeDecisionConfig } = require('./config');
const { evaluateAllGates, toFiniteNumber } = require('./gates');
const { evaluateFactors } = require('./factors');

const VERDICT_RANK = Object.freeze({
  viable: 0,
  viable_with_conditions: 1,
  not_viable: 2,
});

/**
 * Extracts compact aircraft metadata for inclusion in ranking and comparison outputs.
 *
 * @param {Object|null} aircraft
 * @returns {{ id: number|string|null, name: string, category: string|null, source: string|null }|null}
 */
function summarizeAircraft(aircraft) {
  if (!aircraft) return null;
  return {
    id: aircraft.id ?? null,
    name: aircraft.name ?? 'Unknown Aircraft',
    category: aircraft.category ?? null,
    source: aircraft.source ?? null,
  };
}

/**
 * Extracts normalized airstrip summary attributes across direct and SQL/JSON column aliases.
 *
 * @param {Object} airstrip
 * @returns {Object}
 */
function summarizeAirstrip(airstrip) {
  return {
    id: airstrip.id ?? null,
    name: airstrip.name ?? 'Unnamed Airstrip',
    state: airstrip.state ?? airstrip.state_name ?? null,
    surface: airstrip.surface ?? airstrip.surface_name ?? null,
    ownership: airstrip.ownership ?? airstrip.ownership_name ?? airstrip.ownership_type ?? null,
    elevation_m: toFiniteNumber(airstrip.elevation_m),
    runway_length_m: toFiniteNumber(airstrip.runway_length_m),
    data_confidence: airstrip.data_confidence ?? null,
    source: airstrip.source ?? null,
  };
}

function getRunwayMargin(evaluation) {
  const runwayGate = evaluation.gates.find((g) => g.name === 'runway_length');
  return runwayGate && typeof runwayGate.margin === 'number' ? runwayGate.margin : -Infinity;
}

/**
 * Deterministic comparator sorting viable > viable_with_conditions > not_viable,
 * then weighted score descending, runway margin descending, and airstrip name ascending.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function compareEvaluatedEntries(a, b) {
  const verdictDiff = VERDICT_RANK[a.evaluation.verdict] - VERDICT_RANK[b.evaluation.verdict];
  if (verdictDiff !== 0) return verdictDiff;

  const scoreDiff = b.evaluation.score - a.evaluation.score;
  if (scoreDiff !== 0) return scoreDiff;

  const marginDiff = getRunwayMargin(b.evaluation) - getRunwayMargin(a.evaluation);
  if (marginDiff !== 0) return marginDiff;

  return String(a.airstrip.name).localeCompare(String(b.airstrip.name), 'en');
}

function buildEntryReasons(airstrip, evaluation) {
  const reasons = [];
  const runwayGate = evaluation.gates.find((g) => g.name === 'runway_length');
  const surfaceGate = evaluation.gates.find((g) => g.name === 'surface_compatibility');

  if (evaluation.verdict === 'not_viable') {
    const failed = evaluation.gates.filter((g) => !g.pass).map((g) => g.explanation);
    return failed.length > 0 ? failed : ['Failed hard operational suitability gate.'];
  }

  reasons.push(`Verdict: ${evaluation.verdict} (weighted score ${evaluation.score}/100).`);
  if (runwayGate) reasons.push(runwayGate.explanation);
  if (surfaceGate) reasons.push(surfaceGate.explanation);

  if (evaluation.warnings.length > 0) {
    reasons.push(`Conditions/Warnings (${evaluation.warnings.length}): ${evaluation.warnings[0]}`);
  } else {
    reasons.push(`All ${evaluation.gates.length} hard gates passed with no operational caveats.`);
  }

  return reasons;
}

/**
 * Evaluates a single airstrip against an aircraft profile.
 *
 * Pure function: no DB queries, HTTP calls, or side effects.
 *
 * @param {Object} aircraft
 * @param {Object} airstrip
 * @param {Object} [customConfig]
 * @returns {{ verdict: string, score: number, gates: Array, factors: Array, warnings: string[], caveat: string }}
 */
function evaluateAirstrip(aircraft, airstrip, customConfig) {
  const config = mergeDecisionConfig(customConfig);
  const safeAircraft = aircraft || {};
  const safeAirstrip = airstrip || {};

  const gateResult = evaluateAllGates(safeAircraft, safeAirstrip, config);
  const factorResult = evaluateFactors(safeAircraft, safeAirstrip, config);

  const operationalWarnings = [];
  let missingUtilities = false;
  let politicalCondition = false;

  if (safeAircraft.needs_charging === true && safeAirstrip.charging_available !== true) {
    missingUtilities = true;
    operationalWarnings.push(
      'Aircraft requires electric charging, which is not currently installed at this airstrip (mobile/pad charger required).'
    );
  } else if (safeAircraft.needs_charging === false && safeAirstrip.fuel_available !== true) {
    missingUtilities = true;
    operationalWarnings.push(
      'Aviation fuel is not currently available on-site (tankering or mobile fuel bowser required).'
    );
  }

  const politicalSeverity =
    typeof safeAirstrip.political_severity === 'string'
      ? safeAirstrip.political_severity.trim().toLowerCase()
      : 'none';
  if (politicalSeverity === 'moderate' || politicalSeverity === 'high') {
    politicalCondition = true;
    const disruption = safeAirstrip.disruption_type || 'jurisdictional or regulatory friction';
    operationalWarnings.push(
      `Political/jurisdictional disruption risk (${politicalSeverity.toUpperCase()}): ${disruption}.`
    );
  }

  const failedGates = gateResult.gates.filter((g) => !g.pass);
  const anyGateFailed = failedGates.length > 0;

  let verdict;
  let score;

  if (anyGateFailed) {
    verdict = 'not_viable';
    score = 0;
  } else {
    const weightedSum = factorResult.factors.reduce((sum, f) => sum + f.weight * f.value, 0);
    score = Math.max(0, Math.min(100, Math.round(weightedSum)));

    const isConditional =
      score < config.scoring.viableMinScore ||
      factorResult.missingFactorCount > 0 ||
      factorResult.effectiveConfidence === 'low' ||
      factorResult.effectiveConfidence === 'unverified' ||
      gateResult.flags.tightRunwayMargin ||
      gateResult.flags.highElevationCaution ||
      gateResult.flags.unpavedSurfaceCaution ||
      factorResult.flags.highTerrainRisk ||
      factorResult.flags.rangeConstrained ||
      missingUtilities ||
      politicalCondition;

    verdict = isConditional ? 'viable_with_conditions' : 'viable';
  }

  const rawWarnings = anyGateFailed
    ? [...failedGates.map((g) => g.explanation), ...gateResult.warnings, ...factorResult.warnings, ...operationalWarnings]
    : [...gateResult.warnings, ...factorResult.warnings, ...operationalWarnings];

  const warnings = Array.from(new Set(rawWarnings.filter(Boolean)));

  return {
    verdict,
    score,
    gates: gateResult.gates,
    factors: factorResult.factors,
    warnings,
    caveat: config.caveat,
  };
}

function matchesFilterString(actual, expected) {
  if (!expected) return true;
  if (!actual) return false;
  return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

/**
 * Filters airstrip candidates by state, surface, ownership, and minimum runway length.
 *
 * @param {Array<Object>} airstrips
 * @param {Object} [filters={}]
 * @returns {Array<Object>}
 */
function applyAirstripFilters(airstrips, filters = {}) {
  return airstrips.filter((strip) => {
    if (!matchesFilterString(strip.state ?? strip.state_name, filters.state)) return false;
    if (!matchesFilterString(strip.surface ?? strip.surface_name, filters.surface)) return false;
    if (!matchesFilterString(strip.ownership ?? strip.ownership_name ?? strip.ownership_type, filters.ownership)) return false;
    if (filters.minRunwayLengthM !== undefined && filters.minRunwayLengthM !== null) {
      const len = toFiniteNumber(strip.runway_length_m);
      if (len === null || len < Number(filters.minRunwayLengthM)) return false;
    }
    return true;
  });
}

/**
 * Evaluates, filters, and ranks candidate airstrips for a chosen aircraft profile.
 *
 * @param {Object} aircraft
 * @param {Array<Object>} airstrips
 * @param {Object} [options]
 * @param {Object} [customConfig]
 */
function rankAirstrips(aircraft, airstrips, options = {}, customConfig) {
  const config = mergeDecisionConfig(customConfig);
  const filters = (options && options.filters) || options || {};
  const list = Array.isArray(airstrips) ? airstrips : [];

  const filtered = applyAirstripFilters(list, filters);
  const evaluated = filtered.map((strip) => {
    const evaluation = evaluateAirstrip(aircraft, strip, config);
    return {
      airstrip: summarizeAirstrip(strip),
      evaluation,
      reasons: buildEntryReasons(strip, evaluation),
    };
  });

  evaluated.sort(compareEvaluatedEntries);

  const viableCount = evaluated.filter((e) => e.evaluation.verdict === 'viable').length;
  const conditionalCount = evaluated.filter((e) => e.evaluation.verdict === 'viable_with_conditions').length;
  const notViableCount = evaluated.filter((e) => e.evaluation.verdict === 'not_viable').length;

  const includeNotViable = filters.includeNotViable === true || filters.onlyViable === false;
  const visible = includeNotViable
    ? evaluated
    : evaluated.filter((e) => e.evaluation.verdict !== 'not_viable');

  const results = visible.map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));

  return {
    aircraft: summarizeAircraft(aircraft),
    total_evaluated: evaluated.length,
    viable_count: viableCount,
    conditional_count: conditionalCount,
    not_viable_count: notViableCount,
    results,
    caveat: config.caveat,
  };
}

/**
 * Produces a side-by-side comparison of 2-3 selected airstrips for a chosen aircraft.
 *
 * @param {Object} aircraft
 * @param {Array<Object>} airstrips
 * @param {Object} [customConfig]
 */
function compareAirstrips(aircraft, airstrips, customConfig) {
  const config = mergeDecisionConfig(customConfig);
  const list = Array.isArray(airstrips) ? airstrips : [];

  const evaluated = list.map((strip) => {
    const evaluation = evaluateAirstrip(aircraft, strip, config);
    return {
      airstrip: summarizeAirstrip(strip),
      evaluation,
      reasons: buildEntryReasons(strip, evaluation),
    };
  });

  evaluated.sort(compareEvaluatedEntries);

  const comparisons = evaluated.map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));

  const top = comparisons[0] || null;
  const recommendedId = top && top.evaluation.verdict !== 'not_viable' ? top.airstrip.id : null;

  const matrix = comparisons.map((c) => {
    const runwayGate = c.evaluation.gates.find((g) => g.name === 'runway_length');
    const surfaceGate = c.evaluation.gates.find((g) => g.name === 'surface_compatibility');
    const elevGate = c.evaluation.gates.find((g) => g.name === 'elevation_adjustment');
    return {
      airstrip_id: c.airstrip.id,
      name: c.airstrip.name,
      verdict: c.evaluation.verdict,
      score: c.evaluation.score,
      runway_margin_m: runwayGate ? runwayGate.margin : null,
      surface_pass: surfaceGate ? surfaceGate.pass : false,
      elevation_pass: elevGate ? elevGate.pass : false,
      warning_count: c.evaluation.warnings.length,
    };
  });

  const summary = !top
    ? 'No airstrips provided for comparison.'
    : recommendedId !== null
      ? `${top.airstrip.name} ranks #1 (${top.evaluation.verdict}, score ${top.evaluation.score}/100) among ${comparisons.length} compared airstrips.`
      : `None of the ${comparisons.length} compared airstrips pass all hard operational gates for ${aircraft?.name || 'the selected aircraft'}.`;

  return {
    aircraft: summarizeAircraft(aircraft),
    comparisons,
    recommended_airstrip_id: recommendedId,
    summary,
    matrix,
    caveat: config.caveat,
  };
}

module.exports = {
  evaluateAirstrip,
  rankAirstrips,
  compareAirstrips,
};
