import type {
  AppointmentStatus,
  BloodGroup,
  DocumentCategory,
  Gender,
  Permission,
  UserRole,
  VisitType,
} from './enums';

/** Wire-format models. Dates are ISO-8601 strings — never `Date` across HTTP. */

export interface Identified {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: UserRole;
  permissions: readonly Permission[];
  practiceIds: readonly string[];
  onboardingCompleted: boolean;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSession extends AuthTokens {
  user: AuthenticatedUser;
}

/** Returned when credentials are valid but an OTP challenge must be satisfied. */
export interface OtpChallenge {
  challengeId: string;
  /** Masked destination, e.g. "+8801•••••4567" — never the full value. */
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export type LoginResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'otp_required'; challenge: OtpChallenge };

export interface Patient extends Identified {
  curaId: string;
  fullName: string;
  mobile: string;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  bloodGroup: BloodGroup | null;
  address: string | null;
  avatarUrl: string | null;
  /** Spec: profile completion indicator on the calendar details pane. */
  profileComplete: boolean;
  lastVisitAt: string | null;
}

export interface PatientSearchHit {
  id: string;
  curaId: string;
  fullName: string;
  mobile: string;
  gender: Gender | null;
  ageYears: number | null;
  avatarUrl: string | null;
}

export interface Appointment extends Identified {
  practiceId: string;
  doctorId: string;
  patientId: string;
  patient: PatientSearchHit;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  visitType: VisitType;
  tokenNumber: number | null;
  plannedProcedures: readonly string[];
  notes: string | null;
  checkedInAt: string | null;
  engagedAt: string | null;
  completedAt: string | null;
}

/** Realtime counters for the dashboard Information Box. */
export interface QueueSummary {
  date: string;
  waiting: number;
  engaged: number;
  done: number;
  cancelled: number;
  total: number;
}

export interface PracticeSession {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Practice extends Identified {
  name: string;
  specialization: string | null;
  contactNumber: string | null;
  email: string | null;
  address: string | null;
  mapsUrl: string | null;
  logoUrl: string | null;
  roomNumber: string | null;
  slotMinutes: number;
  sessions: readonly PracticeSession[];
}

export interface TimeSlot {
  startsAt: string;
  endsAt: string;
  available: boolean;
  appointmentId: string | null;
}

export interface DocumentAsset extends Identified {
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  capturedOn: string | null;
}

export interface Vitals extends Identified {
  encounterId: string;
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
}

export interface ClinicalNote extends Identified {
  encounterId: string;
  complaints: readonly string[];
  observations: readonly string[];
  diagnoses: readonly string[];
  advice: readonly string[];
  notes: string | null;
}

export interface PrescriptionItem {
  drugName: string;
  strength: string | null;
  form: string | null;
  durationDays: number | null;
  morning: number;
  noon: number;
  night: number;
  mealRelation: 'BEFORE' | 'AFTER' | 'ANY';
  instruction: string | null;
}

export interface Prescription extends Identified {
  encounterId: string;
  items: readonly PrescriptionItem[];
  investigations: readonly string[];
  followUpDate: string | null;
  signedAt: string | null;
}

/** One visit. Timeline entries in the patient dashboard are encounters. */
export interface Encounter extends Identified {
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string | null;
  occurredAt: string;
  vitals: Vitals | null;
  clinicalNote: ClinicalNote | null;
  prescription: Prescription | null;
  documents: readonly DocumentAsset[];
}

/**
 * Spec: records older than the privacy window are withheld until the patient
 * consents. The client renders a locked state from this, so the rule is visible
 * in the contract rather than implied by an empty list.
 */
export interface TimelinePage {
  entries: readonly Encounter[];
  nextCursor: string | null;
  privacyWindowDays: number;
  hasLockedHistory: boolean;
  consentGrantedUntil: string | null;
}

export interface CursorPage<T> {
  items: readonly T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Uniform error envelope emitted by the API's exception filter. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  /** Field-level messages keyed by dotted path. */
  details?: Record<string, string[]>;
  requestId: string;
  timestamp: string;
}
