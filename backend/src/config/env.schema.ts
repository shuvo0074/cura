import { z } from 'zod';

/**
 * Environment contract, validated once at boot.
 *
 * The process refuses to start on a malformed or missing value rather than
 * failing later at the first request. Secrets carry minimum-length floors so a
 * placeholder value cannot reach production unnoticed.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().url(),
  /**
   * Prisma connections per API process. Prisma's own default is derived from
   * the CPU count it sees, which on shared hosts can be the host's core count
   * and exceed what the database accepts. Ignored when DATABASE_URL already
   * sets `connection_limit`.
   */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  REDIS_URL: z.string().url(),

  /** Distinct secrets: a leaked access secret must not mint refresh tokens. */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().default('cura.api'),
  JWT_AUDIENCE: z.string().default('cura.client'),

  /** AES-256-GCM key (hex, 32 bytes) for column-level encryption of NID etc. */
  FIELD_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  /** Pepper mixed into OTP hashes so a DB dump alone cannot replay codes. */
  OTP_PEPPER: z.string().min(16),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  /** Turns every rate limit off — for the end-to-end suite only. Rejected
   *  outside development and test below. */
  THROTTLE_DISABLED: z.enum(['true', 'false']).default('false'),

  SMS_PROVIDER: z.enum(['console', 'ssl_wireless', 'twilio']).default('console'),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'ses', 'sendgrid']).default('console'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('no-reply@cura.health'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Proxy hops in front of the API whose X-Forwarded-For is trusted:
   *  false/0 = none, true = 1, or a count (Netlify proxy + host balancer = 2).
   *  Parsed by hand: `z.coerce.boolean()` reads the string "false" as true. */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => (v === 'false' ? 0 : v === 'true' ? 1 : Number(v)))
    .pipe(z.number().int().min(0).max(5)),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;

  if (env.THROTTLE_DISABLED === 'true' && env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    throw new Error('THROTTLE_DISABLED is only allowed in development and test');
  }

  // Production must not run on development defaults.
  if (env.NODE_ENV === 'production') {
    if (env.CORS_ORIGINS.length === 0) {
      throw new Error('CORS_ORIGINS must be set explicitly in production');
    }
    if (env.SMS_PROVIDER === 'console' || env.EMAIL_PROVIDER === 'console') {
      throw new Error('Console SMS/email drivers are not permitted in production');
    }
  }

  return env;
}
