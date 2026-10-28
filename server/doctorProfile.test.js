import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, isValidSlug, cleanProfilePatch, cleanItem, completeness, httpUrl } from './doctorProfile.js';

test('slugify makes a dr- prefixed link from a name', () => {
  assert.equal(slugify('Dr. Farhana Rahman'), 'dr-farhana-rahman');
  assert.equal(slugify('  Md.  Abul  Kalam  '), 'dr-md-abul-kalam');
  assert.equal(slugify('ফারহানা'), null);
  assert.ok(isValidSlug(slugify('A'.repeat(80))));
});

test('isValidSlug rejects bad links', () => {
  assert.ok(isValidSlug('dr-farhana'));
  assert.ok(!isValidSlug('-dr'));
  assert.ok(!isValidSlug('dr--x'));
  assert.ok(!isValidSlug('Dr-X'));
  assert.ok(!isValidSlug('ab'.repeat(40)));
});

test('cleanProfilePatch accepts fees in whole taka', () => {
  assert.deepEqual(cleanProfilePatch({ fees: '1200', followupFees: '' }).value, { fees: 1200, followup_fees: null });
  assert.ok(cleanProfilePatch({ fees: 12.5 }).error);
  assert.ok(cleanProfilePatch({ fees: -1 }).error);
  assert.ok(cleanProfilePatch({ followupFees: 200000 }).error);
});

test('cleanProfilePatch keeps only given fields and validates them', () => {
  assert.deepEqual(cleanProfilePatch({ headline: '  Consultant  Gynaecologist ' }).value, { headline: 'Consultant Gynaecologist' });
  assert.deepEqual(cleanProfilePatch({ clinicalExpertise: ['IVF', 'ivf', ' Laparoscopy '] }).value,
    { clinical_expertise: ['IVF', 'Laparoscopy'] });
  assert.match(cleanProfilePatch({ headline: 'x'.repeat(121) }).error, /120/);
  assert.match(cleanProfilePatch({ website: 'javascript:alert(1)' }).error, /https/);
  assert.match(cleanProfilePatch({ practicingSince: 1800 }).error, /year/);
  assert.equal(cleanProfilePatch({ about: 'a\n\n\n\nb' }).value.about, 'a\n\nb');
});

test('cleanItem validates entries by kind', () => {
  const pos = cleanItem({ kind: 'position', title: 'Consultant', organization: 'DMCH', startYear: '2015', isCurrent: true, endYear: 2020 });
  assert.equal(pos.value.end_year, null);
  assert.equal(pos.value.is_current, true);
  assert.match(cleanItem({ kind: 'position', title: 'X' }).error, /started/);
  assert.match(cleanItem({ kind: 'award', title: 'X', startYear: 2020, endYear: 2010 }).error, /after/);
  assert.match(cleanItem({ kind: 'hobby', title: 'X' }).error, /Unknown/);
  assert.equal(cleanItem({ kind: 'qualification', title: 'FCPS', isCurrent: true }).value.is_current, false);
});

test('httpUrl only allows http(s)', () => {
  assert.equal(httpUrl('https://pubmed.ncbi.nlm.nih.gov/1'), 'https://pubmed.ncbi.nlm.nih.gov/1');
  assert.equal(httpUrl('data:text/html,x'), undefined);
});

test('completeness reports what is missing', () => {
  assert.deepEqual(completeness({}, []).percent, 0);
  const full = completeness({ photo: 'x', headline: 'h', about: 'a'.repeat(150), clinical_expertise: ['a', 'b', 'c'], practicing_since: 2010, languages: 'Bangla' },
    [{ kind: 'position' }, { kind: 'qualification' }]);
  assert.deepEqual(full, { percent: 100, missing: [] });
});
