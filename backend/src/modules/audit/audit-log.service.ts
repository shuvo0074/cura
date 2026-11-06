import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AUDIT_REPOSITORY, type AuditRepository, type AuditRow, type AuditSearch } from '../../core/ports/repositories';
import { safeMetadata } from './audit-metadata';

export const PAGE_MAX = 100;
export const EXPORT_MAX = 5000;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Query filters shared by both views. Dates are ISO date-times with an offset. */
export const auditFilterSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  action: text(80),
  actor: text(120),
  q: text(120),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(50),
});
export type AuditFilter = z.infer<typeof auditFilterSchema>;

/** Super admins may also narrow to one clinic. Named `clinicId`, not `practiceId`, so filtering is not itself logged as a clinic read. */
export const adminAuditFilterSchema = auditFilterSchema.extend({ clinicId: z.string().uuid().optional() });

/** What the API returns for one row: no raw IP hash, and details with secrets removed. */
export interface AuditView {
  id: string;
  at: string;
  action: string;
  actor: AuditRow['actor'];
  subject: { type: string; id: string | null; name: string | null };
  clinic: { id: string; name: string | null } | null;
  /** Short fingerprint of the hashed IP address, enough to tell devices apart. */
  network: string | null;
  userAgent: string | null;
  requestId: string | null;
  details: unknown;
}

/** Reads the shared audit trail for the activity log screens. */
@Injectable()
export class AuditLogService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  async page(filter: AuditFilter, practiceId?: string) {
    const { items, nextCursor } = await this.audit.search(this.toSearch(filter, filter.limit, practiceId));
    return { items: items.map(present), nextCursor };
  }

  /** Up to EXPORT_MAX rows for a CSV download; `truncated` says there were more. */
  async export(filter: AuditFilter, practiceId?: string) {
    const { cursor: _start, ...rest } = filter;
    const items: AuditView[] = [];
    let cursor: string | undefined;
    for (;;) {
      const want = Math.min(PAGE_MAX * 10, EXPORT_MAX - items.length);
      const page = await this.audit.search({ ...this.toSearch(rest, want, practiceId), ...(cursor ? { cursor } : {}) });
      items.push(...page.items.map(present));
      if (!page.nextCursor) return { items, truncated: false };
      if (items.length >= EXPORT_MAX) return { items, truncated: true };
      cursor = page.nextCursor;
    }
  }

  actions(practiceId?: string) {
    return this.audit.actions(practiceId);
  }

  private toSearch(filter: Omit<AuditFilter, 'cursor'> & { cursor?: string | undefined }, limit: number, practiceId?: string): AuditSearch {
    return {
      limit,
      ...(practiceId ? { practiceId } : {}),
      ...(filter.from ? { from: new Date(filter.from) } : {}),
      ...(filter.to ? { to: new Date(filter.to) } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.actor ? { actor: filter.actor } : {}),
      ...(filter.q ? { q: filter.q } : {}),
      ...(filter.cursor ? { cursor: filter.cursor } : {}),
    };
  }
}

function present(row: AuditRow): AuditView {
  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    action: row.action,
    actor: row.actor,
    subject: { type: row.resourceType, id: row.resourceId, name: row.resourceName },
    clinic: row.practiceId ? { id: row.practiceId, name: row.practiceName } : null,
    network: row.ipHash ? row.ipHash.slice(0, 10) : null,
    userAgent: row.userAgent,
    requestId: row.requestId,
    details: safeMetadata(row.metadata),
  };
}
