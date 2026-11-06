import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail, nextPhone, registerPatient } from './harness';
import { safeMetadata } from '../src/modules/audit/audit-metadata';

/** The activity log: super admins see every row, a clinic owner only their own clinic's. */
let api: TestApi;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;
let clinic: { token: string; practiceId: string; ownerId: string };
let other: { token: string; practiceId: string; ownerId: string };

async function newClinic(name: string) {
  const email = nextEmail();
  const res = await api.post('/directory/admin/owners', { fullName: `${name} Owner`, clinicName: name, mobile: nextPhone(), email, temporaryPassword: PASSWORD }, superAdmin.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const owner = await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  return { token: login.body.session.accessToken as string, practiceId: res.body.clinics[0].id as string, ownerId: owner.id };
}

/** A clinic member who can log in straight away. */
async function member(practiceId: string, role: 'DOCTOR' | 'DESK_STAFF') {
  const { CryptoService } = await import('../src/common/crypto/crypto.service');
  const email = nextEmail();
  const user = await db.user.create({
    data: {
      fullName: `Test ${role}`,
      email,
      mobile: `+88${nextPhone()}`,
      mobileVerifiedAt: new Date(),
      passwordHash: await api.app.get(CryptoService).hashPassword(PASSWORD),
      role,
    },
  });
  await db.practiceMembership.create({ data: { practiceId, userId: user.id, role } });
  const login = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.body.session.accessToken as string;
}

const items = (res: { body: { items: { action: string }[] } }) => res.body.items;

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, ambulance_vendors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  superAdmin = await directoryAdmin(api);
  clinic = await newClinic('Audit Clinic');
  other = await newClinic('Other Audit Clinic');

  // A super admin reads the first clinic: the guard writes a clinic read row.
  const read = await api.get(`/patients?practiceId=${clinic.practiceId}`, superAdmin.token);
  assert.equal(read.status, 200, JSON.stringify(read.body));

  // A settings change in each clinic.
  for (const c of [clinic, other]) {
    const put = await api.put('/settings/practice', { practiceId: c.practiceId, roomNumber: '7' }, c.token);
    assert.equal(put.status, 200, JSON.stringify(put.body));
  }

  // A row someone once wrote with secrets in it.
  await db.auditLog.create({
    data: {
      actorUserId: clinic.ownerId,
      action: 'test.secrets',
      resourceType: 'user',
      resourceId: clinic.ownerId,
      practiceId: clinic.practiceId,
      ipHash: 'abcdef0123456789abcdef',
      metadata: { passwordHash: 'x', refreshToken: 'y', otpCode: '123456', code: '654321', nested: { apiKey: 'z', keep: 'ok' }, fields: ['name'] },
    },
  });
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

test('a super admin sees every row across Cura, newest first, with names', async () => {
  const res = await api.get('/directory/admin/audit-log?limit=100', superAdmin.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const actions = items(res).map((row) => row.action);
  assert.ok(actions.includes('super_admin.clinic_read'));
  assert.ok(actions.includes('directory.clinic_owner_created'));
  const practices = new Set(res.body.items.map((row: any) => row.clinic?.id).filter(Boolean));
  assert.ok(practices.has(clinic.practiceId) && practices.has(other.practiceId));

  const times = res.body.items.map((row: any) => Date.parse(row.at));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));

  const settings = res.body.items.find((row: any) => row.action === 'settings.practice.updated' && row.clinic.id === clinic.practiceId);
  assert.equal(settings.clinic.name, 'Audit Clinic');
  assert.equal(settings.subject.name, 'Audit Clinic');
  assert.equal(settings.actor.fullName, 'Audit Clinic Owner');
  assert.equal(settings.actor.clinicRole, 'ADMINISTRATOR');
  assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);

  // Filter by clinic without the filter itself being logged as a clinic read.
  const before = await db.auditLog.count({ where: { action: 'super_admin.clinic_read' } });
  const oneClinic = await api.get(`/directory/admin/audit-log?clinicId=${other.practiceId}`, superAdmin.token);
  assert.ok(oneClinic.body.items.length > 0);
  assert.ok(oneClinic.body.items.every((row: any) => row.clinic.id === other.practiceId));
  assert.equal(await db.auditLog.count({ where: { action: 'super_admin.clinic_read' } }), before);

  const actionList = await api.get('/directory/admin/audit-log/actions', superAdmin.token);
  assert.ok(actionList.body.includes('settings.practice.updated'));
});

test('a clinic owner sees only their own clinic, including super admin reads of it', async () => {
  const res = await api.get(`/audit-log?practiceId=${clinic.practiceId}&limit=100`, clinic.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.items.length > 0);
  assert.ok(res.body.items.every((row: any) => row.clinic.id === clinic.practiceId));

  const read = res.body.items.find((row: any) => row.action === 'super_admin.clinic_read');
  assert.ok(read, 'super admin read is listed');
  assert.equal(read.actor.id, superAdmin.id);
  assert.ok(read.actor.roles.includes('super_admin'));
  assert.equal(read.details.path, '/api/patients');

  // Another clinic is off limits, and so are its actions.
  assert.equal((await api.get(`/audit-log?practiceId=${other.practiceId}`, clinic.token)).status, 403);
  assert.equal((await api.get(`/audit-log/actions?practiceId=${other.practiceId}`, clinic.token)).status, 403);
  assert.equal((await api.get(`/audit-log/export?practiceId=${other.practiceId}`, clinic.token)).status, 403);
  // The owner cannot use the super admin route either.
  assert.equal((await api.get('/directory/admin/audit-log', clinic.token)).status, 403);

  const actions = await api.get(`/audit-log/actions?practiceId=${clinic.practiceId}`, clinic.token);
  assert.ok(actions.body.includes('super_admin.clinic_read'));
  assert.equal(actions.body.includes('directory.clinic_owner_created'), false);
});

test('when a super admin opens a clinic activity log, that read shows in it', async () => {
  const res = await api.get(`/audit-log?practiceId=${other.practiceId}`, superAdmin.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const own = await api.get(`/audit-log?practiceId=${other.practiceId}&action=super_admin.clinic_read`, other.token);
  assert.ok(own.body.items.some((row: any) => row.details.path === '/api/audit-log'));
});

test('doctors, clinic staff, patients and ambulance owners cannot read the log', async () => {
  const doctor = await member(clinic.practiceId, 'DOCTOR');
  const desk = await member(clinic.practiceId, 'DESK_STAFF');
  const patient = await registerPatient(api);
  const ambulanceOwner = await registerPatient(api);
  await db.userDirectoryRole.create({ data: { userId: ambulanceOwner.id, role: 'AMBULANCE_OWNER' } });
  const ownerToken = (await api.post('/auth/login', { identifier: ambulanceOwner.email, password: PASSWORD })).body.session.accessToken;

  for (const token of [doctor, desk, patient.token, ownerToken]) {
    assert.equal((await api.get(`/audit-log?practiceId=${clinic.practiceId}`, token)).status, 403);
    assert.equal((await api.get(`/audit-log/export?practiceId=${clinic.practiceId}`, token)).status, 403);
    assert.equal((await api.get('/directory/admin/audit-log', token)).status, 403);
    assert.equal((await api.get('/directory/admin/audit-log/export', token)).status, 403);
  }
  assert.equal((await api.get('/directory/admin/audit-log')).status, 401);
});

test('filters and pages work', async () => {
  const token = superAdmin.token;
  const byAction = await api.get('/directory/admin/audit-log?action=settings.practice.updated', token);
  assert.equal(byAction.body.items.length, 2);
  assert.ok(byAction.body.items.every((row: any) => row.action === 'settings.practice.updated'));

  const byPerson = await api.get(`/directory/admin/audit-log?actor=${encodeURIComponent('other audit clinic owner')}`, token);
  assert.ok(byPerson.body.items.length > 0);
  assert.ok(byPerson.body.items.every((row: any) => row.actor.fullName === 'Other Audit Clinic Owner'));

  const byText = await api.get('/directory/admin/audit-log?q=clinic_read', token);
  assert.ok(byText.body.items.length > 0);
  assert.ok(byText.body.items.every((row: any) => row.action.includes('clinic_read')));

  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal((await api.get(`/directory/admin/audit-log?from=${encodeURIComponent(future)}`, token)).body.items.length, 0);
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal((await api.get(`/directory/admin/audit-log?to=${encodeURIComponent(past)}`, token)).body.items.length, 0);

  // Pages of two, joined, equal the whole list with no repeats.
  const all = (await api.get('/directory/admin/audit-log?limit=100', token)).body.items.map((row: any) => row.id);
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const page: any = await api.get(`/directory/admin/audit-log?limit=2${cursor ? `&cursor=${cursor}` : ''}`, token);
    assert.ok(page.body.items.length <= 2);
    seen.push(...page.body.items.map((row: any) => row.id));
    cursor = page.body.nextCursor;
  } while (cursor);
  assert.deepEqual(seen, all);

  assert.equal((await api.get('/directory/admin/audit-log?limit=101', token)).status, 422);
  assert.equal((await api.get('/directory/admin/audit-log?from=yesterday', token)).status, 422);

  const exported = await api.get('/directory/admin/audit-log/export?action=settings.practice.updated', token);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.items.length, 2);
  assert.equal(exported.body.truncated, false);
});

test('secrets in stored details are never shown', async () => {
  const res = await api.get(`/audit-log?practiceId=${clinic.practiceId}&action=test.secrets`, clinic.token);
  assert.equal(res.body.items.length, 1);
  const row = res.body.items[0];
  assert.deepEqual(row.details, { nested: { keep: 'ok' }, fields: ['name'] });
  assert.equal(row.network, 'abcdef0123');
  assert.equal(JSON.stringify(res.body).includes('ipHash'), false);
  assert.equal(JSON.stringify(res.body).includes('123456'), false);

  assert.deepEqual(safeMetadata({ postCode: '1207', sessionToken: 'a', Password: 'b', nid: '1', a: 'x'.repeat(400) }), {
    postCode: '1207',
    a: `${'x'.repeat(300)}…`,
  });
});
