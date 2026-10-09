import test from 'node:test';
import assert from 'node:assert/strict';
import { withFares } from './ambulanceFares.js';

const sample = { ac: { min: 2000, max: 3500 }, icu: { min: 8000, max: 12000 }, freezer: { min: 3000, max: 5000 } };

test('a vendor quote wins over the sample range, which is marked', () => {
  const v = withFares({ id: 7, slug: 'test-ambulance', hidden: false, categories: ['ac', 'icu'], fares: { icu: { min: 9000, max: 11000 } } }, sample);
  assert.equal(v.id, 'test-ambulance');
  assert.equal(v.hidden, undefined);
  assert.deepEqual(v.fares, { ac: { min: 2000, max: 3500, kind: 'sample' }, icu: { min: 9000, max: 11000, kind: 'quoted' } });
});

test('only offered types get a fare', () => {
  assert.deepEqual(Object.keys(withFares({ slug: 'x', categories: ['freezer'], fares: { ac: { min: 1, max: 2 } } }, sample).fares), ['freezer']);
});
