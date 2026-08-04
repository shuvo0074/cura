/**
 * Domain enumerations shared by backend, web and mobile.
 *
 * Declared as const objects (not TS `enum`) so they are erasable, tree-shakable
 * and safe to send over the wire.
 */

export const UserRole = {
  DOCTOR: 'DOCTOR',
  ASSISTANT_DOCTOR: 'ASSISTANT_DOCTOR',
  ADMINISTRATOR: 'ADMINISTRATOR',
  RECEPTIONIST: 'RECEPTIONIST',
  FRONT_DESK: 'FRONT_DESK',
  NONE: 'NONE',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Granular permissions. Roles map to permission sets (see `rolePermissions`),
 * and guards check permissions rather than roles — adding a role never requires
 * touching a controller.
 */
export const Permission = {
  PATIENT_READ: 'patient:read',
  PATIENT_WRITE: 'patient:write',
  PATIENT_HISTORY_READ: 'patient:history:read',
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_WRITE: 'appointment:write',
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
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL: Permission[] = Object.values(Permission);

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  [UserRole.DOCTOR]: ALL,
  [UserRole.ADMINISTRATOR]: ALL,
  [UserRole.ASSISTANT_DOCTOR]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.PATIENT_HISTORY_READ,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_WRITE,
    Permission.PRESCRIPTION_READ,
    Permission.PRESCRIPTION_WRITE,
    Permission.CLINICAL_WRITE,
  ],
  [UserRole.RECEPTIONIST]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.APPOINTMENT_READ,
    Permission.APPOINTMENT_WRITE,
    Permission.APPOINTMENT_CANCEL,
    Permission.BILLING_READ,
  ],
  [UserRole.FRONT_DESK]: [Permission.APPOINTMENT_READ, Permission.PATIENT_READ],
  [UserRole.NONE]: [],
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
