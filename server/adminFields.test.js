import test from 'node:test';
import assert from 'node:assert/strict';
import { rating, latitude, longitude, sourceUrl, checkedOn } from './adminFields.js';

test('rating accepts 0–5 rounded to one decimal, blank as null', () => {
  assert.equal(rating('4.83'), 4.8);
  assert.equal(rating(0), 0);
  assert.equal(rating(5), 5);
  assert.equal(rating(''), null);
  assert.equal(rating(null), null);
});

test('rating rejects values outside 0–5 or not numbers', () => {
  assert.throws(() => rating('5.1'), /0 to 5/);
  assert.throws(() => rating(-1), /0 to 5/);
  assert.throws(() => rating('great'), /0 to 5/);
});

test('coordinates must be on the globe', () => {
  assert.equal(latitude('23.7465'), 23.7465);
  assert.equal(longitude('90.3760'), 90.376);
  assert.equal(latitude(''), null);
  assert.throws(() => latitude(91), /Latitude/);
  assert.throws(() => longitude(-181), /Longitude/);
});

test('source link must be an http(s) address', () => {
  assert.equal(sourceUrl(' https://example.com/doctors '), 'https://example.com/doctors');
  assert.equal(sourceUrl(''), null);
  assert.throws(() => sourceUrl('example.com'), /full web address/);
  assert.throws(() => sourceUrl('javascript:alert(1)'), /http/);
});

test('checked-on date must be a real YYYY-MM-DD date', () => {
  assert.equal(checkedOn('2026-10-09'), '2026-10-09');
  assert.equal(checkedOn(''), null);
  assert.throws(() => checkedOn('2026-02-30'), /real date/);
  assert.throws(() => checkedOn('09/10/2026'), /real date/);
});
