#!/usr/bin/env node
'use strict';

/**
 * Live-DB smoke test for AeroGrid.
 * Runs with ALLOW_FALLBACK=false against the database configured in .env,
 * registers a viewer, logs in, and calls /api/aircraft, /api/airstrips,
 * and /api/evaluate. Prints ONLY status codes, data_source, and row counts.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve(__dirname, '../.env'));
process.env.ALLOW_FALLBACK = 'false';

const app = require('../server/index');
const { pool } = require('../server/src/db');

async function requestJson(baseUrl, method, urlPath, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  let ok = true;
  try {
    const email = `smoke.${Date.now()}.${crypto.randomBytes(3).toString('hex')}@aerogrid.test`;
    const password = `Smk!${crypto.randomBytes(12).toString('hex')}`;

    const reg = await requestJson(baseUrl, 'POST', '/api/auth/register', {
      body: { email, password },
    });
    console.log(`POST /api/auth/register  status=${reg.status} data_source=${reg.data?.data_source ?? 'n/a'} rows=${reg.data?.user ? 1 : 0}`);
    if (reg.status !== 201) ok = false;

    const login = await requestJson(baseUrl, 'POST', '/api/auth/login', {
      body: { email, password },
    });
    const token = login.data?.token || null;
    console.log(`POST /api/auth/login     status=${login.status} data_source=${login.data?.data_source ?? 'n/a'} rows=${login.data?.user ? 1 : 0}`);
    if (login.status !== 200 || !token) ok = false;

    const ac = await requestJson(baseUrl, 'GET', '/api/aircraft', { token });
    const acCount = Array.isArray(ac.data?.aircraft) ? ac.data.aircraft.length : 0;
    console.log(`GET  /api/aircraft       status=${ac.status} data_source=${ac.data?.data_source ?? 'n/a'} rows=${acCount}`);
    if (ac.status !== 200 || ac.data?.data_source !== 'database' || acCount === 0) ok = false;

    const strips = await requestJson(baseUrl, 'GET', '/api/airstrips', { token });
    const stripCount = Array.isArray(strips.data?.features) ? strips.data.features.length : 0;
    console.log(`GET  /api/airstrips      status=${strips.status} data_source=${strips.data?.data_source ?? 'n/a'} rows=${stripCount}`);
    if (strips.status !== 200 || strips.data?.data_source !== 'database' || stripCount === 0) ok = false;

    const aircraftId = ac.data?.aircraft?.[0]?.id;
    const airstripId = strips.data?.features?.[0]?.properties?.id;
    if (aircraftId && airstripId) {
      const ev = await requestJson(baseUrl, 'POST', '/api/evaluate', {
        token,
        body: { aircraftId, airstripId },
      });
      console.log(`POST /api/evaluate       status=${ev.status} data_source=${ev.data?.data_source ?? 'n/a'} rows=${ev.data?.verdict ? 1 : 0}`);
      if (ev.status !== 200 || ev.data?.data_source !== 'database') ok = false;
    } else {
      console.log('POST /api/evaluate       status=skipped data_source=n/a rows=0');
      ok = false;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
  }

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message.replace(/postgres(ql)?:\/\/\S+/g, '[redacted]'));
  process.exit(1);
});
