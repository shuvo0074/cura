import { Inject, Injectable } from '@nestjs/common';
import { businessRules } from '@cura/shared';
import { type Env, loadEnv } from './env.schema';

export const ENV_TOKEN = Symbol('CURA_ENV');

/**
 * Typed configuration facade.
 *
 * Nothing outside this class reads `process.env`. Consumers inject
 * `AppConfigService` and receive validated, typed values, which keeps
 * configuration a single substitutable dependency (D in SOLID) rather than a
 * global that every module reaches into.
 */
@Injectable()
export class AppConfigService {
  constructor(@Inject(ENV_TOKEN) private readonly env: Env) {}

  static fromProcess(): AppConfigService {
    return new AppConfigService(loadEnv());
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }
  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
  get port(): number {
    return this.env.PORT;
  }
  get apiPrefix(): string {
    return this.env.API_PREFIX;
  }
  get trustProxy(): boolean {
    return this.env.TRUST_PROXY;
  }
  get logLevel(): string {
    return this.env.LOG_LEVEL;
  }
  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS;
  }

  get database() {
    return { url: this.env.DATABASE_URL } as const;
  }

  get redis() {
    return { url: this.env.REDIS_URL } as const;
  }

  get jwt() {
    return {
      accessSecret: this.env.JWT_ACCESS_SECRET,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      accessTtl: this.env.JWT_ACCESS_TTL,
      refreshTtl: this.env.JWT_REFRESH_TTL,
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
    } as const;
  }

  get crypto() {
    return {
      fieldKey: Buffer.from(this.env.FIELD_ENCRYPTION_KEY, 'hex'),
      otpPepper: this.env.OTP_PEPPER,
    } as const;
  }

  get throttle() {
    return {
      ttlSeconds: this.env.THROTTLE_TTL_SECONDS,
      limit: this.env.THROTTLE_LIMIT,
      disabled: this.env.THROTTLE_DISABLED === 'true',
    } as const;
  }

  get sms() {
    return {
      provider: this.env.SMS_PROVIDER,
      apiKey: this.env.SMS_API_KEY,
      senderId: this.env.SMS_SENDER_ID,
    } as const;
  }

  get email() {
    return {
      provider: this.env.EMAIL_PROVIDER,
      apiKey: this.env.EMAIL_API_KEY,
      from: this.env.EMAIL_FROM,
    } as const;
  }

  get storage() {
    return {
      driver: this.env.STORAGE_DRIVER,
      bucket: this.env.STORAGE_BUCKET,
      region: this.env.STORAGE_REGION,
    } as const;
  }

  /** Cross-platform business rules, re-exported so services have one source. */
  get rules() {
    return businessRules;
  }
}
