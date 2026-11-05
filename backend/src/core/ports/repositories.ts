import type {
  AppointmentStatus,
  DocumentCategory,
  OtpPurpose,
  OwnerRole,
  UserRole,
  VisitType,
} from '@cura/shared';

/**
 * Repository ports (Dependency Inversion).
 *
 * Application services depend only on these interfaces. Prisma-backed adapters
 * in `infrastructure/repositories` implement them, so the persistence engine is
 * swappable and services are unit-testable against in-memory fakes without a
 * database. Nothing here leaks a Prisma type.
 */

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorQuery {
  cursor?: string | undefined;
  limit: number;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  /** Null for a doctor an admin added who has not created a login yet. */
  passwordHash: string | null;
  role: UserRole;
  bmdcNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  emailVerifiedAt: Date | null;
  mobileVerifiedAt: Date | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  failedLoginCount: number;
  lockedUntil: Date | null;
  tokenVersion: number;
}

export interface CreateUserInput {
  fullName: string;
  email: string | null;
  mobile: string | null;
  passwordHash: string;
  bmdcNumber: string;
  role: UserRole;
}

/** A doctor signing up: hidden from patients until an admin approves them. */
export interface DoctorApplicantInput {
  fullName: string;
  email: string | null;
  mobile: string | null;
  passwordHash: string;
  bmdcNo: string;
  specialty: string;
}

/** A doctor an admin added who has no login yet. Only public fields. */
export interface ClaimableDoctor {
  userId: string;
  fullName: string;
  mobile: string;
  specialty: string;
  bmdcNo: string | null;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  /** Resolves a login identifier that may be either an email or a mobile. */
  findByIdentifier(identifier: string): Promise<UserRecord | null>;
  existsByBmdc(bmdcNumber: string): Promise<boolean>;
  existsByEmailOrMobile(email: string | null, mobile: string | null): Promise<boolean>;
  create(input: CreateUserInput): Promise<UserRecord>;
  createDoctorApplicant(input: DoctorApplicantInput): Promise<UserRecord>;
  findClaimableDoctor(mobile: string): Promise<ClaimableDoctor | null>;
  /** True when a different doctor already holds this BMDC number. */
  bmdcTakenByOther(bmdcNo: string, userId: string | null): Promise<boolean>;
  /** Creates the login once. Returns null if the doctor already has one. */
  completeDoctorClaim(
    userId: string,
    input: { passwordHash: string; bmdcNo: string; email: string | null },
  ): Promise<UserRecord | null>;
  recordSuccessfulLogin(userId: string): Promise<void>;
  /** Returns the resulting failure count so the caller can decide on lockout. */
  recordFailedLogin(userId: string): Promise<number>;
  lockUntil(userId: string, until: Date): Promise<void>;
  markVerified(userId: string, channel: 'email' | 'mobile'): Promise<void>;
  /** Invalidates every access and refresh token previously issued. */
  bumpTokenVersion(userId: string): Promise<void>;
  setActive(userId: string, isActive: boolean): Promise<void>;
  practiceIdsFor(userId: string): Promise<string[]>;
  ownerRolesFor(userId: string): Promise<OwnerRole[]>;
  isSuperAdmin(userId: string): Promise<boolean>;
  /** Every clinic, for a super admin's read-only view. */
  allPracticeIds(): Promise<string[]>;
  /** Replaces the password hash and revokes every session in one step. */
  setPassword(userId: string, passwordHash: string): Promise<void>;
  setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void>;
  updateProfile(userId: string, patch: UserProfilePatch): Promise<UserRecord>;
}

/** Fields the account owner may edit about themselves (spec: Profile Management). */
export interface UserProfilePatch {
  fullName?: string;
  gender?: string | null;
  dateOfBirth?: Date | null;
  bloodGroup?: string | null;
  secondaryPhone?: string | null;
  avatarUrl?: string | null;
  locale?: string;
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  issue(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipHash?: string | null;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  markRotated(oldId: string, newTokenHash: string): Promise<void>;
  /** Reuse detection: revoke every token descending from one lineage. */
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  /** False once logout or reuse detection has ended the whole family. */
  isFamilyActive(familyId: string): Promise<boolean>;
  deleteExpired(before: Date): Promise<number>;
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export interface OtpChallengeRecord {
  id: string;
  purpose: OtpPurpose;
  destination: string;
  subjectId: string | null;
  attempts: number;
  maxAttempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export const OTP_REPOSITORY = Symbol('OTP_REPOSITORY');

export interface OtpRepository {
  create(input: {
    purpose: OtpPurpose;
    destination: string;
    codeHash: string;
    subjectId: string | null;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<OtpChallengeRecord>;
  findActiveById(id: string): Promise<(OtpChallengeRecord & { codeHash: string }) | null>;
  incrementAttempts(id: string): Promise<number>;
  consume(id: string): Promise<void>;
  lastIssuedAt(destination: string, purpose: OtpPurpose): Promise<Date | null>;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export interface PatientRecord {
  id: string;
  practiceId: string;
  curaId: string;
  fullName: string;
  mobile: string;
  email: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  bloodGroup: string | null;
  address: string | null;
  avatarUrl: string | null;
  profileComplete: boolean;
  lastVisitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientInput {
  practiceId: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | null;
  bloodGroup?: string | null;
  address?: string | null;
  /** The website account, when the patient joined this clinic themselves. */
  accountId?: string | null;
}

export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

export interface PatientRepository {
  findById(practiceId: string, id: string): Promise<PatientRecord | null>;
  findByCuraId(practiceId: string, curaId: string): Promise<PatientRecord | null>;
  /** Family members share a mobile number, so this returns all matches. */
  findByMobile(practiceId: string, mobile: string): Promise<PatientRecord[]>;
  /** Universal search across name, Cura ID and mobile. */
  search(practiceId: string, term: string, limit: number): Promise<PatientRecord[]>;
  list(practiceId: string, query: CursorQuery): Promise<Page<PatientRecord>>;
  create(input: CreatePatientInput): Promise<PatientRecord>;
  update(practiceId: string, id: string, patch: Partial<CreatePatientInput>): Promise<PatientRecord>;
  touchLastVisit(id: string, at: Date): Promise<void>;
  nextCuraSequence(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export interface AppointmentRecord {
  id: string;
  practiceId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  visitType: VisitType;
  tokenNumber: number | null;
  plannedProcedures: string[];
  notes: string | null;
  checkedInAt: Date | null;
  engagedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentWithPatient extends AppointmentRecord {
  patient: Pick<
    PatientRecord,
    'id' | 'curaId' | 'fullName' | 'mobile' | 'gender' | 'dateOfBirth' | 'avatarUrl'
  >;
}

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');

export interface AppointmentRepository {
  findById(id: string): Promise<AppointmentWithPatient | null>;
  /** Calendar grid read: one doctor, one window. */
  findInRange(input: {
    practiceId: string;
    doctorId?: string | undefined;
    from: Date;
    to: Date;
    includeCancelled: boolean;
  }): Promise<AppointmentWithPatient[]>;
  /**
   * Bookings per local calendar day (cancellations and no-shows excluded) —
   * the mini month's load dots, without shipping every appointment to draw them.
   */
  dailyCounts(input: {
    practiceId: string;
    doctorId?: string | undefined;
    from: Date;
    to: Date;
    timeZone: string;
  }): Promise<Array<{ date: string; count: number }>>;
  /**
   * Overlap check for double-booking. Excludes cancelled/no-show and may skip
   * one id so an appointment can be rescheduled onto its own slot.
   */
  findOverlapping(input: {
    doctorId: string;
    from: Date;
    to: Date;
    excludeId?: string | undefined;
  }): Promise<AppointmentRecord[]>;
  create(input: {
    practiceId: string;
    doctorId: string;
    patientId: string;
    scheduledAt: Date;
    endsAt: Date;
    durationMinutes: number;
    visitType: VisitType;
    plannedProcedures: string[];
    notes: string | null;
    tokenNumber: number | null;
    createdById: string | null;
  }): Promise<AppointmentRecord>;
  updateStatus(id: string, status: AppointmentStatus, at: Date): Promise<AppointmentRecord>;
  reschedule(id: string, scheduledAt: Date, endsAt: Date, durationMinutes: number): Promise<AppointmentRecord>;
  /** Per-status counts in a window; one doctor's diary when `doctorId` is given. */
  countsByStatus(
    practiceId: string,
    from: Date,
    to: Date,
    doctorId?: string | undefined,
  ): Promise<Record<AppointmentStatus, number>>;
  nextTokenNumber(practiceId: string, doctorId: string, day: Date): Promise<number>;
  /**
   * Active doctors who can be booked: practice role DOCTOR or a BMDC
   * registration, in roster order (the lead consultant first).
   */
  listDoctors(practiceId: string): Promise<Array<{ id: string; fullName: string }>>;
}

/** A clinic a doctor works at on Cura, with what booking into it needs. */
export interface DoctorClinic {
  practiceId: string;
  name: string;
  slotMinutes: number;
  timezone: string;
}

export const WEBSITE_BOOKING_LINK = Symbol('WEBSITE_BOOKING_LINK');

/**
 * The bridge between a serial booking made on Cura Website and the clinic
 * appointment it created, so each side follows the other's status.
 */
export interface WebsiteBookingLinkRepository {
  /** Active clinics where this user is an active DOCTOR member. */
  doctorClinics(doctorUserId: string): Promise<DoctorClinic[]>;
  /** The website account's own patient record at this clinic, if any. */
  clinicPatientId(accountId: string, practiceId: string): Promise<string | null>;
  link(bookingId: string, appointmentId: string): Promise<void>;
  /**
   * Moves the confirmed website booking linked to this appointment. Returns the
   * booking id, or null when none is linked or it is no longer confirmed.
   */
  settle(appointmentId: string, status: 'CANCELLED' | 'COMPLETED'): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Clinical records & consent
// ---------------------------------------------------------------------------

export const ENCOUNTER_REPOSITORY = Symbol('ENCOUNTER_REPOSITORY');

export interface EncounterSummary {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string | null;
  occurredAt: Date;
  signedAt: Date | null;
}

export interface EncounterRepository {
  findForPatient(input: {
    patientId: string;
    notBefore: Date | null;
    query: CursorQuery;
  }): Promise<Page<EncounterSummary>>;
  hasRecordsBefore(patientId: string, before: Date): Promise<boolean>;
  create(input: {
    patientId: string;
    doctorId: string;
    appointmentId: string | null;
    occurredAt: Date;
  }): Promise<EncounterSummary>;
}

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

export interface ConsentRepository {
  /** Active (unexpired, unrevoked) grant for this doctor/patient pair. */
  activeGrant(patientId: string, userId: string, now: Date): Promise<{ expiresAt: Date } | null>;
  grant(input: {
    patientId: string;
    grantedToUserId: string;
    expiresAt: Date;
    method: string;
  }): Promise<void>;
  revoke(patientId: string, userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  practiceId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata?: Record<string, unknown> | undefined;
}

export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');

export interface DocumentRecord {
  id: string;
  ownerUserId: string | null;
  patientId: string | null;
  encounterId: string | null;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
}

export interface DocumentRepository {
  create(input: {
    ownerUserId: string | null;
    patientId: string | null;
    encounterId: string | null;
    category: DocumentCategory;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    checksum: string;
  }): Promise<{ id: string; storageKey: string }>;
  findById(id: string): Promise<DocumentRecord | null>;
  /** Content-addressed lookup so an identical re-upload reuses the object. */
  findByChecksum(checksum: string): Promise<{ id: string; storageKey: string } | null>;
  listForPatient(patientId: string): Promise<DocumentRecord[]>;
  listForOwner(ownerUserId: string): Promise<DocumentRecord[]>;
  /** Practice-wide browse, keyset-paginated. */
  listForPractice(
    practiceId: string,
    filter: DocumentFilter,
  ): Promise<{ items: DocumentListRow[]; nextCursor: string | null }>;
  softDelete(id: string): Promise<void>;
}

export interface DocumentFilter {
  ownerUserId: string;
  category?: DocumentCategory | undefined;
  patientId?: string | undefined;
  /** Matches the file name or the patient's name. */
  q?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  cursor?: string | undefined;
  limit: number;
}

/** A document plus the patient it hangs off, for the browser's list. */
export interface DocumentListRow {
  id: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  capturedOn: Date | null;
  encounterId: string | null;
  patient: { id: string; fullName: string; curaId: string } | null;
}
