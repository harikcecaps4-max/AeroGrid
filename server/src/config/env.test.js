'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
const { validateProductionEnv, isRelaxedEnv } = require('./env');

const ENV_PATH = path.join(__dirname, 'env.js');
const VALID_SECRET = 'env-test-only-secret-that-is-at-least-32-chars';

/** Loads env.js in a clean child process so module-load (startup) behaviour is tested for real. */
function loadInChild(envVars) {
  const env = { PATH: process.env.PATH };
  Object.assign(env, envVars);
  return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(ENV_PATH)})`], {
    env,
    encoding: 'utf8',
  });
}

test('production without JWT_SECRET throws at startup', () => {
  const res = loadInChild({ NODE_ENV: 'production' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /JWT_SECRET is required/);
});

test('production with short JWT_SECRET throws; with valid secret starts', () => {
  assert.notEqual(loadInChild({ NODE_ENV: 'production', JWT_SECRET: 'short' }).status, 0);
  assert.equal(loadInChild({ NODE_ENV: 'production', JWT_SECRET: VALID_SECRET }).status, 0);
});

test('unset NODE_ENV without JWT_SECRET throws at startup', () => {
  const res = loadInChild({});
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /JWT_SECRET is required/);
  assert.match(res.stderr, /<unset>/);
});

test('unknown NODE_ENV values (staging, typos, empty) throw without a secret', () => {
  for (const value of ['staging', 'Production', 'prod', '']) {
    const res = loadInChild({ NODE_ENV: value });
    assert.notEqual(res.status, 0, `NODE_ENV='${value}' should throw`);
  }
});

test('NODE_ENV=test and NODE_ENV=development start without JWT_SECRET', () => {
  assert.equal(loadInChild({ NODE_ENV: 'test' }).status, 0);
  assert.equal(loadInChild({ NODE_ENV: 'development' }).status, 0);
});

test('validateProductionEnv and isRelaxedEnv unit behaviour; no hardcoded secret fallback', () => {
  assert.throws(() => validateProductionEnv({}), /JWT_SECRET is required/);
  assert.throws(() => validateProductionEnv({ NODE_ENV: 'production' }), /JWT_SECRET is required/);
  assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: 'test' }));
  assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: VALID_SECRET }));
  assert.equal(isRelaxedEnv({ NODE_ENV: 'test' }), true);
  assert.equal(isRelaxedEnv({ NODE_ENV: 'development' }), true);
  assert.equal(isRelaxedEnv({}), false);
  assert.equal(isRelaxedEnv({ NODE_ENV: 'production' }), false);

  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.equal(require('./env').jwt.secret, undefined);
  } finally {
    if (saved !== undefined) process.env.JWT_SECRET = saved;
  }
});
