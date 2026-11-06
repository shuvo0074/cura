import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Redis from 'ioredis';
import { PASSWORD, TestApi, db, directoryAdmin, nextEmail, nextPhone, registerDoctor, registerPatient } from './harness';

/** One login across Cura Website and Cura Dashboard: a single-use code carries the session over. */
let api: TestApi;
let redis: Redis;
let superAdmin: Awaited<ReturnType<typeof directoryAdmin>>;

const login = async (email: string) => {
  const res = await api.post('/auth/login', { identifier: email, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { session: res.body.session, cookie: res.cookie };
};

async function handoff(token: string) {
  const res = await api.post('/auth/handoff', {}, token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body as { code: string; expiresIn: number };
}

const redeem = (code: string, cookie?: string | null) => api.call('POST', '/auth/handoff/redeem', { body: { code }, cookie: cookie ?? null });

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, ambulance_vendors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  redis = new Redis(process.env.REDIS_URL!);
  superAdmin = await directoryAdmin(api);
});

after(async () => {
  redis.disconnect();
  await api.stop();
  await db.$disconnect();
});

test('a code opens a new session once, with its own refresh cookie, and is audited', async () => {
  const patient = await registerPatient(api);
  const { code, expiresIn } = await handoff(patient.token);
  assert.equal(expiresIn, 60);
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);

  const first = await redeem(code);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.status, 'authenticated');
  assert.ok(first.body.session.accessToken);
  assert.match(first.cookie ?? '', /^cura_rt=/);
  assert.notEqual(first.cookie, patient.cookie);

  // The new session works and refreshes on its own.
  assert.equal((await api.get('/auth/me', first.body.session.accessToken)).body.id, patient.id);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: first.cookie })).status, 200);

  const again = await redeem(code);
  assert.equal(again.status, 401);
  assert.equal(again.cookie, null);

  const actions = (await db.auditLog.findMany({ where: { actorUserId: patient.id } })).map((row) => row.action);
  assert.ok(actions.includes('auth.handoff_created'));
  assert.ok(actions.includes('auth.handoff_redeemed'));
});

test('a code expires after about a minute', async () => {
  const patient = await registerPatient(api);
  const { code } = await handoff(patient.token);
  const keys = (await redis.keys('auth:handoff:*')).filter((key) => !key.includes('claimed'));
  assert.equal(keys.length, 1);
  const ttl = await redis.ttl(keys[0]!);
  assert.ok(ttl > 0 && ttl <= 60, `ttl ${ttl}`);

  // Fast-forward: let it lapse now instead of waiting a minute.
  await redis.pexpire(keys[0]!, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await redeem(code)).status, 401);
});

test('a code cannot be made without a login, and a made-up code is refused', async () => {
  assert.equal((await api.post('/auth/handoff', {})).status, 401);
  assert.equal((await api.post('/auth/handoff', {}, 'not-a-token')).status, 401);
  assert.equal((await redeem('A'.repeat(43))).status, 401);
  assert.equal((await redeem('short')).status, 422);
});

test('one user cannot redeem a code another user already used', async () => {
  const alice = await registerPatient(api);
  const mallory = await registerPatient(api);
  const { code } = await handoff(alice.token);
  assert.equal((await redeem(code)).status, 200);

  // Mallory replays it from her own browser, with her own session cookie.
  const stolen = await redeem(code, mallory.cookie);
  assert.equal(stolen.status, 401);
  assert.equal(stolen.cookie, null);
});

test('a redeemed session has the same roles as a login: super admin who owns a clinic, and a doctor', async () => {
  const email = nextEmail();
  const created = await api.post(
    '/directory/admin/owners',
    { fullName: 'Owner Admin', clinicName: 'Handoff Clinic', mobile: nextPhone(), email, temporaryPassword: PASSWORD },
    superAdmin.token,
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const owner = await db.user.update({ where: { email }, data: { mobileVerifiedAt: new Date() } });
  await db.userDirectoryRole.create({ data: { userId: owner.id, role: 'SUPER_ADMIN' } });

  const { session: loggedIn } = await login(email);
  const res = await redeem((await handoff(loggedIn.accessToken)).code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.session.user, loggedIn.user);
  assert.equal(res.body.session.user.isSuperAdmin, true);
  assert.equal(res.body.session.user.role, 'ADMINISTRATOR');
  assert.deepEqual(res.body.session.user.practiceIds, [created.body.clinics[0].id]);
  // The new access token reaches the clinic like the login did.
  const clinicId = created.body.clinics[0].id;
  assert.equal((await api.get(`/patients?practiceId=${clinicId}`, res.body.session.accessToken)).status, 200);
  // Cura Website offers "Open Cura Dashboard" to this account, and not to a patient.
  assert.equal((await api.get('/auth/me', res.body.session.accessToken)).body.canUseDashboard, true);
  const patient = await registerPatient(api);
  assert.equal((await api.get('/auth/me', patient.token)).body.canUseDashboard, false);

  const doctor = await registerDoctor(api);
  const fromDoctor = await redeem((await handoff(doctor.token)).code);
  assert.equal(fromDoctor.status, 200);
  assert.deepEqual(fromDoctor.body.session.user, (await login(doctor.email)).session.user);
  assert.equal(fromDoctor.body.session.user.role, 'DOCTOR');
});

test('a deactivated account cannot redeem', async () => {
  const patient = await registerPatient(api);
  const { code } = await handoff(patient.token);
  await db.user.update({ where: { id: patient.id }, data: { isActive: false } });
  const res = await redeem(code);
  assert.equal(res.status, 401);
  assert.equal(res.cookie, null);
  assert.equal(await db.auditLog.count({ where: { actorUserId: patient.id, action: 'auth.handoff_redeemed' } }), 0);
});

test('logging out, or changing the password, before the code is used cancels it', async () => {
  const patient = await registerPatient(api);
  const { code } = await handoff(patient.token);
  await api.call('POST', '/auth/logout', { cookie: patient.cookie });
  assert.equal((await redeem(code)).status, 401);

  const other = await registerPatient(api);
  const second = await handoff(other.token);
  await db.user.update({ where: { id: other.id }, data: { tokenVersion: { increment: 1 } } });
  assert.equal((await redeem(second.code)).status, 401);
});

test('the code appears only in the response that creates it', async () => {
  const patient = await registerPatient(api);
  const { code } = await handoff(patient.token);
  const seen: string[] = [];
  const record = (res: { body: unknown; headers: Headers }) => {
    seen.push(JSON.stringify(res.body));
    res.headers.forEach((value) => seen.push(value));
  };

  const redeemed = await redeem(code);
  record(redeemed);
  record(await api.get('/auth/me', redeemed.body.session.accessToken));
  record(await api.call('POST', '/auth/refresh', { cookie: redeemed.cookie }));
  record(await redeem(code));
  record(await api.get('/account/profile', redeemed.body.session.accessToken));
  for (const text of seen) assert.equal(text.includes(code), false);

  // Nor is it stored anywhere: Redis holds only its hash, and the audit log neither.
  for (const key of await redis.keys('*')) {
    assert.equal(key.includes(code), false);
    const type = await redis.type(key);
    if (type === 'string') assert.equal((await redis.get(key))?.includes(code), false);
  }
  const logs = await db.auditLog.findMany({ where: { actorUserId: patient.id } });
  assert.equal(JSON.stringify(logs).includes(code), false);
});
