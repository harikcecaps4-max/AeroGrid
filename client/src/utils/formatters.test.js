import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMeters, formatScore } from './formatters.js';

test('formatMeters formats numbers with unit', () => {
  assert.equal(formatMeters(1200), '1,200 m');
  assert.equal(formatMeters(null), '—');
});

test('formatScore formats 100-pt scale', () => {
  assert.equal(formatScore(84.6), '85/100');
  assert.equal(formatScore(null), '—');
});
