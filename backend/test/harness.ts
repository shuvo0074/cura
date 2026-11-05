import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Boots the real application against a throwaway database. It refuses any database
 * whose name does not contain "test", so it can never touch real data.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a throwaway database');
if (!new URL(url).pathname.includes('test')) throw new Error('TEST_DATABASE_URL must name a test database');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-012345678',
  FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
  OTP_PEPPER: 'test-pepper-test-pepper',
  LOG_LEVEL: 'error',
  THROTTLE_DISABLED: 'true',
});

// Uploads land in a temporary folder, away from any real media.
process.chdir(mkdtempSync(join(tmpdir(), 'cura-test-')));

export const db = new PrismaClient({ datasources: { db: { url } } });

export const PASSWORD = 'Str0ngPassword';

export interface Res {
  status: number;
  body: any;
  headers: Headers;
  cookie: string | null;
}

export class TestApi {
  private constructor(
    readonly app: NestExpressApplication,
    private readonly base: string,
  ) {}

  static async start(env: Record<string, string> = {}): Promise<TestApi> {
    Object.assign(process.env, env);
    // Rate-limit counters start clean in the dedicated test Redis database.
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.flushdb();
    redis.disconnect();
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    return new TestApi(app, `http://127.0.0.1:${address.port}/api`);
  }

  async call(
    method: string,
    path: string,
    options: { token?: string | undefined; body?: unknown; form?: FormData; cookie?: string | null } = {},
  ): Promise<Res> {
    const headers: Record<string, string> = {};
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers,
      ...(options.form ? { body: options.form } : {}),
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    const setCookie = response.headers.get('set-cookie');
    return { status: response.status, body, headers: response.headers, cookie: setCookie ? setCookie.split(';')[0]! : null };
  }

  get = (path: string, token?: string) => this.call('GET', path, { token });
  post = (path: string, body: unknown = {}, token?: string) => this.call('POST', path, { body, token });
  patch = (path: string, body: unknown = {}, token?: string) => this.call('PATCH', path, { body, token });
  put = (path: string, body: unknown = {}, token?: string) => this.call('PUT', path, { body, token });
  del = (path: string, token?: string) => this.call('DELETE', path, { token });

  async stop(): Promise<void> {
    await this.app.close();
  }
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter += 1)}`;
let phoneCounter = Math.floor(Math.random() * 1_000_000);

export const nextPhone = () => `0171${String((phoneCounter += 1) % 10_000_000).padStart(7, '0')}`;
export const nextEmail = () => `user-${unique()}@example.com`;
let bmdcCounter = 100_000 + Math.floor(Math.random() * 800_000);
export const nextBmdc = () => `A-${(bmdcCounter += 1)}`;

export async function registerPatient(api: TestApi) {
  const email = nextEmail();
  const res = await api.post('/auth/register/patient', { name: 'Test Patient', email, password: PASSWORD, phone: nextPhone() });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { ...res.body, email, token: res.body.accessToken as string, cookie: res.cookie };
}

export async function registerDoctor(api: TestApi, overrides: Record<string, unknown> = {}) {
  const email = nextEmail();
  const bmdcNo = (overrides.bmdcNo as string) ?? nextBmdc();
  const res = await api.post('/auth/register/doctor', {
    name: 'Test Doctor',
    email,
    password: PASSWORD,
    phone: nextPhone(),
    specialty: 'Cardiology',
    degrees: ['MBBS', 'FCPS (Medicine)'],
    ...overrides,
    bmdcNo,
  });
  if (res.status !== 201) throw new Error(`register doctor failed: ${JSON.stringify(res.body)}`);
  return { ...res.body, email, bmdcNo, token: res.body.accessToken as string };
}

export async function directoryAdmin(api: TestApi) {
  const account = await registerPatient(api);
  await db.userDirectoryRole.create({ data: { userId: account.id, role: 'ADMIN' } });
  return account;
}

/** Signs a doctor up and approves them, returning a verified linked doctor. */
export async function verifiedDoctor(api: TestApi, adminToken: string, overrides: Record<string, unknown> = {}) {
  const doctor = await registerDoctor(api, overrides);
  const pending = await db.doctorVerification.findFirstOrThrow({ where: { userId: doctor.id, status: 'PENDING' } });
  const approved = await api.post(`/directory/admin/verifications/${pending.id}/approve`, {}, adminToken);
  if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.body)}`);
  return { ...doctor, doctorId: approved.body.doctorId as string };
}

/** The next date, on or after `fromDays` ahead, that matches the predicate. */
export function dateAhead(fromDays: number, accept: (weekday: number) => boolean): string {
  for (let i = fromDays; i < fromDays + 14; i += 1) {
    const date = new Date(Date.now() + i * 86_400_000);
    if (accept(date.getUTCDay())) return date.toISOString().slice(0, 10);
  }
  throw new Error('No matching date');
}

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export function imageForm(bytes: Buffer, type = 'image/png', name = 'photo.png'): FormData {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(bytes)], { type }), name);
  return form;
}
