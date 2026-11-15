'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const app = require('../../../server/index');
const { CAVEAT_TEXT } = require('../decision/config');

let server;
let baseUrl;

/**
 * Sends a JSON HTTP request against the ephemeral test Express server.
 *
 * @param {string} path
 * @param {{ method?: string, body?: any, headers?: Record<string, string> }} [options]
 * @returns {Promise<{ status: number, headers: Headers, json: any }>}
 */
async function requestJson(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const init = {
    method,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { status: res.status, headers: res.headers, json };
}

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/aircraft returns all 5 placeholder aircraft profiles with caveat', async () => {
  const { status, headers, json } = await requestJson('/api/aircraft');

  assert.equal(status, 200);
  assert.ok(headers.get('x-request-id'));
  assert.equal(json.caveat, CAVEAT_TEXT);
  assert.equal(json.count, 5);
  assert.equal(json.aircraft.length, 5);

  const expectedNames = [
    'Joby S4 (Representative eVTOL)',
    'Electra EL-2 Goldfinch (Representative eSTOL)',
    'Viking DHC-6 Twin Otter Series 400',
    'Cessna 208B Grand Caravan EX',
    'ATR 42-600S (Regional Turboprop)',
  ];
  assert.deepEqual(
    json.aircraft.map((a) => a.name),
    expectedNames,
  );

  for (const profile of json.aircraft) {
    assert.equal(typeof profile.id, 'number');
    assert.equal(typeof profile.category, 'string');
    assert.equal(typeof profile.takeoff_distance_m, 'number');
    assert.equal(typeof profile.landing_distance_m, 'number');
    assert.equal(typeof profile.range_km, 'number');
    assert.equal(typeof profile.needs_charging, 'boolean');
    assert.ok(Array.isArray(profile.allowed_surfaces));
    assert.match(profile.source, /PLACEHOLDER/);
  }
});

test('POST /api/evaluate evaluates compatible paved airstrip with missing-data conditions and caveat', async () => {
  const { status, json } = await requestJson('/api/evaluate', {
    method: 'POST',
    body: { aircraftId: 3, airstripId: 1 },
  });

  assert.equal(status, 200);
  assert.equal(json.caveat, CAVEAT_TEXT);
  assert.equal(json.aircraft.id, 3);
  assert.equal(json.airstrip.id, 1);
  assert.equal(json.verdict, 'viable_with_conditions');
  assert.equal(typeof json.score, 'number');
  assert.ok(json.score > 0 && json.score <= 100);
  assert.equal(json.gates.length, 3);
  assert.ok(json.gates.every((g) => g.pass === true));
  assert.equal(json.factors.length, 5);
  assert.ok(json.warnings.length > 0);
  assert.ok(
    json.warnings.some((w) => /confidence|terrain_risk|catchment|last_mile/i.test(w)),
    'Expected missing-data warning when fallback airstrip decision fields are null',
  );
});

test('POST /api/evaluate returns not_viable with score 0 on incompatible surface', async () => {
  const { status, json } = await requestJson('/api/evaluate', {
    method: 'POST',
    body: { aircraftId: 1, airstripId: 5 },
  });

  assert.equal(status, 200);
  assert.equal(json.caveat, CAVEAT_TEXT);
  assert.equal(json.verdict, 'not_viable');
  assert.equal(json.score, 0);
  const surfaceGate = json.gates.find((g) => g.name === 'surface_compatibility');
  assert.equal(surfaceGate?.pass, false);
});

test('POST /api/evaluate returns 404 with caveat when aircraft or airstrip id does not exist', async () => {
  const missingAircraft = await requestJson('/api/evaluate', {
    method: 'POST',
    body: { aircraftId: 999, airstripId: 1 },
  });
  assert.equal(missingAircraft.status, 404);
  assert.equal(missingAircraft.json.caveat, CAVEAT_TEXT);
  assert.match(missingAircraft.json.error, /Aircraft profile #999/);

  const missingAirstrip = await requestJson('/api/evaluate', {
    method: 'POST',
    body: { aircraftId: 1, airstripId: 999 },
  });
  assert.equal(missingAirstrip.status, 404);
  assert.equal(missingAirstrip.json.caveat, CAVEAT_TEXT);
  assert.match(missingAirstrip.json.error, /Airstrip #999/);
});

test('POST /api/evaluate rejects malformed payloads with 400 Validation Error', async () => {
  const invalidPayloads = [
    {},
    { aircraftId: -1, airstripId: 'abc' },
    { aircraftId: true, airstripId: 1 },
  ];

  for (const body of invalidPayloads) {
    const { status, json } = await requestJson('/api/evaluate', {
      method: 'POST',
      body,
    });
    assert.equal(status, 400);
    assert.equal(json.error, 'Validation Error');
    assert.ok(Array.isArray(json.issues) && json.issues.length > 0);
  }
});

test('POST /api/rank orders viable airstrips by verdict and score and excludes not_viable by default', async () => {
  for (const aircraftId of [4, 5]) {
    const { status, json } = await requestJson('/api/rank', {
      method: 'POST',
      body: { aircraftId },
    });

    assert.equal(status, 200);
    assert.equal(json.caveat, CAVEAT_TEXT);
    assert.equal(json.aircraft.id, aircraftId);
    assert.equal(json.total_evaluated, 25);
    assert.ok(json.not_viable_count > 0);
    assert.equal(json.results.length, json.viable_count + json.conditional_count);

    for (let i = 0; i < json.results.length; i += 1) {
      const entry = json.results[i];
      assert.equal(entry.rank, i + 1);
      assert.notEqual(entry.evaluation.verdict, 'not_viable');
      assert.ok(Array.isArray(entry.reasons) && entry.reasons.length > 0);
      assert.ok(entry.airstrip && typeof entry.airstrip.id === 'number');

      if (i > 0) {
        const prev = json.results[i - 1];
        const verdictOrder = { viable: 0, viable_with_conditions: 1, not_viable: 2 };
        const prevTier = verdictOrder[prev.evaluation.verdict];
        const currTier = verdictOrder[entry.evaluation.verdict];
        assert.ok(prevTier <= currTier);
        if (prevTier === currTier) {
          assert.ok(prev.evaluation.score >= entry.evaluation.score);
        }
      }
    }
  }
});

test('POST /api/rank applies state/surface/minRunwayLengthM filters and includeNotViable option', async () => {
  const filtered = await requestJson('/api/rank', {
    method: 'POST',
    body: {
      aircraftId: 5,
      filters: {
        state: 'Karnataka',
        surface: 'asphalt',
        minRunwayLengthM: 1200,
      },
    },
  });

  assert.equal(filtered.status, 200);
  assert.equal(filtered.json.caveat, CAVEAT_TEXT);
  assert.ok(filtered.json.total_evaluated >= 1);
  for (const entry of filtered.json.results) {
    assert.equal(entry.airstrip.state, 'Karnataka');
    assert.equal(entry.airstrip.surface, 'asphalt');
    assert.ok(entry.airstrip.runway_length_m >= 1200);
  }

  const withNotViable = await requestJson('/api/rank', {
    method: 'POST',
    body: {
      aircraftId: 5,
      filters: { includeNotViable: true },
    },
  });

  assert.equal(withNotViable.status, 200);
  assert.equal(withNotViable.json.results.length, withNotViable.json.total_evaluated);
  const notViableEntries = withNotViable.json.results.filter(
    (entry) => entry.evaluation.verdict === 'not_viable',
  );
  assert.equal(notViableEntries.length, withNotViable.json.not_viable_count);
  assert.ok(notViableEntries.length > 0);
  assert.ok(notViableEntries.every((entry) => entry.evaluation.score === 0 && entry.reasons.length > 0));
});

test('POST /api/rank returns 404 for unknown aircraftId and 400 for invalid filter enums', async () => {
  const missing = await requestJson('/api/rank', {
    method: 'POST',
    body: { aircraftId: 999 },
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.caveat, CAVEAT_TEXT);
  assert.match(missing.json.error, /Aircraft profile #999/);

  const invalidFilter = await requestJson('/api/rank', {
    method: 'POST',
    body: { aircraftId: 1, filters: { surface: 'cobblestone' } },
  });
  assert.equal(invalidFilter.status, 400);
  assert.equal(invalidFilter.json.error, 'Validation Error');
  assert.ok(Array.isArray(invalidFilter.json.issues) && invalidFilter.json.issues.length > 0);
});

test('POST /api/compare compares 2 and 3 airstrips side-by-side and selects recommended strip', async () => {
  const twoWay = await requestJson('/api/compare', {
    method: 'POST',
    body: { aircraftId: 3, airstripIds: [1, 2] },
  });

  assert.equal(twoWay.status, 200);
  assert.equal(twoWay.json.caveat, CAVEAT_TEXT);
  assert.equal(twoWay.json.aircraft.id, 3);
  assert.equal(twoWay.json.comparisons.length, 2);
  assert.ok([1, 2].includes(twoWay.json.recommended_airstrip_id));
  assert.ok(Array.isArray(twoWay.json.matrix));
  assert.equal(twoWay.json.matrix.length, 2);
  assert.equal(typeof twoWay.json.matrix[0].airstrip_id, 'number');
  assert.equal(typeof twoWay.json.matrix[0].surface_pass, 'boolean');
  assert.equal(typeof twoWay.json.summary, 'string');

  const threeWay = await requestJson('/api/compare', {
    method: 'POST',
    body: { aircraftId: 1, airstripIds: [1, 2, 5] },
  });

  assert.equal(threeWay.status, 200);
  assert.equal(threeWay.json.caveat, CAVEAT_TEXT);
  assert.equal(threeWay.json.comparisons.length, 3);
  assert.ok([1, 2].includes(threeWay.json.recommended_airstrip_id));
  const gravelEntry = threeWay.json.comparisons.find((c) => c.airstrip.id === 5);
  assert.equal(gravelEntry?.evaluation.verdict, 'not_viable');
});

test('POST /api/compare rejects fewer than 2, more than 3, or duplicate airstripIds with 400', async () => {
  const invalidArrays = [
    [1],
    [1, 2, 3, 4],
    [1, 1],
  ];

  for (const airstripIds of invalidArrays) {
    const { status, json } = await requestJson('/api/compare', {
      method: 'POST',
      body: { aircraftId: 1, airstripIds },
    });
    assert.equal(status, 400);
    assert.equal(json.error, 'Validation Error');
    assert.ok(Array.isArray(json.issues) && json.issues.length > 0);
  }
});

test('POST /api/compare returns 404 with caveat when aircraftId or any airstripId is missing', async () => {
  const missingAircraft = await requestJson('/api/compare', {
    method: 'POST',
    body: { aircraftId: 999, airstripIds: [1, 2] },
  });
  assert.equal(missingAircraft.status, 404);
  assert.equal(missingAircraft.json.caveat, CAVEAT_TEXT);
  assert.match(missingAircraft.json.error, /Aircraft profile #999/);

  const missingStrip = await requestJson('/api/compare', {
    method: 'POST',
    body: { aircraftId: 1, airstripIds: [1, 999] },
  });
  assert.equal(missingStrip.status, 404);
  assert.equal(missingStrip.json.caveat, CAVEAT_TEXT);
  assert.deepEqual(missingStrip.json.missingIds, [999]);
});

test('decision-support caveat is present across airstrip, spatial, and validation responses', async () => {
  const collection = await requestJson('/api/airstrips');
  assert.equal(collection.status, 200);
  assert.equal(collection.json.caveat, CAVEAT_TEXT);
  assert.equal(collection.json.type, 'FeatureCollection');

  const single = await requestJson('/api/airstrips/1');
  assert.equal(single.status, 200);
  assert.equal(single.json.caveat, CAVEAT_TEXT);
  assert.equal(single.json.type, 'Feature');

  const badId = await requestJson('/api/airstrips/not-a-number');
  assert.equal(badId.status, 400);
  assert.equal(badId.json.caveat, CAVEAT_TEXT);

  const missingStrip = await requestJson('/api/airstrips/999');
  assert.equal(missingStrip.status, 404);
  assert.equal(missingStrip.json.caveat, CAVEAT_TEXT);

  const radius = await requestJson('/api/airstrips/radius?lat=13.07&lng=77.60');
  assert.equal(radius.status, 200);
  assert.equal(radius.json.caveat, CAVEAT_TEXT);

  const badRadius = await requestJson('/api/airstrips/radius');
  assert.equal(badRadius.status, 400);
  assert.equal(badRadius.json.caveat, CAVEAT_TEXT);

  const badValidation = await requestJson('/api/evaluate', {
    method: 'POST',
    body: {},
  });
  assert.equal(badValidation.status, 400);
  assert.equal(badValidation.json.caveat, CAVEAT_TEXT);
});

test('functions/aerogrid_api shares engine without duplication and evaluates ?aircraft_id on GET /airstrips', async () => {
  const catalystEntry = require('../../../functions/aerogrid_api/index');
  const sharedDecision = require('../../../functions/aerogrid_api/src/decision');
  const engine = require('../decision/engine');

  assert.equal(catalystEntry, app);
  assert.equal(sharedDecision.evaluateAirstrip, engine.evaluateAirstrip);
  assert.equal(sharedDecision.rankAirstrips, engine.rankAirstrips);
  assert.equal(sharedDecision.compareAirstrips, engine.compareAirstrips);

  const listWithAircraft = await requestJson('/api/airstrips?aircraft_id=1');
  assert.equal(listWithAircraft.status, 200);
  assert.equal(listWithAircraft.json.caveat, CAVEAT_TEXT);
  assert.equal(listWithAircraft.json.count, 25);

  const featureWithDecision = listWithAircraft.json.features.find(
    (f) => f.properties.id === 1,
  );
  assert.ok(featureWithDecision?.properties.decision);
  assert.equal(featureWithDecision.properties.decision.caveat, CAVEAT_TEXT);
  assert.equal(featureWithDecision.properties.decision.gates.length, 3);
  assert.equal(featureWithDecision.properties.decision.factors.length, 5);

  const singleWithAircraft = await requestJson('/api/airstrips/1?aircraft_id=1');
  assert.equal(singleWithAircraft.status, 200);
  assert.deepEqual(
    singleWithAircraft.json.properties.decision,
    featureWithDecision.properties.decision,
  );

  const invalidAircraftParam = await requestJson('/api/airstrips?aircraft_id=abc');
  assert.equal(invalidAircraftParam.status, 400);
  assert.equal(invalidAircraftParam.json.caveat, CAVEAT_TEXT);

  const missingAircraftParam = await requestJson('/api/airstrips?aircraft_id=999');
  assert.equal(missingAircraftParam.status, 404);
  assert.equal(missingAircraftParam.json.caveat, CAVEAT_TEXT);
});
