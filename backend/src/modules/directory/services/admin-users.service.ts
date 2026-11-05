import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { bdMobileSchema, emailSchema, passwordSchema } from '@cura/shared';
import { CryptoService } from '../../../common/crypto/crypto.service';
import {
  ADMIN_USERS_REPOSITORY,
  AMBULANCE_REPOSITORY,
  type AdminUsersRepository,
  type AmbulanceRepository,
  type ClinicRole,
  type GrantableRole,
  type Row,
} from '../../../core/ports/directory.ports';
import { USER_REPOSITORY, type UserRepository } from '../../../core/ports/repositories';
import { pharmacy } from '../domain/content-rules';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';

const ROLES: Record<string, GrantableRole> = {
  super_admin: 'SUPER_ADMIN',
  patient: 'PATIENT',
  ambulance_owner: 'AMBULANCE_OWNER',
  pharmacy_owner: 'PHARMACY_OWNER',
};
const CLINIC_ROLES: ClinicRole[] = ['ADMINISTRATOR', 'DOCTOR', 'DESK_STAFF'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function valid<T>(result: { success: true; data: T } | { success: false }, message: string): T {
  if (!result.success) throw new DirectoryValidationError(message);
  return result.data;
}

const text = (value: unknown, max = 160): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.slice(0, max) : null;
};

/** What only a super admin does: every account's roles, every clinic and pharmacy. */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY) private readonly admin: AdminUsersRepository,
    @Inject(AMBULANCE_REPOSITORY) private readonly ambulances: AmbulanceRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly crypto: CryptoService,
    private readonly audit: DirectoryAudit,
  ) {}

  async list(query: Row) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
    const role = typeof query.role === 'string' && query.role ? query.role.toUpperCase() : null;
    const { items, total } = await this.admin.listUsers({ q: String(query.q ?? '').trim(), role, page, limit });
    return { items, total, page, limit };
  }

  async get(id: string) {
    const user = await this.admin.getUser(id);
    if (!user) throw directoryNotFound('Account');
    return user;
  }

  async create(body: Row, adminId: string) {
    const fullName = text(body.fullName, 120);
    if (!fullName || fullName.length < 2) throw new DirectoryValidationError('Enter the full name');
    const email = body.email ? valid(emailSchema.safeParse(body.email), 'Enter a valid email address') : null;
    const mobile = body.mobile ? valid(bdMobileSchema.safeParse(body.mobile), 'Enter a valid mobile number, e.g. 01712345678') : null;
    if (!email && !mobile) throw new DirectoryValidationError('Give an email or a mobile number, so they can log in');
    const password = valid(passwordSchema.safeParse(body.temporaryPassword), 'The temporary password needs upper- and lowercase letters and a number');
    const user = await this.admin.createUser({ fullName, email, mobile, passwordHash: await this.crypto.hashPassword(password) });
    await this.audit.record(adminId, 'user_created', 'user', user.id);
    return user;
  }

  async update(id: string, body: Row, adminId: string) {
    const data: Row = {};
    if (body.fullName !== undefined) {
      const fullName = text(body.fullName, 120);
      if (!fullName || fullName.length < 2) throw new DirectoryValidationError('Enter the full name');
      data.fullName = fullName;
    }
    if (body.email !== undefined) data.email = body.email ? valid(emailSchema.safeParse(body.email), 'Enter a valid email address') : null;
    if (body.mobile !== undefined) data.mobile = body.mobile ? valid(bdMobileSchema.safeParse(body.mobile), 'Enter a valid mobile number, e.g. 01712345678') : null;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') throw new DirectoryValidationError('isActive must be true or false');
      if (!body.isActive && id === adminId) throw new DirectoryError(HttpStatus.CONFLICT, 'CANNOT_DISABLE_SELF', 'You cannot deactivate your own account');
      if (!body.isActive && (await this.isLastSuperAdmin(id))) throw this.lastSuperAdmin();
      data.isActive = body.isActive;
    }
    if (!(await this.admin.updateUser(id, data))) throw directoryNotFound('Account');
    await this.audit.record(adminId, 'user_updated', 'user', id, { fields: Object.keys(data) });
    return this.get(id);
  }

  async resetPassword(id: string, body: Row, adminId: string) {
    const password = valid(passwordSchema.safeParse(body.temporaryPassword), 'The temporary password needs upper- and lowercase letters and a number');
    await this.get(id);
    // Also ends every session, so the old password stops working everywhere.
    await this.users.setPassword(id, await this.crypto.hashPassword(password));
    await this.audit.record(adminId, 'user_password_reset', 'user', id);
    return { id, reset: true };
  }

  async setRole(id: string, roleName: string, granted: boolean, adminId: string) {
    const role = ROLES[roleName];
    if (!role) throw new DirectoryValidationError('Choose super_admin, patient, ambulance_owner or pharmacy_owner');
    await this.get(id);
    if (role === 'SUPER_ADMIN' && !granted) {
      if (id === adminId) throw new DirectoryError(HttpStatus.CONFLICT, 'CANNOT_REMOVE_SELF', 'You cannot remove your own super admin role');
      if (await this.isLastSuperAdmin(id)) throw this.lastSuperAdmin();
    }
    await this.admin.setRole(id, role, granted);
    await this.audit.record(adminId, granted ? 'role_granted' : 'role_revoked', 'user', id, { role: roleName });
    return this.get(id);
  }

  async setClinicAccess(id: string, body: Row, adminId: string) {
    const role = body.role === null || body.role === '' ? null : String(body.role).toUpperCase();
    if (role !== null && !CLINIC_ROLES.includes(role as ClinicRole)) throw new DirectoryValidationError('Choose ADMINISTRATOR, DOCTOR, DESK_STAFF or none');
    const practiceIds = Array.isArray(body.practiceIds) ? [...new Set((body.practiceIds as unknown[]).map(String))] : [];
    if (practiceIds.some((value) => !UUID.test(value))) throw new DirectoryValidationError('Choose clinics from the list');
    if (role && practiceIds.length === 0) throw new DirectoryValidationError('Choose at least one clinic for this access level');
    const known = new Set((await this.admin.listClinics()).map((clinic) => clinic.id));
    if (practiceIds.some((value) => !known.has(value))) throw new DirectoryValidationError('Choose clinics from the list');
    await this.get(id);
    await this.admin.setClinicAccess(id, { role: role as ClinicRole | null, practiceIds, specialty: text(body.specialty, 80) });
    await this.audit.record(adminId, 'clinic_access_set', 'user', id, { role, practiceIds });
    return this.get(id);
  }

  async listClinics() {
    return (await this.admin.listClinics()).map(present);
  }

  async updateClinic(id: string, body: Row, adminId: string) {
    const name = text(body.name, 160);
    if (!name || name.length < 2) throw new DirectoryValidationError('Enter the clinic name');
    const data: Row = {
      name,
      specialization: text(body.specialization, 120),
      contactNumber: text(body.contact_number, 20),
      email: text(body.email, 160),
      address: text(body.address, 400),
      city: text(body.city, 80),
    };
    if (typeof body.is_active === 'boolean') data.isActive = body.is_active;
    const row = await this.admin.updateClinic(id, data);
    if (!row) throw directoryNotFound('Clinic');
    await this.audit.record(adminId, 'clinic_updated', 'practice', id);
    return present(row);
  }

  async listPharmacies() {
    return (await this.admin.listPharmacies()).map(({ owner, ...row }) => ({
      ...present(row),
      owner: owner ? { id: owner.id, full_name: owner.fullName, email: owner.email } : null,
    }));
  }

  async createPharmacy(body: Row, adminId: string) {
    const ownerId = await this.ownerFor(body.owner_id, 'PHARMACY_OWNER');
    const row = await this.admin.createPharmacy(ownerId, pharmacy(body));
    await this.audit.record(adminId, 'pharmacy_created', 'pharmacy', row.id);
    return present(row);
  }

  async updatePharmacy(id: string, body: Row, adminId: string) {
    const row = await this.admin.updatePharmacy(id, pharmacy(body));
    if (!row) throw directoryNotFound('Pharmacy');
    if (body.owner_id) {
      await this.admin.setPharmacyOwner(id, await this.ownerFor(body.owner_id, 'PHARMACY_OWNER'));
    }
    await this.audit.record(adminId, 'pharmacy_updated', 'pharmacy', id);
    return present(row);
  }

  async deletePharmacy(id: string, adminId: string) {
    if (!(await this.admin.deletePharmacy(id))) throw directoryNotFound('Pharmacy');
    await this.audit.record(adminId, 'pharmacy_deleted', 'pharmacy', id);
    return { id };
  }

  /** Links an ambulance service to an owner, who gets the role if they lack it. */
  async setAmbulanceOwner(id: string, body: Row, adminId: string) {
    const ownerId = body.owner_id ? await this.ownerFor(body.owner_id, 'AMBULANCE_OWNER') : null;
    if (!(await this.ambulances.setOwner(id, ownerId))) throw directoryNotFound('Ambulance vendor');
    await this.audit.record(adminId, 'ambulance_owner_set', 'ambulance_vendor', id, { ownerId });
    return { id, owner_id: ownerId };
  }

  private async ownerFor(value: unknown, role: GrantableRole): Promise<string> {
    const id = typeof value === 'string' ? value : '';
    if (!UUID.test(id)) throw new DirectoryValidationError('Choose the owner');
    const user = await this.admin.getUser(id);
    if (!user) throw directoryNotFound('Owner');
    if (!(user.roles as string[]).includes(role.toLowerCase())) await this.admin.setRole(id, role, true);
    return id;
  }

  private async isLastSuperAdmin(id: string): Promise<boolean> {
    const user = await this.admin.getUser(id);
    return Boolean(user && (user.roles as string[]).includes('super_admin') && (await this.admin.countSuperAdmins()) <= 1);
  }

  private lastSuperAdmin() {
    return new DirectoryError(HttpStatus.CONFLICT, 'LAST_SUPER_ADMIN', 'Cura needs at least one active super admin');
  }
}
