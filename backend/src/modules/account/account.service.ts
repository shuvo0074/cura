import { Inject, Injectable } from '@nestjs/common';
import { sessionPermissions } from '../auth/auth.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NotFoundError, ValidationError } from '../../common/errors/domain-error';
import {
  AUDIT_REPOSITORY,
  USER_REPOSITORY,
  type AuditRepository,
  type UserProfilePatch,
  type UserRepository,
} from '../../core/ports/repositories';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/**
 * The signed-in user's own account: profile, password and 2FA.
 *
 * Every method acts on `principal.userId` and takes no user id from the
 * request, so there is no parameter a caller could swap to reach someone
 * else's account — the usual failure mode for "edit my profile" endpoints.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly crypto: CryptoService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async getProfile(principal: AuthenticatedPrincipal) {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new NotFoundError('User');
    const isSuperAdmin = await this.users.isSuperAdmin(user.id);

    // passwordHash and tokenVersion are deliberately not projected — this
    // response is rendered straight into the profile screen.
    //
    // It doubles as the "who am I" call the web client makes after a page
    // reload, so it carries everything `AuthenticatedUser` needs: without
    // permissions and the onboarding flag the client cannot rebuild a session
    // from the refresh cookie alone.
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      bmdcNumber: user.bmdcNumber,
      avatarUrl: user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      emailVerified: user.emailVerifiedAt !== null,
      mobileVerified: user.mobileVerifiedAt !== null,
      // Memberships, not the token: a super admin's reads reach every clinic.
      practiceIds: await this.users.practiceIdsFor(user.id),
      permissions: sessionPermissions(user.role, isSuperAdmin),
      ownerRoles: await this.users.ownerRolesFor(user.id),
      isSuperAdmin,
      onboardingCompleted: user.onboardingComplete,
    };
  }

  async updateProfile(principal: AuthenticatedPrincipal, patch: UserProfilePatch) {
    await this.users.updateProfile(principal.userId, patch);
    await this.trail(principal, 'account.profile.updated');
    return this.getProfile(principal);
  }

  /**
   * Password change.
   *
   * The current password is re-verified even though the caller holds a valid
   * access token: a token found on an unlocked machine must not be enough to
   * take the account over permanently.
   */
  async changePassword(
    principal: AuthenticatedPrincipal,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new NotFoundError('User');

    // Only an account with a password can hold a session, but the type allows null.
    const valid = user.passwordHash !== null && (await this.crypto.verifyPassword(user.passwordHash, currentPassword));
    if (!valid || user.passwordHash === null) throw new ValidationError('Your current password is incorrect.');

    if (await this.crypto.verifyPassword(user.passwordHash, newPassword)) {
      throw new ValidationError('The new password must differ from the current one.');
    }

    await this.users.setPassword(principal.userId, await this.crypto.hashPassword(newPassword));
    await this.trail(principal, 'account.password.changed');

    // Every session, including this one, is now invalid.
    return { changed: true, reauthenticationRequired: true };
  }

  async setTwoFactor(principal: AuthenticatedPrincipal, enabled: boolean) {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new NotFoundError('User');

    // 2FA delivers a code to a verified channel; enabling it against an
    // unverified mobile and email would lock the account out on next login.
    if (enabled && user.mobileVerifiedAt === null && user.emailVerifiedAt === null) {
      throw new ValidationError(
        'Verify your mobile number or email address before enabling two-factor authentication.',
      );
    }

    await this.users.setTwoFactorEnabled(principal.userId, enabled);
    await this.trail(principal, enabled ? 'account.2fa.enabled' : 'account.2fa.disabled');
    return { twoFactorEnabled: enabled };
  }

  private trail(principal: AuthenticatedPrincipal, action: string): Promise<void> {
    return this.audit.record({
      actorUserId: principal.userId,
      action,
      resourceType: 'user',
      resourceId: principal.userId,
      practiceId: principal.practiceIds[0] ?? null,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });
  }
}
