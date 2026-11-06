import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail, registerPatient } from './harness';

/** Pharmacy stock lists, and prescriptions patients send to a pharmacy to collect. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

const MISSING = '00000000-0000-4000-8000-000000000000';

async function pharmacyOwner(name: string) {
  const email = nextEmail();
  const res = await api.post('/directory/admin/users', { fullName: name, email, temporaryPassword: PASSWORD }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await api.put(`/directory/admin/users/${res.body.id}/roles/pharmacy_owner`, {}, superAdmin.token);
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { id: res.body.id as string, token: login.body.session.accessToken as string };
}

/** A super admin's pharmacy is visible at once. */
async function pharmacy(ownerId: string, name: string) {
  const res = await api.post('/directory/admin/pharmacies', { owner_id: ownerId, name, phones: '01711113333' }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id as string;
}

/** A patient who joined a clinic, with one signed prescription there. */
async function patientWithPrescription(clinicName: string, opts: { signed?: boolean } = {}) {
  const patient = await registerPatient(api);
  const practice = await db.practice.create({ data: { name: clinicName } });
  const doctor = await db.user.create({ data: { fullName: 'Dr Rx Writer', role: 'DOCTOR' } });
  const joined = await api.put(`/directory/my-clinics/${practice.id}`, {}, patient.token);
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  const account = await db.patientAccount.findUniqueOrThrow({ where: { userId: patient.id } });
  const record = await db.patient.findFirstOrThrow({ where: { practiceId: practice.id, accountId: account.id } });
  const signedAt = opts.signed === false ? null : new Date();
  const encounter = await db.encounter.create({
    data: {
      patientId: record.id,
      doctorId: doctor.id,
      occurredAt: new Date(),
      signedAt,
      clinicalNote: { create: { complaints: ['Secret complaint'], diagnoses: ['Secret diagnosis'], notes: 'Private note' } },
      prescription: {
        create: {
          investigations: ['Secret test'],
          signedAt,
          items: {
            create: [
              { position: 0, drugName: 'Napa', strength: '500 mg', form: 'Tab', morning: 1, noon: 0, night: 1, mealRelation: 'AFTER', durationDays: 5 },
              { position: 1, drugName: 'Seclo', strength: '20 mg', form: 'Cap', morning: 1, noon: 0, night: 0, mealRelation: 'BEFORE' },
            ],
          },
        },
      },
    },
    include: { prescription: true },
  });
  return { ...patient, prescriptionId: encounter.prescription!.id, practiceId: practice.id, recordId: record.id };
}

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE pharmacies, pharmacy_orders, pharmacy_stock_items CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('only the owner changes a pharmacy stock list; patients see in-stock items', async () => {
  const owner = await pharmacyOwner('Stock Owner');
  const rival = await pharmacyOwner('Rival Owner');
  const id = await pharmacy(owner.id, 'Stock Pharmacy');
  const base = `/directory/my-pharmacies/${id}/stock`;

  const napa = await api.post(base, { name: '  Napa ', strength: '500 mg', form: 'Tablet', price: '1.20' }, owner.token);
  assert.equal(napa.status, 201, JSON.stringify(napa.body));
  assert.equal(napa.body.name, 'Napa');
  assert.equal(napa.body.price, 1.2);
  assert.equal(napa.body.in_stock, true);
  const ace = await api.post(base, { name: 'Ace', in_stock: false }, owner.token);
  assert.equal(ace.status, 201);
  assert.equal(ace.body.price, null);

  // Bad input.
  assert.equal((await api.post(base, { name: '' }, owner.token)).status, 400);
  assert.equal((await api.post(base, { name: 'X', price: -1 }, owner.token)).status, 400);
  assert.equal((await api.post(base, { name: 'X', price: 'abc' }, owner.token)).status, 400);
  assert.equal((await api.post(base, { name: 'X', in_stock: 'yes' }, owner.token)).status, 400);

  // The owner sees everything; patients see only what is in stock.
  const mine = await api.get(base, owner.token);
  assert.deepEqual(mine.body.map((i: { name: string }) => i.name), ['Ace', 'Napa']);
  let open = await api.get(`/directory/pharmacies/${id}/stock`);
  assert.equal(open.status, 200);
  assert.deepEqual(open.body, [{ id: napa.body.id, name: 'Napa', strength: '500 mg', form: 'Tablet', price: 1.2 }]);

  const edited = await api.patch(`${base}/${ace.body.id}`, { name: 'Ace Plus', in_stock: true, price: 3 }, owner.token);
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  open = await api.get(`/directory/pharmacies/${id}/stock`);
  assert.deepEqual(open.body.map((i: { name: string }) => i.name), ['Ace Plus', 'Napa']);

  // Another owner, a patient, a super admin and nobody at all are kept out.
  const patient = await registerPatient(api);
  for (const token of [rival.token, patient.token, superAdmin.token]) {
    const read = await api.get(base, token);
    const write = await api.post(base, { name: 'Intruder' }, token);
    const change = await api.patch(`${base}/${napa.body.id}`, { name: 'Hacked' }, token);
    const remove = await api.del(`${base}/${napa.body.id}`, token);
    for (const res of [read, write, change, remove]) assert.ok([403, 404].includes(res.status), String(res.status));
  }
  assert.equal((await api.get(base)).status, 401);
  // An item id from another pharmacy does not work through the owner's own pharmacy.
  const rivalPharmacy = await pharmacy(rival.id, 'Rival Pharmacy');
  const rivalItem = await api.post(`/directory/my-pharmacies/${rivalPharmacy}/stock`, { name: 'Rival med' }, rival.token);
  assert.equal((await api.patch(`${base}/${rivalItem.body.id}`, { name: 'Taken' }, owner.token)).status, 404);
  assert.equal((await api.del(`${base}/${rivalItem.body.id}`, owner.token)).status, 404);

  const removed = await api.del(`${base}/${ace.body.id}`, owner.token);
  assert.equal(removed.status, 200);
  assert.equal((await api.del(`${base}/${ace.body.id}`, owner.token)).status, 404);
  assert.deepEqual((await api.get(base, owner.token)).body.map((i: { name: string }) => i.name), ['Napa']);
  assert.equal((await db.pharmacyStockItem.findFirstOrThrow({ where: { id: napa.body.id } })).name, 'Napa');

  // A hidden pharmacy's list is not public.
  await api.patch(`/directory/admin/pharmacies/${id}/hidden`, { hidden: true }, superAdmin.token);
  assert.equal((await api.get(`/directory/pharmacies/${id}/stock`)).status, 404);
  assert.equal((await api.get(`/directory/pharmacies/${MISSING}/stock`)).status, 404);
  assert.equal((await api.get('/directory/pharmacies/not-a-uuid/stock')).status, 404);
});

test('a patient sends only their own signed prescription, only to a visible pharmacy', async () => {
  const owner = await pharmacyOwner('Order Owner');
  const visible = await pharmacy(owner.id, 'Visible Pharmacy');
  const hidden = await pharmacy(owner.id, 'Hidden Pharmacy');
  await api.patch(`/directory/admin/pharmacies/${hidden}/hidden`, { hidden: true }, superAdmin.token);

  const alice = await patientWithPrescription('Rx Clinic A');
  const bob = await patientWithPrescription('Rx Clinic B');
  const draft = await patientWithPrescription('Rx Clinic C', { signed: false });

  // My health carries the prescription id the website sends back.
  const health = await api.get('/directory/my-health', alice.token);
  assert.equal(health.body.visits[0].prescription.id, alice.prescriptionId);

  const send = (who: { token: string }, body: Record<string, unknown>) => api.post('/directory/my-pharmacy-orders', body, who.token);

  // Someone else's prescription, a draft, a missing one, a hidden or missing pharmacy: refused.
  assert.equal((await send(alice, { prescription_id: bob.prescriptionId, pharmacy_id: visible })).status, 404);
  assert.equal((await send(draft, { prescription_id: draft.prescriptionId, pharmacy_id: visible })).status, 404);
  assert.equal((await send(alice, { prescription_id: MISSING, pharmacy_id: visible })).status, 404);
  assert.equal((await send(alice, { prescription_id: alice.prescriptionId, pharmacy_id: hidden })).status, 404);
  assert.equal((await send(alice, { prescription_id: alice.prescriptionId, pharmacy_id: MISSING })).status, 404);
  assert.equal((await send(alice, { prescription_id: 'x', pharmacy_id: visible })).status, 400);
  assert.equal((await api.post('/directory/my-pharmacy-orders', { prescription_id: alice.prescriptionId, pharmacy_id: visible }, owner.token)).status, 403);
  assert.equal((await api.post('/directory/my-pharmacy-orders', { prescription_id: alice.prescriptionId, pharmacy_id: visible })).status, 401);

  // Leaving the clinic means the prescription is no longer theirs to send.
  const leaver = await patientWithPrescription('Rx Clinic D');
  await api.del(`/directory/my-clinics/${leaver.practiceId}`, leaver.token);
  assert.equal((await send(leaver, { prescription_id: leaver.prescriptionId, pharmacy_id: visible })).status, 404);

  const sent = await send(alice, { prescription_id: alice.prescriptionId, pharmacy_id: visible, note: 'I will come at 6 pm' });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.status, 'new');
  assert.equal(sent.body.pharmacy.name, 'Visible Pharmacy');
  assert.deepEqual(sent.body.items.map((i: { drug_name: string }) => i.drug_name), ['Napa', 'Seclo']);
  assert.equal((await send(alice, { prescription_id: alice.prescriptionId, pharmacy_id: visible })).status, 409);

  // The pharmacy sees the patient's name and phone and the medicines, and nothing else.
  const orders = await api.get(`/directory/my-pharmacies/${visible}/orders`, owner.token);
  assert.equal(orders.status, 200);
  assert.equal(orders.body.length, 1);
  const order = orders.body[0];
  assert.equal(order.patient_name, 'Test Patient');
  assert.match(order.patient_phone, /^\+?\d+$/);
  assert.equal(order.note, 'I will come at 6 pm');
  assert.equal(order.doctor_name, 'Dr Rx Writer');
  assert.deepEqual(Object.keys(order).sort(), [
    'created_at', 'doctor_name', 'id', 'items', 'note', 'patient_name', 'patient_phone', 'prescribed_at', 'reason', 'status', 'updated_at',
  ]);
  const raw = JSON.stringify(orders.body);
  for (const secret of ['Secret', 'Private note', 'Rx Clinic', alice.prescriptionId, alice.recordId, alice.id]) {
    assert.equal(raw.includes(secret), false, secret);
  }
  assert.equal((await api.get(`/directory/my-pharmacies/${hidden}/orders`, owner.token)).body.length, 0);

  // Each patient sees only their own orders.
  assert.equal((await api.get('/directory/my-pharmacy-orders', alice.token)).body.length, 1);
  assert.equal((await api.get('/directory/my-pharmacy-orders', bob.token)).body.length, 0);
});

test('the owner moves orders through their statuses; the patient cancels only new ones', async () => {
  const owner = await pharmacyOwner('Status Owner');
  const rival = await pharmacyOwner('Status Rival');
  const id = await pharmacy(owner.id, 'Status Pharmacy');
  const rivalId = await pharmacy(rival.id, 'Status Rival Pharmacy');
  const alice = await patientWithPrescription('Status Clinic A');
  const bob = await patientWithPrescription('Status Clinic B');

  const sent = await api.post('/directory/my-pharmacy-orders', { prescription_id: alice.prescriptionId, pharmacy_id: id }, alice.token);
  const orderId = sent.body.id as string;
  const move = (token: string, body: Record<string, unknown>, pharmacyId = id) =>
    api.patch(`/directory/my-pharmacies/${pharmacyId}/orders/${orderId}`, body, token);

  // Nobody but the owner can move it, even through their own pharmacy's URL.
  assert.equal((await move(rival.token, { status: 'ready' })).status, 404);
  assert.equal((await move(rival.token, { status: 'ready' }, rivalId)).status, 404);
  assert.equal((await move(alice.token, { status: 'ready' })).status, 403);
  assert.equal((await move(superAdmin.token, { status: 'ready' })).status, 403);
  assert.equal((await api.get(`/directory/my-pharmacies/${id}/orders`, rival.token)).status, 404);
  // Unknown or skipped statuses.
  assert.equal((await move(owner.token, { status: 'cancelled' })).status, 400);
  assert.equal((await move(owner.token, { status: 'constructor' })).status, 400);
  assert.equal((await move(owner.token, { status: 'collected' })).status, 409);

  // Someone else cannot cancel it.
  assert.equal((await api.post(`/directory/my-pharmacy-orders/${orderId}/cancel`, {}, bob.token)).status, 404);
  assert.equal((await api.post(`/directory/my-pharmacy-orders/${orderId}/cancel`, {}, owner.token)).status, 403);

  const ready = await move(owner.token, { status: 'ready', reason: 'ignored' });
  assert.equal(ready.status, 200, JSON.stringify(ready.body));
  let mine = (await api.get('/directory/my-pharmacy-orders', alice.token)).body[0];
  assert.equal(mine.status, 'ready');
  assert.equal(mine.reason, null);
  // Too late to cancel once the pharmacy has it ready.
  const late = await api.post(`/directory/my-pharmacy-orders/${orderId}/cancel`, {}, alice.token);
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'ORDER_STATUS');

  assert.equal((await move(owner.token, { status: 'collected' })).status, 200);
  assert.equal((await move(owner.token, { status: 'cannot_fill' })).status, 409);
  assert.equal((await move(owner.token, { status: 'ready' })).status, 409);
  mine = (await api.get('/directory/my-pharmacy-orders', alice.token)).body[0];
  assert.equal(mine.status, 'collected');

  // Cannot fill, with a reason the patient reads.
  const again = await api.post('/directory/my-pharmacy-orders', { prescription_id: alice.prescriptionId, pharmacy_id: id }, alice.token);
  assert.equal(again.status, 201, 'a finished order does not block sending again');
  const refused = await api.patch(`/directory/my-pharmacies/${id}/orders/${again.body.id}`, { status: 'cannot_fill', reason: 'Seclo is out of stock' }, owner.token);
  assert.equal(refused.status, 200);
  mine = (await api.get('/directory/my-pharmacy-orders', alice.token)).body.find((o: { id: string }) => o.id === again.body.id);
  assert.equal(mine.status, 'cannot_fill');
  assert.equal(mine.reason, 'Seclo is out of stock');

  // A new order can be cancelled by its patient, once.
  const third = await api.post('/directory/my-pharmacy-orders', { prescription_id: alice.prescriptionId, pharmacy_id: id }, alice.token);
  const cancelled = await api.post(`/directory/my-pharmacy-orders/${third.body.id}/cancel`, {}, alice.token);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal((await api.post(`/directory/my-pharmacy-orders/${third.body.id}/cancel`, {}, alice.token)).status, 409);
  assert.equal((await api.patch(`/directory/my-pharmacies/${id}/orders/${third.body.id}`, { status: 'ready' }, owner.token)).status, 409);
  assert.equal((await api.post(`/directory/my-pharmacy-orders/${MISSING}/cancel`, {}, alice.token)).status, 404);

  // The pharmacy sees all three with their statuses.
  const list = await api.get(`/directory/my-pharmacies/${id}/orders`, owner.token);
  assert.deepEqual(list.body.map((o: { status: string }) => o.status).sort(), ['cancelled', 'cannot_fill', 'collected']);
});
