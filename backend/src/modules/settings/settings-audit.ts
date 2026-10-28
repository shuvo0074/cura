import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../core/ports/repositories';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/**
 * Audit entry for a settings change.
 *
 * Settings writes are recorded with the actor and practice only — no request
 * metadata — so every settings service writes the same shape through here.
 */
@Injectable()
export class SettingsAuditTrail {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  record(
    principal: AuthenticatedPrincipal,
    practiceId: string,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    return this.audit.record({
      actorUserId: principal.userId,
      action,
      resourceType,
      resourceId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });
  }
}
