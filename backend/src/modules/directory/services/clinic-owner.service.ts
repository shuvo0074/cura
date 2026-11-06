import { Inject, Injectable } from '@nestjs/common';
import { bdMobileSchema, emailSchema, passwordSchema } from '@cura/shared';
import { CryptoService } from '../../../common/crypto/crypto.service';
import {
  AMBULANCE_REPOSITORY,
  DIRECTORY_ACCOUNT_REPOSITORY,
  type AmbulanceRepository,
  type DirectoryAccountRepository,
  type Row,
} from '../../../core/ports/directory.ports';
import { DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';

const GRANTABLE = {
  ambulance_owner: 'AMBULANCE_OWNER',
  pharmacy_owner: 'PHARMACY_OWNER',
  hospital_owner: 'HOSPITAL_OWNER',
} as const;

function checked<T>(result: { success: true; data: T } | { success: false }, message: string): T {
  if (!result.success) throw new DirectoryValidationError(message);
  return result.data;
}

/** What only a super admin does: create clinic owners and grant owner roles. */
@Injectable()
export class ClinicOwnerService {
  constructor(
    @Inject(DIRECTORY_ACCOUNT_REPOSITORY) private readonly accounts: DirectoryAccountRepository,
    @Inject(AMBULANCE_REPOSITORY) private readonly ambulances: AmbulanceRepository,
    private readonly crypto: CryptoService,
    private readonly audit: DirectoryAudit,
  ) {}

  async list() {
    return (await this.accounts.listClinicOwners()).map(present);
  }

  async create(body: Row, adminId: string) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (fullName.length < 2) throw new DirectoryValidationError('Enter the owner\'s full name');
    const clinicName = typeof body.clinicName === 'string' ? body.clinicName.trim() : '';
    if (clinicName.length < 2) throw new DirectoryValidationError('Enter the clinic\'s name');
    const mobile = checked(bdMobileSchema.safeParse(body.mobile), 'Enter a valid mobile number, e.g. 01712345678');
    const email = body.email ? checked(emailSchema.safeParse(body.email), 'Enter a valid email address') : null;
    const password = checked(
      passwordSchema.safeParse(body.temporaryPassword),
      'The temporary password needs upper- and lowercase letters and a number',
    );

    const owner = await this.accounts.createClinicOwner({
      fullName,
      clinicName,
      mobile,
      email,
      passwordHash: await this.crypto.hashPassword(password),
    });
    await this.audit.record(adminId, 'clinic_owner_created', 'user', owner.id, { clinicName });
    return present(owner);
  }

  /** An owner can hold ambulance, pharmacy and hospital access too. */
  async setRole(body: Row, granted: boolean, adminId: string) {
    const role = GRANTABLE[body.role as keyof typeof GRANTABLE];
    if (!role) throw new DirectoryValidationError('Choose ambulance_owner, pharmacy_owner or hospital_owner');
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const parsedMobile = bdMobileSchema.safeParse(identifier);
    const userId = await this.accounts.findUserIdByIdentifier(parsedMobile.success ? parsedMobile.data : identifier);
    if (!userId) throw directoryNotFound('Account');

    if (granted) await this.accounts.grantRole(userId, role);
    else await this.accounts.revokeRole(userId, role);

    if (role === 'AMBULANCE_OWNER' && body.ambulanceVendorId) {
      const assigned = await this.ambulances.setOwner(String(body.ambulanceVendorId), granted ? userId : null);
      if (!assigned) throw directoryNotFound('Ambulance vendor');
    }
    await this.audit.record(adminId, granted ? 'role_granted' : 'role_revoked', 'user', userId, { role });
    return { userId, role: body.role, granted };
  }
}
