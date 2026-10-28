import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@cura/shared';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConflictError, ValidationError } from '../../common/errors/domain-error';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  STAFF_REPOSITORY,
  type StaffNotificationPrefs,
  type StaffRepository,
} from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsAuditTrail } from './settings-audit';

/** Practice staff: onboarding members, editing them, and revoking access. */
@Injectable()
export class StaffSettingsService {
  constructor(
    private readonly crypto: CryptoService,
    @Inject(STAFF_REPOSITORY) private readonly staff: StaffRepository,
    private readonly trail: SettingsAuditTrail,
  ) {}

  async listStaff(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.staff.listStaff(practiceId);
  }

  async addStaff(
    practiceId: string,
    input: {
      fullName: string;
      email: string | null;
      mobile: string | null;
      role: string;
      bmdcNumber: string | null;
      temporaryPassword: string;
    },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);

    // BMDC registration is mandatory for anyone who practises and irrelevant
    // for the front desk.
    if (input.role === UserRole.DOCTOR && !input.bmdcNumber) {
      throw new ValidationError('A BMDC registration number is required for doctors.');
    }

    const staff = await this.staff.addStaff({
      practiceId,
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      role: input.role,
      bmdcNumber: input.bmdcNumber,
      passwordHash: await this.crypto.hashPassword(input.temporaryPassword),
    });

    await this.trail.record(principal, practiceId, 'settings.staff.added', 'user', staff.userId);
    return staff;
  }

  /**
   * Instant access revocation.
   *
   * Ends the member's active sessions immediately — the repository bumps their
   * token version, so already-issued access tokens stop verifying on the next
   * request rather than at expiry.
   */
  async setStaffActive(
    practiceId: string,
    userId: string,
    isActive: boolean,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    if (userId === principal.userId && !isActive) {
      throw new ConflictError('CANNOT_DISABLE_SELF', 'You cannot deactivate your own account.');
    }

    await this.staff.setStaffActive(practiceId, userId, isActive);
    await this.trail.record(
      principal,
      practiceId,
      isActive ? 'settings.staff.reactivated' : 'settings.staff.deactivated',
      'user',
      userId,
    );
    return { userId, isActive };
  }

  /**
   * Edits a member's record and notification matrix.
   *
   * Demoting yourself is rejected for the same reason self-deactivation is: a
   * sole administrator who picks "Consultant" locks the practice out of its own
   * settings with no way back in.
   */
  async updateStaff(
    practiceId: string,
    userId: string,
    patch: {
      fullName?: string;
      email?: string | null;
      mobile?: string | null;
      bmdcNumber?: string | null;
      role?: string;
      notifications?: Partial<StaffNotificationPrefs>;
    },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);

    if (patch.role && userId === principal.userId) {
      throw new ConflictError('CANNOT_DEMOTE_SELF', 'You cannot change your own access level.');
    }
    if (patch.role === UserRole.DOCTOR && patch.bmdcNumber === null) {
      throw new ValidationError('A BMDC registration number is required for doctors.');
    }

    const updated = await this.staff.updateStaff(practiceId, userId, patch);
    await this.trail.record(principal, practiceId, 'settings.staff.updated', 'user', userId);
    return updated;
  }
}
