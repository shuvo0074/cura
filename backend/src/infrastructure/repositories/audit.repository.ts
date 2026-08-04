import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditEntry, AuditRepository } from '../../core/ports/repositories';

/**
 * Append-only audit trail for PHI access and security events.
 *
 * Writes are best-effort with respect to the caller: an audit failure is logged
 * loudly but never converts a successful clinical action into an error the
 * doctor sees. The trail is a control, not a transaction participant.
 */
@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  private readonly logger = new Logger(PrismaAuditRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          practiceId: entry.practiceId,
          ipHash: entry.ipHash,
          userAgent: entry.userAgent?.slice(0, 300) ?? null,
          requestId: entry.requestId,
          metadata: (entry.metadata ?? undefined) as never,
        },
      });
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Failed to write audit entry');
    }
  }
}
