/** Types and constants shared by the staff panel. */

import { UserRole } from '@cura/shared';

export interface Staff {
  userId: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  bmdcNumber: string | null;
  isActive: boolean;
  notifyScheduleSms: boolean;
  notifyScheduleEmail: boolean;
  notifyAppointmentSms: boolean;
  notifyAppointmentEmail: boolean;
}

export type Kind = 'doctor' | 'staff';

/** Doctors are listed apart from the front desk, as the reference UI does. */
export const MEDICAL_ROLES: readonly string[] = [UserRole.DOCTOR];

/**
 * The three access levels.
 *
 * Administrators run the practice, doctors own the clinical record, desk staff
 * run the diary. The list is identical for both personnel tabs — only the
 * default differs — because the levels are the levels.
 */
export const ACCESS_OPTIONS: Record<Kind, ReadonlyArray<{ role: string; label: string; detail: string }>> = {
  doctor: [
    {
      role: UserRole.ADMINISTRATOR,
      label: 'Administrator',
      detail: 'Everything: settings, staff, catalogs, statistics and billing.',
    },
    {
      role: UserRole.DOCTOR,
      label: 'Doctor',
      detail: 'Patient records and prescriptions. Cannot book sessions or register patients.',
    },
  ],
  staff: [
    {
      role: UserRole.ADMINISTRATOR,
      label: 'Administrator',
      detail: 'Everything: settings, staff, catalogs, statistics and billing.',
    },
    {
      role: UserRole.DESK_STAFF,
      label: 'Desk staff',
      detail: 'Register patients, book sessions, run the queue and take payment.',
    },
  ],
};

export const NOTIFICATION_ROWS = [
  { label: 'Daily Schedule', sms: 'notifyScheduleSms', email: 'notifyScheduleEmail' },
  { label: 'Appointment Confirmations', sms: 'notifyAppointmentSms', email: 'notifyAppointmentEmail' },
] as const;

export function accessLabel(role: string, kind: Kind): string {
  return ACCESS_OPTIONS[kind].find((o) => o.role === role)?.label ?? role.replace(/_/g, ' ').toLowerCase();
}
