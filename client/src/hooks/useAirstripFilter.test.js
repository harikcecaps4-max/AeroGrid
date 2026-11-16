import test from 'node:test';
import assert from 'node:assert/strict';
import { useAirstripFilter } from './useAirstripFilter.js';

test('useAirstripFilter filters by name', () => {
  const items = [{ properties: { name: 'Jakkur', state: 'Karnataka' } }, { properties: { name: 'Hosur', state: 'Tamil Nadu' } }];
  const res = useAirstripFilter(items, 'jakkur');
  assert.equal(res.length, 1);
  assert.equal(res[0].properties.name, 'Jakkur');
});
