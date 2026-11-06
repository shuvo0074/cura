import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail } from './harness';

/** Pharmacies on Cura Website, and hospital owners editing their own place. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

async function newAccount(fullName: string) {
  const email = nextEmail();
  const res = await api.post('/directory/admin/users', { fullName, email, temporaryPassword: PASSWORD }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { id: res.body.id as string, email };
}

const login = async (email: string) => {
  const res = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.session;
};

async function newHospital(name: string, extra: Record<string, unknown> = {}) {
  const res = await api.post(
    '/directory/admin/hospitals',
    { name, location: 'Dhaka', type: 'hospital', lat: 23.75, lng: 90.39, hotline: '10600', ...extra },
    superAdmin.token,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body as { id: string };
}

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, hospitals, pharmacies, audit_logs CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('public pharmacies list only visible ones, with public fields only', async () => {
  const owner = await newAccount('Pharmacy Owner');
  await api.put(`/directory/admin/users/${owner.id}/roles/pharmacy_owner`, {}, superAdmin.token);
  const session = await login(owner.email);

  // An owner's new pharmacy waits for a super admin.
  const own = await api.post(
    '/directory/my-pharmacies',
    { name: 'Owner Pharmacy', phones: '01711112222', license_number: 'DL-1', city: 'Dhaka', home_delivery: true },
    session.accessToken,
  );
  assert.equal(own.status, 201, JSON.stringify(own.body));
  assert.equal(own.body.hidden, true);
  // A super admin's new pharmacy is visible at once.
  const byAdmin = await api.post('/directory/admin/pharmacies', { owner_id: owner.id, name: 'Admin Pharmacy', phones: '01711113333' }, superAdmin.token);
  assert.equal(byAdmin.status, 201, JSON.stringify(byAdmin.body));
  assert.equal(byAdmin.body.hidden, false);

  let list = await api.get('/directory/pharmacies');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((p: { name: string }) => p.name), ['Admin Pharmacy']);

  // The super admin shows the owner's pharmacy.
  const shown = await api.patch(`/directory/admin/pharmacies/${own.body.id}/hidden`, { hidden: false }, superAdmin.token);
  assert.equal(shown.status, 200, JSON.stringify(shown.body));
  list = await api.get('/directory/pharmacies');
  assert.deepEqual(list.body.map((p: { name: string }) => p.name), ['Admin Pharmacy', 'Owner Pharmacy']);
  const shownRow = list.body.find((p: { name: string }) => p.name === 'Owner Pharmacy');
  assert.deepEqual(Object.keys(shownRow).sort(), ['address', 'city', 'home_delivery', 'id', 'name', 'opening_hours', 'phones']);
  assert.equal(shownRow.home_delivery, true);
  const raw = JSON.stringify(list.body);
  for (const secret of [owner.id, owner.email, 'owner_id', 'license', 'DL-1', 'hidden']) assert.equal(raw.includes(secret), false, secret);

  // The owner sees the status; only a super admin can change it.
  const mine = await api.get('/directory/my-pharmacies', session.accessToken);
  assert.equal(mine.body.find((p: { id: string }) => p.id === own.body.id).hidden, false);
  assert.equal((await api.patch(`/directory/admin/pharmacies/${own.body.id}/hidden`, { hidden: true }, session.accessToken)).status, 403);
  await api.patch(`/directory/my-pharmacies/${own.body.id}`, { name: 'Owner Pharmacy', phones: '01711112222', hidden: false }, session.accessToken);
  await api.patch(`/directory/admin/pharmacies/${own.body.id}/hidden`, { hidden: true }, superAdmin.token);
  assert.deepEqual((await api.get('/directory/pharmacies')).body.map((p: { name: string }) => p.name), ['Admin Pharmacy']);
});

test('linking a hospital grants the role, and the session and website know it', async () => {
  const hospital = await newHospital('Linked Hospital');
  const owner = await newAccount('Hospital Owner');
  assert.equal((await api.get(`/directory/admin/users/${owner.id}`, superAdmin.token)).body.roles.length, 0);

  const linked = await api.put(`/directory/admin/hospitals/${hospital.id}/owner`, { owner_id: owner.id }, superAdmin.token);
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  const detail = (await api.get(`/directory/admin/users/${owner.id}`, superAdmin.token)).body;
  assert.deepEqual(detail.roles, ['hospital_owner']);
  assert.deepEqual(detail.hospitals.map((h: { name: string }) => h.name), ['Linked Hospital']);
  const listed = (await api.get('/directory/admin/hospitals', superAdmin.token)).body.find((h: { id: string }) => h.id === hospital.id);
  assert.equal(listed.owner_id, owner.id);

  const session = await login(owner.email);
  assert.deepEqual(session.user.ownerRoles, ['hospital_owner']);
  const me = await api.get('/auth/me', session.accessToken);
  assert.equal(me.body.canUseDashboard, true);
  assert.ok(me.body.roles.includes('hospital_owner'));

  // A missing hospital is a 404 and grants nothing.
  const other = await newAccount('Nobody');
  const missing = await api.put('/directory/admin/hospitals/00000000-0000-4000-8000-000000000000/owner', { owner_id: other.id }, superAdmin.token);
  assert.equal(missing.status, 404);
  assert.deepEqual((await api.get(`/directory/admin/users/${other.id}`, superAdmin.token)).body.roles, []);
  // Only a super admin links.
  assert.equal((await api.put(`/directory/admin/hospitals/${hospital.id}/owner`, { owner_id: owner.id }, session.accessToken)).status, 403);

  // Unlinking keeps the role but the place is no longer theirs.
  await api.put(`/directory/admin/hospitals/${hospital.id}/owner`, { owner_id: null }, superAdmin.token);
  assert.deepEqual((await api.get(`/directory/admin/users/${owner.id}`, superAdmin.token)).body.hospitals, []);
});

test('a hospital owner edits only their own place, and only the public details', async () => {
  const mine = await newHospital('Owner Hospital', {
    address: 'Old address',
    tests: [{ name: 'CBC', category: 'blood', price: 400 }],
    beds: { general: 10, cabin: 2, icu: 1 },
    facilities: ['parking'],
    source_url: 'https://example.com/source',
  });
  const theirs = await newHospital('Someone Else Hospital');
  const owner = await newAccount('Place Owner');
  const rival = await newAccount('Rival Owner');
  await api.put(`/directory/admin/hospitals/${mine.id}/owner`, { owner_id: owner.id }, superAdmin.token);
  await api.put(`/directory/admin/hospitals/${theirs.id}/owner`, { owner_id: rival.id }, superAdmin.token);
  const token = (await login(owner.email)).accessToken;
  const rivalToken = (await login(rival.email)).accessToken;

  const list = await api.get('/directory/my-hospitals', token);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((h: { name: string }) => h.name), ['Owner Hospital']);

  // Allowed fields change; type, location, coordinates and visibility do not.
  const edited = await api.patch(
    `/directory/my-hospitals/${mine.id}`,
    {
      hotline: '01999999999',
      description: 'Open every day',
      beds: { general: 20, cabin: 4, icu: 2 },
      type: 'diagnostic',
      location: 'Chattogram',
      lat: 1,
      lng: 2,
      hidden: true,
      photo: 'https://evil.example/x.png',
      source_url: 'https://evil.example',
    },
    token,
  );
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  const stored = await db.hospital.findUniqueOrThrow({ where: { id: mine.id } });
  assert.equal(stored.hotline, '01999999999');
  assert.equal(stored.description, 'Open every day');
  assert.deepEqual(stored.beds, { general: 20, cabin: 4, icu: 2 });
  assert.equal(stored.type, 'hospital');
  assert.equal(stored.location, 'Dhaka');
  assert.equal(stored.lat, 23.75);
  assert.equal(stored.lng, 90.39);
  assert.equal(stored.hidden, false);
  assert.equal(stored.photo, null);
  assert.equal(stored.sourceUrl, 'https://example.com/source');
  // Fields not sent keep their values: the update merges, it does not replace.
  assert.equal(stored.address, 'Old address');
  assert.deepEqual(stored.facilities, ['parking']);
  assert.deepEqual((stored.tests as { name: string }[]).map((t) => t.name), ['CBC']);

  // Live at once on Cura Website.
  assert.equal((await api.get(`/directory/hospitals/${mine.id}`)).body.hotline, '01999999999');

  // Validation still applies.
  assert.equal((await api.patch(`/directory/my-hospitals/${mine.id}`, { name: '' }, token)).status, 400);
  assert.equal((await api.patch(`/directory/my-hospitals/${mine.id}`, { beds: { general: -1 } }, token)).status, 400);

  // Another owner's place is a 404, and so is an unlinked one.
  assert.equal((await api.patch(`/directory/my-hospitals/${theirs.id}`, { hotline: '0' }, token)).status, 404);
  assert.equal((await api.patch(`/directory/my-hospitals/${mine.id}`, { hotline: '0' }, rivalToken)).status, 404);
  assert.equal((await db.hospital.findUniqueOrThrow({ where: { id: mine.id } })).hotline, '01999999999');

  // Without the role, the routes are closed.
  const patientLike = await newAccount('No Role');
  const plain = (await login(patientLike.email)).accessToken;
  assert.equal((await api.get('/directory/my-hospitals', plain)).status, 403);
});
