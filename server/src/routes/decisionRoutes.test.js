'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');

// Clearly named test secret & dev passwords configured in test setup (not hardcoded in env.js)
process.env.NODE_ENV = 'test';
const TEST_JWT_SECRET = 'aerogrid-test-suite-jwt-secret-key-min-32-chars';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.ALLOW_FALLBACK = 'true';
process.env.DEV_ADMIN_PASSWORD = 'TestAdminPassword!2026';
process.env.DEV_ANALYST_PASSWORD = 'TestAnalystPassword!2026';
process.env.DEV_VIEWER_PASSWORD = 'TestViewerPassword!2026';

const app = require('../../../server/index');
const config = require('../config/env');
const { requireRole } = require('../middleware/auth');
const authRoutes = require('./authRoutes');
const { CAVEAT_TEXT } = require('../decision/config');

authRoutes.initInMemoryUsers(process.env);

let server;
let baseUrl;

function signTestToken(payload = { id: 3, email: 'viewer@aerogrid.dev', role: 'viewer', name: 'Test Viewer' }, options = {}) {
  return jwt.sign(payload, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    ...options,
  });
}

const DEFAULT_VIEWER_TOKEN = signTestToken();

/**
 * Sends a JSON HTTP request against the ephemeral test Express server.
 *
 * @param {string} path
 * @param {{ method?: string, body?: any, headers?: Record<string, string>, token?: string | null }} [options]
 * @returns {Promise<{ status: number, headers: Headers, json: any }>}
 */
async function requestJson(path, options = {}) {
  const { method = 'GET', body, headers = {}, token = DEFAULT_VIEWER_TOKEN } = options;
  const authHeader =
    token !== null && !headers.Authorization && !headers.authorization
      ? { Authorization: `Bearer ${token}` }
      : {};
  const init = {
    method,
    headers: {
      Accept: 'application/json',
      ...authHeader,
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
  assert.equal(json.data_source, 'fallback');
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
  assert.equal(json.data_source, 'fallback');
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
    assert.equal(json.data_source, 'fallback');
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
  assert.equal(twoWay.json.data_source, 'fallback');
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
  assert.equal(collection.json.data_source, 'fallback');
  assert.equal(collection.json.type, 'FeatureCollection');

  const single = await requestJson('/api/airstrips/1');
  assert.equal(single.status, 200);
  assert.equal(single.json.caveat, CAVEAT_TEXT);
  assert.equal(single.json.data_source, 'fallback');
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
  assert.equal(radius.json.data_source, 'fallback');

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

test('auth security: production JWT_SECRET validation, requireRole fail-closed startup check, and 401/403 enforcement', async () => {
  // 1. env.js throws in production when JWT_SECRET is missing or < 32 chars
  assert.throws(
    () => config.validateProductionEnv({ NODE_ENV: 'production' }),
    /JWT_SECRET is required/i,
  );
  assert.throws(
    () => config.validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'too-short-secret' }),
    /JWT_SECRET is required/i,
  );
  assert.doesNotThrow(() =>
    config.validateProductionEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-valid-32-character-minimum-production-secret',
    }),
  );

  // 2. requireRole throws at startup on unknown role name and returns 401 when req.user is missing
  assert.throws(() => requireRole('superadmin'), /Invalid role/i);
  assert.throws(() => requireRole(''), /Invalid role/i);

  const viewerMiddleware = requireRole('viewer');
  let capturedStatus = null;
  viewerMiddleware(
    {},
    {
      status(code) {
        capturedStatus = code;
        return { json() {} };
      },
    },
    () => {},
  );
  assert.equal(capturedStatus, 401);

  // 3. Protected routes return 401 on missing, invalid, wrong-alg, or expired token
  const protectedEndpoints = [
    { method: 'GET', path: '/api/aircraft' },
    { method: 'POST', path: '/api/evaluate', body: { aircraftId: 1, airstripId: 1 } },
    { method: 'POST', path: '/api/rank', body: { aircraftId: 1 } },
    { method: 'POST', path: '/api/compare', body: { aircraftId: 1, airstripIds: [1, 2] } },
    { method: 'GET', path: '/api/airstrips/1/assets' },
  ];

  const expiredToken = signTestToken(
    { id: 3, email: 'viewer@aerogrid.dev', role: 'viewer' },
    { expiresIn: '-10s' },
  );
  const wrongAlgToken = jwt.sign(
    { id: 3, email: 'viewer@aerogrid.dev', role: 'viewer' },
    TEST_JWT_SECRET,
    { algorithm: 'HS384' },
  );

  for (const ep of protectedEndpoints) {
    const noTokenRes = await requestJson(ep.path, { method: ep.method, body: ep.body, token: null });
    assert.equal(noTokenRes.status, 401, `Expected 401 without token on ${ep.method} ${ep.path}`);

    const badTokenRes = await requestJson(ep.path, {
      method: ep.method,
      body: ep.body,
      token: 'not.a.valid.jwt',
    });
    assert.equal(badTokenRes.status, 401, `Expected 401 with malformed token on ${ep.method} ${ep.path}`);

    const expiredRes = await requestJson(ep.path, {
      method: ep.method,
      body: ep.body,
      token: expiredToken,
    });
    assert.equal(expiredRes.status, 401, `Expected 401 with expired token on ${ep.method} ${ep.path}`);

    const wrongAlgRes = await requestJson(ep.path, {
      method: ep.method,
      body: ep.body,
      token: wrongAlgToken,
    });
    assert.equal(wrongAlgRes.status, 401, `Expected 401 with HS384 token on ${ep.method} ${ep.path}`);
  }
});

test('auth security: backdoor passwords removed, register enforces viewer role & 409 duplicate, and admin role management works', async () => {
  // 1. Backdoor passwords ('AeroGrid2026!', 'password123') must fail with 401
  for (const backdoor of ['AeroGrid2026!', 'password123']) {
    const res = await requestJson('/api/auth/login', {
      method: 'POST',
      token: null,
      body: { email: 'admin@aerogrid.dev', password: backdoor },
    });
    assert.equal(res.status, 401);
  }

  // 2. Real bcrypt password generated from DEV_ADMIN_PASSWORD succeeds (case/whitespace normalized)
  const adminLogin = await requestJson('/api/auth/login', {
    method: 'POST',
    token: null,
    body: { email: '  ADMIN@AeroGrid.dev ', password: process.env.DEV_ADMIN_PASSWORD },
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.json.user.role, 'admin');
  assert.equal(adminLogin.json.user.email, 'admin@aerogrid.dev');
  const adminToken = adminLogin.json.token;

  // 3. Register ignores client-supplied role, always assigns 'viewer', normalizes email, and returns 409 on duplicate
  const regRes = await requestJson('/api/auth/register', {
    method: 'POST',
    token: null,
    body: {
      email: '  NewPilot@AeroGrid.dev ',
      password: 'SecurePilotPassword!99',
      name: 'New Pilot',
      role: 'admin', // must be ignored/stripped
    },
  });
  assert.equal(regRes.status, 201);
  assert.equal(regRes.json.user.email, 'newpilot@aerogrid.dev');
  assert.equal(regRes.json.user.role, 'viewer');
  const newUserId = regRes.json.user.id;
  const viewerToken = regRes.json.token;

  const dupReg = await requestJson('/api/auth/register', {
    method: 'POST',
    token: null,
    body: {
      email: 'newpilot@aerogrid.dev',
      password: 'AnotherPassword!99',
    },
  });
  assert.equal(dupReg.status, 409);

  // 4. Role hierarchy: viewer cannot POST /assets (analyst required) or PATCH /users/:id/role (admin required)
  const viewerPostAsset = await requestJson('/api/airstrips/1/assets', {
    method: 'POST',
    token: viewerToken,
    body: { name: 'Unauthorized Hangar', asset_type: 'hangar' },
  });
  assert.equal(viewerPostAsset.status, 403);

  const viewerPatchRole = await requestJson(`/api/users/${newUserId}/role`, {
    method: 'PATCH',
    token: viewerToken,
    body: { role: 'analyst' },
  });
  assert.equal(viewerPatchRole.status, 403);

  const analystToken = signTestToken({ id: 2, email: 'analyst@aerogrid.dev', role: 'analyst' });
  const analystPatchRole = await requestJson(`/api/users/${newUserId}/role`, {
    method: 'PATCH',
    token: analystToken,
    body: { role: 'admin' },
  });
  assert.equal(analystPatchRole.status, 403);

  // 5. Admin can promote user role via PATCH /api/users/:id/role
  const adminPatchRole = await requestJson(`/api/users/${newUserId}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'analyst' },
  });
  assert.equal(adminPatchRole.status, 200);
  assert.equal(adminPatchRole.json.user.id, newUserId);
  assert.equal(adminPatchRole.json.user.role, 'analyst');

  // Invalid role enum rejected with 400
  const invalidRolePatch = await requestJson(`/api/users/${newUserId}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'commander' },
  });
  assert.equal(invalidRolePatch.status, 400);

  // In-memory users are disabled in production even if ALLOW_FALLBACK=true
  const prodUsers = authRoutes.initInMemoryUsers({
    NODE_ENV: 'production',
    ALLOW_FALLBACK: 'true',
    DEV_ADMIN_PASSWORD: 'TestAdminPassword!2026',
  });
  assert.equal(prodUsers.length, 0);
  // Restore test in-memory users
  authRoutes.initInMemoryUsers(process.env);
});

test('no silent database fallback: returns 503 when ALLOW_FALLBACK=false or when configured DB query fails', async () => {
  const adminToken = signTestToken({ id: 1, email: 'admin@aerogrid.dev', role: 'admin' });
  const prevAllow = process.env.ALLOW_FALLBACK;
  const prevDbUrl = process.env.DATABASE_URL;

  try {
    // 1. When DATABASE_URL is unset and ALLOW_FALLBACK=false, endpoints return 503 instead of fallback data
    process.env.ALLOW_FALLBACK = 'false';

    const endpoints = [
      { method: 'GET', path: '/api/aircraft' },
      { method: 'POST', path: '/api/evaluate', body: { aircraftId: 1, airstripId: 1 } },
      { method: 'POST', path: '/api/rank', body: { aircraftId: 1 } },
      { method: 'POST', path: '/api/compare', body: { aircraftId: 1, airstripIds: [1, 2] } },
      { method: 'GET', path: '/api/airstrips' },
      { method: 'GET', path: '/api/airstrips/radius?lat=13.07&lng=77.60' },
      { method: 'GET', path: '/api/airstrips/1/assets' },
      {
        method: 'POST',
        path: '/api/airstrips/1/assets',
        body: { name: 'Test Hangar', asset_type: 'hangar' },
      },
    ];

    for (const ep of endpoints) {
      const res = await requestJson(ep.path, {
        method: ep.method,
        body: ep.body,
        token: adminToken,
      });
      assert.equal(res.status, 503, `Expected 503 on ${ep.method} ${ep.path} when ALLOW_FALLBACK=false`);
      assert.ok(res.json.requestId, 'Expected requestId in 503 error response');
    }

    // 2. When DATABASE_URL is configured (even with ALLOW_FALLBACK=true) and query fails, never fall back silently — return 503
    process.env.ALLOW_FALLBACK = 'true';
    process.env.DATABASE_URL = 'postgresql://unreachable:5432/aerogrid';

    for (const ep of endpoints) {
      const res = await requestJson(ep.path, {
        method: ep.method,
        body: ep.body,
        token: adminToken,
      });
      assert.equal(
        res.status,
        503,
        `Expected 503 on ${ep.method} ${ep.path} when configured DB query fails`,
      );
      assert.ok(res.json.requestId, 'Expected requestId in 503 error response');
    }
  } finally {
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
    process.env.ALLOW_FALLBACK = prevAllow ?? 'true';
  }
});

test('validation: Express 5 req.validatedQuery on spatialRoutes and Zod validation on assetRoutes', async () => {
  const analystToken = signTestToken({ id: 2, email: 'analyst@aerogrid.dev', role: 'analyst' });

  // 1. spatialRoutes.js validates lat (-90..90), lng (-180..180), radius_km (positive, max 1000)
  const invalidQueries = [
    '/api/airstrips/radius?lat=95&lng=77.6',
    '/api/airstrips/radius?lat=-95&lng=77.6',
    '/api/airstrips/radius?lat=13.0&lng=190',
    '/api/airstrips/radius?lat=13.0&lng=-185',
    '/api/airstrips/radius?lat=13.0&lng=77.6&radius_km=0',
    '/api/airstrips/radius?lat=13.0&lng=77.6&radius_km=-50',
    '/api/airstrips/radius?lat=13.0&lng=77.6&radius_km=1500',
    '/api/airstrips/radius?lat=&lng=77.6',
  ];

  for (const url of invalidQueries) {
    const res = await requestJson(url);
    assert.equal(res.status, 400, `Expected 400 for invalid spatial query: ${url}`);
    assert.equal(res.json.error, 'Validation Error');
  }

  // Valid query with 0 matching airstrips returns empty array (not full fallback dump)
  const oceanQuery = await requestJson('/api/airstrips/radius?lat=0&lng=0&radius_km=10');
  assert.equal(oceanQuery.status, 200);
  assert.equal(oceanQuery.json.count, 0);
  assert.deepEqual(oceanQuery.json.airstrips, []);
  assert.equal(oceanQuery.json.data_source, 'fallback');

  // 2. assetRoutes.js validates :airstripId and :id params, checks airstrip existence (404), and validates PATCH body
  const badParamGet = await requestJson('/api/airstrips/abc/assets');
  assert.equal(badParamGet.status, 400);

  const missingAirstripPost = await requestJson('/api/airstrips/999/assets', {
    method: 'POST',
    token: analystToken,
    body: {
      name: 'Ghost Airstrip Hangar',
      asset_type: 'hangar',
    },
  });
  assert.equal(missingAirstripPost.status, 404);

  const created1 = await requestJson('/api/airstrips/1/assets', {
    method: 'POST',
    token: analystToken,
    body: {
      name: 'Weather Radar Array 1',
      asset_type: 'weather_station',
      status: 'operational',
      condition_grade: 'excellent',
    },
  });
  assert.equal(created1.status, 201);
  assert.equal(created1.json.data_source, 'fallback');

  const created2 = await requestJson('/api/airstrips/1/assets', {
    method: 'POST',
    token: analystToken,
    body: {
      name: 'Weather Radar Array 2',
      asset_type: 'weather_station',
    },
  });
  assert.equal(created2.status, 201);
  assert.equal(created2.json.asset.id, created1.json.asset.id + 1);

  // PATCH validation: empty body -> 400, invalid status enum -> 400, notes > 500 chars -> 400, invalid :id -> 400
  const emptyPatch = await requestJson(`/api/assets/${created1.json.asset.id}/status`, {
    method: 'PATCH',
    token: analystToken,
    body: {},
  });
  assert.equal(emptyPatch.status, 400);

  const badStatusPatch = await requestJson(`/api/assets/${created1.json.asset.id}/status`, {
    method: 'PATCH',
    token: analystToken,
    body: { status: 'broken_beyond_repair' },
  });
  assert.equal(badStatusPatch.status, 400);

  const longNotesPatch = await requestJson(`/api/assets/${created1.json.asset.id}/status`, {
    method: 'PATCH',
    token: analystToken,
    body: { notes: 'x'.repeat(501) },
  });
  assert.equal(longNotesPatch.status, 400);

  const badIdPatch = await requestJson('/api/assets/not-an-id/status', {
    method: 'PATCH',
    token: analystToken,
    body: { status: 'under_repair' },
  });
  assert.equal(badIdPatch.status, 400);

  const validPatch = await requestJson(`/api/assets/${created1.json.asset.id}/status`, {
    method: 'PATCH',
    token: analystToken,
    body: { status: 'under_repair', condition_grade: 'fair', notes: 'Scheduled sensor calibration' },
  });
  assert.equal(validPatch.status, 200);
  assert.equal(validPatch.json.asset.status, 'under_repair');
  assert.equal(validPatch.json.asset.condition_grade, 'fair');
});

test('GET /api/health requires no auth, returns expected contract, and returns 503 without leaking details when DB is configured but unreachable', async () => {
  // 1. Without DATABASE_URL (not_configured) -> 200, no auth required
  const res = await requestJson('/api/health', { auth: false });
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'ok');
  assert.equal(res.json.database, 'not_configured');
  assert.equal(res.json.data_source, 'fallback');
  assert.ok(!Number.isNaN(Date.parse(res.json.time)));
  assert.equal(Object.keys(res.json).sort().join(','), 'data_source,database,status,time');

  // 2. With DATABASE_URL configured but pool unavailable/query failing -> 503 and no leaked details
  const prevDbUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://secret-user:secret-pass@127.0.0.1:1/secret-db';
  try {
    const resUnavail = await requestJson('/api/health', { auth: false });
    assert.equal(resUnavail.status, 503);
    assert.equal(resUnavail.json.status, 'unavailable');
    assert.equal(resUnavail.json.database, 'unavailable');
    assert.equal(resUnavail.json.data_source, 'unavailable');
    assert.ok(!Number.isNaN(Date.parse(resUnavail.json.time)));
    const serialized = JSON.stringify(resUnavail.json);
    assert.ok(!/secret-user|secret-pass|secret-db|DATABASE_URL|error/i.test(serialized));
  } finally {
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
  }
});



