import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { UnauthenticatedError } from '../../common/errors/domain-error';
import {
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  type RefreshTokenRepository,
  type UserRepository,
} from '../../core/ports/repositories';
import { CLOCK, type Clock } from '../../core/ports/services';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Token issuing and rotation.
 *
 * Single responsibility: this class knows how sessions are minted and refreshed
 * and nothing else. `AuthService` orchestrates credential checks and delegates
 * here, so the token policy can be reasoned about (and changed) in isolation.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly crypto: CryptoService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Mints a new access/refresh pair and starts a fresh rotation family. */
  async issue(
    userId: string,
    role: UserRole,
    tokenVersion: number,
    context: { userAgent?: string | null; ip?: string | null },
  ): Promise<IssuedTokens> {
    const practiceIds = await this.users.practiceIdsFor(userId);
    return this.mint(userId, role, tokenVersion, practiceIds, randomUUID(), context);
  }

  /**
   * Rotates a refresh token.
   *
   * The presented token is invalidated and replaced. If a token that was
   * already rotated is presented again, that is evidence the value leaked, so
   * the entire family is revoked and the session ends everywhere.
   */
  async rotate(
    presentedToken: string,
    context: { userAgent?: string | null; ip?: string | null },
  ): Promise<IssuedTokens> {
    const hash = this.crypto.sha256(presentedToken);
    const stored = await this.refreshTokens.findByHash(hash);

    if (!stored) throw new UnauthenticatedError('Your session has expired. Please sign in again.');

    if (stored.revokedAt) {
      // Replay of a rotated token — treat as compromise.
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthenticatedError('Your session was ended for security reasons.');
    }

    if (stored.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new UnauthenticatedError('Your session has expired. Please sign in again.');
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthenticatedError('Account is not active.');
    }

    const practiceIds = await this.users.practiceIdsFor(user.id);
    const next = await this.mint(
      user.id,
      user.role,
      user.tokenVersion,
      practiceIds,
      stored.familyId,
      context,
    );
    await this.refreshTokens.markRotated(stored.id, this.crypto.sha256(next.refreshToken));
    return next;
  }

  async revoke(presentedToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(this.crypto.sha256(presentedToken));
    if (stored) await this.refreshTokens.revokeFamily(stored.familyId);
  }

  /** Ends every session for a user (password change, staff kill-switch). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    await this.users.bumpTokenVersion(userId);
  }

  private async mint(
    userId: string,
    role: UserRole,
    tokenVersion: number,
    practiceIds: string[],
    familyId: string,
    context: { userAgent?: string | null; ip?: string | null },
  ): Promise<IssuedTokens> {
    const accessTtlSeconds = this.config.rules.auth.accessTokenTtlSeconds;

    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, ver: tokenVersion, practices: practiceIds },
      {
        secret: this.config.jwt.accessSecret,
        expiresIn: accessTtlSeconds,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      },
    );

    // The refresh token is opaque random material, not a JWT: it carries no
    // claims, so it cannot be read or partially trusted by a client.
    const refreshToken = this.crypto.generateToken(48);
    const expiresAt = this.clock.addDays(
      this.clock.now(),
      this.config.rules.auth.rememberMeDays,
    );

    await this.refreshTokens.issue({
      userId,
      tokenHash: this.crypto.sha256(refreshToken),
      familyId,
      expiresAt,
      userAgent: context.userAgent ?? null,
      ipHash: this.crypto.hashIp(context.ip ?? undefined),
    });

    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }
}
