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
  /** False for a doctor who was added but has not created a login yet. */
  hasLogin: boolean;
  specialty: string | null;
  notifyScheduleSms: boolean;
  notifyScheduleEmail: boolean;
  notifyAppointmentSms: boolean;
  notifyAppointmentEmail: boolean;
}

export type Kind = 'doctor' | 'staff';

/** Doctors are listed apart from the front desk, as the reference UI does. */
export const MEDICAL_ROLES: readonly string[] = [UserRole.DOCTOR];

/**
 * What an owner can add. Only a super admin creates owners, so an owner's own
 * clinic has one access level per personnel tab.
 */
export const ACCESS_OPTIONS: Record<Kind, ReadonlyArray<{ role: string; label: string; detail: string }>> = {
  doctor: [
    {
      role: UserRole.DOCTOR,
      label: 'Doctor',
      detail: 'Patient records and prescriptions. Cannot book sessions or register patients.',
    },
  ],
  staff: [
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
  if (role === UserRole.ADMINISTRATOR) return 'Administrator';
  return ACCESS_OPTIONS[kind].find((o) => o.role === role)?.label ?? role.replace(/_/g, ' ').toLowerCase();
}
