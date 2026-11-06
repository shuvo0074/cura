/**
 * Ports for the public directory. Each one is narrow, so a service depends only
 * on the persistence it actually uses. Rows are plain objects whose fields come
 * from explicit select lists in the adapters.
 */
export type Row = Record<string, any>;

export type DirectoryRoleName = 'super_admin' | 'patient' | 'doctor' | 'ambulance_owner' | 'pharmacy_owner';

export interface DirectoryIdentity {
  userId: string;
  name: string;
  email: string | null;
  mobile: string | null;
  roles: DirectoryRoleName[];
  patientId: string | null;
  doctorId: string | null;
  doctorVerified: boolean;
}

export interface NewAccount {
  name: string;
  email: string;
  mobile: string | null;
  passwordHash: string;
}

export interface NewVerification {
  doctorId: string | null;
  kind: 'NEW';
  bmdcNo: string;
  details: Row;
}

export const DIRECTORY_ACCOUNT_REPOSITORY = Symbol('DIRECTORY_ACCOUNT_REPOSITORY');

export interface DirectoryAccountRepository {
  loadIdentity(userId: string): Promise<DirectoryIdentity | null>;
  createPatient(account: NewAccount): Promise<{ userId: string; tokenVersion: number }>;
  /** Adds a pending request to an account whose doctor record awaits approval. */
  submitVerification(userId: string, verification: NewVerification): Promise<void>;
  latestVerification(userId: string): Promise<Row | null>;
  /** Clinics a patient can choose on Cura Website. */
  listClinics(): Promise<Row[]>;
  clinicExists(practiceId: string): Promise<boolean>;
  listPatientClinics(accountId: string): Promise<Row[]>;
  findPatientClinic(accountId: string, practiceId: string): Promise<Row | null>;
  leaveClinic(accountId: string, practiceId: string): Promise<boolean>;
  /** A super admin creates a clinic and its owner together. */
  createClinicOwner(input: NewClinicOwner): Promise<Row>;
  listClinicOwners(): Promise<Row[]>;
  findUserIdByIdentifier(identifier: string): Promise<string | null>;
  grantRole(userId: string, role: 'AMBULANCE_OWNER' | 'PHARMACY_OWNER'): Promise<void>;
  revokeRole(userId: string, role: 'AMBULANCE_OWNER' | 'PHARMACY_OWNER'): Promise<void>;
}

export interface NewClinicOwner {
  fullName: string;
  email: string | null;
  mobile: string;
  passwordHash: string;
  clinicName: string;
}

export const DOCTOR_LISTING_REPOSITORY = Symbol('DOCTOR_LISTING_REPOSITORY');

export interface DoctorSearch {
  q: string;
  filters: Partial<Record<'specialty' | 'division' | 'city' | 'gender', string[]>>;
  page: number;
  limit: number;
}

export interface DoctorListingRepository {
  /** Creates the doctor and the user behind them. */
  createWithUser(data: Row, mobile: string): Promise<Row>;
  listPublic(): Promise<Row[]>;
  searchPublic(search: DoctorSearch): Promise<{ items: Row[]; total: number }>;
  featured(limit: number): Promise<Row[]>;
  stats(): Promise<Row>;
  findPublicById(id: string): Promise<Row | null>;
  findPublicBySlug(slug: string): Promise<Row | null>;
  /** Null when the doctor is missing or hidden. */
  findVisible(id: string): Promise<{ id: string; userId: string; weeklySchedule: unknown; clinicalExpertise: string[] } | null>;
  findByBmdc(bmdcNo: string): Promise<{ id: string; userId: string | null } | null>;
  listForHospital(hospitalId: string, hospitalName: string): Promise<Row[]>;
  listAdmin(): Promise<Row[]>;
  update(id: string, data: Row): Promise<Row | null>;
  setHidden(id: string, hidden: boolean): Promise<Row | null>;
  bookingCount(id: string): Promise<number>;
  delete(id: string): Promise<{ id: string; name: string; photo: string | null } | null>;
  /** Returns the previous photo, or undefined when the doctor does not exist. */
  setPhoto(id: string, photo: string | null): Promise<string | null | undefined>;
}

export const DOCTOR_PROFILE_REPOSITORY = Symbol('DOCTOR_PROFILE_REPOSITORY');

export interface DoctorProfileRepository {
  findSelf(doctorId: string): Promise<Row | null>;
  /** Claims the first free slug in order. */
  assignFirstFreeSlug(doctorId: string, candidates: string[]): Promise<string | null>;
  updateSelf(doctorId: string, patch: Row): Promise<void>;
  touch(doctorId: string): Promise<void>;
  items(doctorId: string): Promise<Row[]>;
  countItems(doctorId: string, kind: string): Promise<number>;
  addItem(doctorId: string, item: Row): Promise<Row>;
  updateItem(doctorId: string, itemId: string, item: Row): Promise<Row | null>;
  deleteItem(doctorId: string, itemId: string): Promise<boolean>;
  endorsementSummaries(doctorId: string, skills: string[]): Promise<Row[]>;
  isVerified(doctorId: string): Promise<boolean>;
  endorse(doctorId: string, endorserId: string, skill: string): Promise<void>;
  unendorse(doctorId: string, endorserId: string, skill: string): Promise<void>;
  reviewSummary(doctorId: string): Promise<{ count: number; average: number | null }>;
  recentReviews(doctorId: string, limit: number): Promise<Row[]>;
  endorsementTotals(doctorId: string): Promise<{ recognitions: number; peers: number }>;
}

export const DOCTOR_VERIFICATION_REPOSITORY = Symbol('DOCTOR_VERIFICATION_REPOSITORY');

export interface DoctorVerificationRepository {
  list(status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<Row[]>;
  approve(id: string, reviewerId: string): Promise<{ doctorId: string; userId: string }>;
  reject(id: string, note: string, reviewerId: string): Promise<{ userId: string } | null>;
}

export const DOCTOR_REACH_REPOSITORY = Symbol('DOCTOR_REACH_REPOSITORY');

export interface DoctorReachRepository {
  addView(doctorId: string, day: Date): Promise<void>;
  /** Null when the doctor is missing or hidden. */
  addShare(doctorId: string, day: Date): Promise<{ id: string; shareCount: number } | null>;
  addCall(doctorId: string, venue: string | null, phone: string | null): Promise<{ id: string; createdAt: Date } | null>;
  dailyStats(doctorId: string, since: Date): Promise<{ day: Date; views: number; shares: number }[]>;
  callTimes(doctorId: string, since: Date): Promise<Date[]>;
}

export const SERIAL_BOOKING_REPOSITORY = Symbol('SERIAL_BOOKING_REPOSITORY');

export interface NewBooking {
  patientId: string;
  doctorId: string;
  bookingDate: Date;
  startTime: string;
  venue: string;
  sessionTime: string;
  notes: string | null;
}

export interface SerialBookingRepository {
  /** Assigns the next serial under a per-session lock. Cancelled serials stay used. */
  book(booking: NewBooking): Promise<Row>;
  sessionCounts(doctorId: string, date: Date): Promise<{ venue: string; sessionTime: string; lastSerial: number; booked: number }[]>;
  patientActive(doctorId: string, date: Date, patientId: string): Promise<Row[]>;
  listForPatient(patientId: string): Promise<Row[]>;
  listForDoctor(doctorId: string): Promise<Row[]>;
  listAll(status: string | null): Promise<Row[]>;
  /** Null unless the patient owns a currently confirmed booking. */
  cancel(id: string, patientId: string): Promise<Row | null>;
  /** Null unless the doctor owns a currently confirmed booking. */
  complete(id: string, doctorId: string): Promise<Row | null>;
  findForReview(id: string, patientId: string): Promise<{ doctorId: string; status: string } | null>;
  /** Null when this booking already has a review. */
  addReview(input: { bookingId: string; doctorId: string; patientId: string; rating: number; comment: string | null }): Promise<Row | null>;
}

export const HOSPITAL_REPOSITORY = Symbol('HOSPITAL_REPOSITORY');

export interface HospitalRepository {
  listPublic(): Promise<Row[]>;
  findPublic(id: string): Promise<Row | null>;
  listAdmin(): Promise<Row[]>;
  findAny(id: string): Promise<Row | null>;
  create(data: Row): Promise<Row>;
  update(id: string, data: Row): Promise<Row | null>;
  setHidden(id: string, hidden: boolean): Promise<Row | null>;
  /** Doctors with this as their hospital or listing it as a chamber. */
  dependentDoctorCount(id: string, name: string): Promise<number>;
  delete(id: string): Promise<void>;
  setPhoto(id: string, photo: string | null): Promise<string | null | undefined>;
}

export const AMBULANCE_REPOSITORY = Symbol('AMBULANCE_REPOSITORY');

export interface AmbulanceRepository {
  listPublic(): Promise<Row[]>;
  listAdmin(): Promise<Row[]>;
  create(data: Row): Promise<Row>;
  update(id: string, data: Row): Promise<Row | null>;
  setHidden(id: string, hidden: boolean): Promise<Row | null>;
  delete(id: string): Promise<boolean>;
  listOwned(ownerId: string): Promise<Row[]>;
  /** Hidden from patients until a super admin shows it. */
  createOwned(ownerId: string, data: Row): Promise<Row>;
  /** Null when the vendor is missing or belongs to someone else. */
  updateOwned(id: string, ownerId: string, data: Row): Promise<Row | null>;
  setOwner(id: string, ownerId: string | null): Promise<boolean>;
}

export const ADMIN_USERS_REPOSITORY = Symbol('ADMIN_USERS_REPOSITORY');

export type GrantableRole = 'SUPER_ADMIN' | 'PATIENT' | 'AMBULANCE_OWNER' | 'PHARMACY_OWNER';
export type ClinicRole = 'ADMINISTRATOR' | 'DOCTOR' | 'DESK_STAFF';

/** A super admin's view of every account, clinic and pharmacy. */
export interface AdminUsersRepository {
  listUsers(search: { q: string; role: string | null; page: number; limit: number }): Promise<{ items: Row[]; total: number }>;
  getUser(id: string): Promise<Row | null>;
  createUser(data: { fullName: string; email: string | null; mobile: string | null; passwordHash: string }): Promise<Row>;
  updateUser(id: string, data: Row): Promise<boolean>;
  setRole(id: string, role: GrantableRole, granted: boolean): Promise<void>;
  countSuperAdmins(): Promise<number>;
  /** Sets the clinic access level and the clinics it applies to, in one step. */
  setClinicAccess(id: string, access: { role: ClinicRole | null; practiceIds: string[]; specialty: string | null }): Promise<void>;
  listClinics(): Promise<Row[]>;
  updateClinic(id: string, data: Row): Promise<Row | null>;
  listPharmacies(): Promise<Row[]>;
  createPharmacy(ownerId: string, data: Row): Promise<Row>;
  updatePharmacy(id: string, data: Row): Promise<Row | null>;
  deletePharmacy(id: string): Promise<boolean>;
  setPharmacyOwner(id: string, ownerId: string): Promise<boolean>;
}

export const PHARMACY_REPOSITORY = Symbol('PHARMACY_REPOSITORY');

export interface PharmacyRepository {
  listOwned(ownerId: string): Promise<Row[]>;
  create(ownerId: string, data: Row): Promise<Row>;
  /** Null when the pharmacy is missing or belongs to someone else. */
  update(id: string, ownerId: string, data: Row): Promise<Row | null>;
}

export const CATALOG_DIRECTORY_REPOSITORY = Symbol('CATALOG_DIRECTORY_REPOSITORY');

export type CatalogKind = 'specialties' | 'symptoms';

export interface CatalogDirectoryRepository {
  listPublic(kind: CatalogKind): Promise<Row[]>;
  listAdmin(kind: CatalogKind): Promise<Row[]>;
  find(kind: CatalogKind, id: string): Promise<Row | null>;
  create(kind: CatalogKind, data: Row): Promise<Row>;
  /** A specialty rename also updates its doctors and symptoms, atomically. */
  update(kind: CatalogKind, id: string, data: Row): Promise<{ row: Row; renamedDoctors: number; renamedFrom: string | null } | null>;
  setHidden(kind: CatalogKind, id: string, hidden: boolean): Promise<Row | null>;
  delete(kind: CatalogKind, id: string): Promise<void>;
  setImage(kind: CatalogKind, id: string, image: string | null): Promise<void>;
  specialtyUsage(name: string): Promise<{ doctors: number; symptoms: number }>;
  /** A specialty typed on a doctor that is not listed yet is added hidden. */
  ensureSpecialty(name: string): Promise<void>;
  existingSpecialtyNames(names: string[]): Promise<string[]>;
  slugs(kind: CatalogKind): Promise<string[]>;
}

export const PATIENT_HEALTH_REPOSITORY = Symbol('PATIENT_HEALTH_REPOSITORY');

/** A signed visit as the patient sees it. No staff-only notes or observations. */
export interface HealthVisit {
  id: string;
  occurredAt: Date;
  clinicName: string;
  doctorName: string;
  complaints: string[];
  diagnoses: string[];
  advice: string[];
  vitals: {
    weightKg: number | null;
    systolic: number | null;
    diastolic: number | null;
    pulseBpm: number | null;
    temperatureC: number | null;
  } | null;
  prescription: {
    investigations: string[];
    followUpDate: Date | null;
    items: {
      drugName: string;
      form: string | null;
      strength: string | null;
      morning: number;
      noon: number;
      night: number;
      mealRelation: string;
      durationDays: number | null;
      instruction: string | null;
    }[];
  } | null;
}

export interface HealthInvoice {
  id: string;
  number: string;
  date: Date;
  clinicName: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  items: { description: string; quantity: number; totalMinor: number }[];
}

export interface HealthAppointment {
  id: string;
  scheduledAt: Date;
  clinicName: string;
  doctorName: string;
  status: string;
}

/**
 * Read-only: a patient's own records at the clinics they joined on Cura Website.
 * Every query is scoped by the website account, never by an id the client sends.
 */
export interface PatientHealthRepository {
  /** Signed visits only, newest first. Drafts never leave the database. */
  signedVisits(accountId: string, limit: number): Promise<HealthVisit[]>;
  /** Issued invoices, newest first; cancelled ones only where the clinic shows them. */
  invoices(accountId: string, limit: number): Promise<HealthInvoice[]>;
  /** Calendar appointments that are not cancelled and have not ended yet, soonest first. */
  upcomingAppointments(accountId: string, now: Date, limit: number): Promise<HealthAppointment[]>;
}

export const SITE_SETTINGS_REPOSITORY = Symbol('SITE_SETTINGS_REPOSITORY');

export interface SiteSettingsRepository {
  get<T>(key: string, fallback: T): Promise<T>;
  getMany(keys: string[]): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
}
