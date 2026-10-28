import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission, UserRole, bdMobileSchema, passwordSchema } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { optionalText, practiceQuery } from './settings.schemas';
import { StaffSettingsService } from './staff-settings.service';

const staffPatchSchema = practiceQuery.extend({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional().transform((v) => (v === '' ? null : v)),
  mobile: bdMobileSchema.nullable().optional(),
  bmdcNumber: optionalText(20),
  role: z.nativeEnum(UserRole).optional(),
  notifyScheduleSms: z.boolean().optional(),
  notifyScheduleEmail: z.boolean().optional(),
  notifyAppointmentSms: z.boolean().optional(),
  notifyAppointmentEmail: z.boolean().optional(),
});

const staffSchema = practiceQuery.extend({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().nullable().default(null),
  mobile: bdMobileSchema.nullable().default(null),
  role: z.nativeEnum(UserRole),
  bmdcNumber: z.string().trim().max(20).nullable().default(null),
  temporaryPassword: passwordSchema,
});

/**
 * Practice staff. Every route needs `STAFF_MANAGE`; the class-level
 * `SETTINGS_MANAGE` is the fallback for any route added without a decorator.
 */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class StaffSettingsController {
  constructor(private readonly settings: StaffSettingsService) {}

  @Get('staff')
  @RequirePermissions(Permission.STAFF_MANAGE)
  listStaff(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listStaff(q.practiceId, p);
  }

  @Post('staff')
  @RequirePermissions(Permission.STAFF_MANAGE)
  addStaff(@Body(zodBody(staffSchema)) b: z.infer<typeof staffSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...rest } = b;
    return this.settings.addStaff(practiceId, rest, p);
  }

  /** The kill-switch: revokes access immediately, not at token expiry. */
  @Put('staff/:userId/access')
  @RequirePermissions(Permission.STAFF_MANAGE)
  setStaffAccess(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(zodBody(practiceQuery.extend({ isActive: z.boolean() }))) b: { practiceId: string; isActive: boolean },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.setStaffActive(b.practiceId, userId, b.isActive, p);
  }

  @Patch('staff/:userId')
  @RequirePermissions(Permission.STAFF_MANAGE)
  updateStaff(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(zodBody(staffPatchSchema)) b: z.infer<typeof staffPatchSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    const {
      practiceId,
      notifyScheduleSms,
      notifyScheduleEmail,
      notifyAppointmentSms,
      notifyAppointmentEmail,
      ...details
    } = b;

    // Only forward the notification keys the caller actually sent, so a patch
    // that touches the name alone does not reset the whole matrix to defaults.
    const notifications = {
      ...(notifyScheduleSms !== undefined ? { notifyScheduleSms } : {}),
      ...(notifyScheduleEmail !== undefined ? { notifyScheduleEmail } : {}),
      ...(notifyAppointmentSms !== undefined ? { notifyAppointmentSms } : {}),
      ...(notifyAppointmentEmail !== undefined ? { notifyAppointmentEmail } : {}),
    };

    return this.settings.updateStaff(
      practiceId,
      userId,
      { ...details, ...(Object.keys(notifications).length > 0 ? { notifications } : {}) },
      p,
    );
  }
}
