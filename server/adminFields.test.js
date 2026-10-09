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

test('ambulance vendor: required fields, phones and fares only for offered types', async () => {
  const { ambulanceVendor } = await import('./adminFields.js');
  const v = ambulanceVendor({ name: ' Test Ambulance ', phones: '01714-325325, 01993 800900', categories: ['icu', 'ac', 'bogus'],
    features: ['oxygen'], service_areas: ['mirpur-10', 'mirpur-10'], fares: { ac: { min: '2000', max: '3500' }, non_ac: { min: 1, max: 2 }, icu: { min: '', max: '' } } });
  assert.equal(v.name, 'Test Ambulance');
  assert.deepEqual(v.phones, ['01714325325', '01993800900']);
  assert.deepEqual(v.categories, ['ac', 'icu']);
  assert.deepEqual(v.service_areas, ['mirpur-10']);
  assert.deepEqual(v.fares, { ac: { min: 2000, max: 3500 } });
  assert.throws(() => ambulanceVendor({ name: 'X', phones: '', categories: ['ac'] }), /phone/);
  assert.throws(() => ambulanceVendor({ name: 'X', phones: '0171', categories: [] }), /ambulance type/);
  assert.throws(() => ambulanceVendor({ name: 'X', phones: 'call us', categories: ['ac'] }), /not a phone/);
  assert.throws(() => ambulanceVendor({ name: 'X', phones: '0171', categories: ['ac'], fares: { ac: { min: 5000, max: 100 } } }), /more than the highest/);
});

test('shared sample fares need every type; sample test prices need unique names and a price', async () => {
  const { fareRanges, sampleTestPrices } = await import('./adminFields.js');
  assert.throws(() => fareRanges({ ac: { min: 1, max: 2 } }, undefined, { all: true }), /NON-AC lowest fare/);
  assert.deepEqual(sampleTestPrices([{ name: 'ECG', category: 'cardiac', price: '300' }, { name: '' }]), [{ name: 'ECG', category: 'cardiac', price: 300 }]);
  assert.throws(() => sampleTestPrices([{ name: 'ECG', category: 'cardiac', price: 1 }, { name: 'ecg', category: 'cardiac', price: 2 }]), /twice/);
  assert.throws(() => sampleTestPrices([{ name: 'ECG', category: 'cardiac', price: '' }]), /whole number/);
});

test('specialty/symptom entries: tags tidied, image an upload path or web address', async () => {
  const { catalogEntry, slugify } = await import('./adminFields.js');
  const e = catalogEntry({ name: ' Cardiology ', icon: '❤️', tags: ['Heart', 'Heart', ' ECG ', ''], image: '/cura-media/catalog/specialty-1.jpg' }, { icon: true });
  assert.deepEqual([e.name, e.icon, e.tags, e.image], ['Cardiology', '❤️', ['Heart', 'ECG'], '/cura-media/catalog/specialty-1.jpg']);
  assert.equal(catalogEntry({ name: 'Fever', image: 'https://images.unsplash.com/photo-1' }).image, 'https://images.unsplash.com/photo-1');
  assert.throws(() => catalogEntry({ name: 'Fever', image: '//evil.example/x.jpg' }), /Image/);
  assert.throws(() => catalogEntry({ name: '' }), /Name/);
  assert.deepEqual(catalogEntry({ name: 'Fever', specialties: ['Medicine', 'Medicine', ''] }, { specialties: true }).specialties, ['Medicine']);
  assert.equal(slugify('ENT & Head Surgery'), 'ent-head-surgery');
});

test('site text edits: known languages, text keys, no empty text, FAQ as q/a pairs', async () => {
  const { siteTextPatch } = await import('./adminFields.js');
  assert.deepEqual(siteTextPatch({ en: { home_hero_title: 'Find a doctor', footer_demo: null } }), { en: { home_hero_title: 'Find a doctor', footer_demo: null } });
  assert.deepEqual(siteTextPatch({ bn: { faq_items: [{ q: ' প্রশ্ন ', a: 'উত্তর' }] } }).bn.faq_items, [{ q: 'প্রশ্ন', a: 'উত্তর' }]);
  assert.throws(() => siteTextPatch({ fr: {} }), /Unknown language/);
  assert.throws(() => siteTextPatch({ en: { 'bad key': 'x' } }), /not a text key/);
  assert.throws(() => siteTextPatch({ en: { home_hero_title: '  ' } }), /can't be empty/);
  assert.throws(() => siteTextPatch({ en: { faq_items: [{ q: 'Q?', a: '' }] } }), /FAQ answer 1/);
});

test('home content needs every division once and labelled shortcuts', async () => {
  const { homeContent, DIVISIONS } = await import('./adminFields.js');
  const divisions = DIVISIONS.map(name => ({ name, bn: name, photo: `/landing/division-${name.toLowerCase()}.jpg`, alt: '' }));
  const ok = homeContent({ popular_specialties: [{ slug: 'cardiology', en: 'Heart', bn: 'হৃদরোগ' }], common_problems: [], divisions });
  assert.equal(ok.divisions.length, 8);
  assert.equal(ok.divisions[0].alt, null);
  assert.throws(() => homeContent({ popular_specialties: [], common_problems: [], divisions: divisions.slice(1) }), /8 divisions/);
  assert.throws(() => homeContent({ popular_specialties: [{ slug: 'cardiology', en: 'Heart', bn: '' }], common_problems: [], divisions }), /Bangla label/);
});

test('contact numbers and photo credits', async () => {
  const { contactNumbers, photoCredits } = await import('./adminFields.js');
  assert.deepEqual(contactNumbers({ emergency: '999', health_line: '16263', hotline: '169 66' }), { emergency: '999', health_line: '16263', hotline: '16966' });
  assert.throws(() => contactNumbers({ emergency: '', health_line: '16263', hotline: '16966' }), /Emergency number/);
  const [c] = photoCredits([{ file: '/landing/a.jpg', caption: 'Lake', author: 'A', license: 'CC0', licenseUrl: '', source: 'https://commons.wikimedia.org/x' }]);
  assert.equal(c.licenseUrl, null);
  assert.equal(photoCredits([{ file: '/x.jpg', caption: 'Eye hospital', author: '', license: 'Public domain' }])[0].author, null);
  assert.throws(() => photoCredits([{ file: '', caption: 'x', author: 'y', license: 'CC0' }]), /photo is required/);
});
