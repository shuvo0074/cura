import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, matchesDoctorFilters } from './doctorFilters.js';
const female = { gender: 'female', city: 'Dhaka', division: 'Dhaka', specialty: 'Medicine' };
test('gender selections exclude unspecified records and include either selected gender', () => {
  const filter = { ...EMPTY_FILTERS, gender: ['female'] };
  assert.equal(matchesDoctorFilters(female, filter), true);
  assert.equal(matchesDoctorFilters({ ...female, gender: 'male' }, filter), false);
  assert.equal(matchesDoctorFilters({ ...female, gender: null }, filter), false);
  assert.equal(matchesDoctorFilters({ ...female, gender: null }, EMPTY_FILTERS), true);
  assert.equal(matchesDoctorFilters(female, { ...filter, gender: ['female', 'male'] }), true);
});
test('gender intersects location and specialty, and old filter shapes remain supported', () => {
  assert.equal(matchesDoctorFilters(female, { ...EMPTY_FILTERS, gender: ['female'], city: ['Khulna'] }), false);
  assert.equal(matchesDoctorFilters(female, { ...EMPTY_FILTERS, gender: ['female'], specialty: ['Medicine'], city: ['Dhaka'] }), true);
  const { gender, ...legacy } = EMPTY_FILTERS;
  assert.equal(matchesDoctorFilters(female, legacy), true);
});
