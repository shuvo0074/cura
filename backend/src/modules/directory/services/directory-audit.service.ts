import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../../core/ports/repositories';

/** Records who changed what on the public directory in the shared audit trail. */
@Injectable()
export class DirectoryAudit {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  record(actorUserId: string | null, action: string, resourceType: string, resourceId: string | null, metadata?: Record<string, unknown>) {
    return this.audit.record({
      actorUserId,
      action: `directory.${action}`,
      resourceType,
      resourceId,
      practiceId: null,
      ipHash: null,
      userAgent: null,
      requestId: null,
      ...(metadata ? { metadata } : {}),
    });
  }
}
