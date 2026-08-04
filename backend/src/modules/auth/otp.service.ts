import { Inject, Injectable, Logger } from '@nestjs/common';
import { OtpPurpose, maskEmail, maskMobile, type OtpChallenge } from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RateLimitedError, ValidationError } from '../../common/errors/domain-error';
import { OTP_REPOSITORY, type OtpRepository } from '../../core/ports/repositories';
import {
  CLOCK,
  EMAIL_SENDER,
  SMS_SENDER,
  type Clock,
  type EmailSender,
  type SmsSender,
} from '../../core/ports/services';

/**
 * One-time password issuing and verification.
 *
 * Design points that matter for security:
 *  - Codes are generated with a CSPRNG and stored only as peppered HMACs.
 *  - Verification is constant-time and bounded by an attempt counter, so an
 *    attacker cannot brute-force a 6-digit code.
 *  - Resend is rate limited per destination.
 *  - The destination is echoed back masked, never in full.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: CryptoService,
    @Inject(OTP_REPOSITORY) private readonly otps: OtpRepository,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async issue(input: {
    purpose: OtpPurpose;
    destination: string;
    subjectId: string | null;
  }): Promise<OtpChallenge> {
    const rules = this.config.rules.auth;
    const now = this.clock.now();

    const lastIssued = await this.otps.lastIssuedAt(input.destination, input.purpose);
    if (lastIssued) {
      const elapsed = (now.getTime() - lastIssued.getTime()) / 1000;
      if (elapsed < rules.otpResendCooldownSeconds) {
        throw new RateLimitedError(
          `Please wait ${Math.ceil(rules.otpResendCooldownSeconds - elapsed)}s before requesting another code.`,
        );
      }
    }

    const code = this.crypto.generateNumericCode(rules.otpLength);
    const expiresAt = this.clock.addSeconds(now, rules.otpTtlSeconds);

    const challenge = await this.otps.create({
      purpose: input.purpose,
      destination: input.destination,
      codeHash: this.crypto.hashOtp(input.purpose, input.destination, code),
      subjectId: input.subjectId,
      expiresAt,
      maxAttempts: rules.otpMaxAttempts,
    });

    await this.deliver(input.destination, code, input.purpose);

    return {
      challengeId: challenge.id,
      maskedDestination: this.mask(input.destination),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: this.clock
        .addSeconds(now, rules.otpResendCooldownSeconds)
        .toISOString(),
    };
  }

  /**
   * Verifies a code and consumes the challenge.
   *
   * Returns the challenge subject on success so the caller can complete the
   * flow (activate an account, issue a session, unlock a record).
   */
  async verify(challengeId: string, code: string): Promise<{ subjectId: string | null; destination: string; purpose: OtpPurpose }> {
    const challenge = await this.otps.findActiveById(challengeId);
    if (!challenge) {
      throw new ValidationError('This code has expired. Request a new one.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new RateLimitedError('Too many incorrect attempts. Request a new code.');
    }

    const expected = challenge.codeHash;
    const actual = this.crypto.hashOtp(challenge.purpose, challenge.destination, code);

    if (!this.crypto.safeEquals(expected, actual)) {
      const attempts = await this.otps.incrementAttempts(challengeId);
      const remaining = Math.max(0, challenge.maxAttempts - attempts);
      throw new ValidationError(
        remaining > 0
          ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Request a new code.',
      );
    }

    await this.otps.consume(challengeId);
    return {
      subjectId: challenge.subjectId,
      destination: challenge.destination,
      purpose: challenge.purpose,
    };
  }

  private mask(destination: string): string {
    return destination.includes('@') ? maskEmail(destination) : maskMobile(destination);
  }

  private async deliver(destination: string, code: string, purpose: OtpPurpose): Promise<void> {
    const ttlMinutes = Math.round(this.config.rules.auth.otpTtlSeconds / 60);
    const body = `Your Cura verification code is ${code}. It expires in ${ttlMinutes} minutes. Do not share this code.`;

    try {
      if (destination.includes('@')) {
        await this.email.send({
          to: destination,
          subject: 'Your Cura verification code',
          text: body,
          html: `<p>Your Cura verification code is <strong>${code}</strong>.</p><p>It expires in ${ttlMinutes} minutes. Do not share this code with anyone.</p>`,
        });
      } else {
        await this.sms.send({ to: destination, body, reference: purpose });
      }
    } catch (error) {
      // Delivery failure must not reveal whether the destination exists, and
      // must not roll back the challenge — the user can retry after cooldown.
      this.logger.error({ err: error, purpose }, 'OTP delivery failed');
    }
  }
}
