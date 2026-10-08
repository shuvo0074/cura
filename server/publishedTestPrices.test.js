import test from 'node:test';
import assert from 'node:assert/strict';
import { withPublishedTestPrices } from './publishedTestPrices.js';

const centre = { name: 'Popular Diagnostic Centre, Dhanmondi', type: 'diagnostic' };

test('published prices fill missing rates and retain provenance', () => {
  const original = { ...centre, tests: [{ name: 'Complete Blood Count (CBC)', category: 'blood', price: null }] };
  const result = withPublishedTestPrices(original);
  assert.equal(result.tests.length, 13);
  const cbc = result.tests.find(t => t.name === 'Complete Blood Count (CBC)');
  assert.equal(cbc.price, 400);
  assert.equal(cbc.source_test_name, 'CBC');
  assert.equal(cbc.source_url, 'https://old.populardiagnostic.com/our-price-list');
  assert.equal(cbc.source_checked_on, '2026-10-09');
  assert.equal(original.tests[0].price, null);
});

test('admin rates including zero are preserved without web-source attribution', () => {
  for (const price of [0, 450]) {
    const result = withPublishedTestPrices({ ...centre, tests: [{ name: 'Complete Blood Count (CBC)', category: 'blood', price }] });
    const cbc = result.tests.find(t => t.name === 'Complete Blood Count (CBC)');
    assert.equal(cbc.price, price);
    assert.equal(cbc.source_url, undefined);
  }
});

test('rates are scoped to the named diagnostic branch', () => {
  const other = { name: 'Popular Diagnostic Centre, Rangpur', type: 'diagnostic', tests: [] };
  const hospital = { ...centre, type: 'hospital', tests: [] };
  assert.equal(withPublishedTestPrices(other), other);
  assert.equal(withPublishedTestPrices(hospital), hospital);
});

test('test variants are explicit and repeated merging does not duplicate tests', () => {
  const first = withPublishedTestPrices({ ...centre, tests: [{ name: 'CT Scan Brain', category: 'imaging', price: null }] });
  assert.deepEqual(withPublishedTestPrices(first).tests, first.tests);
  assert.equal(first.tests.find(t => t.name === 'CT Scan Brain (spiral)').price, 5000);
  assert.equal(first.tests.find(t => t.name === 'Lipid Profile (Fasting)').price, 1400);
});

test('unpublished individual prices stay unknown', () => {
  const result = withPublishedTestPrices({ ...centre, tests: [{ name: 'Thyroid (TSH)', category: 'blood', price: null }] });
  assert.equal(result.tests.find(t => t.name === 'Thyroid (TSH)').price, null);
  assert.ok(result.tests.filter(t => t.source_url).every(t => Number.isFinite(t.price) && t.price > 0));
});
