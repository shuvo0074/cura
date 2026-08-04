import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  AppointmentStatus,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  Permission,
  type CreateAppointmentInput,
} from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { AppointmentService } from './appointment.service';

const rangeQuerySchema = z.object({
  practiceId: z.string().uuid(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  doctorId: z.string().uuid().optional(),
  includeCancelled: z.coerce.boolean().default(false),
});

const statusSchema = z.object({ status: z.nativeEnum(AppointmentStatus) });

/**
 * HTTP surface for scheduling.
 *
 * Handlers stay thin — validate, delegate, return. Every route declares the
 * capability it requires so authorisation is visible at the call site.
 */
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointments: AppointmentService) {}

  @Get()
  @RequirePermissions(Permission.APPOINTMENT_READ)
  async listRange(
    @Query(zodBody(rangeQuerySchema)) query: z.infer<typeof rangeQuerySchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.appointments.listRange(
      query.practiceId,
      new Date(query.from),
      new Date(query.to),
      principal,
      { doctorId: query.doctorId, includeCancelled: query.includeCancelled },
    );
  }

  @Get('queue-summary')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  async queueSummary(
    @Query(zodBody(z.object({ practiceId: z.string().uuid(), date: z.string().date() })))
    query: { practiceId: string; date: string },
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.appointments.queueSummary(query.practiceId, new Date(query.date), principal);
  }

  @Post()
  @RequirePermissions(Permission.APPOINTMENT_WRITE)
  async create(
    @Body(zodBody(createAppointmentSchema)) dto: CreateAppointmentInput,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.appointments.create(dto, principal);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.APPOINTMENT_WRITE)
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(statusSchema)) dto: z.infer<typeof statusSchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.appointments.changeStatus(id, dto.status, principal);
  }

  @Patch(':id/reschedule')
  @RequirePermissions(Permission.APPOINTMENT_WRITE)
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(rescheduleAppointmentSchema)) dto: z.infer<typeof rescheduleAppointmentSchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.appointments.reschedule(
      id,
      new Date(dto.scheduledAt),
      principal,
      dto.durationMinutes,
    );
  }
}
