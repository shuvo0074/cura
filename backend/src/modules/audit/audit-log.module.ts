import { Module } from '@nestjs/common';
import { AdminAuditLogController, PracticeAuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

/** The activity log screens: a clinic owner's own clinic, and everything for super admins. */
@Module({
  controllers: [PracticeAuditLogController, AdminAuditLogController],
  providers: [AuditLogService],
})
export class AuditLogModule {}
