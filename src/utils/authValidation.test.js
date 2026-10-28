import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBmdc, passwordProblemKey, safeRedirect, normalizeBdPhone } from './authValidation.js';

test('client validation matches the server rules', () => {
  assert.equal(normalizeBmdc('a 12345'), 'A-12345');
  assert.equal(normalizeBmdc('X-1'), null);
  assert.equal(passwordProblemKey('abc12345'), null);
  assert.equal(passwordProblemKey('abcdefgh'), 'auth_err_password_mix');
  assert.equal(normalizeBdPhone('+8801712345678'), '01712345678');
});

test('safeRedirect only allows same-site paths', () => {
  assert.equal(safeRedirect('/appointments', '/'), '/appointments');
  assert.equal(safeRedirect('//evil.example', '/'), '/');
  assert.equal(safeRedirect('https://evil.example', '/'), '/');
  assert.equal(safeRedirect(null, '/x'), '/x');
});
