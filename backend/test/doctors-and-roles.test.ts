import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { SMS_SENDER } from '../src/core/ports/services';
import { PASSWORD, TestApi, db, directoryAdmin, nextBmdc, nextEmail, nextPhone, registerDoctor, registerPatient } from './harness';

/** One doctor table shown on both front ends, and the seven user types. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;
let sentCode = '';

async function newClinic(name = 'Clinic') {
  const email = nextEmail();
  const res = await api.post(
    '/directory/admin/owners',
    { fullName: 'Clinic Owner', clinicName: name, mobile: nextPhone(), email, temporaryPassword: PASSWORD },
    superAdmin.token,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const owner = await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  return { token: login.body.session.accessToken as string, practiceId: res.body.clinics[0].id as string, ownerId: owner.id };
}

const addDoctor = (clinic: { token: string; practiceId: string }, fields: Record<string, unknown> = {}) =>
  api.post(
    '/settings/staff',
    { practiceId: clinic.practiceId, fullName: 'Dr Added', role: 'DOCTOR', mobile: nextPhone(), specialty: 'ENT', ...fields },
    clinic.token,
  );

const publicNames = async () => (await api.get('/directory/doctors')).body.map((d: { name: string }) => d.name);

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, ambulance_vendors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
  api.app.get(SMS_SENDER).send = async ({ body }: { body: string }) => {
    sentCode = body.match(/\d{6}/)![0];
  };
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('a doctor an admin adds is on both front ends at once, with no login', async () => {
  const clinic = await newClinic();
  const added = await addDoctor(clinic, { fullName: 'Dr Both Fronts' });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.body.hasLogin, false);
  assert.equal(JSON.stringify(added.body).includes('passwordHash'), false);

  assert.ok((await publicNames()).includes('Dr Both Fronts'));
  const doctors = await api.get(`/appointments/doctors?practiceId=${clinic.practiceId}`, clinic.token);
  assert.ok(doctors.body.some((d: { fullName: string }) => d.fullName === 'Dr Both Fronts'));
});

test('a phone number is a must when an admin adds a doctor', async () => {
  const clinic = await newClinic();
  const res = await addDoctor(clinic, { mobile: null });
  assert.equal(res.status, 422);
  assert.equal((await api.post('/directory/admin/doctors', { name: 'Dr. No Phone', specialty: 'ENT' }, superAdmin.token)).status, 400);
});

test('logging in or signing up with that phone leads to the pre-filled sign-up', async () => {
  const clinic = await newClinic();
  const mobile = nextPhone();
  await addDoctor(clinic, { fullName: 'Dr Prefill', mobile });

  const login = await api.post('/auth/login', { identifier: mobile, password: PASSWORD });
  assert.equal(login.status, 409);
  assert.equal(login.body.code, 'DOCTOR_SIGNUP_REQUIRED');

  const register = await api.post('/auth/register', {
    fullName: 'Someone', mobile, bmdcNumber: nextBmdc(), specialty: 'ENT', password: PASSWORD, confirmPassword: PASSWORD,
  });
  assert.equal(register.body.code, 'DOCTOR_SIGNUP_REQUIRED');

  const patient = await api.post('/auth/register/patient', { name: 'Someone', email: nextEmail(), password: PASSWORD, phone: mobile });
  assert.equal(patient.body.code, 'DOCTOR_SIGNUP_REQUIRED');

  const lookup = await api.post('/auth/doctor-claim/lookup', { mobile });
  assert.equal(lookup.body.claimable, true);
  assert.equal(lookup.body.fullName, 'Dr Prefill');
  assert.equal(lookup.body.specialty, 'ENT');
  assert.equal(JSON.stringify(lookup.body).toLowerCase().includes('bmdc'), false);
  assert.equal((await api.post('/auth/doctor-claim/lookup', { mobile: nextPhone() })).body.claimable, false);
});

test('a doctor signs up with their BMDC number and a code, once', async () => {
  const clinic = await newClinic();
  const mobile = nextPhone();
  const bmdcNumber = nextBmdc();
  await addDoctor(clinic, { fullName: 'Dr Claimant', mobile, bmdcNumber });

  const wrong = await api.post('/auth/doctor-claim/start', { mobile, bmdcNumber: nextBmdc() });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.body.code, 'BMDC_MISMATCH');

  const started = await api.post('/auth/doctor-claim/start', { mobile, bmdcNumber });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const { challengeId } = started.body.challenge;

  // The code alone never opens a session.
  const code = sentCode;
  assert.equal((await api.post('/auth/verify-otp', { challengeId, code })).status, 401);
  await db.otpChallenge.update({ where: { id: challengeId }, data: { consumedAt: null } });

  const done = await api.post('/auth/doctor-claim/complete', {
    challengeId, code, bmdcNumber, password: PASSWORD, confirmPassword: PASSWORD,
  });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.deepEqual(done.body.user.practiceIds, [clinic.practiceId]);
  assert.ok(done.body.user.permissions.includes('clinic:access'));

  const login = await api.post('/auth/login', { identifier: mobile, password: PASSWORD });
  assert.equal(login.body.status, 'authenticated');
  const me = await api.get('/auth/me', login.body.session.accessToken);
  assert.deepEqual(me.body.roles, ['doctor']);
  assert.ok(me.body.doctorId);

  // Still one doctor, not a second record.
  assert.equal(await db.doctorListing.count({ where: { name: 'Dr Claimant' } }), 1);
  assert.equal((await api.post('/auth/doctor-claim/lookup', { mobile })).body.claimable, false);
  assert.equal((await api.post('/auth/doctor-claim/start', { mobile, bmdcNumber })).status, 404);
});

test('a doctor who signs up is hidden from patients until an admin approves', async () => {
  const doctor = await registerDoctor(api, { name: 'Dr Waiting' });
  assert.equal(doctor.doctorId, null);
  assert.equal(doctor.verification.status, 'pending');
  assert.equal((await publicNames()).includes('Dr Waiting'), false);

  const row = await db.doctorListing.findUniqueOrThrow({ where: { userId: doctor.id } });
  assert.equal((await api.patch(`/directory/admin/doctors/${row.id}/hidden`, { hidden: false }, superAdmin.token)).status, 404);
  assert.equal((await publicNames()).includes('Dr Waiting'), false);

  const request = await db.doctorVerification.findFirstOrThrow({ where: { userId: doctor.id } });
  const approved = await api.post(`/directory/admin/verifications/${request.id}/approve`, {}, superAdmin.token);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.doctorId, row.id);
  assert.ok((await publicNames()).includes('Dr Waiting'));
  assert.equal(await db.doctorListing.count({ where: { userId: doctor.id } }), 1);
});

test('one doctor at two clinics is one person, and one clinic cannot affect the other', async () => {
  const [first, second] = [await newClinic('First'), await newClinic('Second')];
  const mobile = nextPhone();
  const added = await addDoctor(first, { fullName: 'Dr Shared', mobile });
  const again = await addDoctor(second, { fullName: 'Ignored Name', mobile });
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.userId, added.body.userId);
  assert.equal(await db.doctorListing.count({ where: { userId: added.body.userId } }), 1);
  assert.equal((await addDoctor(second, { mobile })).body.code, 'ALREADY_A_MEMBER');

  const rename = await api.patch(`/settings/staff/${added.body.userId}`, { practiceId: second.practiceId, fullName: 'Renamed' }, second.token);
  assert.equal(rename.body.code, 'SHARED_DOCTOR');

  const off = await api.put(`/settings/staff/${added.body.userId}/access`, { practiceId: second.practiceId, isActive: false }, second.token);
  assert.equal(off.status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: added.body.userId } })).isActive, true);
});

test('a clinic owner reaches only their own clinic, and never another owner', async () => {
  const clinic = await newClinic();
  const other = await newClinic();
  const secondOwner = await db.user.create({ data: { fullName: 'Second Owner', role: 'ADMINISTRATOR' } });
  await db.practiceMembership.create({ data: { practiceId: clinic.practiceId, userId: secondOwner.id, role: 'ADMINISTRATOR' } });

  const staff = await api.get(`/settings/staff?practiceId=${clinic.practiceId}`, clinic.token);
  assert.deepEqual(staff.body.filter((m: { role: string }) => m.role === 'ADMINISTRATOR').map((m: { userId: string }) => m.userId), [clinic.ownerId]);

  const path = `/settings/staff/${secondOwner.id}`;
  assert.equal((await api.patch(path, { practiceId: clinic.practiceId, fullName: 'Hacked' }, clinic.token)).status, 403);
  assert.equal((await api.put(`${path}/access`, { practiceId: clinic.practiceId, isActive: false }, clinic.token)).status, 403);

  const newOwner = await addDoctor(clinic, { role: 'ADMINISTRATOR', temporaryPassword: PASSWORD, email: nextEmail() });
  assert.equal(newOwner.status, 403);

  assert.equal((await api.get(`/settings/staff?practiceId=${other.practiceId}`, clinic.token)).status, 403);
  assert.equal((await addDoctor({ token: clinic.token, practiceId: other.practiceId })).status, 403);
  assert.equal((await api.get('/directory/admin/owners', clinic.token)).status, 403);
  assert.equal((await api.post('/directory/admin/doctors', { name: 'X', specialty: 'Y', phone: nextPhone() }, clinic.token)).status, 403);
});

test('a clinic can give a doctor with no login a temporary password later', async () => {
  const clinic = await newClinic();
  const added = await addDoctor(clinic);
  const path = `/settings/staff/${added.body.userId}/login`;
  const body = { practiceId: clinic.practiceId, temporaryPassword: PASSWORD };
  assert.equal((await api.put(path, body, clinic.token)).status, 200);
  assert.equal((await api.put(path, body, clinic.token)).body.code, 'LOGIN_EXISTS');
});

test('only a super admin creates owners, and an owner can also own ambulances and pharmacies', async () => {
  const body = { fullName: 'New Owner', clinicName: 'New Clinic', mobile: nextPhone(), temporaryPassword: PASSWORD };
  const patient = await registerPatient(api);
  assert.equal((await api.post('/directory/admin/owners', body, patient.token)).status, 403);

  const clinic = await newClinic();
  const owner = await db.user.findUniqueOrThrow({ where: { id: clinic.ownerId } });
  const vendor = await api.post('/directory/admin/ambulances', { name: 'Fast Van', phones: ['01711111111'], categories: ['ac'] }, superAdmin.token);
  assert.equal(vendor.status, 201, JSON.stringify(vendor.body));
  const another = await api.post('/directory/admin/ambulances', { name: 'Other Van', phones: ['01711111112'], categories: ['ac'] }, superAdmin.token);

  assert.equal((await api.get('/directory/my-ambulances', clinic.token)).status, 403);
  const granted = await api.post('/directory/admin/roles', { identifier: owner.email, role: 'ambulance_owner', ambulanceVendorId: vendor.body.id }, superAdmin.token);
  assert.equal(granted.status, 201, JSON.stringify(granted.body));
  await api.post('/directory/admin/roles', { identifier: owner.email, role: 'pharmacy_owner' }, superAdmin.token);

  const me = await api.get('/auth/me', clinic.token);
  assert.deepEqual([...me.body.roles].sort(), ['ambulance_owner', 'pharmacy_owner']);

  const mine = await api.get('/directory/my-ambulances', clinic.token);
  assert.deepEqual(mine.body.map((v: { name: string }) => v.name), ['Fast Van']);
  const edit = { name: 'Faster Van', phones: ['01711111111'], categories: ['ac'] };
  assert.equal((await api.patch(`/directory/my-ambulances/${vendor.body.id}`, edit, clinic.token)).status, 200);
  assert.equal((await api.patch(`/directory/my-ambulances/${another.body.id}`, edit, clinic.token)).status, 404);

  assert.equal((await api.post('/directory/admin/roles', { identifier: owner.email, role: 'super_admin' }, superAdmin.token)).status, 400);
});

test('a patient joins several clinics from the website and appears at each', async () => {
  const [first, second] = [await newClinic('Patient First'), await newClinic('Patient Second')];
  const patient = await registerPatient(api);

  const clinics = await api.get('/directory/clinics');
  assert.ok(clinics.body.some((c: { id: string }) => c.id === first.practiceId));

  assert.equal((await api.put(`/directory/my-clinics/${first.practiceId}`, {}, patient.token)).status, 200);
  assert.equal((await api.put(`/directory/my-clinics/${first.practiceId}`, {}, patient.token)).status, 200);
  assert.equal((await api.put(`/directory/my-clinics/${second.practiceId}`, {}, patient.token)).status, 200);
  assert.equal((await api.get('/directory/my-clinics', patient.token)).body.length, 2);

  for (const clinic of [first, second]) {
    const list = await api.get(`/patients?practiceId=${clinic.practiceId}`, clinic.token);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.items.filter((p: { fullName: string }) => p.fullName === 'Test Patient').length, 1);
  }

  // A patient holds no clinic access, so they cannot use Cura Dashboard's data.
  assert.equal((await api.get(`/patients?practiceId=${first.practiceId}`, patient.token)).status, 403);

  // Leaving ends the link; the clinic keeps its record.
  assert.equal((await api.del(`/directory/my-clinics/${second.practiceId}`, patient.token)).status, 200);
  assert.equal((await api.get('/directory/my-clinics', patient.token)).body.length, 1);
  assert.equal(await db.patient.count({ where: { practiceId: second.practiceId, fullName: 'Test Patient' } }), 1);

  const noPhone = await api.post('/auth/register/patient', { name: 'No Phone', email: nextEmail(), password: PASSWORD });
  const refused = await api.put(`/directory/my-clinics/${first.practiceId}`, {}, noPhone.body.accessToken);
  assert.equal(refused.body.code, 'PHONE_REQUIRED');
});

test('ambulance and pharmacy owners manage only their own businesses', async () => {
  const email = nextEmail();
  const account = await registerPatient(api);
  const owner = await db.user.create({ data: { fullName: 'Business Owner', email, role: 'PUBLIC_USER', passwordHash: await db.user.findUniqueOrThrow({ where: { id: account.id } }).then((u) => u.passwordHash) } });
  const login = async () => (await api.post('/auth/login', { identifier: email, password: PASSWORD })).body.session;

  let session = await login();
  assert.deepEqual(session.user.ownerRoles, []);
  assert.equal((await api.get('/directory/my-pharmacies', session.accessToken)).status, 403);
  assert.equal((await api.post('/directory/my-ambulances', {}, session.accessToken)).status, 403);

  for (const role of ['ambulance_owner', 'pharmacy_owner']) {
    await api.post('/directory/admin/roles', { identifier: email, role }, superAdmin.token);
  }
  session = await login();
  assert.deepEqual([...session.user.ownerRoles].sort(), ['ambulance_owner', 'pharmacy_owner']);
  assert.deepEqual(session.user.permissions, []);
  const token = session.accessToken;
  assert.deepEqual((await api.get('/account/profile', token)).body.ownerRoles.sort(), ['ambulance_owner', 'pharmacy_owner']);

  // A new ambulance service waits for a super admin, and never shows who owns it.
  const van = { name: 'Owner Van', phones: '01711111199', categories: ['icu'], fares: { icu: { min: 5000, max: 9000 } } };
  const created = await api.post('/directory/my-ambulances', van, token);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.hidden, true);
  const publicList = async () => (await api.get('/directory/ambulances')).body;
  assert.equal((await publicList()).some((v: { name: string }) => v.name === 'Owner Van'), false);
  await api.patch(`/directory/admin/ambulances/${created.body.id}/hidden`, { hidden: false }, superAdmin.token);
  const shown = (await publicList()).find((v: { name: string }) => v.name === 'Owner Van');
  assert.ok(shown);
  assert.equal('owner_id' in shown, false);

  const edited = await api.patch(`/directory/my-ambulances/${created.body.id}`, { ...created.body, name: 'Owner Van Two' }, token);
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.fares.icu.max, 9000);

  const store = await api.post('/directory/my-pharmacies', { name: 'Owner Pharmacy', phones: '01711111198', home_delivery: true }, token);
  assert.equal(store.status, 201, JSON.stringify(store.body));
  assert.equal(store.body.home_delivery, true);
  assert.equal((await api.post('/directory/my-pharmacies', { name: 'No Phone' }, token)).status, 400);

  // Another owner cannot touch them.
  const otherEmail = nextEmail();
  await db.user.create({ data: { fullName: 'Other', email: otherEmail, role: 'PUBLIC_USER', passwordHash: owner.passwordHash } });
  await api.post('/directory/admin/roles', { identifier: otherEmail, role: 'pharmacy_owner' }, superAdmin.token);
  const other = (await api.post('/auth/login', { identifier: otherEmail, password: PASSWORD })).body.session.accessToken;
  assert.equal((await api.patch(`/directory/my-pharmacies/${store.body.id}`, { name: 'Taken', phones: '017' }, other)).status, 404);
  assert.deepEqual((await api.get('/directory/my-pharmacies', other)).body, []);

  // Owning a business gives no clinic access.
  assert.equal((await api.get('/patients?practiceId=11111111-1111-4111-8111-111111111111', token)).status, 403);
});
