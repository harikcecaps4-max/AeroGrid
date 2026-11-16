import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBoundingBox } from './geoBounds.js';

test('calculateBoundingBox computes min/max coordinates', () => {
  const bbox = calculateBoundingBox([[77.5, 12.9], [78.0, 13.5]]);
  assert.deepEqual(bbox, { minLng: 77.5, minLat: 12.9, maxLng: 78.0, maxLat: 13.5 });
});
