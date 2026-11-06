import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { TestApi, db, registerDoctor, registerPatient } from './harness';

/** "My health": a patient reads their own signed clinic records on Cura Website. */
let api: TestApi;

const DAY = 86_400_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

before(async () => {
  api = await TestApi.start();
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

async function clinic(name: string, hideCancelledInvoices = false) {
  return db.practice.create({ data: { name, hideCancelledInvoices } });
}

async function doctor(name: string) {
  return db.user.create({ data: { fullName: name, role: 'DOCTOR' } });
}

/** Joins the clinic through the website and returns the clinic's patient record. */
async function join(patient: { id: string; token: string }, practiceId: string) {
  const res = await api.put(`/directory/my-clinics/${practiceId}`, {}, patient.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const account = await db.patientAccount.findUniqueOrThrow({ where: { userId: patient.id } });
  return db.patient.findFirstOrThrow({ where: { practiceId, accountId: account.id } });
}

async function visit(input: {
  patientId: string;
  doctorId: string;
  occurredAt: Date;
  signed: boolean;
  diagnosis: string;
  withPrescription?: boolean;
}) {
  return db.encounter.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      occurredAt: input.occurredAt,
      signedAt: input.signed ? input.occurredAt : null,
      vitals: { create: { weightKg: 64.5, systolic: 120, diastolic: 80, pulseBpm: 72, temperatureC: 37.1 } },
      clinicalNote: {
        create: {
          complaints: ['Fever'],
          observations: ['Observation for staff'],
          diagnoses: [input.diagnosis],
          advice: ['Drink water'],
          notes: 'Private note for staff',
        },
      },
      ...(input.withPrescription
        ? {
            prescription: {
              create: {
                investigations: ['CBC'],
                followUpDate: new Date('2026-12-20'),
                signedAt: input.signed ? input.occurredAt : null,
                items: {
                  create: [
                    { position: 0, drugName: 'Napa', strength: '500 mg', form: 'Tab', morning: 1, noon: 0, night: 1, mealRelation: 'AFTER', durationDays: 5 },
                  ],
                },
              },
            },
          }
        : {}),
    },
  });
}

async function invoice(input: { practiceId: string; patientId: string; number: string; status: string; totalMinor: number; paidMinor?: number }) {
  return db.invoice.create({
    data: {
      practiceId: input.practiceId,
      patientId: input.patientId,
      number: input.number,
      status: input.status as never,
      subtotalMinor: input.totalMinor,
      totalMinor: input.totalMinor,
      paidMinor: input.paidMinor ?? 0,
      notes: 'Invoice note for staff',
      issuedAt: input.status === 'DRAFT' ? null : new Date(),
      items: { create: [{ description: 'Consultation', quantity: 1, unitMinor: input.totalMinor, totalMinor: input.totalMinor }] },
    },
  });
}

async function appointment(input: { practiceId: string; patientId: string; doctorId: string; at: Date; status?: string }) {
  return db.appointment.create({
    data: {
      practiceId: input.practiceId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      scheduledAt: input.at,
      endsAt: new Date(input.at.getTime() + 15 * 60_000),
      durationMinutes: 15,
      status: (input.status ?? 'SCHEDULED') as never,
      notes: 'Appointment note for staff',
    },
  });
}

test('a patient sees only their own signed records across the clinics they joined', async () => {
  const [first, second] = [await clinic('Health Clinic One'), await clinic('Health Clinic Two', true)];
  const drOne = await doctor('Dr Health One');
  const drTwo = await doctor('Dr Health Two');

  const patient = await registerPatient(api);
  const other = await registerPatient(api);
  const atFirst = await join(patient, first.id);
  const atSecond = await join(patient, second.id);
  const otherAtFirst = await join(other, first.id);

  const signed = await visit({ patientId: atFirst.id, doctorId: drOne.id, occurredAt: daysFromNow(-2), signed: true, diagnosis: 'Viral fever', withPrescription: true });
  await visit({ patientId: atFirst.id, doctorId: drOne.id, occurredAt: daysFromNow(-1), signed: false, diagnosis: 'Draft diagnosis', withPrescription: true });
  // Older than the clinics' 90-day window: the patient still sees their own history.
  const old = await visit({ patientId: atFirst.id, doctorId: drOne.id, occurredAt: daysFromNow(-200), signed: true, diagnosis: 'Old sprain' });
  const atTwo = await visit({ patientId: atSecond.id, doctorId: drTwo.id, occurredAt: daysFromNow(-5), signed: true, diagnosis: 'Migraine' });
  await visit({ patientId: otherAtFirst.id, doctorId: drOne.id, occurredAt: daysFromNow(-3), signed: true, diagnosis: 'Someone else' });

  await invoice({ practiceId: first.id, patientId: atFirst.id, number: 'HC1-1', status: 'PARTIALLY_PAID', totalMinor: 100_000, paidMinor: 50_000 });
  await invoice({ practiceId: first.id, patientId: atFirst.id, number: 'HC1-2', status: 'DRAFT', totalMinor: 20_000 });
  await invoice({ practiceId: first.id, patientId: atFirst.id, number: 'HC1-3', status: 'CANCELLED', totalMinor: 30_000 });
  await invoice({ practiceId: second.id, patientId: atSecond.id, number: 'HC2-1', status: 'PAID', totalMinor: 70_000, paidMinor: 70_000 });
  await invoice({ practiceId: second.id, patientId: atSecond.id, number: 'HC2-2', status: 'CANCELLED', totalMinor: 10_000 });
  await invoice({ practiceId: first.id, patientId: otherAtFirst.id, number: 'HC1-9', status: 'ISSUED', totalMinor: 99_000 });

  const soon = await appointment({ practiceId: first.id, patientId: atFirst.id, doctorId: drOne.id, at: daysFromNow(3) });
  const later = await appointment({ practiceId: second.id, patientId: atSecond.id, doctorId: drTwo.id, at: daysFromNow(10) });
  await appointment({ practiceId: first.id, patientId: atFirst.id, doctorId: drOne.id, at: daysFromNow(4), status: 'CANCELLED' });
  await appointment({ practiceId: first.id, patientId: atFirst.id, doctorId: drOne.id, at: daysFromNow(-4), status: 'DONE' });
  await appointment({ practiceId: first.id, patientId: otherAtFirst.id, doctorId: drOne.id, at: daysFromNow(2) });
  // Today's visit, opened by the clinic owner and signed: it shows under the
  // booked doctor, and its appointment is no longer upcoming.
  const owner = await doctor('Clinic Owner');
  const today = await appointment({ practiceId: first.id, patientId: atFirst.id, doctorId: drOne.id, at: new Date(Date.now() + 5 * 60_000) });
  const todayVisit = await visit({ patientId: atFirst.id, doctorId: owner.id, occurredAt: new Date(), signed: true, diagnosis: 'Today' });
  await db.encounter.update({ where: { id: todayVisit.id }, data: { appointmentId: today.id } });

  const res = await api.get('/directory/my-health', patient.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const body = res.body;

  // Signed visits only, newest first, across both clinics.
  assert.deepEqual(body.visits.map((v: { id: string }) => v.id), [todayVisit.id, signed.id, atTwo.id, old.id]);
  assert.equal(body.visits[0].doctor_name, 'Dr Health One');
  const latest = body.visits[1];
  assert.equal(latest.clinic_name, 'Health Clinic One');
  assert.equal(latest.doctor_name, 'Dr Health One');
  assert.deepEqual(latest.complaints, ['Fever']);
  assert.deepEqual(latest.diagnoses, ['Viral fever']);
  assert.deepEqual(latest.advice, ['Drink water']);
  assert.deepEqual(latest.vitals, { weight_kg: 64.5, systolic: 120, diastolic: 80, pulse_bpm: 72, temperature_c: 37.1 });
  assert.deepEqual(latest.prescription, {
    investigations: ['CBC'],
    follow_up_date: '2026-12-20',
    items: [{ drug_name: 'Napa', form: 'Tab', strength: '500 mg', morning: 1, noon: 0, night: 1, meal_relation: 'after', duration_days: 5, instruction: null }],
  });
  assert.equal(body.visits[2].prescription, null);

  // Drafts never appear; cancelled shows only where the clinic shows cancelled invoices.
  const invoices = Object.fromEntries(body.invoices.map((i: { number: string }) => [i.number, i]));
  assert.deepEqual(Object.keys(invoices).sort(), ['HC1-1', 'HC1-3', 'HC2-1']);
  assert.equal(invoices['HC1-1'].status, 'partially_paid');
  assert.equal(invoices['HC1-1'].total_minor, 100_000);
  assert.equal(invoices['HC1-1'].paid_minor, 50_000);
  assert.equal(invoices['HC1-1'].clinic_name, 'Health Clinic One');
  assert.deepEqual(invoices['HC1-1'].items, [{ description: 'Consultation', quantity: 1, total_minor: 100_000 }]);
  assert.equal(invoices['HC1-3'].status, 'cancelled');

  // Upcoming calendar appointments, soonest first, never cancelled or past ones.
  assert.deepEqual(body.upcoming_appointments.map((a: { id: string }) => a.id), [soon.id, later.id]);
  assert.equal(body.upcoming_appointments[0].doctor_name, 'Dr Health One');
  assert.equal(body.upcoming_appointments[0].clinic_name, 'Health Clinic One');

  // Staff-only fields and other people's records never leave the API.
  const text = JSON.stringify(body);
  for (const hidden of ['Draft diagnosis', 'Someone else', 'HC1-9', 'Private note for staff', 'Observation for staff', 'Invoice note for staff', 'Appointment note for staff', atFirst.id, otherAtFirst.id]) {
    assert.equal(text.includes(hidden), false, `leaked ${hidden}`);
  }

  // The other patient sees only theirs.
  const theirs = (await api.get('/directory/my-health', other.token)).body;
  assert.deepEqual(theirs.visits.map((v: { diagnoses: string[] }) => v.diagnoses[0]), ['Someone else']);
  assert.deepEqual(theirs.invoices.map((i: { number: string }) => i.number), ['HC1-9']);
  assert.equal(theirs.upcoming_appointments.length, 1);

  // Query strings cannot choose whose records load.
  const sneaky = await api.get(`/directory/my-health?patientId=${otherAtFirst.id}&practiceId=${first.id}`, patient.token);
  assert.deepEqual(sneaky.body, body);

  // Leaving a clinic hides its records; the clinic keeps them.
  assert.equal((await api.del(`/directory/my-clinics/${second.id}`, patient.token)).status, 200);
  const afterLeaving = (await api.get('/directory/my-health', patient.token)).body;
  assert.deepEqual(afterLeaving.visits.map((v: { id: string }) => v.id), [todayVisit.id, signed.id, old.id]);
  assert.deepEqual(afterLeaving.invoices.map((i: { number: string }) => i.number).sort(), ['HC1-1', 'HC1-3']);
  assert.deepEqual(afterLeaving.upcoming_appointments.map((a: { id: string }) => a.id), [soon.id]);
  assert.equal(await db.encounter.count({ where: { patientId: atSecond.id } }), 1);
});

test('a patient who joined no clinic sees empty lists', async () => {
  const patient = await registerPatient(api);
  const res = await api.get('/directory/my-health', patient.token);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { visits: [], invoices: [], upcoming_appointments: [] });
});

test('only signed-in patients can open My health', async () => {
  assert.equal((await api.get('/directory/my-health')).status, 401);
  const doctorAccount = await registerDoctor(api);
  assert.equal((await api.get('/directory/my-health', doctorAccount.token)).status, 403);
});
