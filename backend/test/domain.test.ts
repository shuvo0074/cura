import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBmdc, toNationalPhone, withDoctorPrefix } from '../src/modules/directory/domain/account-rules';
import {
  ambulanceVendor,
  catalogEntry,
  checkedOn,
  contactNumbers,
  fareRanges,
  homeContent,
  imageRef,
  latitude,
  rating,
  sampleTestPrices,
  siteTextPatch,
  sourceUrl,
} from '../src/modules/directory/domain/content-rules';
import {
  cleanItem,
  cleanProfilePatch,
  completeness,
  httpUrl,
  isValidSlug,
  slugify,
} from '../src/modules/directory/domain/doctor-profile.rules';
import { present, presentListing } from '../src/modules/directory/domain/presenter';
import { withFares, withSampleTestPrices } from '../src/modules/directory/domain/pricing';
import {
  bookingBlocker,
  dhakaNow,
  estimatedArrival,
  parseSessionTime,
} from '../src/modules/directory/domain/schedule';

test('BMDC numbers normalise and bad ones are refused', () => {
  assert.equal(normalizeBmdc('a12345'), 'A-12345');
  assert.equal(normalizeBmdc(' D - 1234 '), 'D-1234');
  assert.equal(normalizeBmdc('X-1'), null);
  assert.equal(normalizeBmdc('A-1234567'), null);
  assert.equal(normalizeBmdc(42), null);
});

test('phones show in national form and names get a Dr. prefix once', () => {
  assert.equal(toNationalPhone('+8801712345678'), '01712345678');
  assert.equal(toNationalPhone(null), null);
  assert.equal(withDoctorPrefix('Dr. A Khan'), 'Dr. A Khan');
  assert.equal(withDoctorPrefix('A Khan'), 'Dr. A Khan');
});

test('slugify makes a dr- link from a name', () => {
  assert.equal(slugify('Dr. Farhana Rahman'), 'dr-farhana-rahman');
  assert.equal(slugify('  Md.  Abul  Kalam  '), 'dr-md-abul-kalam');
  assert.equal(slugify('ফারহানা'), null);
  assert.ok(isValidSlug(slugify('A'.repeat(80))));
});

test('isValidSlug rejects bad links', () => {
  assert.ok(isValidSlug('dr-farhana'));
  for (const bad of ['-dr', 'dr--x', 'Dr-X', 'ab'.repeat(40)]) assert.ok(!isValidSlug(bad), bad);
});

test('the profile patch keeps only sent keys and checks fees', () => {
  assert.deepEqual(cleanProfilePatch({ fees: '1200', followupFees: '' }, 2026), { fees: 1200, followupFees: null });
  assert.throws(() => cleanProfilePatch({ fees: 12.5 }, 2026));
  assert.throws(() => cleanProfilePatch({ fees: -1 }, 2026));
  assert.throws(() => cleanProfilePatch({ followupFees: 200000 }, 2026));
  assert.throws(() => cleanProfilePatch({ practicingSince: 1900 }, 2026));
  assert.deepEqual(cleanProfilePatch({}, 2026), {});
  assert.deepEqual(cleanProfilePatch({ name: 'x', specialty: 'y', bmdcNo: 'z' }, 2026), {});
});

test('career entries follow their rules', () => {
  const position = cleanItem({ kind: 'position', title: 'Consultant', startYear: 2010, isCurrent: true, endYear: 2020 }, 2026);
  assert.equal(position.endYear, null);
  assert.equal(position.isCurrent, true);
  assert.equal(cleanItem({ kind: 'award', title: 'Prize', isCurrent: true }, 2026).isCurrent, false);
  assert.throws(() => cleanItem({ kind: 'position', title: 'No year' }, 2026));
  assert.throws(() => cleanItem({ kind: 'nope', title: 'x' }, 2026));
  assert.throws(() => cleanItem({ kind: 'award', title: 'x', startYear: 2020, endYear: 2010 }, 2026));
  assert.equal(httpUrl('javascript:alert(1)'), undefined);
});

test('completeness counts eight equal checks in order', () => {
  assert.deepEqual(completeness({}, []).missing, [
    'photo', 'headline', 'about', 'expertise', 'practicing_since', 'position', 'qualification', 'languages',
  ]);
  const full = completeness(
    { photo: 'x', headline: 'x', about: 'x'.repeat(150), clinicalExpertise: ['a', 'b', 'c'], practicingSince: 2000, languages: 'en' },
    [{ kind: 'position' }, { kind: 'qualification' }],
  );
  assert.equal(full.percent, 100);
});

test('session times parse and serials estimate arrival', () => {
  assert.deepEqual(parseSessionTime('08:00 AM - 11:00 AM'), { start: 480, end: 660 });
  assert.deepEqual(parseSessionTime('12:30 PM - 02:00 PM'), { start: 750, end: 840 });
  assert.equal(parseSessionTime('morning'), null);
  assert.equal(estimatedArrival(480, 5), '08:40 AM');
});

test('booking blockers use Dhaka time', () => {
  const session = { start: 480, end: 660 };
  const now = { date: '2026-11-04', minutes: 700 };
  assert.equal(bookingBlocker('2026-11-06', session, now)?.code, 'CLOSED_FRIDAY');
  assert.equal(bookingBlocker('2026-11-03', session, now)?.code, 'DATE_PASSED');
  assert.equal(bookingBlocker('2027-01-05', session, now)?.code, 'TOO_FAR_AHEAD');
  assert.equal(bookingBlocker('2026-11-04', session, now)?.code, 'SESSION_ENDED');
  assert.equal(bookingBlocker('2026-11-05', session, now), null);
  // 20:00 UTC is already 02:00 the next day in Dhaka.
  assert.deepEqual(dhakaNow(new Date('2026-11-04T20:00:00Z')), { date: '2026-11-05', minutes: 120 });
});

test('vendor quotes beat sample fares, which are marked', () => {
  const sample = { ac: { min: 2000, max: 3500 }, icu: { min: 8000, max: 12000 } };
  const vendor = withFares({ id: 7, slug: 'test', hidden: false, categories: ['ac', 'icu'], fares: { icu: { min: 9000, max: 11000 } } }, sample);
  assert.equal(vendor.id, 'test');
  assert.equal('hidden' in vendor, false);
  assert.deepEqual(vendor.fares, { ac: { min: 2000, max: 3500, kind: 'sample' }, icu: { min: 9000, max: 11000, kind: 'quoted' } });
});

test('sample test prices are labelled and never replace real ones', () => {
  const sample = [{ name: 'CBC', category: 'blood', price: 400 }];
  const centre = { type: 'diagnostic', tests: [{ name: 'CBC', price: null, source_url: 'https://x' }, { name: 'MRI', price: 900 }] };
  const tests = withSampleTestPrices(centre, sample).tests as any[];
  assert.deepEqual(tests[0], { name: 'CBC', price: 400, price_kind: 'demo' });
  assert.deepEqual(tests[1], { name: 'MRI', price: 900 });
  assert.equal((withSampleTestPrices({ type: 'diagnostic', tests: [] }, sample).tests as any[])[0].price_kind, 'demo');
  assert.deepEqual(withSampleTestPrices(centre, null), centre);
  assert.deepEqual(withSampleTestPrices({ type: 'hospital', tests: null }, sample).tests, null);
});

test('admin field checks', () => {
  assert.equal(rating('4.83'), 4.8);
  assert.throws(() => rating(6));
  assert.throws(() => latitude(91));
  assert.equal(sourceUrl(''), null);
  assert.throws(() => sourceUrl('ftp://x'));
  assert.throws(() => checkedOn('2026-02-30'));
  assert.equal(checkedOn('2026-02-28')?.toISOString().slice(0, 10), '2026-02-28');
  assert.equal(imageRef('/a.png'), '/a.png');
  assert.throws(() => imageRef('//evil.example/a.png'));
});

test('ambulance vendors and fares validate', () => {
  const vendor = ambulanceVendor({ name: 'A', phones: '0171 000-000, 999', categories: ['ac', 'bogus'] });
  assert.deepEqual(vendor.phones, ['0171000000', '999']);
  assert.deepEqual(vendor.categories, ['ac']);
  assert.throws(() => ambulanceVendor({ name: 'A', phones: [], categories: ['ac'] }));
  assert.throws(() => ambulanceVendor({ name: 'A', phones: ['1234'], categories: [] }));
  assert.throws(() => fareRanges({ ac: { min: 5, max: 1 } }));
  assert.throws(() => fareRanges({}, undefined, true));
  assert.throws(() => sampleTestPrices([{ name: 'X', category: 'blood', price: 1 }, { name: 'x', category: 'blood', price: 2 }]));
});

test('catalogue, site text, home content and contacts validate', () => {
  assert.equal(catalogEntry({ name: 'ENT', tags: ['a', 'a', 'b'] }, {}).tags.length, 2);
  assert.throws(() => catalogEntry({}, {}));
  assert.deepEqual(siteTextPatch({ en: { a_b: 'hi', c: null } }), { en: { a_b: 'hi', c: null } });
  assert.throws(() => siteTextPatch({ fr: {} }));
  assert.throws(() => siteTextPatch({ en: { 'Bad-Key': 'x' } }));
  assert.throws(() => siteTextPatch({ en: { a: '  ' } }));
  assert.throws(() => homeContent({ divisions: [], popular_specialties: [], common_problems: [] }));
  assert.equal(contactNumbers({ emergency: '999', health_line: '16263', hotline: '16 966' }).hotline, '16966');
  assert.throws(() => contactNumbers({ emergency: 'x', health_line: '1', hotline: '1' }));
});

test('the presenter gives snake_case, date strings and lower-case enums', () => {
  const day = new Date('2026-10-09T00:00:00Z');
  assert.deepEqual(present({ verifiedOn: day, sourceUrl: 'x', status: 'PENDING', weeklySchedule: [{ venueName: 'a' }] }), {
    verified_on: '2026-10-09',
    source_url: 'x',
    status: 'pending',
    weekly_schedule: [{ venueName: 'a' }],
  });
});

test('a listing never exposes its owner and builds the degree line', () => {
  const out = presentListing({
    id: '1',
    userId: 'secret-user',
    user: { mobileVerifiedAt: new Date() },
    education: 'Old text',
    hospital: { name: 'H' },
    items: [
      { title: 'FCPS', endYear: 2010, createdAt: new Date(1) },
      { title: 'MBBS', endYear: 2000, createdAt: new Date(2) },
      { title: 'Course', endYear: null, createdAt: new Date(3) },
    ],
  });
  assert.equal(JSON.stringify(out).includes('secret-user'), false);
  assert.equal(out.is_managed, true);
  assert.equal(out.hospital_name, 'H');
  assert.equal(out.degrees, 'MBBS, FCPS, Course');
  assert.equal(presentListing({ education: 'MBBS', items: [] }).degrees, 'MBBS');
});

test('a prescription row with empty optional fields is valid', async () => {
  const { prescriptionSchema } = await import('@cura/shared');
  const parsed = prescriptionSchema.safeParse({
    items: [{ drugName: 'Typed by hand', strength: null, form: null, durationDays: null, morning: 1, noon: 0, night: 1, mealRelation: 'AFTER', instruction: null }],
  });
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});
