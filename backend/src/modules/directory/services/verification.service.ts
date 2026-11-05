import { Inject, Injectable } from '@nestjs/common';
import {
  DOCTOR_VERIFICATION_REPOSITORY,
  type DoctorVerificationRepository,
} from '../../../core/ports/directory.ports';
import { toNationalPhone } from '../domain/account-rules';
import { DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';

const STATUSES = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' } as const;

/** The admin's review of doctors asking to be listed or to claim a listing. */
@Injectable()
export class DoctorVerificationService {
  constructor(
    @Inject(DOCTOR_VERIFICATION_REPOSITORY) private readonly verifications: DoctorVerificationRepository,
    private readonly audit: DirectoryAudit,
  ) {}

  async list(status: unknown) {
    const key = (typeof status === 'string' && status in STATUSES ? status : 'pending') as keyof typeof STATUSES;
    const rows = await this.verifications.list(STATUSES[key]);
    return rows.map(({ mobile, ...row }) => ({ ...present(row), phone: toNationalPhone(mobile) }));
  }

  async approve(id: string, adminId: string) {
    const { doctorId, userId } = await this.verifications.approve(id, adminId);
    await this.audit.record(adminId, 'doctor_verified', 'doctor_verification', id, { doctorId, userId });
    return { ok: true, doctorId };
  }

  async reject(id: string, note: unknown, adminId: string) {
    const trimmed = typeof note === 'string' ? note.trim() : '';
    if (trimmed.length < 5) throw new DirectoryValidationError('Tell the doctor why, so they can fix it');
    const rejected = await this.verifications.reject(id, trimmed.slice(0, 500), adminId);
    if (!rejected) throw directoryNotFound('Pending request');
    await this.audit.record(adminId, 'doctor_verification_rejected', 'doctor_verification', id, {
      userId: rejected.userId,
    });
    return { ok: true };
  }
}
