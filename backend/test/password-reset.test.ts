import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { EMAIL_SENDER, SMS_SENDER } from '../src/core/ports/services';
import { PASSWORD, TestApi, db, nextEmail, nextPhone, registerDoctor, registerPatient } from './harness';

/** Forgot password: a code sent to the login address lets anyone set a new password. */
let api: TestApi;
let sent: Array<{ to: string; code: string }> = [];
const NEW_PASSWORD = 'N3wPassword123';

before(async () => {
  await db.$executeRawUnsafe(`TRUNCATE users, doctors, practices, audit_logs CASCADE`);
  api = await TestApi.start();
  api.app.get(SMS_SENDER).send = async ({ to, body }: { to: string; body: string }) => {
    sent.push({ to, code: body.match(/\d{6}/)![0] });
  };
  api.app.get(EMAIL_SENDER).send = async ({ to, text }: { to: string; text: string }) => {
    sent.push({ to, code: text.match(/\d{6}/)![0] });
  };
});

beforeEach(() => {
  sent = [];
});

after(async () => {
  await api.stop();
  await db.$disconnect();
});

const requestCode = (identifier: string) => api.post('/auth/password-reset/request', { identifier });
const confirm = (challengeId: string, code: string, password = NEW_PASSWORD) =>
  api.post('/auth/password-reset/confirm', { challengeId, code, password, confirmPassword: password });

/** Everything about the answer except the values that differ per request. */
function shapeOf(body: any) {
  return {
    status: body.status,
    keys: Object.keys(body.challenge).sort(),
    masked: body.challenge.maskedDestination.replace(/[a-z0-9]/gi, 'x').length,
    idIsUuid: /^[0-9a-f-]{36}$/.test(body.challenge.challengeId),
  };
}

test('asking for a code for an unknown account looks the same, and sends nothing', async () => {
  const patient = await registerPatient(api);
  const known = await requestCode(patient.email);
  assert.equal(known.status, 200, JSON.stringify(known.body));
  assert.equal(sent.length, 1);

  // Same length as the known address, so the masked forms line up.
  const unknownEmail = patient.email.replace(/^user-/, 'nobd-');
  const unknown = await requestCode(unknownEmail);
  assert.equal(unknown.status, 200, JSON.stringify(unknown.body));
  assert.deepEqual(shapeOf(unknown.body), shapeOf(known.body));
  assert.equal(sent.length, 1, 'no code is sent to an unknown address');
  assert.equal(await db.otpChallenge.count({ where: { destination: unknownEmail } }), 0);

  // A code entered against the made-up challenge fails like a wrong code.
  const fake = await confirm(unknown.body.challenge.challengeId, '123456');
  const wrong = await confirm(known.body.challenge.challengeId, sent[0]!.code === '000000' ? '111111' : '000000');
  assert.equal(fake.status, wrong.status);
  const { requestId: _a, timestamp: _b, ...fakeBody } = fake.body;
  const { requestId: _c, timestamp: _d, ...wrongBody } = wrong.body;
  assert.deepEqual(fakeBody, wrongBody);

  // The resend cooldown applies either way.
  assert.equal((await requestCode(patient.email)).status, 429);
  assert.equal((await requestCode(unknownEmail)).status, 429);

  // An unknown mobile number answers the same way too.
  const phone = await requestCode(nextPhone());
  assert.equal(phone.status, 200);
  assert.equal(phone.body.status, 'code_sent');
  assert.equal(sent.length, 1);
});

test('a wrong code fails and the password stays the same', async () => {
  const patient = await registerPatient(api);
  const res = await requestCode(patient.email);
  const code = sent[0]!.code;
  const wrongCode = code === '999999' ? '000000' : String(Number(code) + 1).padStart(6, '0').slice(-6);
  const wrong = await confirm(res.body.challenge.challengeId, wrongCode);
  assert.equal(wrong.status, 422);
  assert.equal(wrong.body.code, 'VALIDATION_FAILED');

  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: PASSWORD })).status, 200);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: NEW_PASSWORD })).status, 401);
});

test('a weak or mismatched password is refused before the code is checked', async () => {
  const patient = await registerPatient(api);
  const res = await requestCode(patient.email);
  const id = res.body.challenge.challengeId;
  assert.equal((await confirm(id, sent[0]!.code, 'short')).status, 422);
  const mismatch = await api.post('/auth/password-reset/confirm', {
    challengeId: id, code: sent[0]!.code, password: NEW_PASSWORD, confirmPassword: 'Different123x',
  });
  assert.equal(mismatch.status, 422);
  // The code was not used up.
  assert.equal((await confirm(id, sent[0]!.code)).status, 200);
});

test('the code resets the password once, ends old sessions and logs in', async () => {
  const patient = await registerPatient(api);
  const oldLogin = await api.post('/auth/login', { identifier: patient.email, password: PASSWORD });
  const oldToken = oldLogin.body.session.accessToken as string;
  assert.equal((await api.get('/auth/me', oldToken)).status, 200);

  const res = await requestCode(patient.email);
  assert.equal(sent[0]!.to, patient.email);
  const done = await confirm(res.body.challenge.challengeId, sent[0]!.code);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.status, 'authenticated');
  assert.ok(done.cookie, 'a refresh cookie is set');
  assert.equal(JSON.stringify(done.body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(done.body).includes('refreshToken'), false);

  // The new session works, the old ones do not.
  assert.equal((await api.get('/auth/me', done.body.session.accessToken)).status, 200);
  assert.equal((await api.get('/auth/me', oldToken)).status, 401);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: oldLogin.cookie })).status, 401);
  assert.equal((await api.call('POST', '/auth/refresh', { cookie: patient.cookie })).status, 401);

  // Old password out, new password in.
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: PASSWORD })).status, 401);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: NEW_PASSWORD })).status, 200);

  // The same code cannot be used twice.
  assert.equal((await confirm(res.body.challenge.challengeId, sent[0]!.code, 'An0therPassword9')).status, 422);
  assert.equal((await api.post('/auth/login', { identifier: patient.email, password: NEW_PASSWORD })).status, 200);

  const audit = await db.auditLog.count({ where: { action: 'auth.password_reset' } });
  assert.ok(audit >= 1);
});

test('a doctor resets by mobile and is logged in', async () => {
  const mobile = nextPhone();
  const doctor = await registerDoctor(api, { phone: mobile });
  sent = [];
  const res = await requestCode(mobile);
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, `+88${mobile}`);
  const done = await confirm(res.body.challenge.challengeId, sent[0]!.code);
  assert.equal(done.body.status, 'authenticated', JSON.stringify(done.body));
  assert.equal(done.body.session.user.id, doctor.id ?? done.body.session.user.id);
  assert.equal((await api.post('/auth/login', { identifier: doctor.email, password: NEW_PASSWORD })).status, 200);
});

test('a clinic account reset by email with an unconfirmed mobile must log in again', async () => {
  const doctor = await registerDoctor(api);
  await db.user.update({ where: { email: doctor.email }, data: { mobileVerifiedAt: null } });
  sent = [];
  const res = await requestCode(doctor.email);
  const done = await confirm(res.body.challenge.challengeId, sent[0]!.code);
  assert.equal(done.status, 200);
  assert.deepEqual(done.body, { status: 'login_required' });
  assert.equal(done.cookie, null);
  const login = await api.post('/auth/login', { identifier: doctor.email, password: NEW_PASSWORD });
  assert.equal(login.body.status, 'otp_required');
});

test('a reset code cannot log in through /auth/verify-otp', async () => {
  const patient = await registerPatient(api);
  const res = await requestCode(patient.email);
  const viaOtp = await api.post('/auth/verify-otp', { challengeId: res.body.challenge.challengeId, code: sent[0]!.code });
  assert.equal(viaOtp.status, 401);
  assert.equal(viaOtp.cookie, null);
});

test('a code for another purpose cannot reset a password', async () => {
  const email = nextEmail();
  const register = await api.post('/auth/register', {
    fullName: 'Dr Other Code', email, bmdcNumber: 'A-987654', specialty: 'ENT', password: PASSWORD, confirmPassword: PASSWORD,
  });
  assert.equal(register.status, 201, JSON.stringify(register.body));
  const done = await confirm(register.body.challenge.challengeId, sent[0]!.code);
  assert.equal(done.status, 422);
  assert.equal((await api.post('/auth/login', { identifier: email, password: NEW_PASSWORD })).status, 401);
});

test('a deactivated account gets nothing', async () => {
  const patient = await registerPatient(api);
  await db.user.update({ where: { email: patient.email }, data: { isActive: false } });
  const res = await requestCode(patient.email);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'code_sent');
  assert.equal(sent.length, 0);
  assert.equal(await db.otpChallenge.count({ where: { destination: patient.email } }), 0);
});

test('a doctor a clinic added with no password is told to finish signing up', async () => {
  const mobile = nextPhone();
  const user = await db.user.create({
    data: {
      fullName: 'Dr Waiting', mobile: `+88${mobile}`, role: 'DOCTOR', passwordHash: null,
      doctorListing: { create: { name: 'Dr. Waiting', specialty: 'ENT', phone: mobile } },
    },
  });
  const res = await requestCode(mobile);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'DOCTOR_SIGNUP_REQUIRED');
  assert.equal(sent.length, 0);
  await db.user.delete({ where: { id: user.id } });
});
