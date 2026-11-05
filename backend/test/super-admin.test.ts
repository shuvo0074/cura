import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail, nextPhone, registerPatient } from './harness';

/** A super admin manages accounts and roles, and reads any clinic without changing it. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;
let clinic: { token: string; practiceId: string; ownerId: string };

async function newClinic(name: string) {
  const email = nextEmail();
  const res = await api.post('/directory/admin/owners', { fullName: 'Owner', clinicName: name, mobile: nextPhone(), email, temporaryPassword: PASSWORD }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const owner = await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  return { token: login.body.session.accessToken as string, practiceId: res.body.clinics[0].id as string, ownerId: owner.id };
}

const login = async (email: string) => (await api.post('/auth/login', { identifier: email, password: PASSWORD })).body.session;

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, ambulance_vendors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
  clinic = await newClinic('Read Clinic');
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('a super admin session says so, and carries read-only clinic permissions', async () => {
  const session = await login(superAdmin.email);
  assert.equal(session.user.isSuperAdmin, true);
  assert.ok(session.user.permissions.includes('patient:read'));
  assert.equal(session.user.permissions.includes('patient:write'), false);
  assert.deepEqual(session.user.practiceIds, []);
  assert.equal((await login((await db.user.findUniqueOrThrow({ where: { id: clinic.ownerId } })).email!)).user.isSuperAdmin, false);
});

test('a super admin reads any clinic, every read is audited, and nothing can be changed', async () => {
  const token = (await login(superAdmin.email)).accessToken;
  await db.patient.create({ data: { practiceId: clinic.practiceId, curaId: `CURA-T${Date.now() % 100000}`, fullName: 'Private Patient', mobile: '+8801700009999', searchName: 'private patient' } });

  const list = await api.get(`/patients?practiceId=${clinic.practiceId}`, token);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.items[0].fullName, 'Private Patient');
  assert.equal((await api.get(`/settings/staff?practiceId=${clinic.practiceId}`, token)).status, 200);

  const audit = await db.auditLog.findMany({ where: { actorUserId: superAdmin.id, action: 'super_admin.clinic_read' } });
  assert.ok(audit.length >= 2);
  assert.equal(audit[0]!.practiceId, clinic.practiceId);

  const write = await api.post('/patients', { practiceId: clinic.practiceId, fullName: 'Nope', mobile: '01700009998' }, token);
  assert.equal(write.status, 403);
  assert.equal((await api.put(`/settings/practice`, { practiceId: clinic.practiceId, name: 'Hacked' }, token)).status, 403);

  // A clinic owner still cannot read another clinic.
  const other = await newClinic('Other Clinic');
  assert.equal((await api.get(`/patients?practiceId=${clinic.practiceId}`, other.token)).status, 403);
});

test('a super admin assigns, edits and removes any role', async () => {
  const patient = await registerPatient(api);
  const path = `/directory/admin/users/${patient.id}`;
  const token = superAdmin.token;

  const found = await api.get(`/directory/admin/users?q=${encodeURIComponent(patient.email)}`, token);
  assert.equal(found.body.items.length, 1);
  assert.equal(JSON.stringify(found.body).includes('passwordHash'), false);

  assert.deepEqual((await api.put(`${path}/roles/ambulance_owner`, {}, token)).body.roles.sort(), ['ambulance_owner', 'patient']);
  assert.deepEqual((await api.del(`${path}/roles/ambulance_owner`, token)).body.roles, ['patient']);
  assert.equal((await api.put(`${path}/roles/nonsense`, {}, token)).status, 400);

  // Clinic access: a doctor at the clinic, shown to patients, then removed again.
  const doctor = await api.put(`${path}/clinic-access`, { role: 'DOCTOR', practiceIds: [clinic.practiceId], specialty: 'ENT' }, token);
  assert.equal(doctor.status, 200, JSON.stringify(doctor.body));
  assert.equal(doctor.body.clinic_role, 'DOCTOR');
  assert.equal(doctor.body.doctor.specialty, 'ENT');
  const publicNames = async () => (await api.get('/directory/doctors')).body.map((d: { name: string }) => d.name);
  assert.ok((await publicNames()).includes('Dr. Test Patient'));
  const removed = await api.put(`${path}/clinic-access`, { role: null }, token);
  assert.equal(removed.body.clinic_role, null);
  assert.deepEqual(removed.body.clinics, []);
  assert.equal((await publicNames()).includes('Dr. Test Patient'), false);
  assert.equal((await api.put(`${path}/clinic-access`, { role: 'DOCTOR', practiceIds: [] }, token)).status, 400);

  // Changing roles ends the user's sessions.
  assert.equal((await api.get('/auth/me', patient.token)).status, 401);

  // Edit, deactivate, reset password.
  assert.equal((await api.patch(path, { fullName: 'Renamed Person' }, token)).body.full_name, 'Renamed Person');
  assert.equal((await api.patch(path, { isActive: false }, token)).body.is_active, false);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: PASSWORD })).status, 401);
  await api.patch(path, { isActive: true }, token);
  assert.equal((await api.post(`${path}/password`, { temporaryPassword: 'NewPassword123' }, token)).status, 201);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: 'NewPassword123' })).status, 200);
});

test('the last super admin cannot be removed, and non-admins cannot use these routes', async () => {
  const self = `/directory/admin/users/${superAdmin.id}`;
  assert.equal((await api.del(`${self}/roles/super_admin`, superAdmin.token)).body.code, 'CANNOT_REMOVE_SELF');
  assert.equal((await api.patch(self, { isActive: false }, superAdmin.token)).body.code, 'CANNOT_DISABLE_SELF');
  assert.equal((await api.get('/directory/admin/users', clinic.token)).status, 403);
  assert.equal((await api.get('/directory/admin/clinics', clinic.token)).status, 403);
});

test('a super admin edits clinics, pharmacies and ambulance owners', async () => {
  const token = superAdmin.token;
  const clinics = await api.get('/directory/admin/clinics', token);
  assert.ok(clinics.body.some((c: { id: string }) => c.id === clinic.practiceId));
  const edited = await api.patch(`/directory/admin/clinics/${clinic.practiceId}`, { name: 'Read Clinic Two', city: 'Dhaka' }, token);
  assert.equal(edited.body.name, 'Read Clinic Two');

  const owner = await api.post('/directory/admin/users', { fullName: 'Shop Owner', email: nextEmail(), temporaryPassword: PASSWORD }, token);
  assert.equal(owner.status, 201, JSON.stringify(owner.body));
  const store = await api.post('/directory/admin/pharmacies', { owner_id: owner.body.id, name: 'Admin Pharmacy', phones: '01711110000' }, token);
  assert.equal(store.status, 201, JSON.stringify(store.body));
  assert.deepEqual((await api.get(`/directory/admin/users/${owner.body.id}`, token)).body.roles, ['pharmacy_owner']);
  const listed = (await api.get('/directory/admin/pharmacies', token)).body.find((p: { id: string }) => p.id === store.body.id);
  assert.equal(listed.owner.full_name, 'Shop Owner');

  const van = await api.post('/directory/admin/ambulances', { name: 'Admin Van', phones: ['01711110001'], categories: ['ac'] }, token);
  const linked = await api.put(`/directory/admin/ambulances/${van.body.id}/owner`, { owner_id: owner.body.id }, token);
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  const detail = (await api.get(`/directory/admin/users/${owner.body.id}`, token)).body;
  assert.deepEqual(detail.roles.sort(), ['ambulance_owner', 'pharmacy_owner']);
  assert.deepEqual(detail.ambulances.map((a: { name: string }) => a.name), ['Admin Van']);
  assert.equal((await api.del(`/directory/admin/pharmacies/${store.body.id}`, token)).status, 200);
});
