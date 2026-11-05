import { Inject, Injectable } from '@nestjs/common';
import {
  CLINIC_READ_PERMISSIONS,
  OtpPurpose,
  UserRole,
  permissionsForRole,
  type AuthSession,
  type DoctorClaimCompleteInput,
  type DoctorClaimStartInput,
  type LoginInput,
  type LoginResult,
  type PasswordResetConfirmInput,
  type RegisterInput,
} from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  ConflictError,
  InvalidCredentialsError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '../../common/errors/domain-error';
import { normalizeBmdc } from '../directory/domain/account-rules';
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

    // An admin already added this doctor, so they finish that record instead.
    if (mobile && (await this.users.findClaimableDoctor(mobile))) throw doctorSignupRequired();

    const bmdcNo = normalizeBmdc(input.bmdcNumber);
    if (!bmdcNo) {
      throw new ValidationError('Enter your BMDC registration number, e.g. A-12345.');
    }
    if (await this.users.bmdcTakenByOther(bmdcNo, null)) {
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

    // Patients see this doctor only after an admin approves the BMDC number.
    const user = await this.users.createDoctorApplicant({
      fullName: input.fullName,
      email,
      mobile,
      passwordHash: await this.crypto.hashPassword(input.password),
      bmdcNo,
      specialty: input.specialty,
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

    if (user.passwordHash === null) {
      if (await this.users.findClaimableDoctor(user.mobile ?? '')) throw doctorSignupRequired();
      throw new InvalidCredentialsError();
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
    const isClinicAccount = user.role !== UserRole.PUBLIC_USER;
    const needsSecondFactor = user.twoFactorEnabled || (isClinicAccount && !user.mobileVerifiedAt);
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
    // Only login and sign-up codes open a session here. A doctor sign-up code or a
    // password reset code proves a phone or email for its own flow and nothing else.
    if (result.purpose !== OtpPurpose.LOGIN && result.purpose !== OtpPurpose.REGISTRATION) {
      throw new InvalidCredentialsError();
    }

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

  /** The public facts that pre-fill the sign-up form. Never the BMDC number. */
  async lookupDoctorClaim(mobile: string) {
    const doctor = await this.users.findClaimableDoctor(mobile);
    if (!doctor) return { claimable: false as const };
    return {
      claimable: true as const,
      fullName: doctor.fullName,
      specialty: doctor.specialty,
      mobile: doctor.mobile,
    };
  }

  /**
   * Checks the BMDC number and sends a code to the doctor's phone.
   *
   * Phone and BMDC numbers can both be found publicly, so they cannot be enough
   * to take over a doctor's record. The code proves the phone is theirs.
   */
  async startDoctorClaim(input: DoctorClaimStartInput) {
    const { doctor } = await this.checkClaim(input.mobile, input.bmdcNumber);
    const challenge = await this.otp.issue({
      purpose: OtpPurpose.DOCTOR_CLAIM,
      destination: doctor.mobile,
      subjectId: doctor.userId,
    });
    return { status: 'otp_required' as const, challenge };
  }

  async completeDoctorClaim(
    input: DoctorClaimCompleteInput,
    ctx: RequestContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const proof = await this.otp.verify(input.challengeId, input.code);
    if (proof.purpose !== OtpPurpose.DOCTOR_CLAIM || !proof.subjectId) throw new InvalidCredentialsError();

    const { doctor, bmdcNo } = await this.checkClaim(proof.destination, input.bmdcNumber);
    if (doctor.userId !== proof.subjectId) throw new InvalidCredentialsError();

    const user = await this.users.completeDoctorClaim(doctor.userId, {
      passwordHash: await this.crypto.hashPassword(input.password),
      bmdcNo,
      email: input.email ?? null,
    });
    if (!user) throw new ConflictError('ACCOUNT_EXISTS', 'This doctor has already created a login.');

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.doctor_claimed',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
    });
    return this.createSession(user, ctx);
  }

  private async checkClaim(mobile: string, bmdcNumber: string) {
    const doctor = await this.users.findClaimableDoctor(mobile);
    if (!doctor) throw new NotFoundError('Doctor');

    const bmdcNo = normalizeBmdc(bmdcNumber);
    if (!bmdcNo) throw new ValidationError('Enter your BMDC registration number, e.g. A-12345.');
    if (doctor.bmdcNo && doctor.bmdcNo !== bmdcNo) {
      throw new ConflictError('BMDC_MISMATCH', 'That BMDC number does not match this doctor.');
    }
    if (await this.users.bmdcTakenByOther(bmdcNo, doctor.userId)) {
      throw new ConflictError('BMDC_ALREADY_REGISTERED', 'Another doctor already holds this BMDC number.');
    }
    return { doctor, bmdcNo };
  }

  /**
   * Sends a password reset code to the mobile number or email given.
   *
   * The answer is the same whether or not an account matches, so this cannot be
   * used to find out who has an account. With no match, nothing is stored or sent.
   * The one exception is a doctor a clinic added who has no password yet: the
   * login form already tells them to finish signing up, and this does the same.
   */
  async requestPasswordReset(identifier: string) {
    const user = await this.users.findByIdentifier(identifier);

    if (user?.isActive && user.passwordHash === null && user.mobile) {
      if (await this.users.findClaimableDoctor(user.mobile)) throw doctorSignupRequired();
    }

    const challenge =
      user?.isActive && user.passwordHash !== null
        ? await this.otp.issue({
            purpose: OtpPurpose.PASSWORD_RESET,
            // The address they typed, which is the one stored on the account.
            destination: identifier,
            subjectId: user.id,
          })
        : this.otp.decoy({ purpose: OtpPurpose.PASSWORD_RESET, destination: identifier });

    return { status: 'code_sent' as const, challenge };
  }

  /**
   * Sets a new password once the reset code checks out, which ends every
   * existing session. The person is then logged in, unless the account needs a
   * second code the reset did not prove (see `login`), in which case they log in
   * again with the new password.
   */
  async confirmPasswordReset(
    input: PasswordResetConfirmInput,
    ctx: RequestContext,
  ): Promise<
    | { status: 'authenticated'; session: AuthSession; refreshToken: string }
    | { status: 'login_required' }
  > {
    let proof: Awaited<ReturnType<OtpService['verify']>>;
    try {
      proof = await this.otp.verify(input.challengeId, input.code);
    } catch (error) {
      // A wrong code, an expired code and a code that was never sent all read the
      // same, so the answer says nothing about whether the account exists.
      if (error instanceof ValidationError || error instanceof RateLimitedError) throw resetCodeRejected();
      throw error;
    }
    if (proof.purpose !== OtpPurpose.PASSWORD_RESET || !proof.subjectId) throw resetCodeRejected();

    const user = await this.users.findById(proof.subjectId);
    if (!user || !user.isActive || user.passwordHash === null) throw resetCodeRejected();
    // The code went to an address on the account; refuse if that address has since changed.
    if (proof.destination !== user.email && proof.destination !== user.mobile) throw resetCodeRejected();

    await this.users.setPassword(user.id, await this.crypto.hashPassword(input.password));
    const viaMobile = proof.destination === user.mobile;
    if (viaMobile && !user.mobileVerifiedAt) await this.users.markVerified(user.id, 'mobile');
    if (!viaMobile && !user.emailVerifiedAt) await this.users.markVerified(user.id, 'email');

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: user.id,
      practiceId: null,
      ipHash: this.crypto.hashIp(ctx.ip ?? undefined),
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId ?? null,
      metadata: { channel: viaMobile ? 'mobile' : 'email' },
    });

    // Read again: the password change bumped the token version.
    const fresh = await this.users.findById(user.id);
    if (!fresh) throw resetCodeRejected();

    // Same rule as login: the second code goes to the mobile, or to the email when
    // there is no mobile. A reset code sent there already proves it.
    const isClinicAccount = fresh.role !== UserRole.PUBLIC_USER;
    const needsSecondFactor = fresh.twoFactorEnabled || (isClinicAccount && !fresh.mobileVerifiedAt);
    const secondFactorDestination = fresh.mobile ?? fresh.email;
    if (needsSecondFactor && secondFactorDestination !== proof.destination) {
      return { status: 'login_required' };
    }

    await this.users.recordSuccessfulLogin(fresh.id);
    const created = await this.createSession(fresh, ctx);
    return { status: 'authenticated', ...created };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const issued = await this.tokens.rotate(refreshToken, ctx);
    return issued;
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.tokens.revokeAllSessions(userId);
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
    const [practiceIds, ownerRoles, isSuperAdmin] = await Promise.all([
      this.users.practiceIdsFor(user.id),
      this.users.ownerRolesFor(user.id),
      this.users.isSuperAdmin(user.id),
    ]);

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
          permissions: sessionPermissions(user.role, isSuperAdmin),
          ownerRoles,
          isSuperAdmin,
          practiceIds,
          onboardingCompleted: user.onboardingComplete,
          avatarUrl: user.avatarUrl,
        },
      },
    };
  }
}

/** A super admin also reads any clinic, so the client shows those screens read-only. */
export function sessionPermissions(role: UserRole, isSuperAdmin: boolean) {
  const own = permissionsForRole(role);
  return isSuperAdmin ? [...new Set([...own, ...CLINIC_READ_PERMISSIONS])] : own;
}

/** The login does not exist yet: the client opens the pre-filled sign-up form. */
export const doctorSignupRequired = (): ConflictError =>
  new ConflictError(
    'DOCTOR_SIGNUP_REQUIRED',
    'A clinic already added you as a doctor. Finish signing up on Cura Dashboard.',
  );

/** One answer for every failed reset code, whatever the reason. */
const resetCodeRejected = (): ValidationError =>
  new ValidationError('That code is wrong or has expired. Check it, or ask for a new code.');

/**
 * A real Argon2id hash of a random value, used only to spend comparable CPU
 * time when an account does not exist. Never matches any password.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zdGF0aWMtc2FsdA$Qe0mQ5GTVWXjKXwq6cN2m0R0hqYQ5hVfJ0Zx0oGm0Zo';
