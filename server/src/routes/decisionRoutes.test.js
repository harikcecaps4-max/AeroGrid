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
