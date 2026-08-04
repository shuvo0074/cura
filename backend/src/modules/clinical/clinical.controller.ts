import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  Permission,
  businessRules,
  clinicalNoteSchema,
  prescriptionSchema,
  vitalsSchema,
  type ClinicalNoteInput,
  type PrescriptionInput,
  type VitalsInput,
} from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { ClinicalService } from './clinical.service';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const timelineQuery = practiceQuery.extend({
  cursor: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(businessRules.pagination.maxPageSize)
    .default(businessRules.pagination.defaultPageSize),
});

const consentConfirmSchema = practiceQuery.extend({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

@Controller('clinical')
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get('patients/:patientId/timeline')
  @RequirePermissions(Permission.PATIENT_HISTORY_READ)
  async timeline(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query(zodBody(timelineQuery)) query: z.infer<typeof timelineQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.timeline(query.practiceId, patientId, principal, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  /** Starts the OTP handshake that unlocks records beyond the privacy window. */
  @Post('patients/:patientId/consent/request')
  @RequirePermissions(Permission.PATIENT_HISTORY_READ)
  async requestConsent(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body(zodBody(practiceQuery)) body: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.requestConsent(body.practiceId, patientId, principal);
  }

  @Post('consent/confirm')
  @RequirePermissions(Permission.PATIENT_HISTORY_READ)
  async confirmConsent(
    @Body(zodBody(consentConfirmSchema)) body: z.infer<typeof consentConfirmSchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.confirmConsent(
      body.practiceId,
      body.challengeId,
      body.code,
      principal,
    );
  }

  /** Opens the encounter for an appointment and moves the patient to Engaged. */
  @Post('appointments/:appointmentId/encounter')
  @RequirePermissions(Permission.CLINICAL_WRITE)
  async openEncounter(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body(zodBody(practiceQuery)) body: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.openEncounter(body.practiceId, appointmentId, principal);
  }

  @Put('encounters/:encounterId/vitals')
  @RequirePermissions(Permission.CLINICAL_WRITE)
  async saveVitals(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @Body(zodBody(vitalsSchema)) body: VitalsInput,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.saveVitals(query.practiceId, encounterId, body, principal);
  }

  @Put('encounters/:encounterId/note')
  @RequirePermissions(Permission.CLINICAL_WRITE)
  async saveNote(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @Body(zodBody(clinicalNoteSchema)) body: ClinicalNoteInput,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.saveClinicalNote(query.practiceId, encounterId, body, principal);
  }

  @Put('encounters/:encounterId/prescription')
  @RequirePermissions(Permission.PRESCRIPTION_WRITE)
  async savePrescription(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @Body(zodBody(prescriptionSchema)) body: PrescriptionInput,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.savePrescription(query.practiceId, encounterId, body, principal);
  }

  /** Freezes the record and completes the visit. */
  @Post('encounters/:encounterId/sign')
  @RequirePermissions(Permission.PRESCRIPTION_WRITE)
  async sign(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Body(zodBody(practiceQuery)) body: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.clinical.signEncounter(body.practiceId, encounterId, principal);
  }
}
