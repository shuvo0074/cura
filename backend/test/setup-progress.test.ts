import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextBmdc, nextEmail, nextPhone } from './harness';

/** The clinic owner's "Get your clinic ready" checklist on Cura Dashboard. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

async function newClinic(name: string) {
  const email = nextEmail();
  const res = await api.post(
    '/directory/admin/owners',
    { fullName: 'Clinic Owner', clinicName: name, mobile: nextPhone(), email, temporaryPassword: PASSWORD },
    superAdmin.token,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  return { token: login.body.session.accessToken as string, practiceId: res.body.clinics[0].id as string };
}

const progress = (clinic: { token: string; practiceId: string }, token = clinic.token) =>
  api.get(`/settings/setup-progress?practiceId=${clinic.practiceId}`, token);

const doneKeys = (body: { steps: Array<{ key: string; done: boolean }> }) =>
  body.steps.filter((s) => s.done).map((s) => s.key);

async function addStaff(clinic: { token: string; practiceId: string }, role: 'DOCTOR' | 'DESK_STAFF') {
  const email = nextEmail();
  const res = await api.post(
    '/settings/staff',
    {
      practiceId: clinic.practiceId,
      fullName: role === 'DOCTOR' ? 'Dr Setup' : 'Front Desk',
      role,
      email,
      mobile: nextPhone(),
      temporaryPassword: PASSWORD,
      ...(role === 'DOCTOR' ? { specialty: 'Medicine', bmdcNumber: nextBmdc() } : {}),
    },
    clinic.token,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  return { userId: res.body.userId as string, email };
}

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, ambulance_vendors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('a brand-new clinic has nothing done', async () => {
  const clinic = await newClinic('Empty Clinic');
  const res = await progress(clinic);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    res.body.steps.map((s: { key: string }) => s.key),
    ['details', 'hours', 'doctor', 'pricing', 'deskStaff', 'firstPatient'],
  );
  assert.deepEqual(doneKeys(res.body), []);
  assert.equal(res.body.steps.find((s: { key: string }) => s.key === 'deskStaff').optional, true);
  assert.deepEqual([res.body.done, res.body.total, res.body.complete], [0, 5, false]);
});

test('a partly set-up clinic shows only the finished steps', async () => {
  const clinic = await newClinic('Partial Clinic');
  // Name and phone come from Super Admin; the address is still missing.
  assert.deepEqual(doneKeys((await progress(clinic)).body), []);
  await api.put('/settings/practice', { practiceId: clinic.practiceId, addressLine1: 'House 1, Road 2' }, clinic.token);
  await api.put(
    '/settings/practice/sessions',
    { practiceId: clinic.practiceId, sessions: [{ dayOfWeek: 0, startTime: '09:00', endTime: '13:00' }] },
    clinic.token,
  );
  const res = await progress(clinic);
  assert.deepEqual(doneKeys(res.body), ['details', 'hours']);
  assert.deepEqual([res.body.done, res.body.complete], [2, false]);
});

test('a fully set-up clinic is complete, and doctors and others are refused', async () => {
  const clinic = await newClinic('Ready Clinic');
  const { practiceId, token } = clinic;
  await api.put('/settings/practice', { practiceId, addressLine1: 'House 3, Road 4' }, token);
  await api.put('/settings/practice/sessions', { practiceId, sessions: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] }, token);
  const doctor = await addStaff(clinic, 'DOCTOR');
  assert.equal((await api.put('/settings/pricing', { practiceId, name: 'Consultation', priceMinor: 50000 }, token)).status, 200);

  // Every required step but the first patient: not complete yet.
  let res = await progress(clinic);
  assert.deepEqual(doneKeys(res.body), ['details', 'hours', 'doctor', 'pricing']);
  assert.equal(res.body.complete, false);

  const patient = await api.post('/patients', { practiceId, fullName: 'First Patient', mobile: nextPhone(), ageYears: 40 }, token);
  assert.equal(patient.status, 201, JSON.stringify(patient.body));
  const start = new Date(Date.now() + 86_400_000);
  start.setUTCHours(4, 0, 0, 0);
  const visit = await api.post(
    '/appointments',
    { practiceId, doctorId: doctor.userId, patientId: patient.body.id, scheduledAt: start.toISOString(), durationMinutes: 10, visitType: 'NEW' },
    token,
  );
  assert.equal(visit.status, 201, JSON.stringify(visit.body));

  res = await progress(clinic);
  assert.deepEqual([res.body.done, res.body.total, res.body.complete], [5, 5, true]);
  // Front desk staff is optional: complete without it, ticked once added.
  assert.equal(doneKeys(res.body).includes('deskStaff'), false);
  const desk = await addStaff(clinic, 'DESK_STAFF');
  assert.deepEqual(doneKeys((await progress(clinic)).body), ['details', 'hours', 'doctor', 'pricing', 'deskStaff', 'firstPatient']);

  // A doctor and clinic staff of this clinic cannot see it.
  for (const member of [doctor, desk]) {
    const login = await api.post('/auth/login', { identifier: member.email, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal((await progress(clinic, login.body.session.accessToken)).status, 403);
  }

  // Another clinic's owner cannot, nor can a super admin reading the clinic.
  const other = await newClinic('Other Clinic');
  assert.equal((await progress(clinic, other.token)).status, 403);
  assert.equal((await progress(clinic, superAdmin.token)).status, 403);
});

test('a clinic owner who is a doctor counts as the clinic doctor', async () => {
  const clinic = await newClinic('Owner Doctor Clinic');
  const membership = await db.practiceMembership.findFirstOrThrow({ where: { practiceId: clinic.practiceId } });
  await db.user.update({ where: { id: membership.userId }, data: { bmdcNumber: nextBmdc() } });
  assert.deepEqual(doneKeys((await progress(clinic)).body), ['doctor']);
});
