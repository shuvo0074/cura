import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  DIRECTORY_ACCOUNT_REPOSITORY,
  type DirectoryAccountRepository,
  type DirectoryIdentity,
} from '../../../core/ports/directory.ports';
import { PATIENT_REPOSITORY, type PatientRepository } from '../../../core/ports/repositories';
import { DirectoryError, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';

/**
 * A patient on Cura Website chooses clinics. Each clinic gets its own patient
 * record, which staff then see on Cura Dashboard. Joining exposes no clinical
 * data; the patient reads their own signed records on "My health".
 */
@Injectable()
export class PatientClinicService {
  constructor(
    @Inject(DIRECTORY_ACCOUNT_REPOSITORY) private readonly accounts: DirectoryAccountRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
  ) {}

  async listClinics() {
    return (await this.accounts.listClinics()).map(present);
  }

  async mine(identity: DirectoryIdentity) {
    return (await this.accounts.listPatientClinics(identity.patientId!)).map(present);
  }

  async join(identity: DirectoryIdentity, practiceId: string) {
    const accountId = identity.patientId!;
    if (!(await this.accounts.clinicExists(practiceId))) throw directoryNotFound('Clinic');

    const existing = await this.accounts.findPatientClinic(accountId, practiceId);
    if (existing) return present(existing);

    // Clinics reach patients by phone, so their record requires one.
    if (!identity.mobile) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'PHONE_REQUIRED', 'Add a mobile number to your account first.');
    }
    await this.patients.create({
      practiceId,
      fullName: identity.name,
      mobile: identity.mobile,
      email: identity.email,
      accountId,
    });
    return present((await this.accounts.findPatientClinic(accountId, practiceId))!);
  }

  async leave(identity: DirectoryIdentity, practiceId: string) {
    if (!(await this.accounts.leaveClinic(identity.patientId!, practiceId))) throw directoryNotFound('Clinic');
    return { id: practiceId };
  }
}
