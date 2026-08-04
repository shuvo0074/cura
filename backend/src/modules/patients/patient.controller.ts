import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { z } from 'zod';
import {
  Permission,
  businessRules,
  patientIntakeSchema,
  type PatientIntakeInput,
} from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import {
  AUDIT_REPOSITORY,
  PATIENT_REPOSITORY,
  type AuditRepository,
  type PatientRepository,
} from '../../core/ports/repositories';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const listQuery = practiceQuery.extend({
  cursor: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(businessRules.pagination.maxPageSize)
    .default(businessRules.pagination.defaultPageSize),
});

/**
 * Update payload.
 *
 * Written out rather than derived from `patientIntakeSchema.partial()`: that
 * schema ends in a `.refine()` (age-or-DOB), which makes it a ZodEffects with
 * no `.partial()`. A partial update has no such cross-field requirement anyway.
 */
const patientUpdateSchema = practiceQuery.extend({
  fullName: z.string().trim().min(2).max(120).optional(),
  mobile: z.string().trim().max(20).optional(),
  email: z.string().email().nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  bloodGroup: z.string().max(4).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
});

const searchQuery = practiceQuery.extend({
  q: z.string().trim().min(businessRules.search.minQueryLength),
  limit: z.coerce.number().int().min(1).max(businessRules.search.maxResults).default(10),
});

/**
 * Patient directory.
 *
 * The universal search bar and the Patients module both read through here.
 * Every method scopes to a practice the caller belongs to, so a patient id from
 * another clinic resolves to a 404 rather than leaking that it exists.
 */
@Controller('patients')
export class PatientController {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  async list(
    @Query(zodBody(listQuery)) query: z.infer<typeof listQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, query.practiceId);
    return this.patients.list(query.practiceId, { cursor: query.cursor, limit: query.limit });
  }

  /** Backs the header's as-you-type dropdown (spec 2.1.1). */
  @Get('search')
  @RequirePermissions(Permission.PATIENT_READ)
  async search(
    @Query(zodBody(searchQuery)) query: z.infer<typeof searchQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, query.practiceId);
    return this.patients.search(query.practiceId, query.q, query.limit);
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, query.practiceId);
    const patient = await this.patients.findById(query.practiceId, id);
    if (!patient) throw new NotFoundError('Patient');

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'patient.read',
      resourceType: 'patient',
      resourceId: id,
      practiceId: query.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return patient;
  }

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  async create(
    @Body(zodBody(practiceQuery.and(patientIntakeSchema)))
    body: PatientIntakeInput & { practiceId: string },
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, body.practiceId);

    // Reuse an existing record when the mobile already exists, matching the
    // intake modal's duplicate-prevention rule.
    const existing = await this.patients.findByMobile(body.practiceId, body.mobile);
    const match = existing.find(
      (p) => p.fullName.toLowerCase() === body.fullName.toLowerCase(),
    );
    if (match) return match;

    const created = await this.patients.create({
      practiceId: body.practiceId,
      fullName: body.fullName,
      mobile: body.mobile,
      email: body.email ?? null,
      gender: body.gender ?? null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      bloodGroup: body.bloodGroup ?? null,
      address: body.address ?? null,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'patient.created',
      resourceType: 'patient',
      resourceId: created.id,
      practiceId: body.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return created;
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(patientUpdateSchema)) body: z.infer<typeof patientUpdateSchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, body.practiceId);

    const existing = await this.patients.findById(body.practiceId, id);
    if (!existing) throw new NotFoundError('Patient');

    return this.patients.update(body.practiceId, id, {
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.mobile !== undefined ? { mobile: body.mobile } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.dateOfBirth !== undefined
        ? { dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null }
        : {}),
      ...(body.bloodGroup !== undefined ? { bloodGroup: body.bloodGroup } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
    });
  }

  private assert(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }
}
