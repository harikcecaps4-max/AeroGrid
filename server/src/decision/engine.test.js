'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DECISION_CONFIG, CAVEAT_TEXT, mergeDecisionConfig } = require('./config');
const {
  computeElevationMultiplier,
  evaluateElevationGate,
  evaluateRunwayLengthGate,
  evaluateSurfaceGate,
} = require('./gates');
const { evaluateAirstrip, rankAirstrips, compareAirstrips } = require('./engine');

const VERIFIED_AIRCRAFT = {
  id: 101,
  name: 'Verified Test Commuter',
  category: 'stol',
  takeoff_distance_m: 400,
  landing_distance_m: 350,
  mtow_kg: 3500,
  payload_kg: 1000,
  seats: 9,
  range_km: 900,
  needs_charging: false,
  allowed_surfaces: ['asphalt', 'concrete'],
  source: 'Verified OEM AFM Test Fixture',
};

const IDEAL_AIRSTRIP = {
  id: 1,
  name: 'Baseline Verified Aerodrome',
  state: 'Maharashtra',
  ownership: 'state',
  surface: 'asphalt',
  elevation_m: 200,
  runway_length_m: 1500,
  night_landing: true,
  fuel_available: true,
  charging_available: true,
  political_severity: 'none',
  disruption_type: 'No Disruption',
  terrain_risk: 'low',
  catchment_population: 600000,
  last_mile_access_km: 2.0,
  nearest_airport_distance_km: 80,
  data_confidence: 'high',
  source: 'Verified AAI Registry Fixture',
};

test('DECISION_CONFIG weights sum to 1.00 and evaluation matches exact output contract', () => {
  const sum = Object.values(DECISION_CONFIG.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `Expected weights sum 1.0, got ${sum}`);

  const result = evaluateAirstrip(VERIFIED_AIRCRAFT, IDEAL_AIRSTRIP);
  assert.deepEqual(Object.keys(result), ['verdict', 'score', 'gates', 'factors', 'warnings', 'caveat']);
  assert.equal(result.caveat, CAVEAT_TEXT);
  assert.equal(result.gates.length, 3);
  for (const gate of result.gates) {
    assert.deepEqual(Object.keys(gate), ['name', 'pass', 'margin', 'explanation']);
  }
  assert.equal(result.factors.length, 5);
  for (const factor of result.factors) {
    assert.deepEqual(Object.keys(factor), ['name', 'weight', 'value', 'note']);
  }
});

test('ideal verified paved airstrip yields viable verdict with high score and zero warnings', () => {
  const result = evaluateAirstrip(VERIFIED_AIRCRAFT, IDEAL_AIRSTRIP);
  assert.equal(result.verdict, 'viable');
  assert.equal(result.score, 97);
  assert.ok(result.gates.every((g) => g.pass === true));
  assert.equal(result.warnings.length, 0);
});

test('boundary runway lengths: exact threshold passes with tight-margin condition, 1m short fails', () => {
  const aircraft = {
    ...VERIFIED_AIRCRAFT,
    takeoff_distance_m: 500,
    landing_distance_m: 400,
  };
  const seaLevelBase = { ...IDEAL_AIRSTRIP, elevation_m: 0 };

  // Base 500m * 1.3 safety * 1.0 elevation = 650m required
  const atThreshold = evaluateAirstrip(aircraft, { ...seaLevelBase, runway_length_m: 650 });
  const thresholdGate = atThreshold.gates.find((g) => g.name === 'runway_length');
  assert.equal(thresholdGate.pass, true);
  assert.equal(thresholdGate.margin, 0);
  assert.equal(atThreshold.verdict, 'viable_with_conditions');
  assert.ok(atThreshold.warnings.some((w) => /tight runway margin/i.test(w)));

  const oneMeterShort = evaluateAirstrip(aircraft, { ...seaLevelBase, runway_length_m: 649 });
  const shortGate = oneMeterShort.gates.find((g) => g.name === 'runway_length');
  assert.equal(shortGate.pass, false);
  assert.equal(shortGate.margin, -1);
  assert.equal(oneMeterShort.verdict, 'not_viable');
  assert.equal(oneMeterShort.score, 0);
});

test('configurable safety margin override changes gate threshold without mutating defaults', () => {
  const aircraft = { ...VERIFIED_AIRCRAFT, takeoff_distance_m: 500, landing_distance_m: 400 };
  const strip = { ...IDEAL_AIRSTRIP, elevation_m: 0, runway_length_m: 700 };

  // Default 1.3x -> 650m required (passes, +50m)
  const defaultEval = evaluateAirstrip(aircraft, strip);
  assert.equal(defaultEval.gates.find((g) => g.name === 'runway_length').pass, true);

  // Override 1.5x -> 750m required (fails, -50m)
  const customCfg = mergeDecisionConfig({ runway: { safetyMarginMultiplier: 1.5 } });
  const strictEval = evaluateAirstrip(aircraft, strip, customCfg);
  const strictGate = strictEval.gates.find((g) => g.name === 'runway_length');
  assert.equal(strictGate.pass, false);
  assert.equal(strictGate.margin, -50);
  assert.equal(strictEval.verdict, 'not_viable');
  assert.equal(DECISION_CONFIG.runway.safetyMarginMultiplier, 1.3);
});

test('high elevation density-altitude penalty and elevation ceiling behave accurately', () => {
  assert.equal(computeElevationMultiplier(0), 1);
  assert.equal(computeElevationMultiplier(-50), 1);
  assert.equal(computeElevationMultiplier(900), 1.21);
  assert.equal(computeElevationMultiplier(1500), 1.35);
  assert.equal(computeElevationMultiplier(null), null);

  // Verify IEEE-754 stability at 300m (1000 * 1.3 * 1.07 = 1391 exact, not 1392)
  const boundaryGate = evaluateRunwayLengthGate(
    { ...VERIFIED_AIRCRAFT, takeoff_distance_m: 1000, landing_distance_m: 800 },
    { ...IDEAL_AIRSTRIP, elevation_m: 300, runway_length_m: 1391 }
  );
  assert.equal(boundaryGate.pass, true);
  assert.equal(boundaryGate.margin, 0);

  // Cessna-like aircraft (658m takeoff): passes 950m at sea level (req 856m), fails at 1500m (req 1155m)
  const feeder = { ...VERIFIED_AIRCRAFT, takeoff_distance_m: 658, landing_distance_m: 500 };
  const seaLevelEval = evaluateAirstrip(feeder, { ...IDEAL_AIRSTRIP, elevation_m: 0, runway_length_m: 950 });
  assert.equal(seaLevelEval.gates.find((g) => g.name === 'runway_length').pass, true);

  const mountainEval = evaluateAirstrip(feeder, { ...IDEAL_AIRSTRIP, elevation_m: 1500, runway_length_m: 950 });
  const mountainRunwayGate = mountainEval.gates.find((g) => g.name === 'runway_length');
  assert.equal(mountainRunwayGate.pass, false);
  assert.equal(mountainRunwayGate.margin, -205);
  assert.equal(mountainEval.verdict, 'not_viable');

  // High elevation (>= 900m) within envelope with sufficient runway yields conditional warning
  const plateauEval = evaluateAirstrip(feeder, { ...IDEAL_AIRSTRIP, elevation_m: 1050, runway_length_m: 1600 });
  assert.equal(plateauEval.verdict, 'viable_with_conditions');
  assert.ok(plateauEval.warnings.some((w) => /high-elevation/i.test(w)));

  // Above maxFieldElevationM (3500m) fails elevation_adjustment hard gate
  const extremeEval = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, elevation_m: 3800, runway_length_m: 3000 });
  const elevGate = extremeEval.gates.find((g) => g.name === 'elevation_adjustment');
  assert.equal(elevGate.pass, false);
  assert.equal(elevGate.margin, -300);
  assert.equal(extremeEval.verdict, 'not_viable');
});

test('surface compatibility rejects unsupported surfaces and flags allowed unpaved surfaces', () => {
  const pavedOnlyAircraft = { ...VERIFIED_AIRCRAFT, allowed_surfaces: ['asphalt', 'concrete'] };
  const grassResult = evaluateAirstrip(pavedOnlyAircraft, { ...IDEAL_AIRSTRIP, surface: 'grass' });
  const surfaceGate = grassResult.gates.find((g) => g.name === 'surface_compatibility');
  assert.equal(surfaceGate.pass, false);
  assert.equal(surfaceGate.margin, -1);
  assert.equal(grassResult.verdict, 'not_viable');
  assert.equal(grassResult.score, 0);

  const roughFieldAircraft = {
    ...VERIFIED_AIRCRAFT,
    allowed_surfaces: ['asphalt', 'concrete', 'gravel', 'grass', 'laterite'],
  };
  const stolOnGrass = evaluateAirstrip(roughFieldAircraft, { ...IDEAL_AIRSTRIP, surface: 'grass' });
  assert.equal(stolOnGrass.gates.find((g) => g.name === 'surface_compatibility').pass, true);
  assert.equal(stolOnGrass.verdict, 'viable_with_conditions');
  assert.ok(stolOnGrass.warnings.some((w) => /unpaved surface/i.test(w)));
});

test('NULL and missing gate fields never silently pass', () => {
  const nullRunway = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, runway_length_m: null });
  assert.equal(nullRunway.verdict, 'not_viable');
  assert.equal(nullRunway.gates.find((g) => g.name === 'runway_length').pass, false);
  assert.equal(nullRunway.gates.find((g) => g.name === 'runway_length').margin, null);

  const nullSurface = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, surface: null });
  assert.equal(nullSurface.verdict, 'not_viable');
  assert.equal(nullSurface.gates.find((g) => g.name === 'surface_compatibility').pass, false);

  const nullElevation = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, elevation_m: null });
  assert.equal(nullElevation.verdict, 'not_viable');
  assert.equal(nullElevation.gates.find((g) => g.name === 'elevation_adjustment').pass, false);
  assert.equal(nullElevation.gates.find((g) => g.name === 'runway_length').pass, false);

  // Boolean / empty-string elevation must not coerce to 0m sea level
  assert.equal(evaluateElevationGate(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, elevation_m: false }).pass, false);
  assert.equal(evaluateSurfaceGate(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, surface: '   ' }).pass, false);
});

test('missing secondary factor fields trigger warnings, penalize confidence, and force conditional verdict', () => {
  const sparseStrip = {
    ...IDEAL_AIRSTRIP,
    terrain_risk: null,
    catchment_population: null,
    last_mile_access_km: null,
    nearest_airport_distance_km: null,
  };

  const result = evaluateAirstrip(VERIFIED_AIRCRAFT, sparseStrip);
  assert.equal(result.verdict, 'viable_with_conditions');
  // 4 missing factors @ 40 = 34.0 weight portion, data_confidence 100 - 4*10 = 60 -> 0.15*60 = 9.0 -> total 43
  assert.equal(result.score, 43);
  assert.equal(result.factors.find((f) => f.name === 'data_confidence').value, 60);
  assert.ok(result.warnings.length >= 4);

  // When last_mile_access_km is NULL but access_points is provided, resolve minimum distance
  const withAccessPoints = evaluateAirstrip(VERIFIED_AIRCRAFT, {
    ...IDEAL_AIRSTRIP,
    last_mile_access_km: null,
    access_points: [{ distance_km: 1.8 }, { distance_km: 4.5 }],
  });
  const lastMileFactor = withAccessPoints.factors.find((f) => f.name === 'last_mile_access');
  assert.equal(lastMileFactor.value, 100);
  assert.match(lastMileFactor.note, /access_points/);
});

test('missing charging, political severity, and range constraint trigger conditional warnings', () => {
  const evtol = { ...VERIFIED_AIRCRAFT, needs_charging: true, range_km: 160 };
  const constrainedStrip = {
    ...IDEAL_AIRSTRIP,
    charging_available: false,
    political_severity: 'high',
    disruption_type: 'Land Acquisition Contestation',
    nearest_airport_distance_km: 150, // > 85% of 160 km (136 km)
  };

  const result = evaluateAirstrip(evtol, constrainedStrip);
  assert.equal(result.verdict, 'viable_with_conditions');
  assert.ok(result.warnings.some((w) => /electric charging/i.test(w)));
  assert.ok(result.warnings.some((w) => /political/i.test(w)));
  assert.ok(result.warnings.some((w) => /85% of aircraft nominal range/i.test(w)));
});

test('rankAirstrips and compareAirstrips order results deterministically with filters and caveat', () => {
  const strips = [
    { ...IDEAL_AIRSTRIP, id: 1, name: 'Beta Unpaved Grass', surface: 'grass' }, // fails paved-only gate
    { ...IDEAL_AIRSTRIP, id: 2, name: 'Gamma Moderate Conditional', terrain_risk: 'high', political_severity: 'moderate', disruption_type: 'Permit Delay' },
    { ...IDEAL_AIRSTRIP, id: 3, name: 'Alpha Prime Paved', runway_length_m: 1800 },
  ];

  const ranked = rankAirstrips(VERIFIED_AIRCRAFT, strips);
  assert.equal(ranked.total_evaluated, 3);
  assert.equal(ranked.viable_count, 1);
  assert.equal(ranked.conditional_count, 1);
  assert.equal(ranked.not_viable_count, 1);
  assert.equal(ranked.results.length, 2); // default hides not_viable
  assert.equal(ranked.results[0].airstrip.name, 'Alpha Prime Paved');
  assert.equal(ranked.results[0].rank, 1);
  assert.equal(ranked.results[1].airstrip.name, 'Gamma Moderate Conditional');
  assert.equal(ranked.caveat, CAVEAT_TEXT);

  const rankedAll = rankAirstrips(VERIFIED_AIRCRAFT, strips, { filters: { includeNotViable: true } });
  assert.equal(rankedAll.results.length, 3);
  assert.equal(rankedAll.results[2].evaluation.verdict, 'not_viable');

  const compared = compareAirstrips(VERIFIED_AIRCRAFT, strips);
  assert.equal(compared.comparisons.length, 3);
  assert.equal(compared.recommended_airstrip_id, 3);
  assert.equal(compared.matrix.length, 3);
  assert.match(compared.summary, /Alpha Prime Paved/);
  assert.equal(compared.caveat, CAVEAT_TEXT);

  const allFailedComparison = compareAirstrips(VERIFIED_AIRCRAFT, [strips[0]]);
  assert.equal(allFailedComparison.recommended_airstrip_id, null);
  assert.match(allFailedComparison.summary, /None of the 1 compared airstrips/);
});

test('landing-governed aircraft, DB column aliases, zero catchment, custom range reserve, and null objects behave safely', () => {
  // 1. Landing distance > takeoff distance governs required runway
  const landingLimitedAircraft = {
    ...VERIFIED_AIRCRAFT,
    takeoff_distance_m: 300,
    landing_distance_m: 600,
  };
  const seaLevel = { ...IDEAL_AIRSTRIP, elevation_m: 0 };
  // 600 * 1.3 = 780m required
  assert.equal(evaluateRunwayLengthGate(landingLimitedAircraft, { ...seaLevel, runway_length_m: 780 }).pass, true);
  assert.equal(evaluateRunwayLengthGate(landingLimitedAircraft, { ...seaLevel, runway_length_m: 779 }).pass, false);

  // 2. Database / fallback JSON column aliases (state_name, surface_name, ownership_name)
  const dbAliasedStrip = {
    id: 99,
    name: 'SQL Aliased Strip',
    state_name: 'Gujarat',
    surface_name: 'concrete',
    ownership_name: 'psu',
    elevation_m: 50,
    runway_length_m: 1400,
    fuel_available: true,
    terrain_risk: 'low',
    catchment_population: 500000,
    last_mile_access_km: 1.5,
    nearest_airport_distance_km: 60,
    data_confidence: 'high',
    source: 'Verified AAI Fixture',
  };
  const aliasRanked = rankAirstrips(VERIFIED_AIRCRAFT, [dbAliasedStrip], {
    filters: { state: 'Gujarat', surface: 'concrete', ownership: 'psu', minRunwayLengthM: 1200 },
  });
  assert.equal(aliasRanked.results.length, 1);
  assert.equal(aliasRanked.results[0].airstrip.ownership, 'psu');
  assert.equal(aliasRanked.results[0].evaluation.verdict, 'viable');

  // 3. Zero catchment_population (valid negligible band = 10/100) vs negative (-50 = invalid/missing = 40/100 + warning)
  const zeroCatchment = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, catchment_population: 0 });
  const negCatchment = evaluateAirstrip(VERIFIED_AIRCRAFT, { ...IDEAL_AIRSTRIP, catchment_population: -50 });
  assert.equal(zeroCatchment.factors.find((f) => f.name === 'catchment_population').value, 10);
  assert.equal(negCatchment.factors.find((f) => f.name === 'catchment_population').value, 40);
  assert.ok(negCatchment.warnings.some((w) => /catchment_population/i.test(w)));

  // 4. Custom rangeReserveRatio override via mergeDecisionConfig + null objects safety
  const customRangeCfg = mergeDecisionConfig({ scoring: { airportDistance: { rangeReserveRatio: 0.5 } } });
  const rangeCheck = evaluateAirstrip(
    { ...VERIFIED_AIRCRAFT, range_km: 200 },
    { ...IDEAL_AIRSTRIP, nearest_airport_distance_km: 110 },
    customRangeCfg
  );
  assert.ok(rangeCheck.warnings.some((w) => /50% of aircraft nominal range/i.test(w)));

  const nullEval = evaluateAirstrip(null, null);
  assert.equal(nullEval.verdict, 'not_viable');
  assert.equal(nullEval.score, 0);
  assert.equal(nullEval.caveat, CAVEAT_TEXT);
});
