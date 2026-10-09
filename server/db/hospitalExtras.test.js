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

test('a test price keeps its source link and checked-on date', () => {
  const out = adminHospitalExtras({ tests: [
    { name: 'CBC', category: 'blood', price: 400, source_url: 'https://example.com/prices', source_checked_on: '2026-10-09', source_test_name: 'CBC' },
    { name: 'ECG', category: 'cardiac', price: 300, source_url: '' },
  ] });
  const [cbc, ecg] = JSON.parse(out.tests);
  assert.deepEqual(cbc, { name: 'CBC', category: 'blood', price: 400, source_url: 'https://example.com/prices', source_checked_on: '2026-10-09', source_test_name: 'CBC' });
  assert.deepEqual(ecg, { name: 'ECG', category: 'cardiac', price: 300 });
  assert.throws(() => adminHospitalExtras({ tests: [{ name: 'X', category: 'blood', source_url: 'not a link' }] }), /Source link/);
});
