import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsentRepository } from '../../core/ports/repositories';

/**
 * Patient consent grants.
 *
 * Grants are per doctor and time-boxed. Nothing here revokes implicitly — an
 * expired grant simply stops matching, and the timeline re-locks on the next
 * read without any background job needing to run.
 */
@Injectable()
export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async activeGrant(
    patientId: string,
    userId: string,
    now: Date,
  ): Promise<{ expiresAt: Date } | null> {
    const row = await this.prisma.patientConsent.findFirst({
      where: {
        patientId,
        grantedToUserId: userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    return row ?? null;
  }

  async grant(input: {
    patientId: string;
    grantedToUserId: string;
    expiresAt: Date;
    method: string;
  }): Promise<void> {
    await this.prisma.patientConsent.create({
      data: {
        patientId: input.patientId,
        grantedToUserId: input.grantedToUserId,
        expiresAt: input.expiresAt,
        method: input.method,
      },
    });
  }

  async revoke(patientId: string, userId: string): Promise<void> {
    await this.prisma.patientConsent.updateMany({
      where: { patientId, grantedToUserId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
