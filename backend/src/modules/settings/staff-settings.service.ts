import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@cura/shared';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-error';
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
    // An owner has no access to other owners, including seeing them.
    const members = await this.staff.listStaff(practiceId);
    return members.filter((m) => m.role !== UserRole.ADMINISTRATOR || m.userId === principal.userId);
  }

  async addStaff(
    practiceId: string,
    input: {
      fullName: string;
      email: string | null;
      mobile: string | null;
      role: string;
      bmdcNumber: string | null;
      specialty: string | null;
      temporaryPassword: string | null;
    },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);

    // Only a super admin creates owners. An owner adds doctors and clinic staff.
    if (input.role !== UserRole.DOCTOR && input.role !== UserRole.DESK_STAFF) {
      throw new ForbiddenError('You can only add doctors and clinic staff.');
    }
    if (input.role === UserRole.DOCTOR) {
      // The phone is how the doctor later finds this record and signs up.
      if (!input.mobile) throw new ValidationError('A mobile number is required for doctors.');
      if (!input.specialty) throw new ValidationError('A specialty is required for doctors.');
      // Without a login the doctor proves their BMDC number when they sign up.
      if (input.temporaryPassword && !input.bmdcNumber) {
        throw new ValidationError('A BMDC registration number is required to create a doctor\'s login.');
      }
    } else if (!input.temporaryPassword) {
      throw new ValidationError('A temporary password is required for clinic staff.');
    }

    const staff = await this.staff.addStaff({
      practiceId,
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      role: input.role,
      bmdcNumber: input.bmdcNumber,
      specialty: input.specialty,
      passwordHash: input.temporaryPassword ? await this.crypto.hashPassword(input.temporaryPassword) : null,
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
    await this.assertNotAnotherOwner(practiceId, userId, principal);

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

  /** Lets a clinic set a password for a doctor it added without a login. */
  async createStaffLogin(
    practiceId: string,
    userId: string,
    temporaryPassword: string,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    const created = await this.staff.createLogin(
      practiceId,
      userId,
      await this.crypto.hashPassword(temporaryPassword),
    );
    if (!created) throw new ConflictError('LOGIN_EXISTS', 'This member already has a login.');
    await this.trail.record(principal, practiceId, 'settings.staff.login_created', 'user', userId);
    return { userId, hasLogin: true };
  }

  private async assertNotAnotherOwner(
    practiceId: string,
    userId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<string> {
    const role = await this.staff.memberRole(practiceId, userId);
    if (!role) throw new NotFoundError('Staff member');
    if (role === UserRole.ADMINISTRATOR && userId !== principal.userId) {
      throw new ForbiddenError('You do not have access to other owners.');
    }
    return role;
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

    const role = await this.assertNotAnotherOwner(practiceId, userId, principal);
    // A member's type is fixed: a doctor is also a doctor on Cura Website, and only
    // a super admin creates owners. The form still sends the current value.
    if (patch.role && patch.role !== role) {
      throw new ConflictError('ROLE_LOCKED', 'A member\'s access level cannot be changed. Add them again instead.');
    }
    // Those details are shared, so one clinic cannot change them for another.
    if (await this.staff.belongsToAnotherClinic(practiceId, userId)) {
      const current = (await this.staff.listStaff(practiceId)).find((m) => m.userId === userId);
      const changesPerson = (['fullName', 'email', 'mobile', 'bmdcNumber'] as const).some(
        (key) => patch[key] !== undefined && patch[key] !== current?.[key],
      );
      if (!changesPerson) {
        const updated = await this.staff.updateStaff(practiceId, userId, {
          ...(patch.notifications ? { notifications: patch.notifications } : {}),
        });
        await this.trail.record(principal, practiceId, 'settings.staff.updated', 'user', userId);
        return updated;
      }
      throw new ConflictError(
        'SHARED_DOCTOR',
        'This doctor also works at another clinic, so only they can change these details.',
      );
    }

    const updated = await this.staff.updateStaff(practiceId, userId, patch);
    await this.trail.record(principal, practiceId, 'settings.staff.updated', 'user', userId);
    return updated;
  }
}
