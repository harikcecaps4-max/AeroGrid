import test from 'node:test';
import assert from 'node:assert/strict';
import { VIABILITY_TIERS } from './constants.js';

test('VIABILITY_TIERS defines thresholds', () => {
  assert.equal(VIABILITY_TIERS.HIGH.minScore, 70);
  assert.equal(VIABILITY_TIERS.MODERATE.minScore, 40);
  assert.equal(VIABILITY_TIERS.LOW.minScore, 0);
});
