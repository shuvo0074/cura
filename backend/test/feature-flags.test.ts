import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { TestApi, dateAhead, db, directoryAdmin, nextEmail, registerPatient, PASSWORD } from './harness';

/** Booking switched off, and rate limits on as in a production deploy. */
let api: TestApi;

before(async () => {
  api = await TestApi.start({ DIRECTORY_BOOKING_ENABLED: 'false', THROTTLE_DISABLED: 'false' });
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('booking is refused while switched off, and sessions say so', async () => {
  const admin = await directoryAdmin(api);
  const session = '08:00 AM - 11:00 AM';
  const doctor = (await api.post('/directory/admin/doctors', {
    name: 'Dr. Call Only', specialty: 'ENT', weeklySchedule: [{ venue: 'V', time: session }],
  }, admin.token)).body;
  const date = dateAhead(1, (day) => day !== 5);
  const res = await api.post('/directory/appointments', { doctorId: doctor.id, date, venue: 'V', session }, admin.token);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'BOOKING_DISABLED');
  const sessions = (await api.get(`/directory/doctors/${doctor.id}/sessions?date=${date}`)).body;
  assert.equal(sessions.sessions[0].bookable, false);
  assert.equal(sessions.sessions[0].reasonCode, 'BOOKING_DISABLED');
  assert.deepEqual((await api.get('/directory/appointments/me', admin.token)).body, []);
});

test('there are no OTP login or mock OTP routes', async () => {
  assert.equal((await api.post('/auth/otp/request', { phone: '01711111111' })).status, 404);
  assert.equal((await api.post('/auth/otp/verify', { phone: '01711111111', code: '123456' })).status, 404);
});

test('rate limits answer 429 with Retry-After, using shared storage', async () => {
  const doctor = await db.doctorListing.create({ data: { name: 'Dr. Limited', specialty: 'ENT' } });
  let last = await api.call('POST', `/directory/doctors/${doctor.id}/share`);
  for (let i = 0; i < 130 && last.status !== 429; i += 1) {
    last = await api.call('POST', `/directory/doctors/${doctor.id}/share`);
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'RATE_LIMITED');
  assert.ok(Number(last.headers.get('retry-after')) > 0);
});

test('sign-up is limited per address', async () => {
  let last = await registerPatient(api).then(() => 201).catch(() => 429);
  for (let i = 0; i < 12 && last !== 429; i += 1) {
    last = (await api.post('/auth/register/patient', { name: 'Limit Me', email: nextEmail(), password: PASSWORD })).status;
  }
  assert.equal(last, 429);
});
