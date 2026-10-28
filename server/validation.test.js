import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBmdc, passwordProblem, normalizeEmail, isValidEmail, normalizeBdPhone } from './validation.js';

test('normalizeBmdc accepts common spellings and rejects others', () => {
  assert.equal(normalizeBmdc('A-12345'), 'A-12345');
  assert.equal(normalizeBmdc(' a12345 '), 'A-12345');
  assert.equal(normalizeBmdc('d - 987'), 'D-987');
  assert.equal(normalizeBmdc('B-12345'), null);
  assert.equal(normalizeBmdc('A-1234567'), null);
  assert.equal(normalizeBmdc('12345'), null);
  assert.equal(normalizeBmdc(undefined), null);
});

test('passwordProblem enforces length, letter and digit', () => {
  assert.equal(passwordProblem('abc12345'), null);
  assert.match(passwordProblem('abc123'), /8 characters/);
  assert.match(passwordProblem('abcdefgh'), /letter and a number/);
  assert.match(passwordProblem('a1'.repeat(40)), /72 bytes/);
});

test('email and phone normalisation', () => {
  assert.equal(normalizeEmail('  Dr.Rahim@Example.COM '), 'dr.rahim@example.com');
  assert.ok(isValidEmail('a@b.co'));
  assert.ok(!isValidEmail('a@b'));
  assert.equal(normalizeBdPhone('+880 1712-345678'), '01712345678');
  assert.equal(normalizeBdPhone('01212345678'), null);
});
