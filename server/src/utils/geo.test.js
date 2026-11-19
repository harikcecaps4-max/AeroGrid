'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateHaversineKm } = require('./geo');

test('calculateHaversineKm returns 0 for identical coordinates', () => {
  assert.equal(calculateHaversineKm(13.0782, 77.6065, 13.0782, 77.6065), 0);
  assert.equal(calculateHaversineKm(0, 0, 0, 0), 0);
});

test('calculateHaversineKm computes accurate Great-Circle distances across Indian aerodromes', () => {
  // Jakkur (13.0782, 77.6065) to BLR Kempegowda (13.1979, 77.7063) ~ 17.1 km straight-line
  const jakkurToBlr = calculateHaversineKm(13.0782, 77.6065, 13.1979, 77.7063);
  assert.ok(jakkurToBlr >= 16.5 && jakkurToBlr <= 17.5, `Expected ~17.1 km, got ${jakkurToBlr}`);

  // Jakkur (13.0782, 77.6065) to Hosur (12.737, 77.825) ~ 44.8 km straight-line
  const jakkurToHosur = calculateHaversineKm(13.0782, 77.6065, 12.737, 77.825);
  assert.ok(jakkurToHosur >= 44 && jakkurToHosur <= 46, `Expected ~44.8 km, got ${jakkurToHosur}`);

  // Symmetry check: d(A, B) === d(B, A)
  assert.equal(
    calculateHaversineKm(19.0896, 72.8679, 28.5562, 77.1),
    calculateHaversineKm(28.5562, 77.1, 19.0896, 72.8679)
  );
});
