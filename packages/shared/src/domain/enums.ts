/**
 * Domain enumerations shared by backend, web and mobile.
 *
 * Declared as const objects (not TS `enum`) so they are erasable, tree-shakable
 * and safe to send over the wire.
 */

/**
 * Access levels.
 *
 * Three, deliberately: the practice owner, the clinicians who write records,
 * and the front desk who run the diary. Anything finer was collapsing into
 * roles nobody could tell apart when assigning them.
 */
export const UserRole = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  DOCTOR: 'DOCTOR',
  DESK_STAFF: 'DESK_STAFF',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Granular permissions. Roles map to permission sets (see `rolePermissions`),
 * and guards check permissions rather than roles — adding a role never requires
 * touching a controller.
 */
export const Permission = {
  PATIENT_READ: 'patient:read',
  /** Registering a new patient. Separate from editing one that exists. */
  PATIENT_CREATE: 'patient:create',
  PATIENT_WRITE: 'patient:write',
  PATIENT_HISTORY_READ: 'patient:history:read',
  APPOINTMENT_READ: 'appointment:read',
  /** Booking or rescheduling a session. Front-desk work, not clinical work. */
  APPOINTMENT_WRITE: 'appointment:write',
  /** Moving a booked session through waiting → engaged → done. */
  APPOINTMENT_STATUS_WRITE: 'appointment:status:write',
  APPOINTMENT_CANCEL: 'appointment:cancel',
  PRESCRIPTION_READ: 'prescription:read',
  PRESCRIPTION_WRITE: 'prescription:write',
  CLINICAL_WRITE: 'clinical:write',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  STAFF_MANAGE: 'staff:manage',
  SETTINGS_MANAGE: 'settings:manage',
  REPORTS_READ: 'reports:read',
  CATALOG_MANAGE: 'catalog:manage',
  /**
   * Reading the drug and clinical-note catalogues.
   *
   * Held by every role: these back the auto-suggest a doctor relies on while
   * writing a prescription, so gating them behind settings access would break
   * the clinical screen for everyone but administrators.
   */
  CATALOG_READ: 'catalog:read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL: Permission[] = Object.values(Permission);

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMINISTRATOR]: ALL,

  /**
   * Doctors own the clinical record but not the diary.
   *
   * No APPOINTMENT_WRITE and no PATIENT_CREATE: booking a session and
   * registering a patient are front-desk actions. A doctor can still move a
   * session they are seeing through the queue, which is why the status
   * permission is separate from the booking one.
   */
  [UserRole.DOCTOR]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_HISTORY_READ,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_STATUS_WRITE,
    Permission.PRESCRIPTION_READ,
    Permission.PRESCRIPTION_WRITE,
    Permission.CLINICAL_WRITE,
    Permission.CATALOG_READ,
    Permission.BILLING_READ,
    Permission.REPORTS_READ,
  ],

  /** The front desk: registration, the diary and taking payment. */
  [UserRole.DESK_STAFF]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_CREATE,
    Permission.PATIENT_WRITE,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_WRITE,
    Permission.APPOINTMENT_STATUS_WRITE,
    Permission.APPOINTMENT_CANCEL,
    Permission.CATALOG_READ,
    Permission.BILLING_READ,
    Permission.BILLING_WRITE,
  ],
};

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return rolePermissions[role] ?? [];
}

/** Spec: Waiting / Engaged / Done / Cancelled queue states. */
export const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  WAITING: 'WAITING',
  ENGAGED: 'ENGAGED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

/**
 * Legal state transitions. Centralising this prevents a client from putting an
 * appointment into an impossible state and keeps the queue counters coherent.
 */
export const appointmentTransitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.WAITING,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.WAITING]: [
    AppointmentStatus.ENGAGED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.ENGAGED]: [AppointmentStatus.DONE, AppointmentStatus.CANCELLED],
  [AppointmentStatus.DONE]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return appointmentTransitions[from]?.includes(to) ?? false;
}

/** Spec 3: grid prefixes N (new) / F (follow-up) / O (old). */
export const VisitType = {
  NEW: 'NEW',
  FOLLOW_UP: 'FOLLOW_UP',
  OLD: 'OLD',
} as const;
export type VisitType = (typeof VisitType)[keyof typeof VisitType];

export const visitTypePrefix: Record<VisitType, string> = {
  [VisitType.NEW]: 'N',
  [VisitType.FOLLOW_UP]: 'F',
  [VisitType.OLD]: 'O',
};

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const BloodGroup = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  O_POS: 'O+', O_NEG: 'O-', AB_POS: 'AB+', AB_NEG: 'AB-',
} as const;
export type BloodGroup = (typeof BloodGroup)[keyof typeof BloodGroup];

export const DocumentCategory = {
  NID_FRONT: 'NID_FRONT',
  NID_BACK: 'NID_BACK',
  MEDICAL_CERTIFICATE: 'MEDICAL_CERTIFICATE',
  DIGITAL_SIGNATURE: 'DIGITAL_SIGNATURE',
  LAB_REPORT: 'LAB_REPORT',
  EXTERNAL_PRESCRIPTION: 'EXTERNAL_PRESCRIPTION',
  OTHER: 'OTHER',
} as const;
export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const OtpPurpose = {
  REGISTRATION: 'REGISTRATION',
  LOGIN: 'LOGIN',
  PASSWORD_RESET: 'PASSWORD_RESET',
  STAFF_DEVICE: 'STAFF_DEVICE',
  PATIENT_CONSENT: 'PATIENT_CONSENT',
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const CalendarView = {
  DAY: 'day',
  THREE_DAY: 'threeDay',
  WEEK: 'week',
  MONTH: 'month',
} as const;
export type CalendarView = (typeof CalendarView)[keyof typeof CalendarView];
