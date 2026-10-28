import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterAmbulances, AMBULANCE_CATEGORIES, AMBULANCE_FEATURES } from './ambulanceFilters.js';

const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const vendors = load('../../server/data/ambulanceVendors.json');
const areas = load('../data/dhakaAreas.json');

test('pickup coverage includes citywide vendors without inventing local coverage', () => {
  const result = filterAmbulances(vendors, { area: 'mirpur-10' }, areas);
  assert.equal(result[0].id, 'national-mirpur');
  assert.ok(!result.some(v => v.id === 'dhaka-ambulance'));
  assert.equal(result.at(-1).id, 'bd-ambulance');
  assert.equal(result.at(-1).areaDistance, null);
});

test('category and service requirements intersect', () => {
  const result = filterAmbulances(vendors, { category: 'non_ac', features: ['oxygen', '24_hours'] }, areas);
  assert.deepEqual(result.map(v => v.id), ['bd-ambulance']);
});

test('Bangla vendor search and phone search work', () => {
  assert.equal(filterAmbulances(vendors, { query: ' শিহাব ' }, areas)[0].id, 'shihab-ambulance');
  assert.equal(filterAmbulances(vendors, { query: '01791229290' }, areas)[0].id, 'national-mirpur');
  assert.equal(filterAmbulances(vendors, { query: 'unknown vendor' }, areas).length, 0);
});

test('nearest sorting uses area reference points and keeps missing bases last', () => {
  const result = filterAmbulances(vendors, { area: 'uttara-10' }, areas);
  assert.equal(result[0].id, 'shihab-ambulance');
  assert.equal(result[0].areaDistance, 0);
  assert.equal(result.at(-1).areaDistance, null);
});

test('directory entries have valid categories, areas, phones and source links', () => {
  assert.equal(new Set(areas.map(a => a.id)).size, areas.length);
  for (const v of vendors) {
    assert.ok(v.categories.every(c => AMBULANCE_CATEGORIES.includes(c)));
    assert.ok(v.features.every(f => AMBULANCE_FEATURES.includes(f)));
    assert.ok(!v.base_area || areas.some(a => a.id === v.base_area));
    assert.ok(v.service_areas.every(id => areas.some(a => a.id === id)));
    assert.ok(v.phones.length && v.phones.every(phone => /^01[3-9]\d{8}$/.test(phone)));
    assert.ok(v.source_url.startsWith('https://'));
  }
});
