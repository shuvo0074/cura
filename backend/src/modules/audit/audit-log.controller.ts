import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { assertPracticeAccess } from '../../common/security/practice-access';
import { RequireDirectoryAdmin } from '../directory/access/directory-access.decorators';
import { AuditLogService, adminAuditFilterSchema, auditFilterSchema } from './audit-log.service';

const practiceFilterSchema = auditFilterSchema.extend({ practiceId: z.string().uuid() });
const practiceOnly = z.object({ practiceId: z.string().uuid() });
type PracticeFilter = z.infer<typeof practiceFilterSchema>;
type AdminFilter = z.infer<typeof adminAuditFilterSchema>;

/**
 * A clinic owner's activity log: only rows about their own clinic, including
 * every time a super admin read that clinic's records.
 */
@Controller('audit-log')
@RequirePermissions(Permission.AUDIT_READ)
export class PracticeAuditLogController {
  constructor(private readonly log: AuditLogService) {}

  @Get()
  list(@Query(zodBody(practiceFilterSchema)) q: PracticeFilter, @CurrentUser() p: AuthenticatedPrincipal) {
    assertPracticeAccess(p, q.practiceId);
    const { practiceId, ...filter } = q;
    return this.log.page(filter, practiceId);
  }

  @Get('actions')
  actions(@Query(zodBody(practiceOnly)) q: { practiceId: string }, @CurrentUser() p: AuthenticatedPrincipal) {
    assertPracticeAccess(p, q.practiceId);
    return this.log.actions(q.practiceId);
  }

  @Get('export')
  export(@Query(zodBody(practiceFilterSchema)) q: PracticeFilter, @CurrentUser() p: AuthenticatedPrincipal) {
    assertPracticeAccess(p, q.practiceId);
    const { practiceId, ...filter } = q;
    return this.log.export(filter, practiceId);
  }
}

/** Super admin only: every row across Cura. */
@Controller('directory/admin/audit-log')
@RequireDirectoryAdmin()
export class AdminAuditLogController {
  constructor(private readonly log: AuditLogService) {}

  @Get()
  list(@Query(zodBody(adminAuditFilterSchema)) q: AdminFilter) {
    const { clinicId, ...filter } = q;
    return this.log.page(filter, clinicId);
  }

  @Get('actions')
  actions() {
    return this.log.actions();
  }

  @Get('export')
  export(@Query(zodBody(adminAuditFilterSchema)) q: AdminFilter) {
    const { clinicId, ...filter } = q;
    return this.log.export(filter, clinicId);
  }
}
