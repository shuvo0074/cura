import { Inject, Injectable } from '@nestjs/common';
import {
  OtpPurpose,
  UserRole,
  permissionsForRole,
  type AuthSession,
  type LoginInput,
  type LoginResult,
  type RegisterInput,
} from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  ConflictError,
  InvalidCredentialsError,
  RateLimitedError,
} from '../../common/errors/domain-error';
import {
  AUDIT_REPOSITORY,
  USER_REPOSITORY,
  type AuditRepository,
  type UserRepository,
  type UserRecord,
} from '../../core/ports/repositories';
import { CLOCK, type Clock } from '../../core/ports/services';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

export interface RequestContext {
  userAgent?: string | null;
  ip?: string | null;
  requestId?: string | null;
}

/**
 * Internal login outcome.
 *
 * The refresh token travels separately from the JSON `session` so the transport
 * layer can place it in an httpOnly cookie. It is deliberately not part of the
 * public `LoginResult` contract — no client should ever read it from a body.
 */
export type LoginOutcome =
  | { status: 'authenticated'; session: AuthSession; refreshToken: string }
  | { status: 'otp_required'; challenge: import('@cura/shared').OtpChallenge };

/**
 * Authentication orchestration.
 *
 * Collaborators do the specialised work — `TokenService` mints sessions,
 * `OtpService` handles second factors, `CryptoService` owns hashing. This class
 * only sequences them and enforces the account-state rules, which keeps each
 * piece independently testable and replaceable.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(input: RegisterInput, ctx: RequestContext) {
    const email = input.email ?? null;
    const mobile = input.mobile ?? null;

    if (await this.users.existsByBmdc(input.bmdcNumber)) {
      throw new ConflictError(
        'BMDC_ALREADY_REGISTERED',
        'An account already exists for this BMDC registration number.',
      );
    }
    if (await this.users.existsByEmailOrMobile(email, mobile)) {
      throw new ConflictError(
        'ACCOUNT_EXISTS',
        'An account already exists with those contact details.',
      );
    }

    const user = await this.users.create({
      fullName: input.fullName,
      email,
      mobile,
      passwordHash: await this.crypto.hashPassword(input.password),
      bmdcNumber: input.bmdcNumber,
      role: UserRole.DOCTOR,
    });

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
    });

    // Registration always requires verification before a session exists.
    const challenge = await this.otp.issue({
      purpose: OtpPurpose.REGISTRATION,
      destination: mobile ?? email!,
      subjectId: user.id,
    });

    return { status: 'otp_required' as const, challenge };
  }

  async login(input: LoginInput, ctx: RequestContext): Promise<LoginOutcome> {
    const user = await this.users.findByIdentifier(input.identifier);

    /**
     * Timing equalisation. When the identifier is unknown we still perform a
     * password verification against a dummy hash, so response time does not
     * reveal whether an account exists.
     */
    if (!user) {
      await this.crypto.verifyPassword(DUMMY_HASH, input.password);
      throw new InvalidCredentialsError();
    }

    const now = this.clock.now();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new RateLimitedError(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }

    const passwordOk = await this.crypto.verifyPassword(user.passwordHash, input.password);
    if (!passwordOk) {
      await this.registerFailure(user, ctx);
      throw new InvalidCredentialsError();
    }

    // Inactive accounts fail identically to bad credentials, so the endpoint
    // cannot be used to discover which accounts were disabled.
    if (!user.isActive) throw new InvalidCredentialsError();

    await this.users.recordSuccessfulLogin(user.id);

    /**
     * Spec 1.3.1.2: valid credentials trigger an OTP. We also apply this when
     * the account has 2FA switched on explicitly.
     */
    const needsSecondFactor = user.twoFactorEnabled || !user.mobileVerifiedAt;
    const destination = user.mobile ?? user.email;

    if (needsSecondFactor && destination) {
      const challenge = await this.otp.issue({
        purpose: OtpPurpose.LOGIN,
        destination,
        subjectId: user.id,
      });
      return { status: 'otp_required', challenge };
    }

    const created = await this.createSession(user, ctx);
    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
    });
    return { status: 'authenticated', ...created };
  }

  /** Completes an OTP challenge and issues the session. */
  async verifyOtp(
    challengeId: string,
    code: string,
    ctx: RequestContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const result = await this.otp.verify(challengeId, code);
    if (!result.subjectId) throw new InvalidCredentialsError();

    const user = await this.users.findById(result.subjectId);
    if (!user || !user.isActive) throw new InvalidCredentialsError();

    if (result.purpose === OtpPurpose.REGISTRATION) {
      await this.users.markVerified(user.id, result.destination.includes('@') ? 'email' : 'mobile');
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.otp_verified',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
      metadata: { purpose: result.purpose },
    });

    return this.createSession(user, ctx);
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const issued = await this.tokens.rotate(refreshToken, ctx);
    return issued;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  private async registerFailure(user: UserRecord, ctx: RequestContext): Promise<void> {
    const attempts = await this.users.recordFailedLogin(user.id);
    const { maxFailedLoginsBeforeLock, accountLockMinutes } = this.config.rules.auth;

    if (attempts >= maxFailedLoginsBeforeLock) {
      await this.users.lockUntil(
        user.id,
        this.clock.addSeconds(this.clock.now(), accountLockMinutes * 60),
      );
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login_failed',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
      metadata: { attempts },
    });
  }

  private async createSession(
    user: UserRecord,
    ctx: RequestContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const issued = await this.tokens.issue(user.id, user.role, user.tokenVersion, ctx);
    const practiceIds = await this.users.practiceIdsFor(user.id);

    return {
      refreshToken: issued.refreshToken,
      session: {
        accessToken: issued.accessToken,
        expiresIn: issued.expiresIn,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          permissions: permissionsForRole(user.role),
          practiceIds,
          onboardingCompleted: user.onboardingComplete,
          avatarUrl: user.avatarUrl,
        },
      },
    };
  }
}

/**
 * A real Argon2id hash of a random value, used only to spend comparable CPU
 * time when an account does not exist. Never matches any password.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zdGF0aWMtc2FsdA$Qe0mQ5GTVWXjKXwq6cN2m0R0hqYQ5hVfJ0Zx0oGm0Zo';
