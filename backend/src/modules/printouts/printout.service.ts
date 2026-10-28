import { Inject, Injectable } from '@nestjs/common';
import { resolve } from 'node:path';
import { ageFromDateOfBirth } from '@cura/shared';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  CLINICAL_REPOSITORY,
  PRACTICE_REPOSITORY,
  PRESCRIBER_REPOSITORY,
  PRINTOUT_SETTINGS_REPOSITORY,
  type ClinicalRepository,
  type PracticeRepository,
  type PrescriberRepository,
  type PrintoutSettingsRepository,
} from '../../core/ports/clinical.ports';
import {
  AUDIT_REPOSITORY,
  PATIENT_REPOSITORY,
  type AuditRepository,
  type PatientRepository,
} from '../../core/ports/repositories';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { PdfRendererService } from './pdf-renderer.service';

/**
 * Assembles a printable prescription.
 *
 * Gathers practice branding, prescriber credentials, patient identity and the
 * clinical content, then hands them to the renderer along with the practice's
 * stored page setup. Nothing about layout lives here, and nothing about data
 * lives in the renderer.
 */
@Injectable()
export class PrintoutService {
  constructor(
    private readonly renderer: PdfRendererService,
    @Inject(CLINICAL_REPOSITORY) private readonly clinical: ClinicalRepository,
    @Inject(PRACTICE_REPOSITORY) private readonly practices: PracticeRepository,
    @Inject(PRESCRIBER_REPOSITORY) private readonly prescribers: PrescriberRepository,
    @Inject(PRINTOUT_SETTINGS_REPOSITORY) private readonly settings: PrintoutSettingsRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async renderPrescription(
    practiceId: string,
    encounterId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    assertPracticeAccess(principal, practiceId);

    const encounter = await this.clinical.findEncounter(encounterId);
    if (!encounter) throw new NotFoundError('Encounter');

    // Tenancy: the encounter's patient must belong to the requested practice.
    const patient = await this.patients.findById(practiceId, encounter.patientId);
    if (!patient) throw new ForbiddenError('This record belongs to another practice.');

    const practice = await this.practices.findById(practiceId);
    if (!practice) throw new NotFoundError('Practice');

    const prescriber = await this.prescribers.findCredentials(encounter.doctorId);

    const settings =
      (await this.settings.getPrintout(practiceId, 'EMR')) ?? this.fallbackSettings();

    const age = ageFromDateOfBirth(patient.dateOfBirth?.toISOString() ?? null);
    const ageGender = [
      age !== null ? `${age} yrs` : null,
      patient.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : null,
    ]
      .filter(Boolean)
      .join(', ');

    const buffer = await this.renderer.renderPrescription(
      {
        practiceName: practice.name,
        practiceAddress: practice.address,
        practiceContact: practice.contactNumber,
        doctorName: prescriber?.fullName ?? 'Attending physician',
        doctorQualifications: (prescriber?.qualifications ?? []).join(', '),
        bmdcNumber: prescriber?.bmdcNumber ?? null,
        patientName: patient.fullName,
        patientCuraId: patient.curaId,
        patientAgeGender: ageGender,
        encounter,
        padImagePath: settings.padImageKey
          ? resolve(process.cwd(), 'storage', settings.padImageKey)
          : null,
      },
      settings,
    );

    // Printing a prescription is a disclosure of clinical data and is recorded
    // as such.
    await this.audit.record({
      actorUserId: principal.userId,
      action: 'printout.prescription.rendered',
      resourceType: 'encounter',
      resourceId: encounterId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    const stamp = encounter.occurredAt.toISOString().slice(0, 10);
    return {
      buffer,
      fileName: `prescription-${patient.curaId}-${stamp}.pdf`,
    };
  }

  private fallbackSettings() {
    return {
      documentType: 'EMR',
      printerType: 'COLOUR',
      paperSize: 'A4',
      orientation: 'PORTRAIT',
      marginTopMm: 20,
      marginBottomMm: 12,
      marginLeftMm: 12,
      marginRightMm: 12,
      fontScale: 100,
      showHeader: true,
      showFooter: true,
      headerHtml: null,
      footerHtml: null,
      padImageKey: null,
      sectionOrder: [
        'vitals',
        'complaints',
        'diagnosis',
        'prescription',
        'investigations',
        'advice',
      ],
    };
  }
}
