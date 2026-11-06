import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditEntry, AuditRepository, AuditRow, AuditSearch } from '../../core/ports/repositories';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only what the activity log shows about the person. Never a password hash or token version. */
const ACTOR_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  directoryRoles: { select: { role: true } },
} as const;

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

  async search(filter: AuditSearch): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.practiceId) where.practiceId = filter.practiceId;
    if (filter.from || filter.to) {
      where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
    }
    if (filter.action) where.action = filter.action;
    if (filter.actor) {
      where.actor = {
        OR: [
          { fullName: { contains: filter.actor, mode: 'insensitive' } },
          { email: { contains: filter.actor, mode: 'insensitive' } },
        ],
      };
    }
    if (filter.q) {
      where.OR = [
        { action: { contains: filter.q, mode: 'insensitive' } },
        { resourceType: { contains: filter.q, mode: 'insensitive' } },
        { resourceId: { contains: filter.q, mode: 'insensitive' } },
        { requestId: filter.q },
      ];
    }

    const cursor = filter.cursor && UUID.test(filter.cursor) ? filter.cursor : null;
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: ACTOR_SELECT } },
    });
    const page = rows.slice(0, filter.limit);
    const nextCursor = rows.length > filter.limit ? page[page.length - 1]!.id : null;

    const [practiceNames, resourceNames] = await Promise.all([this.practiceNames(page), this.resourceNames(page)]);

    const items: AuditRow[] = page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      resourceName: (row.resourceId && resourceNames.get(`${row.resourceType}:${row.resourceId}`)) ?? null,
      practiceId: row.practiceId,
      practiceName: (row.practiceId && practiceNames.get(row.practiceId)) ?? null,
      ipHash: row.ipHash,
      userAgent: row.userAgent,
      requestId: row.requestId,
      metadata: row.metadata,
      actor: row.actor
        ? {
            id: row.actor.id,
            fullName: row.actor.fullName,
            email: row.actor.email,
            clinicRole: row.actor.role === 'PUBLIC_USER' ? null : row.actor.role,
            roles: row.actor.directoryRoles.map((r) => r.role.toLowerCase()),
          }
        : null,
    }));
    return { items, nextCursor };
  }

  async actions(practiceId?: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: practiceId ? { practiceId } : {},
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((row) => row.action);
  }

  private async practiceNames(rows: { practiceId: string | null }[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.practiceId).filter((id): id is string => !!id))];
    if (ids.length === 0) return new Map();
    const practices = await this.prisma.practice.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(practices.map((p) => [p.id, p.name]));
  }

  /**
   * Names for the subjects on one page, one query per kind. A patient's name is
   * only filled in when the patient belongs to the clinic the row is about, so a
   * clinic's log can never name another clinic's patient.
   */
  private async resourceNames(
    rows: { resourceType: string; resourceId: string | null; practiceId: string | null }[],
  ): Promise<Map<string, string>> {
    const idsOf = (type: string) => [
      ...new Set(rows.filter((r) => r.resourceType === type && r.resourceId && UUID.test(r.resourceId)).map((r) => r.resourceId!)),
    ];
    const names = new Map<string, string>();
    const put = (type: string, list: { id: string; name: string }[]) => list.forEach((item) => names.set(`${type}:${item.id}`, item.name));
    const byIds = (type: string) => ({ where: { id: { in: idsOf(type) } } });

    const patientIds = idsOf('patient');
    const [users, patients, practices, pharmacies, hospitals, ambulances, doctors] = await Promise.all([
      idsOf('user').length ? this.prisma.user.findMany({ ...byIds('user'), select: { id: true, fullName: true } }) : [],
      patientIds.length
        ? this.prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, fullName: true, practiceId: true } })
        : [],
      idsOf('practice').length ? this.prisma.practice.findMany({ ...byIds('practice'), select: { id: true, name: true } }) : [],
      idsOf('pharmacy').length ? this.prisma.pharmacy.findMany({ ...byIds('pharmacy'), select: { id: true, name: true } }) : [],
      idsOf('hospital').length ? this.prisma.hospital.findMany({ ...byIds('hospital'), select: { id: true, name: true } }) : [],
      idsOf('ambulance_vendor').length
        ? this.prisma.ambulanceVendor.findMany({ ...byIds('ambulance_vendor'), select: { id: true, name: true } })
        : [],
      idsOf('doctor_listing').length
        ? this.prisma.doctorListing.findMany({ ...byIds('doctor_listing'), select: { id: true, name: true } })
        : [],
    ]);
    put('user', users.map((u) => ({ id: u.id, name: u.fullName })));
    put('practice', practices);
    put('pharmacy', pharmacies);
    put('hospital', hospitals);
    put('ambulance_vendor', ambulances);
    put('doctor_listing', doctors);

    const patientClinic = new Map(patients.map((p) => [p.id, p]));
    for (const row of rows) {
      if (row.resourceType !== 'patient' || !row.resourceId) continue;
      const patient = patientClinic.get(row.resourceId);
      if (patient && patient.practiceId === row.practiceId) names.set(`patient:${patient.id}`, patient.fullName);
    }
    return names;
  }
}
