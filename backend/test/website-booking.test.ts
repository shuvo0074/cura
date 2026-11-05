import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, dateAhead, db, directoryAdmin, nextEmail, nextPhone, registerPatient } from './harness';

/** A booking made on Cura Website reaches the clinic's calendar, and both stay in step. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

const SESSION = '10:00 AM - 02:00 PM';
// Dhaka is UTC+6, so 10:00 there is 04:00 UTC.
const at = (date: string, time: string) => new Date(`${date}T${time}:00.000Z`).toISOString();

async function clinicWithDoctor(name: string, doctorName = 'Dr Clinic') {
  const email = nextEmail();
  const res = await api.post(
    '/directory/admin/owners',
    { fullName: 'Clinic Owner', clinicName: name, mobile: nextPhone(), email, temporaryPassword: PASSWORD },
    superAdmin.token,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  const clinic = { token: login.body.session.accessToken as string, practiceId: res.body.clinics[0].id as string };
  await db.practice.update({ where: { id: clinic.practiceId }, data: { slotMinutes: 15 } });

  const added = await api.post(
    '/settings/staff',
    { practiceId: clinic.practiceId, fullName: doctorName, role: 'DOCTOR', mobile: nextPhone(), specialty: 'ENT' },
    clinic.token,
  );
  assert.equal(added.status, 201, JSON.stringify(added.body));
  const userId = added.body.userId as string;
  const listing = await db.doctorListing.update({
    where: { userId },
    data: { weeklySchedule: [{ venue: name, time: SESSION }, { venue: 'Somewhere Else Hospital', time: '06:00 PM - 08:00 PM', hospital_id: '00000000-0000-0000-0000-000000000001' }] },
  });
  return { ...clinic, doctorUserId: userId, doctorId: listing.id };
}

const book = (token: string, doctorId: string, date: string, venue: string, session = SESSION, notes?: string) =>
  api.post('/directory/appointments', { doctorId, date, venue, session, notes }, token);

const calendar = async (clinic: { token: string; practiceId: string }, date: string) => {
  const from = `${date}T00:00:00.000Z`;
  const to = new Date(Date.parse(from) + 86_400_000).toISOString();
  const res = await api.get(`/appointments?practiceId=${clinic.practiceId}&from=${from}&to=${to}&includeCancelled=true`, clinic.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body as Array<Record<string, any>>;
};

const myBooking = async (token: string, id: string) =>
  (await api.get('/directory/appointments/me', token)).body.find((b: { id: string }) => b.id === id);

before(async () => {
  api = await TestApi.start({ DIRECTORY_BOOKING_ENABLED: 'true' });
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('a booking at a clinic on Cura puts an appointment in that clinic’s calendar', async () => {
  const clinic = await clinicWithDoctor('Website Clinic One');
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);

  const res = await book(patient.token, clinic.doctorId, date, 'Website Clinic One', SESSION, 'Back pain');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.clinic_status, 'sent');
  assert.equal(res.body.clinic_name, 'Website Clinic One');
  assert.equal('appointment_id' in res.body, false);

  const [appointment] = await calendar(clinic, date);
  assert.ok(appointment);
  assert.equal(appointment.doctorId, clinic.doctorUserId);
  assert.equal(appointment.status, 'SCHEDULED');
  assert.equal(appointment.durationMinutes, 15);
  assert.equal(new Date(appointment.scheduledAt).toISOString(), at(date, '04:00'));
  assert.match(appointment.notes, /^Booked on Cura Website: serial #1, 10:00 AM - 02:00 PM\. Reason: Back pain$/);

  // The patient's own record at the clinic, linked to their account, as if they had joined.
  const record = await db.patient.findUniqueOrThrow({ where: { id: appointment.patient.id } });
  const account = await db.patientAccount.findUniqueOrThrow({ where: { userId: patient.id } });
  assert.equal(record.accountId, account.id);
  assert.equal(record.mobile.replace(/\D/g, '').slice(-10), patient.phone.slice(-10));
  const clinics = (await api.get('/directory/my-clinics', patient.token)).body;
  assert.ok(clinics.some((c: { id: string }) => c.id === clinic.practiceId), JSON.stringify(clinics));
  const link = await db.serialBooking.findUniqueOrThrow({ where: { id: res.body.id } });
  assert.equal(link.appointmentId, appointment.id);

  // A second patient gets serial 2, one slot later. The clinic record is reused on a second visit.
  const second = await registerPatient(api);
  assert.equal((await book(second.token, clinic.doctorId, date, 'Website Clinic One')).body.clinic_status, 'sent');
  const later = dateAhead(3, (day) => day !== 5);
  assert.equal((await book(patient.token, clinic.doctorId, later, 'Website Clinic One')).body.clinic_status, 'sent');
  assert.equal(await db.patient.count({ where: { practiceId: clinic.practiceId, accountId: record.accountId } }), 1);
  const times = (await calendar(clinic, date)).map((a) => new Date(a.scheduledAt).toISOString());
  assert.deepEqual(times, [at(date, '04:00'), at(date, '04:15')]);
});

test('a taken slot moves the visit to the next free one in the session', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Busy');
  const date = dateAhead(2, (day) => day !== 5);
  // The desk has already booked 10:00 for this doctor.
  const desk = await api.post(
    '/appointments',
    {
      practiceId: clinic.practiceId,
      doctorId: clinic.doctorUserId,
      scheduledAt: at(date, '04:00'),
      durationMinutes: 15,
      patient: { fullName: 'Walk In', mobile: nextPhone(), ageYears: 30 },
    },
    clinic.token,
  );
  assert.equal(desk.status, 201, JSON.stringify(desk.body));

  const patient = await registerPatient(api);
  assert.equal((await book(patient.token, clinic.doctorId, date, 'Website Clinic Busy')).body.clinic_status, 'sent');
  const web = (await calendar(clinic, date)).find((a) => a.notes?.startsWith('Booked on Cura Website'));
  assert.equal(new Date(web!.scheduledAt).toISOString(), at(date, '04:15'));
});

test('cancelling on Cura Website cancels the clinic appointment', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Two');
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  const booked = (await book(patient.token, clinic.doctorId, date, 'Website Clinic Two')).body;

  const cancelled = await api.patch(`/directory/appointments/${booked.id}/cancel`, {}, patient.token);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  const [appointment] = await calendar(clinic, date);
  assert.equal(appointment!.status, 'CANCELLED');
  const audit = await db.auditLog.findFirst({ where: { resourceId: appointment!.id, action: 'appointment.status.cancelled' } });
  assert.equal(audit?.actorUserId, patient.id);
});

test('cancelling on Cura Dashboard cancels the website booking', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Three');
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  const booked = (await book(patient.token, clinic.doctorId, date, 'Website Clinic Three')).body;
  const [appointment] = await calendar(clinic, date);

  const res = await api.patch(`/appointments/${appointment!.id}/status`, { status: 'CANCELLED' }, clinic.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await myBooking(patient.token, booked.id)).status, 'cancelled');
  // Already cancelled, so the patient cannot cancel it again.
  assert.equal((await api.patch(`/directory/appointments/${booked.id}/cancel`, {}, patient.token)).status, 404);
});

test('a no-show on Cura Dashboard ends the website booking as cancelled', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Four');
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  const booked = (await book(patient.token, clinic.doctorId, date, 'Website Clinic Four')).body;
  const [appointment] = await calendar(clinic, date);

  assert.equal((await api.patch(`/appointments/${appointment!.id}/status`, { status: 'NO_SHOW' }, clinic.token)).status, 200);
  assert.equal((await myBooking(patient.token, booked.id)).status, 'cancelled');
});

test('completing the visit on Cura Dashboard completes the booking, so the patient can review', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Five');
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  const booked = (await book(patient.token, clinic.doctorId, date, 'Website Clinic Five')).body;
  const [appointment] = await calendar(clinic, date);

  for (const status of ['WAITING', 'ENGAGED']) {
    assert.equal((await api.patch(`/appointments/${appointment!.id}/status`, { status }, clinic.token)).status, 200);
    assert.equal((await myBooking(patient.token, booked.id)).status, 'confirmed');
  }
  assert.equal((await api.patch(`/appointments/${appointment!.id}/status`, { status: 'DONE' }, clinic.token)).status, 200);
  assert.equal((await myBooking(patient.token, booked.id)).status, 'completed');

  const review = await api.post(`/directory/appointments/${booked.id}/review`, { rating: 5, comment: 'Kind doctor' }, patient.token);
  assert.equal(review.status, 201, JSON.stringify(review.body));
  // Cancelling a completed booking changes nothing on either side.
  assert.equal((await api.patch(`/directory/appointments/${booked.id}/cancel`, {}, patient.token)).status, 404);
  assert.equal((await calendar(clinic, date))[0]!.status, 'DONE');
});

test('a doctor with no clinic on Cura, or a hospital session, stays a website-only booking', async () => {
  const listed = await api.post(
    '/directory/admin/doctors',
    { name: 'Dr Chamber Only', specialty: 'ENT', phone: nextPhone(), weeklySchedule: [{ venue: 'Private Chamber', time: SESSION }] },
    superAdmin.token,
  );
  assert.equal(listed.status, 201, JSON.stringify(listed.body));
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  const res = await book(patient.token, listed.body.id, date, 'Private Chamber');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.clinic_status, 'website_only');
  assert.equal((await db.serialBooking.findUniqueOrThrow({ where: { id: res.body.id } })).appointmentId, null);
  assert.equal((await api.patch(`/directory/appointments/${res.body.id}/cancel`, {}, patient.token)).status, 200);

  // A clinic doctor's session at a listed hospital is not the clinic's.
  const clinic = await clinicWithDoctor('Website Clinic Six');
  const hospital = await book(patient.token, clinic.doctorId, date, 'Somewhere Else Hospital', '06:00 PM - 08:00 PM');
  assert.equal(hospital.status, 201, JSON.stringify(hospital.body));
  assert.equal(hospital.body.clinic_status, 'website_only');
  assert.deepEqual(await calendar(clinic, date), []);
});

test('a patient with no mobile number still books, but only on Cura Website', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Seven');
  const patient = await registerPatient(api);
  await db.user.update({ where: { id: patient.id }, data: { mobile: null } });
  const date = dateAhead(2, (day) => day !== 5);

  const res = await book(patient.token, clinic.doctorId, date, 'Website Clinic Seven');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.clinic_status, 'phone_required');
  assert.equal(res.body.clinic_name, 'Website Clinic Seven');
  assert.deepEqual(await calendar(clinic, date), []);
  assert.equal(await db.patient.count({ where: { practiceId: clinic.practiceId } }), 0);
});

test('a single-clinic doctor whose venue name differs is still booked at their clinic', async () => {
  const clinic = await clinicWithDoctor('Website Clinic Eight');
  await db.doctorListing.update({ where: { id: clinic.doctorId }, data: { weeklySchedule: [{ venue: 'Old Clinic Name', time: SESSION }] } });
  const patient = await registerPatient(api);
  const date = dateAhead(2, (day) => day !== 5);
  assert.equal((await book(patient.token, clinic.doctorId, date, 'Old Clinic Name')).body.clinic_status, 'sent');
  assert.equal((await calendar(clinic, date)).length, 1);
});
