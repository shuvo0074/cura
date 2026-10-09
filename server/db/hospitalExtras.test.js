import test from 'node:test';
import assert from 'node:assert/strict';
import { adminHospitalExtras } from './hospitalExtras.js';

test('lists sent as null are left unchanged, not rejected', () => {
  // Diagnostic centres seeded without facilities or payment methods load
  // with these as null; saving the form must still work.
  const out = adminHospitalExtras({ services: [], tests: [], facilities: null, payment_methods: null });
  assert.deepEqual(Object.keys(out).sort(), ['services', 'tests']);
});

test('a list that is not a list is still rejected', () => {
  assert.throws(() => adminHospitalExtras({ facilities: 'parking' }), /facilities must be a list/);
});
