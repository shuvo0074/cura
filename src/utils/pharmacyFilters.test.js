import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPharmacies, telHref } from './pharmacyFilters.js';

const pharmacies = [
  { id: 'a', name: 'Lazz Pharma', address: 'Kalabagan', city: 'Dhaka', home_delivery: true },
  { id: 'b', name: 'Tamanna Pharmacy', address: 'Mirpur 10', city: 'Dhaka', home_delivery: false },
  { id: 'c', name: 'Popular Drugs', address: null, city: 'Chattogram', home_delivery: true },
];

test('search matches the name or the area, ignoring case and spaces', () => {
  assert.deepEqual(filterPharmacies(pharmacies, { query: ' lazz ' }).map(p => p.id), ['a']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'mirpur  10' }).map(p => p.id), ['b']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'chattogram' }).map(p => p.id), ['c']);
  assert.equal(filterPharmacies(pharmacies, { query: 'nowhere' }).length, 0);
});

test('home delivery keeps only pharmacies that deliver', () => {
  assert.deepEqual(filterPharmacies(pharmacies, { delivery: true }).map(p => p.id), ['a', 'c']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'dhaka', delivery: true }).map(p => p.id), ['a']);
});

test('phone links dial Bangladesh numbers', () => {
  assert.equal(telHref('01711-112222'), 'tel:+8801711112222');
  assert.equal(telHref('+8801711112222'), 'tel:+8801711112222');
  assert.equal(telHref('8801711112222'), 'tel:+8801711112222');
  assert.equal(telHref('10600'), 'tel:10600');
});
