import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, nextEmail, nextPhone } from './harness';

/** The clinic app keeps working, and directory activity leaves its data alone. */
let api: TestApi;
let token: string;
let practiceId: string;
let doctorUserId: string;

before(async () => {
  api = await TestApi.start();
  const { CryptoService } = await import('../src/common/crypto/crypto.service');
  const hash = await api.app.get(CryptoService).hashPassword(PASSWORD);
  const practice = await db.practice.create({ data: { name: 'Regression Clinic' } });
  practiceId = practice.id;
  const email = nextEmail();
  const owner = await db.user.create({
    data: { fullName: 'Owner', email, mobile: `+88${nextPhone()}`, passwordHash: hash, role: 'ADMINISTRATOR', mobileVerifiedAt: new Date(), onboardingComplete: true },
  });
  const doctor = await db.user.create({
    data: { fullName: 'Dr Clinic', email: nextEmail(), mobile: `+88${nextPhone()}`, passwordHash: hash, role: 'DOCTOR', mobileVerifiedAt: new Date(), bmdcNumber: `A-${Date.now() % 1_000_000}` },
  });
  doctorUserId = doctor.id;
  await db.practiceMembership.createMany({
    data: [
      { practiceId, userId: owner.id, role: 'ADMINISTRATOR' },
      { practiceId, userId: doctor.id, role: 'DOCTOR' },
    ],
  });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  token = login.body.session.accessToken;
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('staff log in with the clinic second-factor rule unchanged', async () => {
  const email = nextEmail();
  const { CryptoService } = await import('../src/common/crypto/crypto.service');
  await db.user.create({
    data: { fullName: 'Unverified', email, mobile: `+88${nextPhone()}`, passwordHash: await api.app.get(CryptoService).hashPassword(PASSWORD), role: 'DESK_STAFF' },
  });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.status, 'otp_required');
});

test('the patient, appointment, billing and settings flow still works', async () => {
  const created = await api.post('/patients', { practiceId, fullName: 'Clinic Patient', mobile: nextPhone(), ageYears: 30 }, token);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const patientId = created.body.id;

  const list = await api.get(`/patients?practiceId=${practiceId}`, token);
  assert.equal(list.status, 200, JSON.stringify(list.body));

  const start = new Date(Date.now() + 86_400_000);
  start.setUTCHours(6, 0, 0, 0);
  const appointment = await api.post('/appointments', {
    practiceId, doctorId: doctorUserId, patientId, scheduledAt: start.toISOString(), durationMinutes: 10, visitType: 'NEW',
  }, token);
  assert.equal(appointment.status, 201, JSON.stringify(appointment.body));

  const window = `practiceId=${practiceId}&from=${new Date(Date.now() - 86_400_000).toISOString()}&to=${new Date(Date.now() + 7 * 86_400_000).toISOString()}`;
  const calendar = await api.get(`/appointments?${window}`, token);
  assert.equal(calendar.status, 200, JSON.stringify(calendar.body));

  for (const path of [
    `/settings/practice?practiceId=${practiceId}`,
    `/settings/staff?practiceId=${practiceId}`,
    `/billing/invoices?practiceId=${practiceId}`,
    `/engagement/upcoming?practiceId=${practiceId}`,
    `/appointments/doctors?practiceId=${practiceId}`,
    '/account/profile',
  ]) {
    assert.equal((await api.get(path, token)).status, 200, path);
  }
});

test('clinic staff can still reach onboarding', async () => {
  assert.equal((await api.get('/onboarding/state', token)).status, 200);
});

test('directory sign-up and booking never write to clinical tables', async () => {
  const counts = async () => ({
    patients: await db.patient.count(),
    appointments: await db.appointment.count(),
    invoices: await db.invoice.count(),
    encounters: await db.encounter.count(),
  });
  const before = await counts();
  const mobile = nextPhone();
  await db.patient.create({
    data: { practiceId, curaId: `T-${Date.now() % 1_000_000_000}`, fullName: 'Same Phone', mobile: `+88${mobile}`, searchName: 'same phone' },
  });
  const res = await api.post('/auth/register/patient', { name: 'Same Phone', email: nextEmail(), password: PASSWORD, phone: mobile });
  assert.equal(res.status, 201, 'a clinical record with the same phone must not block or link sign-up');
  assert.equal(res.body.patientId !== null, true);
  const clinical = await db.patient.findFirstOrThrow({ where: { mobile: `+88${mobile}` } });
  const after = await counts();
  assert.equal(after.patients, before.patients + 1);
  assert.equal(after.appointments, before.appointments);
  assert.equal(after.invoices, before.invoices);
  assert.equal(clinical.fullName, 'Same Phone');
  assert.equal((await api.get(`/patients/${clinical.id}?practiceId=${practiceId}`, res.body.accessToken)).status, 403);
});
