import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail, registerPatient } from './harness';

/** Patients request an ambulance on Cura Website; the service's owner answers on Cura Dashboard. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

const MISSING = '00000000-0000-4000-8000-000000000000';
const MINE = '/directory/my-ambulance-requests';

async function ambulanceOwner(name: string) {
  const email = nextEmail();
  const res = await api.post('/directory/admin/users', { fullName: name, email, temporaryPassword: PASSWORD }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await api.put(`/directory/admin/users/${res.body.id}/roles/ambulance_owner`, {}, superAdmin.token);
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { id: res.body.id as string, token: login.body.session.accessToken as string };
}

/** A visible service, owned by `ownerId` when given. Returns its id and its public slug. */
async function ambulance(name: string, ownerId: string | null) {
  const res = await api.post('/directory/admin/ambulances', { name, phones: ['01711113333'], categories: ['ac'] }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  if (ownerId) {
    const owned = await api.put(`/directory/admin/ambulances/${res.body.id}/owner`, { owner_id: ownerId }, superAdmin.token);
    assert.equal(owned.status, 200, JSON.stringify(owned.body));
  }
  return { id: res.body.id as string, slug: res.body.slug as string };
}

const form = (slug: string, extra: Record<string, unknown> = {}) => ({
  ambulance_id: slug,
  pickup_address: 'House 12, Road 5, Dhanmondi',
  destination: 'Square Hospital',
  contact_phone: '01712345678',
  note: 'Patient cannot walk',
  ...extra,
});

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE ambulance_requests CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('only services with an owner can be requested, and the public list says which', async () => {
  const owner = await ambulanceOwner('Listed Owner');
  const owned = await ambulance('Owned Van', owner.id);
  const unowned = await ambulance('Unowned Van', null);
  const hidden = await ambulance('Hidden Van', owner.id);
  await api.patch(`/directory/admin/ambulances/${hidden.id}/hidden`, { hidden: true }, superAdmin.token);

  const list = (await api.get('/directory/ambulances')).body as { id: string; requestable: boolean; owner_id?: string }[];
  assert.equal(list.find((v) => v.id === owned.slug)?.requestable, true);
  assert.equal(list.find((v) => v.id === unowned.slug)?.requestable, false);
  assert.equal(list.some((v) => 'owner_id' in v), false);

  const patient = await registerPatient(api);
  assert.equal((await api.post(MINE, form(unowned.slug), patient.token)).status, 404);
  assert.equal((await api.post(MINE, form(hidden.slug), patient.token)).status, 404);
  assert.equal((await api.post(MINE, form('no-such-van'), patient.token)).status, 404);
  assert.equal((await api.post(MINE, form('Not a slug!'), patient.token)).status, 400);
  // Only a signed-in patient can ask.
  assert.equal((await api.post(MINE, form(owned.slug))).status, 401);
  assert.equal((await api.post(MINE, form(owned.slug), owner.token)).status, 403);
  assert.equal((await api.get(MINE, owner.token)).status, 403);
});

test('a request needs a pickup address, a Bangladeshi mobile and a sensible time', async () => {
  const owner = await ambulanceOwner('Form Owner');
  const van = await ambulance('Form Van', owner.id);
  const patient = await registerPatient(api);
  const send = (extra: Record<string, unknown>) => api.post(MINE, form(van.slug, extra), patient.token);

  for (const bad of [
    { pickup_address: '' },
    { pickup_address: 'abc' },
    { contact_phone: '' },
    { contact_phone: '12345' },
    { contact_phone: '01212345678' },
    { pickup_at: 'tomorrow' },
    { pickup_at: new Date(Date.now() - 2 * 3_600_000).toISOString() },
    { pickup_at: new Date(Date.now() + 8 * 86_400_000).toISOString() },
    { pickup_at: 12345 },
  ]) {
    const res = await send(bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(res.body.code, 'VALIDATION');
  }
  assert.equal(await db.ambulanceRequest.count({ where: { vendorId: van.id } }), 0);

  const later = new Date(Date.now() + 3 * 3_600_000);
  const sent = await send({
    pickup_address: '  House 12,\n Road 5 ',
    contact_phone: '+880 1712-345678',
    destination: '',
    pickup_at: later.toISOString(),
    note: ' Needs oxygen\nSecond floor ',
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.status, 'new');
  assert.equal(sent.body.pickup_address, 'House 12, Road 5');
  assert.equal(sent.body.contact_phone, '+8801712345678');
  assert.equal(sent.body.destination, null);
  assert.equal(sent.body.note, 'Needs oxygen\nSecond floor');
  assert.equal(sent.body.pickup_at, later.toISOString());
  assert.equal(sent.body.ambulance.id, van.slug);
  assert.equal(sent.body.ambulance.name, 'Form Van');
  assert.equal(sent.body.owner_message, null);

  // "Now" has no pickup time.
  const owner2 = await ambulanceOwner('Form Owner 2');
  const van2 = await ambulance('Form Van 2', owner2.id);
  const now = await api.post(MINE, form(van2.slug, { pickup_at: null }), patient.token);
  assert.equal(now.status, 201, JSON.stringify(now.body));
  assert.equal(now.body.pickup_at, null);
});

test('a patient has at most three open requests, one per service', async () => {
  const owner = await ambulanceOwner('Limit Owner');
  const vans = [];
  for (let i = 0; i < 4; i += 1) vans.push(await ambulance(`Limit Van ${i}`, owner.id));
  const patient = await registerPatient(api);

  assert.equal((await api.post(MINE, form(vans[0].slug), patient.token)).status, 201);
  const twice = await api.post(MINE, form(vans[0].slug), patient.token);
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, 'ALREADY_REQUESTED');
  assert.equal((await api.post(MINE, form(vans[1].slug), patient.token)).status, 201);
  const third = await api.post(MINE, form(vans[2].slug), patient.token);
  assert.equal(third.status, 201);
  const fourth = await api.post(MINE, form(vans[3].slug), patient.token);
  assert.equal(fourth.status, 409);
  assert.equal(fourth.body.code, 'TOO_MANY_REQUESTS');

  // Cancelling one frees a place.
  assert.equal((await api.post(`${MINE}/${third.body.id}/cancel`, {}, patient.token)).status, 200);
  assert.equal((await api.post(MINE, form(vans[3].slug), patient.token)).status, 201);

  // Someone else is not affected by this patient's limit.
  const other = await registerPatient(api);
  assert.equal((await api.post(MINE, form(vans[0].slug), other.token)).status, 201);

  // A day's cap holds even when every request is cancelled.
  const busy = await registerPatient(api);
  for (let i = 0; i < 10; i += 1) {
    const res = await api.post(MINE, form(vans[i % 4].slug), busy.token);
    assert.equal(res.status, 201, `request ${i}: ${JSON.stringify(res.body)}`);
    await api.post(`${MINE}/${res.body.id}/cancel`, {}, busy.token);
  }
  const capped = await api.post(MINE, form(vans[0].slug), busy.token);
  assert.equal(capped.status, 409);
  assert.equal(capped.body.code, 'DAILY_LIMIT');
});

test('owners see only requests to their own services, with just what the patient typed', async () => {
  const owner = await ambulanceOwner('Seeing Owner');
  const rival = await ambulanceOwner('Seeing Rival');
  const first = await ambulance('Seeing Van A', owner.id);
  const second = await ambulance('Seeing Van B', owner.id);
  const rivalVan = await ambulance('Rival Van', rival.id);
  const alice = await registerPatient(api);
  const bob = await registerPatient(api);

  const a = await api.post(MINE, form(first.slug), alice.token);
  const b = await api.post(MINE, form(second.slug, { destination: 'Ibn Sina' }), bob.token);
  const c = await api.post(MINE, form(rivalVan.slug), alice.token);
  for (const res of [a, b, c]) assert.equal(res.status, 201, JSON.stringify(res.body));

  const all = await api.get('/directory/my-ambulances/requests', owner.token);
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.map((r: { id: string }) => r.id).sort(), [a.body.id, b.body.id].sort());
  const row = all.body.find((r: { id: string }) => r.id === b.body.id);
  assert.equal(row.patient_name, 'Test Patient');
  assert.equal(row.contact_phone, '+8801712345678');
  assert.equal(row.destination, 'Ibn Sina');
  assert.deepEqual(row.ambulance, { id: second.id, name: 'Seeing Van B' });
  assert.deepEqual(Object.keys(row).sort(), [
    'ambulance', 'contact_phone', 'created_at', 'destination', 'id', 'note', 'owner_message', 'patient_name',
    'pickup_address', 'pickup_at', 'status', 'updated_at',
  ]);
  const raw = JSON.stringify(all.body);
  for (const secret of [alice.id, bob.id, alice.email, bob.email]) assert.equal(raw.includes(secret), false, secret);

  const one = await api.get(`/directory/my-ambulances/${first.id}/requests`, owner.token);
  assert.deepEqual(one.body.map((r: { id: string }) => r.id), [a.body.id]);
  // Another owner's service looks missing.
  assert.equal((await api.get(`/directory/my-ambulances/${rivalVan.id}/requests`, owner.token)).status, 404);
  assert.equal((await api.get(`/directory/my-ambulances/${MISSING}/requests`, owner.token)).status, 404);
  assert.deepEqual((await api.get('/directory/my-ambulances/requests', rival.token)).body.map((r: { id: string }) => r.id), [c.body.id]);

  // Patients, a super admin and nobody at all are kept out of the owner's list.
  assert.equal((await api.get('/directory/my-ambulances/requests', alice.token)).status, 403);
  assert.equal((await api.get('/directory/my-ambulances/requests', superAdmin.token)).status, 403);
  assert.equal((await api.get('/directory/my-ambulances/requests')).status, 401);

  // Each patient sees only their own.
  assert.deepEqual((await api.get(MINE, alice.token)).body.map((r: { id: string }) => r.id).sort(), [a.body.id, c.body.id].sort());
  assert.deepEqual((await api.get(MINE, bob.token)).body.map((r: { id: string }) => r.id), [b.body.id]);
});

test('the owner accepts, completes or declines; the patient cancels while new or accepted', async () => {
  const owner = await ambulanceOwner('Status Owner');
  const rival = await ambulanceOwner('Status Rival');
  const van = await ambulance('Status Van', owner.id);
  const rivalVan = await ambulance('Status Rival Van', rival.id);
  const alice = await registerPatient(api);
  const bob = await registerPatient(api);

  const sent = await api.post(MINE, form(van.slug), alice.token);
  const id = sent.body.id as string;
  const move = (token: string, body: Record<string, unknown>, vendorId = van.id, requestId = id) =>
    api.patch(`/directory/my-ambulances/${vendorId}/requests/${requestId}`, body, token);

  // Nobody but the owner can move it, even through their own service's URL.
  assert.equal((await move(rival.token, { status: 'accepted' })).status, 404);
  assert.equal((await move(rival.token, { status: 'accepted' }, rivalVan.id)).status, 404);
  assert.equal((await move(alice.token, { status: 'accepted' })).status, 403);
  assert.equal((await move(superAdmin.token, { status: 'accepted' })).status, 403);
  assert.equal((await api.patch(`/directory/my-ambulances/${van.id}/requests/${id}`, { status: 'accepted' })).status, 401);
  // Unknown or skipped statuses.
  assert.equal((await move(owner.token, { status: 'cancelled' })).status, 400);
  assert.equal((await move(owner.token, { status: 'constructor' })).status, 400);
  assert.equal((await move(owner.token, { status: 'completed' })).status, 409);
  assert.equal((await move(owner.token, { status: 'accepted' }, van.id, MISSING)).status, 404);

  // Someone else cannot cancel it; the owner cannot use the patient's route.
  assert.equal((await api.post(`${MINE}/${id}/cancel`, {}, bob.token)).status, 404);
  assert.equal((await api.post(`${MINE}/${id}/cancel`, {}, owner.token)).status, 403);
  assert.equal((await api.post(`${MINE}/${MISSING}/cancel`, {}, alice.token)).status, 404);

  const accepted = await move(owner.token, { status: 'accepted', message: 'Arriving in 20 minutes' });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  let mine = (await api.get(MINE, alice.token)).body[0];
  assert.equal(mine.status, 'accepted');
  assert.equal(mine.owner_message, 'Arriving in 20 minutes');
  assert.equal((await move(owner.token, { status: 'accepted' })).status, 409);

  // Completing keeps the arrival message; nothing moves after that.
  assert.equal((await move(owner.token, { status: 'completed', message: 'ignored' })).status, 200);
  mine = (await api.get(MINE, alice.token)).body[0];
  assert.equal(mine.status, 'completed');
  assert.equal(mine.owner_message, 'Arriving in 20 minutes');
  for (const status of ['accepted', 'declined', 'completed']) assert.equal((await move(owner.token, { status })).status, 409);
  const late = await api.post(`${MINE}/${id}/cancel`, {}, alice.token);
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'REQUEST_STATUS');

  // Declined with a reason the patient reads.
  const second = await api.post(MINE, form(van.slug), alice.token);
  assert.equal(second.status, 201, 'a finished request does not block asking again');
  assert.equal((await move(owner.token, { status: 'declined', message: 'All vans are out' }, van.id, second.body.id)).status, 200);
  mine = (await api.get(MINE, alice.token)).body.find((r: { id: string }) => r.id === second.body.id);
  assert.equal(mine.status, 'declined');
  assert.equal(mine.owner_message, 'All vans are out');
  assert.equal((await api.post(`${MINE}/${second.body.id}/cancel`, {}, alice.token)).status, 409);

  // The patient cancels an accepted request, once; the owner then cannot move it.
  const third = await api.post(MINE, form(van.slug), alice.token);
  assert.equal((await move(owner.token, { status: 'accepted' }, van.id, third.body.id)).status, 200);
  assert.equal((await api.post(`${MINE}/${third.body.id}/cancel`, {}, alice.token)).status, 200);
  assert.equal((await api.post(`${MINE}/${third.body.id}/cancel`, {}, alice.token)).status, 409);
  assert.equal((await move(owner.token, { status: 'completed' }, van.id, third.body.id)).status, 409);

  // And a new one, straight away.
  const fourth = await api.post(MINE, form(van.slug), alice.token);
  assert.equal((await api.post(`${MINE}/${fourth.body.id}/cancel`, {}, alice.token)).status, 200);

  const list = await api.get(`/directory/my-ambulances/${van.id}/requests`, owner.token);
  assert.deepEqual(list.body.map((r: { status: string }) => r.status).sort(), ['cancelled', 'cancelled', 'completed', 'declined']);
});
