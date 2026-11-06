/** Types and constants shared by the staff panel. */

import { UserRole } from '@cura/shared';
import { translate, type Locale } from '../../../i18n';

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
 * clinic has one access level per personnel tab. Each role has a
 * `settings.staff.access.<role>` name and a `settings.staff.accessDetail.<role>` line.
 */
export const ACCESS_OPTIONS = {
  doctor: [UserRole.DOCTOR],
  staff: [UserRole.DESK_STAFF],
} as const satisfies Record<Kind, readonly string[]>;

/** `key` names the row's `settings.staff.notify.*` label. */
export const NOTIFICATION_ROWS = [
  { key: 'schedule', sms: 'notifyScheduleSms', email: 'notifyScheduleEmail' },
  { key: 'appointment', sms: 'notifyAppointmentSms', email: 'notifyAppointmentEmail' },
] as const;

export function accessLabel(role: string, kind: Kind, locale: Locale = 'en'): string {
  if (role === UserRole.ADMINISTRATOR) return translate(locale, 'settings.staff.access.ADMINISTRATOR');
  const option = (ACCESS_OPTIONS[kind] as readonly string[]).includes(role) ? ACCESS_OPTIONS[kind][0] : undefined;
  return option ? translate(locale, `settings.staff.access.${option}`) : role.replace(/_/g, ' ').toLowerCase();
}
