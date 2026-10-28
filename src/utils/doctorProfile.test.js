import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitDegrees, degreeRows } from './doctorProfile.js';

test('splitDegrees keeps bracketed commas together', () => {
  assert.deepEqual(splitDegrees('MBBS, MS (ENT), FCPS (Otolaryngology)'), ['MBBS', 'MS (ENT)', 'FCPS (Otolaryngology)']);
  assert.deepEqual(splitDegrees('MBBS; MD (Medicine, Cardiology)'), ['MBBS', 'MD (Medicine, Cardiology)']);
  assert.deepEqual(splitDegrees(null), []);
});

test('degreeRows prefers entries, oldest first', () => {
  const items = [
    { id: 2, title: 'MD (Cardiology)', organization: 'BSMMU', end_year: 2015 },
    { id: 1, title: 'MBBS', organization: 'SSMC', end_year: 2008 },
  ];
  assert.deepEqual(degreeRows(items, 'ignored').map(r => r.title), ['MBBS', 'MD (Cardiology)']);
  assert.deepEqual(degreeRows([], 'MBBS, DDV').map(r => r.title), ['MBBS', 'DDV']);
});
