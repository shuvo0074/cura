import test from 'node:test';
import assert from 'node:assert/strict';
import { placeholders, placeholderProblem } from './textPlaceholders.js';

test('finds placeholders once each', () => {
  assert.deepEqual(placeholders('Call {{number}} or {{ number }} for {{name}}'), ['name', 'number']);
  assert.deepEqual(placeholders('No placeholders'), []);
});

test('an edit must keep the placeholders and add none', () => {
  assert.equal(placeholderProblem('Call {{number}}', 'Ring {{number}} now'), null);
  assert.match(placeholderProblem('Call {{number}}', 'Call 999'), /Keep {{number}}/);
  assert.match(placeholderProblem('{{count}} doctors', '{{count}} doctors in {{city}}'), /{{city}} isn't filled in/);
});
