import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  PASSWORD,
  PNG,
  TestApi,
  dateAhead,
  db,
  directoryAdmin,
  imageForm,
  nextBmdc,
  nextEmail,
  nextPhone,
  registerDoctor,
  registerPatient,
  verifiedDoctor,
} from './harness';

let api: TestApi;
let admin: Awaited<ReturnType<typeof directoryAdmin>>;
const SESSION = '08:00 AM - 11:00 AM';
const VENUE = 'Test Chamber';
const SCHEDULE = [{ venue: VENUE, time: SESSION }];
const FORBIDDEN_KEYS = ['password', 'passwordHash', 'password_hash', 'nid', 'tokenVersion', 'user_id', 'userId'];

function assertNoSecrets(value: unknown): void {
  const text = JSON.stringify(value);
  for (const key of FORBIDDEN_KEYS) assert.equal(text.includes(`"${key}"`), false, `leaked ${key}`);
}

const newDoctor = (fields: Record<string, unknown> = {}) =>
  api.post('/directory/admin/doctors', { name: 'Dr. Listed', specialty: 'Cardiology', weeklySchedule: SCHEDULE, ...fields }, admin.token);

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctor_listings, hospitals, ambulance_vendors, specialties, symptoms, site_settings, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  admin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

// ---------------------------------------------------------------- accounts

test('a patient registers, logs in and logs out, and the old token then returns 401', async () => {
  const patient = await registerPatient(api);
  assert.deepEqual(patient.roles, ['patient']);
  assert.equal(patient.role, 'patient');
  assert.ok(patient.patientId);
  assert.equal(patient.doctorId, null);
  assert.match(patient.phone, /^01\d{9}$/);
  assertNoSecrets({ ...patient, token: undefined, accessToken: undefined, cookie: undefined });

  const login = await api.post('/auth/login', { identifier: patient.email, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.status, 'authenticated');
  const token = login.body.session.accessToken;
  assert.equal((await api.get('/auth/me', token)).body.id, patient.id);

  const logout = await api.call('POST', '/auth/logout', { cookie: login.cookie });
  assert.equal(logout.status, 204);
  assert.equal((await api.get('/auth/me', token)).status, 401);
  // A second device stays signed in.
  assert.equal((await api.get('/auth/me', patient.token)).status, 200);
});

test('disabling a user takes effect on the next request and refresh is refused', async () => {
  const patient = await registerPatient(api);
  assert.equal((await api.get('/auth/me', patient.token)).status, 200);
  await db.user.update({ where: { id: patient.id }, data: { isActive: false } });
  assert.equal((await api.get('/auth/me', patient.token)).status, 401);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: patient.cookie })).status, 401);
});

test('logout-all ends every session at once', async () => {
  const patient = await registerPatient(api);
  const second = await api.post('/auth/login', { identifier: patient.email, password: PASSWORD });
  const res = await api.post('/auth/logout-all', {}, patient.token);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal((await api.get('/auth/me', patient.token)).status, 401);
  assert.equal((await api.get('/auth/me', second.body.session.accessToken)).status, 401);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: second.cookie })).status, 401);
});

test('changing a password ends access tokens and old refresh cookies', async () => {
  const patient = await registerPatient(api);
  const changed = await api.post('/account/password', { currentPassword: PASSWORD, newPassword: 'An0therStrongOne' }, patient.token);
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await api.get('/auth/me', patient.token)).status, 401);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: patient.cookie })).status, 401);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: 'An0therStrongOne' })).status, 200);
});

test('refresh rotates, and replaying an old cookie ends the session', async () => {
  const patient = await registerPatient(api);
  const rotated = await api.call('POST', '/auth/refresh', { cookie: patient.cookie });
  assert.equal(rotated.status, 200);
  assert.ok(rotated.body.accessToken);
  assert.equal((await api.get('/auth/me', rotated.body.accessToken)).status, 200);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: patient.cookie })).status, 401);
  assert.equal((await api.get('/auth/me', rotated.body.accessToken)).status, 401);
});

test('the sixth failed login is 429 and a success resets the count', async () => {
  const patient = await registerPatient(api);
  for (let i = 0; i < 4; i += 1) {
    assert.equal((await api.post('/auth/login', { identifier: patient.email, password: 'wrong' })).status, 401);
  }
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: PASSWORD })).status, 200);
  for (let i = 0; i < 5; i += 1) {
    const failed = await api.post('/auth/login', { identifier: patient.email, password: 'wrong' });
    assert.equal(failed.status, 401);
    assert.equal(failed.body.code, 'INVALID_CREDENTIALS');
  }
  const locked = await api.post('/auth/login', { identifier: patient.email, password: 'wrong' });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.code, 'RATE_LIMITED');
});

test('sign-up validation and conflicts use the frontend codes', async () => {
  const email = nextEmail();
  const phone = nextPhone();
  const base = { name: 'Some One', email, password: PASSWORD, phone };
  assert.equal((await api.post('/auth/register/patient', base)).status, 201);

  const dupEmail = await api.post('/auth/register/patient', { ...base, phone: nextPhone() });
  assert.equal(dupEmail.status, 409);
  assert.equal(dupEmail.body.code, 'EMAIL_TAKEN');
  assert.ok(dupEmail.body.error);

  const dupPhone = await api.post('/auth/register/patient', { ...base, email: nextEmail() });
  assert.equal(dupPhone.body.code, 'PHONE_TAKEN');

  const weak = await api.post('/auth/register/patient', { ...base, email: nextEmail(), phone: nextPhone(), password: 'short' });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.code, 'VALIDATION');

  const badPhone = await api.post('/auth/register/patient', { ...base, email: nextEmail(), phone: '123' });
  assert.equal(badPhone.body.code, 'VALIDATION');
});

test('simultaneous sign-ups with one email give one account and a clean 409', async () => {
  const email = nextEmail();
  const results = await Promise.all(
    [1, 2, 3].map(() => api.post('/auth/register/patient', { name: 'Race Me', email, password: PASSWORD })),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  for (const failed of results.filter((r) => r.status !== 201)) {
    assert.equal(failed.status, 409);
    assert.equal(failed.body.code, 'EMAIL_TAKEN');
  }
});

test('a public account has no clinic access', async () => {
  const patient = await registerPatient(api);
  for (const path of ['/patients', '/settings/staff', '/billing/invoices', '/appointments/doctors']) {
    assert.equal((await api.get(path, patient.token)).status, 403, path);
  }
});

// ---------------------------------------------------------------- admin boundary

test('a clinic administrator gets 403 on every directory admin route', async () => {
  const { CryptoService } = await import('../src/common/crypto/crypto.service');
  const crypto = api.app.get(CryptoService);
  const email = nextEmail();
  await db.user.create({
    data: {
      fullName: 'Clinic Owner',
      email,
      mobile: `+88${nextPhone()}`,
      passwordHash: await crypto.hashPassword(PASSWORD),
      role: 'ADMINISTRATOR',
      mobileVerifiedAt: new Date(),
    },
  });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.session.accessToken;
  const id = '00000000-0000-4000-8000-000000000000';
  const calls: [string, string][] = [
    ['GET', '/directory/admin/verifications'],
    ['POST', `/directory/admin/verifications/${id}/approve`],
    ['POST', `/directory/admin/verifications/${id}/reject`],
    ['GET', '/directory/admin/doctors'],
    ['POST', '/directory/admin/doctors'],
    ['PATCH', `/directory/admin/doctors/${id}`],
    ['DELETE', `/directory/admin/doctors/${id}`],
    ['GET', '/directory/admin/hospitals'],
    ['POST', '/directory/admin/hospitals'],
    ['GET', '/directory/admin/ambulances'],
    ['GET', '/directory/admin/specialties'],
    ['GET', '/directory/admin/symptoms'],
    ['GET', '/directory/admin/sample-prices'],
    ['GET', '/directory/admin/site-content'],
    ['PATCH', '/directory/admin/site-text'],
    ['PUT', '/directory/admin/contacts'],
    ['GET', '/directory/admin/appointments'],
  ];
  for (const [method, path] of calls) {
    const res = await api.call(method, path, { token, ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }) });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
});

test('anonymous and patient callers are refused on admin routes', async () => {
  const patient = await registerPatient(api);
  assert.equal((await api.get('/directory/admin/doctors')).status, 401);
  assert.equal((await api.get('/directory/admin/doctors', patient.token)).status, 403);
});

// ---------------------------------------------------------------- verification

test('a new BMDC sign-up creates no public listing until approval', async () => {
  const before = (await api.get('/directory/doctors')).body.length;
  const doctor = await registerDoctor(api, { name: 'Brand New' });
  assert.deepEqual(doctor.roles, ['doctor']);
  assert.equal(doctor.doctorId, null);
  assert.equal(doctor.verification.status, 'pending');
  assert.equal(doctor.verification.kind, 'new');
  assert.equal((await api.get('/directory/doctors')).body.length, before);

  const pending = (await api.get('/directory/admin/verifications', admin.token)).body;
  const request = pending.find((r: any) => r.user_id === doctor.id);
  assert.ok(request);
  assert.equal(request.status, 'pending');
  assert.match(request.phone, /^01/);

  const approved = await api.post(`/directory/admin/verifications/${request.id}/approve`, {}, admin.token);
  assert.equal(approved.status, 200);
  const listing = (await api.get(`/directory/doctors/${approved.body.doctorId}`)).body;
  assert.equal(listing.name, 'Dr. Brand New');
  assert.equal(listing.is_managed, true);
  assert.ok(listing.bmdc_verified_at);
  assert.equal(listing.degrees, 'MBBS, FCPS (Medicine)');
  assert.equal((await api.get('/auth/me', doctor.token)).body.doctorId, approved.body.doctorId);
});

test('an existing listing makes it a claim, approval links it and rejects rival claims', async () => {
  const bmdcNo = nextBmdc();
  const listing = await newDoctor({ bmdcNo, name: 'Dr. Claimable' });
  assert.equal(listing.status, 201, JSON.stringify(listing.body));
  assert.equal(listing.body.bmdc_verified_at, null);

  const first = await registerDoctor(api, { bmdcNo });
  const rival = await registerDoctor(api, { bmdcNo: bmdcNo.replace('-', ' ') });
  assert.equal(first.verification.kind, 'claim');
  assert.equal(rival.verification.kind, 'claim');

  const requests = await db.doctorVerification.findMany({ where: { doctorId: listing.body.id } });
  const firstRequest = requests.find((r) => r.userId === first.id)!;
  const approved = await api.post(`/directory/admin/verifications/${firstRequest.id}/approve`, {}, admin.token);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.doctorId, listing.body.id);

  const after = (await api.get(`/directory/doctors/${listing.body.id}`)).body;
  assert.ok(after.bmdc_verified_at);
  const rivalNow = (await api.get('/auth/me', rival.token)).body;
  assert.equal(rivalNow.verification.status, 'rejected');
  assert.match(rivalNow.verification.review_note, /Another account/);

  const late = await api.post('/auth/register/doctor', {
    name: 'Late Comer', email: nextEmail(), password: PASSWORD, phone: nextPhone(), specialty: 'ENT', bmdcNo,
  });
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'BMDC_CLAIMED');
});

test('two new sign-ups with one number cannot create two listings', async () => {
  const bmdcNo = nextBmdc();
  const one = await registerDoctor(api, { bmdcNo });
  const two = await registerDoctor(api, { bmdcNo });
  const ids = await db.doctorVerification.findMany({ where: { userId: { in: [one.id, two.id] } } });
  const approved = await api.post(`/directory/admin/verifications/${ids[0]!.id}/approve`, {}, admin.token);
  assert.equal(approved.status, 200);
  const other = await api.post(`/directory/admin/verifications/${ids[1]!.id}/approve`, {}, admin.token);
  assert.equal(other.status, 404);
  assert.equal(await db.doctorListing.count({ where: { bmdcNo } }), 1);
});

test('rejecting needs a reason, and a rejected doctor can apply again', async () => {
  const doctor = await registerDoctor(api);
  const { id } = await db.doctorVerification.findFirstOrThrow({ where: { userId: doctor.id } });
  const short = await api.post(`/directory/admin/verifications/${id}/reject`, { note: 'no' }, admin.token);
  assert.equal(short.status, 400);
  assert.equal((await api.post(`/directory/admin/verifications/${id}/reject`, { note: 'Number not found' }, admin.token)).status, 200);
  assert.equal((await api.post(`/directory/admin/verifications/${id}/reject`, { note: 'Number not found' }, admin.token)).status, 404);
  assert.equal((await api.get('/auth/me', doctor.token)).body.verification.review_note, 'Number not found');

  const again = await api.post('/directory/verifications', { bmdcNo: doctor.bmdcNo, specialty: 'ENT' }, doctor.token);
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.status, 'pending');
  const twice = await api.post('/directory/verifications', { bmdcNo: doctor.bmdcNo, specialty: 'ENT' }, doctor.token);
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, 'VERIFICATION_PENDING');
});

test('a self-declared clinic BMDC number cannot lock the real doctor out', async () => {
  const bmdcNo = nextBmdc();
  await db.user.create({ data: { fullName: 'Squatter', email: nextEmail(), passwordHash: 'x', role: 'DOCTOR', bmdcNumber: bmdcNo } });
  const res = await api.post('/auth/register/doctor', {
    name: 'Real Doctor', email: nextEmail(), password: PASSWORD, phone: nextPhone(), specialty: 'ENT', bmdcNo,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.verification.status, 'pending');
  assert.equal(res.body.doctorId, null);
});

test('bad admin input is a 400, never a database error', async () => {
  const cases: Record<string, unknown>[] = [
    { hospitalId: 'not-a-uuid' },
    { hospitalId: '00000000-0000-4000-8000-000000000000' },
    { weeklySchedule: 'monday' },
    { weeklySchedule: [1, 2] },
    { fees: 12.5 },
    { fees: 1e12 },
    { followupFees: -5 },
  ];
  for (const fields of cases) {
    const res = await newDoctor(fields);
    assert.equal(res.status, 400, JSON.stringify(fields));
    assert.equal(res.body.code, 'VALIDATION');
  }
  const created = await newDoctor({ weeklySchedule: null });
  assert.deepEqual(created.body.weekly_schedule, []);
  assert.equal((await api.get('/directory/doctors?page=9999999999999999999')).status, 200);

  const hospital = await api.post('/directory/admin/hospitals', { name: 'Null Beds', location: 'Dhaka', beds: null }, admin.token);
  assert.equal(hospital.status, 201, JSON.stringify(hospital.body));
  assert.equal(hospital.body.beds, null);
  const withBeds = await api.patch(`/directory/admin/hospitals/${hospital.body.id}`, { name: 'Null Beds', location: 'Dhaka', beds: { general: 3 } }, admin.token);
  assert.equal(withBeds.body.beds.general, 3);
  const cleared = await api.patch(`/directory/admin/hospitals/${hospital.body.id}`, { name: 'Null Beds', location: 'Dhaka', beds: null }, admin.token);
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.equal(cleared.body.beds, null);
  assert.equal((await api.get(`/directory/hospitals/${hospital.body.id}/doctors`)).status, 200);
});

test('a public account cannot use clinic onboarding to write to its account', async () => {
  const patient = await registerPatient(api);
  for (const [method, path] of [['GET', '/onboarding/state'], ['POST', '/onboarding/steps/2'], ['POST', '/onboarding/finish']] as const) {
    const res = await api.call(method, path, { token: patient.token, ...(method === 'POST' ? { body: { bmdcNumber: 'A-1' } } : {}) });
    assert.equal(res.status, 403, path);
  }
});

test('a verified new doctor gets no invented follow-up fee', async () => {
  const doctor = await verifiedDoctor(api, admin.token);
  assert.equal((await api.get(`/directory/doctors/${doctor.doctorId}`)).body.followup_fees, null);
});

test('an unapproved doctor gets DOCTOR_NOT_VERIFIED from every /me route', async () => {
  const doctor = await registerDoctor(api);
  for (const path of ['profile', 'insights', 'appointments']) {
    const res = await api.get(`/directory/doctors/me/${path}`, doctor.token);
    assert.equal(res.status, 403, path);
    assert.equal(res.body.code, 'DOCTOR_NOT_VERIFIED');
  }
});

// ---------------------------------------------------------------- profile

test('a doctor edits their profile but not name, specialty or BMDC number', async () => {
  const doctor = await verifiedDoctor(api, admin.token, { name: 'Profile Owner' });
  const before = (await api.get('/directory/doctors/me/profile', doctor.token)).body;
  assert.equal(before.slug, 'dr-profile-owner');
  assert.equal(before.items.qualification.length, 2);
  assert.ok(before.completeness.missing.includes('photo'));

  const res = await api.patch(
    '/directory/doctors/me/profile',
    { name: 'Hacked', specialty: 'Hacked', bmdcNo: 'A-1', bmdc_verified_at: null, headline: '  Heart   doctor ', fees: 1500, clinicalExpertise: ['Echo', 'echo', 'ECG'] },
    doctor.token,
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.name, before.name);
  assert.equal(res.body.specialty, before.specialty);
  assert.equal(res.body.bmdc_no, before.bmdc_no);
  assert.ok(res.body.bmdc_verified_at);
  assert.equal(res.body.headline, 'Heart doctor');
  assert.equal(res.body.fees, 1500);
  assert.deepEqual(res.body.clinical_expertise, ['Echo', 'ECG']);

  const bad = await api.patch('/directory/doctors/me/profile', { fees: -1 }, doctor.token);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'VALIDATION');
});

test('slugs are unique and a taken one returns SLUG_TAKEN', async () => {
  const one = await verifiedDoctor(api, admin.token, { name: 'Same Name' });
  const two = await verifiedDoctor(api, admin.token, { name: 'Same Name' });
  assert.equal((await api.get('/directory/doctors/me/profile', one.token)).body.slug, 'dr-same-name');
  assert.equal((await api.get('/directory/doctors/me/profile', two.token)).body.slug, 'dr-same-name-2');
  const taken = await api.patch('/directory/doctors/me/profile', { slug: 'dr-same-name' }, two.token);
  assert.equal(taken.status, 409);
  assert.equal(taken.body.code, 'SLUG_TAKEN');
  assert.equal((await api.get('/directory/doctors/by-slug/DR-SAME-NAME')).body.id, one.doctorId);
});

test('career entries: order, limits and ownership', async () => {
  const doctor = await verifiedDoctor(api, admin.token);
  const other = await verifiedDoctor(api, admin.token);
  const add = (body: unknown) => api.post('/directory/doctors/me/profile/items', body, doctor.token);

  const old = await add({ kind: 'position', title: 'Old job', startYear: 2000, endYear: 2005 });
  assert.equal(old.status, 201, JSON.stringify(old.body));
  assert.equal(old.body.kind, 'position');
  assert.equal(old.body.start_year, 2000);
  await add({ kind: 'position', title: 'Current job', startYear: 2010, isCurrent: true });
  await add({ kind: 'position', title: 'Mid job', startYear: 2006, endYear: 2009 });
  const titles = (await api.get('/directory/doctors/me/profile', doctor.token)).body.items.position.map((i: any) => i.title);
  assert.deepEqual(titles, ['Current job', 'Mid job', 'Old job']);

  const path = `/directory/doctors/me/profile/items/${old.body.id}`;
  const body = { kind: 'position', title: 'Stolen', startYear: 2000 };
  assert.equal((await api.patch(path, body, other.token)).status, 404);
  assert.equal((await api.del(path, other.token)).status, 404);
  const edited = await api.patch(path, { kind: 'award', title: 'Renamed', startYear: 2000 }, doctor.token);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.title, 'Renamed');
  assert.equal(edited.body.kind, 'position');
  assert.deepEqual((await api.del(path, doctor.token)).body, { ok: true });
  assert.equal((await api.del(path, doctor.token)).status, 404);
  assert.equal((await api.del('/directory/doctors/me/profile/items/not-a-uuid', doctor.token)).status, 404);

  await db.doctorProfileItem.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({ doctorId: doctor.doctorId, kind: 'AWARD' as const, title: `A${i}` })),
  });
  const limit = await add({ kind: 'award', title: 'One too many' });
  assert.equal(limit.status, 400);
  assert.equal(limit.body.code, 'LIMIT');
});

test('photos are checked by their bytes and served publicly', async () => {
  const doctor = await verifiedDoctor(api, admin.token);
  const upload = (form: FormData) => api.call('POST', '/directory/doctors/me/profile/photo', { token: doctor.token, form });

  const fake = await upload(imageForm(Buffer.from('<svg onload="alert(1)"></svg>'), 'image/png', 'x.png'));
  assert.equal(fake.status, 400);
  assert.equal(fake.body.code, 'VALIDATION');

  const svg = await upload(imageForm(Buffer.from('<svg></svg>'), 'image/svg+xml', 'x.svg'));
  assert.equal(svg.status, 400);

  const big = await upload(imageForm(Buffer.alloc(5 * 1024 * 1024 + 10)));
  assert.equal(big.status, 413);
  assert.ok(big.body.error);

  // A real PNG with a misleading name and type keeps a verified extension.
  const good = await upload(imageForm(PNG, 'image/jpeg', 'evil.html'));
  assert.equal(good.status, 200, JSON.stringify(good.body));
  assert.match(good.body.photo, /^\/api\/directory\/media\/doctor-photos\/doctor-upload-.*\.png$/);

  const served = await fetch(`${baseOf()}${good.body.photo}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Buffer.from(await served.arrayBuffer()).equals(PNG), true);

  const replaced = await upload(imageForm(PNG));
  assert.notEqual(replaced.body.photo, good.body.photo);
  assert.equal((await fetch(`${baseOf()}${good.body.photo}`)).status, 404);

  assert.deepEqual((await api.del('/directory/doctors/me/profile/photo', doctor.token)).body, { photo: null });
  assert.equal((await fetch(`${baseOf()}${replaced.body.photo}`)).status, 404);
});

test('the media route cannot read outside its folder', async () => {
  for (const path of ['..%2F..%2Fpackage.json', 'x/..%2F..%2F.env', 'doctor-photos/..%2F..%2Fstorage%2Fsecret.png']) {
    assert.equal((await fetch(`${baseOf()}/api/directory/media/${path}`)).status, 404, path);
  }
});

function baseOf(): string {
  const { port } = api.app.getHttpServer().address() as { port: number };
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------- reach and trust

test('endorsements follow the rules', async () => {
  const target = await verifiedDoctor(api, admin.token);
  await api.patch('/directory/doctors/me/profile', { clinicalExpertise: ['Echo', 'ECG'] }, target.token);
  const endorser = await verifiedDoctor(api, admin.token);
  const unverified = await verifiedDoctor(api, admin.token);
  await db.doctorListing.update({ where: { id: unverified.doctorId }, data: { bmdcVerifiedAt: null } });
  const path = `/directory/doctors/${target.doctorId}/endorsements`;

  const self = await api.post(path, { skill: 'Echo' }, target.token);
  assert.equal(self.status, 400);
  assert.equal(self.body.code, 'SELF_ENDORSE');
  const notVerified = await api.post(path, { skill: 'Echo' }, unverified.token);
  assert.equal(notVerified.status, 403);
  assert.equal(notVerified.body.code, 'NOT_VERIFIED');
  const notListed = await api.post(path, { skill: 'Nope' }, endorser.token);
  assert.equal(notListed.status, 400);
  assert.equal(notListed.body.code, 'VALIDATION');
  const pendingDoctor = await registerDoctor(api);
  assert.equal((await api.post(path, { skill: 'Echo' }, pendingDoctor.token)).body.code, 'DOCTOR_NOT_VERIFIED');

  assert.equal((await api.post(path, { skill: 'Echo' }, endorser.token)).status, 201);
  assert.equal((await api.post(path, { skill: 'Echo' }, endorser.token)).status, 201);

  const profilePath = `/directory/doctors/${target.doctorId}/profile`;
  const seen = (await api.get(profilePath, endorser.token)).body;
  assert.equal(seen.endorsements[0].skill, 'Echo');
  assert.equal(seen.endorsements[0].count, 1);
  assert.equal(seen.endorsements[0].endorsedByMe, true);
  assert.equal(seen.endorsements[0].endorsers[0].id, endorser.doctorId);
  assert.equal(seen.endorsements[1].count, 0);
  assert.equal(seen.canEndorse, true);
  assert.equal(seen.isOwner, false);
  const own = (await api.get(profilePath, target.token)).body;
  assert.equal(own.isOwner, true);
  assert.equal(own.canEndorse, false);
  const anon = (await api.get(profilePath)).body;
  assert.equal(anon.canEndorse, false);
  assert.equal(anon.endorsements[0].endorsedByMe, false);
  // A bad token on an optional route is treated as anonymous.
  assert.equal((await api.get(profilePath, 'garbage')).status, 200);

  // Endorsements for a removed skill stop counting.
  await api.patch('/directory/doctors/me/profile', { clinicalExpertise: ['ECG'] }, target.token);
  assert.equal((await api.get(profilePath)).body.endorsements.length, 1);

  await api.patch('/directory/doctors/me/profile', { clinicalExpertise: ['Echo', 'ECG'] }, target.token);
  assert.deepEqual((await api.del(`${path}?skill=Echo`, endorser.token)).body, { ok: true });
  assert.equal((await api.get(profilePath)).body.endorsements[0].count, 0);
});

test('reach counters feed insights, and the owner view does not count', async () => {
  const doctor = await verifiedDoctor(api, admin.token);
  const path = `/directory/doctors/${doctor.doctorId}`;
  assert.equal((await api.call('POST', `${path}/view`)).status, 204);
  assert.equal((await api.call('POST', `${path}/view`)).status, 204);
  assert.equal((await api.call('POST', `${path}/view`, { token: doctor.token })).status, 204);
  const share = await api.call('POST', `${path}/share`);
  assert.equal(share.status, 200);
  assert.equal(share.body.share_count, 1);
  const call = await api.post(`${path}/call`, { venue: VENUE, phone: '0171' });
  assert.equal(call.status, 200);
  assert.ok(call.body.created_at);

  // Stats from the previous period count separately.
  const older = new Date(Date.now() - 40 * 86_400_000);
  await db.doctorDailyStat.create({ data: { doctorId: doctor.doctorId, day: new Date(`${older.toISOString().slice(0, 10)}T00:00:00Z`), views: 7, shares: 2 } });
  await db.callLog.create({ data: { doctorId: doctor.doctorId, createdAt: older } });
  await db.callLog.create({ data: { doctorId: doctor.doctorId, createdAt: new Date(Date.now() - 90 * 86_400_000) } });

  const insights = (await api.get('/directory/doctors/me/insights', doctor.token)).body;
  assert.equal(insights.days, 30);
  assert.equal(insights.series.length, 30);
  assert.equal(insights.views, 2);
  assert.equal(insights.views_prev, 7);
  assert.equal(insights.shares, 1);
  assert.equal(insights.shares_prev, 2);
  assert.equal(insights.calls, 1);
  assert.equal(insights.calls_prev, 1);
  assert.equal(insights.series.at(-1).views, 2);
  assert.equal(insights.series.at(-1).calls, 1);
  assert.deepEqual(insights.reviews, { count: 0, average: null });
});

// ---------------------------------------------------------------- directory

test('public doctor responses carry no account data', async () => {
  const doctor = await verifiedDoctor(api, admin.token);
  for (const body of [
    (await api.get('/directory/doctors')).body,
    (await api.get('/directory/doctors?page=1')).body,
    (await api.get('/directory/doctors/featured')).body,
    (await api.get(`/directory/doctors/${doctor.doctorId}`)).body,
    (await api.get(`/directory/doctors/${doctor.doctorId}/profile`)).body,
  ]) {
    assertNoSecrets(body);
    assert.equal(JSON.stringify(body).includes(doctor.email), false);
  }
});

test('search pages and filters, and malformed ids are 404', async () => {
  await newDoctor({ name: 'Dr. Filter Alpha', specialty: 'Neurology', division: 'Sylhet', city: 'Sylhet', gender: 'female' });
  await newDoctor({ name: 'Dr. Filter Beta', specialty: 'Neurology', division: 'Dhaka', city: 'Dhaka', gender: 'male' });
  const page = (await api.get('/directory/doctors?page=1&limit=1&q=filter')).body;
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.limit, 1);
  assert.equal(page.items[0].name, 'Dr. Filter Alpha');
  assert.equal((await api.get('/directory/doctors?page=2&limit=1&q=FILTER')).body.items[0].name, 'Dr. Filter Beta');
  assert.equal((await api.get('/directory/doctors?page=1&q=filter&division=Sylhet,Rangpur')).body.total, 1);
  assert.equal((await api.get('/directory/doctors?page=1&q=filter&gender=male')).body.total, 1);
  assert.equal((await api.get('/directory/doctors?page=1&limit=999')).body.limit, 50);
  assert.equal((await api.get('/directory/doctors/123')).status, 404);
  assert.equal((await api.get('/directory/doctors/abc')).status, 404);
  assert.equal((await api.get('/directory/hospitals/123')).status, 404);

  const stats = (await api.get('/directory/doctors/stats')).body;
  assert.ok(stats.doctors >= 2);
  assert.ok(stats.bySpecialty.Neurology >= 2);
  assert.equal(stats.byDivision.Sylhet >= 1, true);
  assert.ok('with_bmdc' in stats);
  assert.equal((await api.get('/directory/doctors/featured?limit=1')).body.length, 1);
});

test('hidden records vanish from every public endpoint', async () => {
  const doctor = (await newDoctor({ name: 'Dr. Hide Me' })).body;
  const hospital = (await api.post('/directory/admin/hospitals', { name: 'Hide Hospital', location: 'Dhaka' }, admin.token)).body;
  const hide = (path: string) => api.patch(path, { hidden: true }, admin.token);
  assert.equal((await hide(`/directory/admin/doctors/${doctor.id}/hidden`)).body.hidden, true);
  assert.equal((await hide(`/directory/admin/hospitals/${hospital.id}/hidden`)).body.hidden, true);
  assert.equal((await api.patch(`/directory/admin/doctors/${doctor.id}/hidden`, { hidden: 'yes' }, admin.token)).status, 400);

  const path = `/directory/doctors/${doctor.id}`;
  for (const url of [path, `${path}/profile`, `${path}/sessions?date=2030-01-01`]) {
    assert.equal((await api.get(url)).status, 404, url);
  }
  for (const url of [`${path}/view`, `${path}/share`, `${path}/call`]) {
    assert.equal((await api.call('POST', url)).status, 404, url);
  }
  assert.equal((await api.get('/directory/doctors')).body.some((d: any) => d.id === doctor.id), false);
  assert.equal((await api.get('/directory/doctors?page=1&q=Hide')).body.total, 0);
  assert.equal((await api.get(`/directory/hospitals/${hospital.id}`)).status, 404);
  assert.equal((await api.get(`/directory/hospitals/${hospital.id}/doctors`)).status, 404);
  assert.equal((await api.get('/directory/hospitals')).body.some((h: any) => h.id === hospital.id), false);
  assert.equal((await api.get('/directory/admin/doctors', admin.token)).body.find((d: any) => d.id === doctor.id).hidden, true);
  assert.equal((await api.get('/directory/admin/hospitals', admin.token)).body.find((h: any) => h.id === hospital.id).hidden, true);
});

test('a PATCH on a doctor is a full replace, keeps the schedule and clears a stale badge', async () => {
  const doctor = await verifiedDoctor(api, admin.token, { name: 'Replace Me' });
  const path = `/directory/admin/doctors/${doctor.doctorId}`;
  await db.doctorListing.update({ where: { id: doctor.doctorId }, data: { weeklySchedule: SCHEDULE, about: 'Text', bmdcNo: doctor.bmdcNo } });

  const same = await api.patch(path, { name: 'Dr. Replace Me', specialty: 'Cardiology', bmdcNo: doctor.bmdcNo }, admin.token);
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.equal(same.body.about, null);
  assert.deepEqual(same.body.weekly_schedule, SCHEDULE);
  assert.ok(same.body.bmdc_verified_at);

  const changed = await api.patch(path, { name: 'Dr. Replace Me', specialty: 'Cardiology', bmdcNo: nextBmdc() }, admin.token);
  assert.equal(changed.body.bmdc_verified_at, null);

  const missing = await api.patch(path, { name: 'x' }, admin.token);
  assert.equal(missing.status, 400);
  const badBmdc = await api.patch(path, { name: 'x', specialty: 'y', bmdcNo: 'nonsense' }, admin.token);
  assert.equal(badBmdc.status, 400);
  const badRating = await api.patch(path, { name: 'x', specialty: 'y', rating: 9 }, admin.token);
  assert.equal(badRating.status, 400);
  assert.equal((await api.patch('/directory/admin/doctors/00000000-0000-4000-8000-000000000000', { name: 'x', specialty: 'y' }, admin.token)).status, 404);
});

test('duplicate BMDC on an admin write is a clean conflict, and a cleared fee stays cleared', async () => {
  const bmdcNo = nextBmdc();
  assert.equal((await newDoctor({ bmdcNo })).status, 201);
  const dup = await newDoctor({ bmdcNo: bmdcNo.replace('-', '') });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'BMDC_CLAIMED');

  const created = await newDoctor();
  assert.equal(created.body.followup_fees, 300);
  const cleared = await api.patch(`/directory/admin/doctors/${created.body.id}`, { name: 'Dr. Listed', specialty: 'Cardiology', followupFees: '' }, admin.token);
  assert.equal(cleared.body.followup_fees, null);
  assert.equal((await api.get(`/directory/doctors/${created.body.id}`)).body.followup_fees, null);
});

test('delete is refused while dependants exist', async () => {
  const hospital = (await api.post('/directory/admin/hospitals', { name: 'Linked Hospital', location: 'Dhaka' }, admin.token)).body;
  const venueOnly = (await api.post('/directory/admin/hospitals', { name: 'Venue Hospital', location: 'Dhaka' }, admin.token)).body;
  const free = (await api.post('/directory/admin/hospitals', { name: 'Free Hospital', location: 'Dhaka' }, admin.token)).body;
  const doctor = (await newDoctor({ hospitalId: hospital.id, weeklySchedule: [{ venue: 'Venue Hospital', time: SESSION }] })).body;

  for (const blocked of [hospital.id, venueOnly.id]) {
    const res = await api.del(`/directory/admin/hospitals/${blocked}`, admin.token);
    assert.equal(res.status, 409);
    assert.ok(res.body.error);
  }
  assert.deepEqual((await api.del(`/directory/admin/hospitals/${free.id}`, admin.token)).body, { id: free.id });

  const doctors = (await api.get(`/directory/hospitals/${venueOnly.id}/doctors`)).body;
  assert.equal(doctors[0].id, doctor.id);
  assert.deepEqual(doctors[0].venue_schedule, [{ venue: 'Venue Hospital', time: SESSION }]);

  // A doctor with any booking cannot be deleted.
  const patient = await registerPatient(api);
  const date = dateAhead(1, (day) => day !== 5);
  assert.equal((await api.post('/directory/appointments', { doctorId: doctor.id, date, venue: 'Venue Hospital', session: SESSION }, patient.token)).status, 201);
  assert.equal((await api.del(`/directory/admin/doctors/${doctor.id}`, admin.token)).status, 409);

  const removable = (await newDoctor()).body;
  assert.deepEqual((await api.del(`/directory/admin/doctors/${removable.id}`, admin.token)).body, { id: removable.id });
  assert.equal((await api.del(`/directory/admin/doctors/${removable.id}`, admin.token)).status, 404);
});

test('renaming a specialty updates its doctors and symptoms atomically', async () => {
  const specialty = (await api.post('/directory/admin/specialties', { name: 'Old Name', tags: ['x'], icon: 'H' }, admin.token)).body;
  assert.equal(specialty.slug, 'old-name');
  const symptom = await api.post('/directory/admin/symptoms', { name: 'Cough', specialties: ['Old Name'] }, admin.token);
  assert.equal(symptom.status, 201, JSON.stringify(symptom.body));
  assert.equal((await api.post('/directory/admin/symptoms', { name: 'Bad', specialties: ['Missing'] }, admin.token)).status, 400);
  const doctor = (await newDoctor({ specialty: 'Old Name' })).body;

  const blocked = await api.del(`/directory/admin/specialties/${specialty.id}`, admin.token);
  assert.equal(blocked.status, 409);

  const renamed = await api.patch(`/directory/admin/specialties/${specialty.id}`, { name: 'New Name' }, admin.token);
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.renamedDoctors, 1);
  assert.equal(renamed.body.slug, 'old-name');
  assert.equal((await api.get(`/directory/doctors/${doctor.id}`)).body.specialty, 'New Name');
  const symptoms = (await api.get('/directory/symptoms')).body;
  assert.deepEqual(symptoms.find((s: any) => s.name === 'Cough').specialties, ['New Name']);

  const dup = await api.post('/directory/admin/specialties', { name: 'New Name' }, admin.token);
  assert.equal(dup.status, 409);
  assert.ok(dup.body.error);
  const counted = (await api.get('/directory/admin/specialties', admin.token)).body.find((s: any) => s.name === 'New Name');
  assert.equal(counted.doctor_count, 1);
  assert.equal((await api.get('/directory/admin/bogus', admin.token)).status, 404);
});

test('an unknown specialty on a doctor is added hidden', async () => {
  await newDoctor({ specialty: 'Rare Field' });
  assert.equal((await api.get('/directory/specialties')).body.some((s: any) => s.name === 'Rare Field'), false);
  const row = (await api.get('/directory/admin/specialties', admin.token)).body.find((s: any) => s.name === 'Rare Field');
  assert.equal(row.hidden, true);
});

test('catalogue images upload and clear', async () => {
  const specialty = (await api.post('/directory/admin/specialties', { name: 'With Image' }, admin.token)).body;
  const res = await api.call('POST', `/directory/admin/specialties/${specialty.id}/photo`, { token: admin.token, form: imageForm(PNG) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.photo, /catalog-images/);
  assert.deepEqual((await api.del(`/directory/admin/specialties/${specialty.id}/photo`, admin.token)).body, { photo: null });
  const site = await api.call('POST', '/directory/admin/site-images', { token: admin.token, form: imageForm(PNG) });
  assert.match(site.body.url, /site-images/);
  const hospital = (await api.post('/directory/admin/hospitals', { name: 'Photo H', location: 'Dhaka' }, admin.token)).body;
  const photo = await api.call('POST', `/directory/admin/hospitals/${hospital.id}/photo`, { token: admin.token, form: imageForm(PNG) });
  assert.match(photo.body.photo, /hospital-photos/);
  assert.deepEqual((await api.del(`/directory/admin/hospitals/${hospital.id}/photo`, admin.token)).body, { photo: null });
});

test('sample prices are labelled and disappear when switched off', async () => {
  await api.patch('/directory/admin/sample-prices', {
    testPrices: [{ name: 'CBC', category: 'blood', price: 400 }],
    showTestPrices: true,
    ambulanceFares: { ac: { min: 1, max: 2 }, non_ac: { min: 1, max: 2 }, freezer: { min: 1, max: 2 }, icu: { min: 1, max: 2 } },
  }, admin.token);
  const centre = await api.post('/directory/admin/hospitals', {
    name: 'Sample Centre', location: 'Dhaka', type: 'diagnostic',
    tests: [{ name: 'CBC', category: 'blood', price: null }, { name: 'MRI', category: 'imaging', price: 5000 }],
  }, admin.token);
  assert.equal(centre.status, 201, JSON.stringify(centre.body));
  const on = (await api.get(`/directory/hospitals/${centre.body.id}`)).body;
  assert.deepEqual(on.tests[0], { name: 'CBC', category: 'blood', price: 400, price_kind: 'demo' });
  assert.equal(on.tests[1].price_kind, undefined);
  assert.equal((await api.get(`/directory/admin/hospitals/${centre.body.id}`, admin.token)).body.tests[0].price, null);

  const list = (await api.get('/directory/hospitals')).body.find((h: any) => h.id === centre.body.id);
  assert.equal(list.tests[0].price_kind, 'demo');

  const hospital = (await api.post('/directory/admin/hospitals', { name: 'No Tests', location: 'Dhaka', type: 'hospital', tests: [] }, admin.token)).body;
  assert.equal((await api.get('/directory/hospitals')).body.find((h: any) => h.id === hospital.id).tests, null);

  const off = await api.patch('/directory/admin/sample-prices', { showTestPrices: false }, admin.token);
  assert.equal(off.body.showTestPrices, false);
  assert.equal(off.body.testPrices.length, 1);
  assert.equal((await api.get(`/directory/hospitals/${centre.body.id}`)).body.tests[0].price, null);
  assert.equal((await api.patch('/directory/admin/sample-prices', { testPrices: 'x' }, admin.token)).status, 400);
});

test('hospital extras are only written when sent', async () => {
  const created = (await api.post('/directory/admin/hospitals', {
    name: 'Extras', location: 'Dhaka', type: 'clinic', facilities: ['parking', 'BAD KEY'], beds: { general: 5 },
    services: [{ key: 'icu', hours: '24/7' }], opening_hours: '9-5', source_url: 'https://x.example', verified_on: '2026-10-09',
  }, admin.token)).body;
  assert.deepEqual(created.facilities, ['parking']);
  assert.equal(created.verified_on, '2026-10-09');
  const updated = (await api.patch(`/directory/admin/hospitals/${created.id}`, { name: 'Extras 2', location: 'Dhaka' }, admin.token)).body;
  assert.equal(updated.name, 'Extras 2');
  assert.deepEqual(updated.facilities, ['parking']);
  assert.equal(updated.type, 'clinic');
  assert.equal(updated.opening_hours, '9-5');
  assert.equal((await api.post('/directory/admin/hospitals', { name: 'x', location: 'y', type: 'nope' }, admin.token)).status, 400);
  assert.equal((await api.post('/directory/admin/hospitals', { name: 'x', location: 'y', verified_on: '2026-99-01' }, admin.token)).status, 400);
});

test('ambulances: fares, slugs, hide and delete', async () => {
  const body = { name: 'Fast Ambulance', phones: ['01700000000'], categories: ['ac', 'icu'], fares: { icu: { min: 9000, max: 11000 } } };
  const first = await api.post('/directory/admin/ambulances', body, admin.token);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const second = await api.post('/directory/admin/ambulances', body, admin.token);
  assert.equal(second.body.slug, 'fast-ambulance-2');
  const listed = (await api.get('/directory/ambulances')).body.find((v: any) => v.id === 'fast-ambulance');
  assert.equal(listed.fares.icu.kind, 'quoted');
  assert.equal(listed.fares.ac.kind, 'sample');
  assert.equal(listed.hidden, undefined);
  assert.equal((await api.patch(`/directory/admin/ambulances/${first.body.id}/hidden`, { hidden: true }, admin.token)).status, 200);
  assert.equal((await api.get('/directory/ambulances')).body.some((v: any) => v.id === 'fast-ambulance'), false);
  assert.equal((await api.patch(`/directory/admin/ambulances/${second.body.id}`, { ...body, name: 'Renamed' }, admin.token)).body.name, 'Renamed');
  assert.deepEqual((await api.del(`/directory/admin/ambulances/${first.body.id}`, admin.token)).body, { id: first.body.id });
  assert.equal((await api.del(`/directory/admin/ambulances/${first.body.id}`, admin.token)).status, 404);
});

test('site content: text merges, null resets, and home slugs must exist', async () => {
  await api.patch('/directory/admin/site-text', { en: { home_title: 'Hello', other: 'Keep' }, bn: { home_title: 'হ্যালো' } }, admin.token);
  const merged = await api.patch('/directory/admin/site-text', { en: { home_title: null } }, admin.token);
  assert.equal(merged.status, 200);
  assert.deepEqual(merged.body.text.en, { other: 'Keep' });
  assert.equal(merged.body.text.bn.home_title, 'হ্যালো');
  assert.deepEqual((await api.get('/directory/site-content')).body.text.en, { other: 'Keep' });
  assert.equal((await api.patch('/directory/admin/site-text', { en: { 'Bad-Key': 'x' } }, admin.token)).status, 400);

  const contacts = await api.put('/directory/admin/contacts', { emergency: '999', health_line: '16263', hotline: '16966' }, admin.token);
  assert.equal(contacts.body.contacts.hotline, '16966');
  assert.equal((await api.put('/directory/admin/contacts', { emergency: 'x' }, admin.token)).status, 400);

  const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh'];
  const divisions = DIVISIONS.map((name) => ({ name, bn: name, photo: '/d.jpg', alt: name }));
  const missing = await api.put('/directory/admin/home-content', {
    divisions, common_problems: [], popular_specialties: [{ slug: 'no-such-page', en: 'A', bn: 'B' }],
  }, admin.token);
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /no-such-page/);
  const home = await api.put('/directory/admin/home-content', { divisions, common_problems: [], popular_specialties: [] }, admin.token);
  assert.equal(home.body.home.divisions.length, 8);
  assert.equal((await api.put('/directory/admin/home-content', { divisions: divisions.slice(1), common_problems: [], popular_specialties: [] }, admin.token)).status, 400);

  const credits = await api.put('/directory/admin/photo-credits', [{ file: '/a.jpg', caption: 'C', license: 'CC', licenseUrl: 'https://l.example', source: 'https://s.example' }], admin.token);
  assert.equal(credits.status, 200, JSON.stringify(credits.body));
  assert.equal(credits.body.credits.length, 1);
  assert.equal((await api.get('/directory/admin/site-content', admin.token)).body.credits.length, 1);
});

// ---------------------------------------------------------------- booking

async function bookableDoctor() {
  return (await newDoctor({ name: `Dr. Booking ${nextBmdc()}` })).body;
}

test('concurrent bookings get distinct serials and a cancelled serial is not reused', async () => {
  const doctor = await bookableDoctor();
  const date = dateAhead(1, (day) => day !== 5);
  const patients = await Promise.all(Array.from({ length: 8 }, () => registerPatient(api)));
  const results = await Promise.all(
    patients.map((p) => api.post('/directory/appointments', { doctorId: doctor.id, date, venue: VENUE, session: SESSION }, p.token)),
  );
  for (const res of results) assert.equal(res.status, 201, JSON.stringify(res.body));
  const serials = results.map((r) => r.body.serial_no).sort((a, b) => a - b);
  assert.deepEqual(serials, [1, 2, 3, 4, 5, 6, 7, 8]);

  const first = results[0]!;
  assert.equal(first.body.appointment_date, date);
  assert.equal(first.body.appointment_time, '08:00:00');
  assert.equal(first.body.status, 'confirmed');
  assert.equal(first.body.estimated_arrival, `08:${String((first.body.serial_no - 1) * 10).padStart(2, '0')} AM`.replace('08:60', '09:00').replace('08:70', '09:10'));

  const last = results.find((r) => r.body.serial_no === 8)!;
  const owner = patients[results.indexOf(last)]!;
  const cancelled = await api.call('PATCH', `/directory/appointments/${last.body.id}/cancel`, { token: owner.token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');

  const again = await api.post('/directory/appointments', { doctorId: doctor.id, date, venue: VENUE, session: SESSION }, owner.token);
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.serial_no, 9);
  const duplicate = await api.post('/directory/appointments', { doctorId: doctor.id, date, venue: VENUE, session: SESSION }, owner.token);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'ALREADY_BOOKED');
  assert.equal(duplicate.body.serial, 9);
});

test('Friday, past, too far ahead and unknown sessions refuse booking', async () => {
  const doctor = await bookableDoctor();
  const patient = await registerPatient(api);
  const book = (date: string, session = SESSION) =>
    api.post('/directory/appointments', { doctorId: doctor.id, date, venue: VENUE, session }, patient.token);
  assert.equal((await book(dateAhead(1, (day) => day === 5))).body.code, 'CLOSED_FRIDAY');
  assert.equal((await book(dateAhead(-14, (day) => day !== 5))).body.code, 'DATE_PASSED');
  assert.equal((await book(dateAhead(40, (day) => day !== 5))).body.code, 'TOO_FAR_AHEAD');
  assert.equal((await book(dateAhead(1, (day) => day !== 5), 'Evening')).body.code, 'NO_SUCH_SESSION');
  assert.equal((await book('not-a-date')).body.code, 'VALIDATION');
  assert.equal((await book('2026-02-30')).body.code, 'VALIDATION');
  assert.equal((await api.post('/directory/appointments', {}, patient.token)).body.code, 'VALIDATION');
  assert.equal((await api.post('/directory/appointments', { doctorId: 'x', date: '2030-01-01', venue: 'v', session: 's' }, patient.token)).status, 404);
});

test('the sessions endpoint shows booking state and the viewer own serial', async () => {
  const doctor = await bookableDoctor();
  const patient = await registerPatient(api);
  const date = dateAhead(1, (day) => day !== 5);
  await api.post('/directory/appointments', { doctorId: doctor.id, date, venue: VENUE, session: SESSION }, patient.token);

  const anon = (await api.get(`/directory/doctors/${doctor.id}/sessions?date=${date}`)).body;
  assert.equal(anon.sessions[0].booked, 1);
  assert.equal(anon.sessions[0].nextSerial, 2);
  assert.equal(anon.sessions[0].estimatedArrival, '08:10 AM');
  assert.equal(anon.sessions[0].bookable, true);
  assert.equal(anon.sessions[0].mine, null);
  const mine = (await api.get(`/directory/doctors/${doctor.id}/sessions?date=${date}`, patient.token)).body;
  assert.equal(mine.sessions[0].mine.serialNo, 1);
  const friday = (await api.get(`/directory/doctors/${doctor.id}/sessions?date=${dateAhead(1, (d) => d === 5)}`)).body;
  assert.equal(friday.sessions[0].bookable, false);
  assert.equal(friday.sessions[0].reasonCode, 'CLOSED_FRIDAY');
  assert.equal((await api.get(`/directory/doctors/${doctor.id}/sessions`)).status, 400);
});

test('complete, cancel rules, reviews and doctor views', async () => {
  const account = await verifiedDoctor(api, admin.token);
  await db.doctorListing.update({ where: { id: account.doctorId }, data: { weeklySchedule: SCHEDULE } });
  const patient = await registerPatient(api);
  const stranger = await registerPatient(api);
  const otherDoctor = await verifiedDoctor(api, admin.token);
  const date = dateAhead(1, (day) => day !== 5);
  const booked = (await api.post('/directory/appointments', { doctorId: account.doctorId, date, venue: VENUE, session: SESSION, notes: ' Hi ' }, patient.token)).body;
  assert.equal(booked.notes, 'Hi');

  const reviewPath = `/directory/appointments/${booked.id}/review`;
  const early = await api.post(reviewPath, { rating: 5 }, patient.token);
  assert.equal(early.status, 400);
  assert.equal(early.body.code, 'NOT_COMPLETED');

  const list = (await api.get('/directory/doctors/me/appointments', account.token)).body;
  assert.equal(list[0].patient_name, 'Test Patient');
  assert.equal(list[0].patient_phone, patient.phone);
  assert.equal(list[0].estimated_arrival, '08:00 AM');

  const completePath = `/directory/doctors/me/appointments/${booked.id}/complete`;
  assert.equal((await api.call('PATCH', completePath, { token: otherDoctor.token })).status, 404);
  const completed = await api.call('PATCH', completePath, { token: account.token });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, 'completed');
  assert.equal((await api.call('PATCH', completePath, { token: account.token })).status, 404);

  // A completed visit cannot be cancelled, and strangers cannot touch it.
  assert.equal((await api.call('PATCH', `/directory/appointments/${booked.id}/cancel`, { token: patient.token })).status, 404);
  assert.equal((await api.call('PATCH', `/directory/appointments/${booked.id}/cancel`, { token: stranger.token })).status, 404);
  assert.equal((await api.post(reviewPath, { rating: 5 }, stranger.token)).status, 404);
  assert.equal((await api.post(reviewPath, { rating: 9 }, patient.token)).body.code, 'VALIDATION');

  const review = await api.post(reviewPath, { rating: 4, comment: ' Good ' }, patient.token);
  assert.equal(review.status, 201);
  assert.equal(review.body.comment, 'Good');
  assert.ok(review.body.created_at);
  const repeat = await api.post(reviewPath, { rating: 4 }, patient.token);
  assert.equal(repeat.status, 409);
  assert.equal(repeat.body.code, 'ALREADY_REVIEWED');

  const mine = (await api.get('/directory/appointments/me', patient.token)).body;
  assert.equal(mine[0].review_rating, 4);
  assert.equal(mine[0].doctor_name, 'Dr. Test Doctor');
  assert.equal(mine[0].estimated_arrival, '08:00 AM');
  assert.equal((await api.get('/directory/appointments/me', account.token)).status, 403);

  const profile = (await api.get(`/directory/doctors/${account.doctorId}/profile`)).body;
  assert.equal(profile.reviews.count, 1);
  assert.equal(profile.reviews.average, 4);
  assert.deepEqual(Object.keys(profile.reviews.recent[0]).sort(), ['comment', 'created_at', 'id', 'rating']);
  const listing = (await api.get(`/directory/doctors/${account.doctorId}`)).body;
  assert.equal(listing.review_count, 1);
  assert.equal(listing.review_average, 4);
  assert.equal((await api.get('/directory/doctors/me/insights', account.token)).body.reviews.count, 1);

  await db.doctorReview.updateMany({ where: { bookingId: booked.id }, data: { hiddenAt: new Date() } });
  assert.equal((await api.get(`/directory/doctors/${account.doctorId}`)).body.review_count, 0);

  const all = (await api.get('/directory/admin/appointments?status=completed', admin.token)).body;
  const row = all.find((a: any) => a.id === booked.id);
  assert.equal(row.patient_phone, patient.phone);
  assert.ok(row.doctor_name);
});

test('a clinic doctor can claim a listing from their existing account', async () => {
  const { CryptoService } = await import('../src/common/crypto/crypto.service');
  const crypto = api.app.get(CryptoService);
  const email = nextEmail();
  const bmdcNo = nextBmdc();
  await db.user.create({
    data: { fullName: 'Clinic Doctor', email, mobile: `+88${nextPhone()}`, passwordHash: await crypto.hashPassword(PASSWORD), role: 'DOCTOR', bmdcNumber: bmdcNo, mobileVerifiedAt: new Date() },
  });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  const token = login.body.session.accessToken;
  assert.deepEqual((await api.get('/auth/me', token)).body.roles, []);

  const submitted = await api.post('/directory/verifications', { bmdcNo, specialty: 'ENT' }, token);
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const { id } = await db.doctorVerification.findFirstOrThrow({ where: { bmdcNo } });
  const approved = await api.post(`/directory/admin/verifications/${id}/approve`, {}, admin.token);
  assert.equal(approved.status, 200);
  const me = (await api.get('/auth/me', token)).body;
  assert.deepEqual(me.roles, ['doctor']);
  assert.equal(me.doctorId, approved.body.doctorId);
  // Their clinic access level has not changed.
  assert.equal((await db.user.findFirstOrThrow({ where: { email } })).role, 'DOCTOR');
  assert.equal((await api.get('/directory/doctors/me/profile', token)).status, 200);
  assert.equal((await api.post('/directory/verifications', { bmdcNo, specialty: 'ENT' }, token)).body.code, 'ALREADY_LINKED');
});

test('errors keep both shapes: { error, code } and the clinic message and requestId', async () => {
  const res = await api.get('/directory/doctors/00000000-0000-4000-8000-000000000000');
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'NOT_FOUND');
  assert.equal(res.body.error, res.body.message);
  assert.ok(res.body.requestId);
  const unauth = await api.get('/auth/me');
  assert.equal(unauth.status, 401);
  assert.ok(unauth.body.error);
  const clinic = await api.post('/auth/login', { identifier: 'nope' });
  assert.equal(clinic.status, 422);
  assert.equal(clinic.body.code, 'VALIDATION_FAILED');
  assert.ok(clinic.body.details);
});
