import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserRole, bdMobileSchema, emailSchema, passwordSchema } from '@cura/shared';
import type { ZodSchema } from 'zod';
import { CryptoService } from '../../../common/crypto/crypto.service';
import {
  DIRECTORY_ACCOUNT_REPOSITORY,
  DOCTOR_LISTING_REPOSITORY,
  type DirectoryAccountRepository,
  type DirectoryIdentity,
  type DirectoryRoleName,
  type DoctorListingRepository,
  type NewVerification,
  type Row,
} from '../../../core/ports/directory.ports';
import { USER_REPOSITORY, type UserRepository } from '../../../core/ports/repositories';
import { TokenService } from '../../auth/token.service';
import { normalizeBmdc, toNationalPhone } from '../domain/account-rules';
import { DirectoryError, DirectoryValidationError } from '../domain/errors';
import { present } from '../domain/presenter';

const ROLE_PRIORITY: DirectoryRoleName[] = ['admin', 'doctor', 'patient'];
const GENDERS = ['male', 'female'];

export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
}

function parse<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DirectoryValidationError(result.error.issues[0]?.message ?? 'Invalid value');
  return result.data;
}

/** Public sign-up and the signed-in user's shape. Shares `users` with the clinic app. */
@Injectable()
export class DirectoryAccountService {
  constructor(
    @Inject(DIRECTORY_ACCOUNT_REPOSITORY) private readonly accounts: DirectoryAccountRepository,
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
  ) {}

  async registerPatient(body: Row, ctx: SessionContext) {
    const fields = await this.accountFields(body);
    const created = await this.accounts.createPatient(fields);
    return this.session(created, ctx);
  }

  /**
   * A doctor signs up and asks to be verified. A matching unclaimed listing makes
   * it a claim, otherwise a new listing is created on approval. Nothing is public
   * and nothing is linked until an admin approves.
   */
  async registerDoctor(body: Row, ctx: SessionContext) {
    const request = await this.verificationRequest(body);
    if (!body.phone) throw new DirectoryValidationError('Mobile number is required for doctors');
    const fields = await this.accountFields(body);
    const created = await this.accounts.createDoctorApplicant(fields, {
      ...request,
      details: { ...request.details, name: fields.name, phone: toNationalPhone(fields.mobile) },
    });
    return this.session(created, ctx);
  }

  /** An existing account (a clinic doctor, or a rejected applicant) asks to be verified. */
  async submitVerification(identity: DirectoryIdentity, body: Row): Promise<Row> {
    if (identity.doctorId) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'ALREADY_LINKED', 'This account already manages a doctor profile');
    }
    const request = await this.verificationRequest(body);
    await this.accounts.submitVerification(identity.userId, {
      ...request,
      details: { ...request.details, name: identity.name, phone: toNationalPhone(identity.mobile) },
    });
    return this.latestVerification(identity.userId);
  }

  async describe(identity: DirectoryIdentity): Promise<Row> {
    const user = this.presentUser(identity);
    if (identity.roles.includes('doctor')) user.verification = await this.latestVerification(identity.userId);
    return user;
  }

  private async latestVerification(userId: string): Promise<Row> {
    const row = await this.accounts.latestVerification(userId);
    return row ? present(row) : (null as unknown as Row);
  }

  private presentUser(identity: DirectoryIdentity): Row {
    return {
      id: identity.userId,
      name: identity.name,
      email: identity.email,
      phone: toNationalPhone(identity.mobile),
      roles: identity.roles,
      role: ROLE_PRIORITY.find((role) => identity.roles.includes(role)) ?? null,
      patientId: identity.patientId,
      doctorId: identity.doctorId,
    };
  }

  private async accountFields(body: Row) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 100) throw new DirectoryValidationError('Please enter your full name');
    const email = parse(emailSchema, body.email);
    const password = parse(passwordSchema, body.password);
    const mobile = body.phone ? parse(bdMobileSchema, body.phone) : null;
    if (await this.users.existsByEmailOrMobile(email, null)) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    if (mobile && (await this.users.existsByEmailOrMobile(null, mobile))) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'This mobile number is already registered');
    }
    return { name, email, mobile, passwordHash: await this.crypto.hashPassword(password) };
  }

  private async verificationRequest(body: Row): Promise<Omit<NewVerification, 'details'> & { details: Row }> {
    const bmdcNo = normalizeBmdc(body.bmdcNo);
    if (!bmdcNo) throw new DirectoryValidationError('Enter your BMDC registration number, e.g. A-12345');
    const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : '';
    if (!specialty || specialty.length > 80) throw new DirectoryValidationError('Please choose your specialty');
    const degrees = Array.isArray(body.degrees)
      ? [
          ...new Set(
            (body.degrees as unknown[])
              .filter((degree): degree is string => typeof degree === 'string')
              .map((degree) => degree.trim().replace(/\s+/g, ' '))
              .filter(Boolean),
          ),
        ]
      : [];
    if (degrees.length > 10 || degrees.some((degree) => degree.length > 60)) {
      throw new DirectoryValidationError('Add up to 10 degrees, each at most 60 characters');
    }

    // Only an approved link blocks a request. `users.bmdcNumber` is self-declared in
    // the clinic app, so trusting it would let anyone lock a real doctor out.
    const listing = await this.listings.findByBmdc(bmdcNo);
    if (listing?.userId) {
      throw new DirectoryError(
        HttpStatus.CONFLICT,
        'BMDC_CLAIMED',
        'A doctor account already manages the profile with this BMDC number. If this is you, contact support.',
      );
    }
    return {
      doctorId: listing?.id ?? null,
      kind: listing ? 'CLAIM' : 'NEW',
      bmdcNo,
      details: {
        specialty,
        gender: GENDERS.includes(body.gender) ? body.gender : null,
        designation: typeof body.designation === 'string' ? body.designation.trim().slice(0, 120) : '',
        workplace: typeof body.workplace === 'string' ? body.workplace.trim().slice(0, 160) : '',
        degrees,
      },
    };
  }

  private async session(created: { userId: string; tokenVersion: number }, ctx: SessionContext) {
    const issued = await this.tokens.issue(created.userId, UserRole.PUBLIC_USER, created.tokenVersion, ctx);
    const identity = await this.accounts.loadIdentity(created.userId);
    return {
      refreshToken: issued.refreshToken,
      body: {
        ...(await this.describe(identity!)),
        accessToken: issued.accessToken,
        expiresIn: issued.expiresIn,
        tokenType: 'Bearer' as const,
      },
    };
  }
}
