import { OwnerRole, Permission } from '@cura/shared';
import type { TranslationKey } from '../../i18n';

/**
 * Sidebar navigation model (spec 2.2).
 *
 * Declared as data rather than JSX so the shell renders it generically and a
 * new module is one entry here — no component edit. `permission` drives
 * visibility, so a receptionist never sees Settings at all rather than seeing
 * it and hitting a 403.
 *
 * `status` is honest about what each destination currently does:
 *   ready   — a real screen backed by the API
 *   partial — renders, but only part of the module is built
 *   pending — no UI yet; the route shows what exists and what does not
 */
export type RouteKey =
  | 'calendar'
  | 'patients'
  | 'queue'
  | 'communications'
  | 'settings'
  | 'reports'
  | 'billing'
  | 'documents'
  | 'feedback'
  | 'integrations'
  | 'ambulances'
  | 'pharmacy'
  | 'hospital'
  | 'admin'
  | 'community'
  | 'prime'
  | 'profile';

export interface NavItem {
  key: RouteKey;
  /** Words are in `i18n/areas/shell.ts`; show with `t(item.label)`. */
  label: TranslationKey;
  icon: string;
  permission?: Permission;
  /** Shown only to accounts that own this kind of business. */
  ownerRole?: OwnerRole;
  /** Shown only to super admins. */
  superAdminOnly?: boolean;
  status: 'ready' | 'partial' | 'pending';
  hint?: TranslationKey;
  /** Second sidebar block: the doctor's outward-facing presence and add-ons. */
  group?: 'network';
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'calendar',
    label: 'shell.nav.calendar',
    icon: '▦',
    permission: Permission.APPOINTMENT_READ,
    status: 'ready',
  },
  {
    key: 'patients',
    label: 'shell.nav.patients',
    icon: '☰',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'queue',
    label: 'shell.nav.queue',
    icon: '⇶',
    permission: Permission.APPOINTMENT_READ,
    status: 'ready',
  },
  {
    key: 'communications',
    label: 'shell.nav.communications',
    icon: '✉',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'billing',
    label: 'shell.nav.billing',
    icon: '৳',
    permission: Permission.BILLING_READ,
    status: 'ready',
  },
  {
    key: 'reports',
    label: 'shell.nav.reports',
    icon: '◔',
    permission: Permission.REPORTS_READ,
    status: 'ready',
  },
  {
    key: 'settings',
    label: 'shell.nav.settings',
    icon: '⚙',
    permission: Permission.SETTINGS_MANAGE,
    status: 'ready',
  },
  {
    key: 'documents',
    label: 'shell.nav.documents',
    icon: '⎘',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'integrations',
    label: 'shell.nav.integrations',
    icon: '⇄',
    permission: Permission.SETTINGS_MANAGE,
    status: 'pending',
  },
  {
    key: 'admin',
    label: 'shell.nav.admin',
    icon: '★',
    superAdminOnly: true,
    status: 'ready',
  },
  {
    key: 'ambulances',
    label: 'shell.nav.ambulances',
    icon: '✚',
    ownerRole: OwnerRole.AMBULANCE_OWNER,
    status: 'ready',
  },
  {
    key: 'pharmacy',
    label: 'shell.nav.pharmacy',
    icon: '℞',
    ownerRole: OwnerRole.PHARMACY_OWNER,
    status: 'ready',
  },
  {
    key: 'hospital',
    label: 'shell.nav.hospital',
    icon: '✙',
    ownerRole: OwnerRole.HOSPITAL_OWNER,
    status: 'ready',
  },
  {
    // No permission: every account holder administers their own profile.
    key: 'profile',
    label: 'shell.nav.profile',
    icon: '◍',
    status: 'ready',
    group: 'network',
  },
  {
    key: 'feedback',
    label: 'shell.nav.feedback',
    icon: '☆',
    permission: Permission.PATIENT_READ,
    status: 'ready',
    group: 'network',
  },
  {
    key: 'community',
    label: 'shell.nav.community',
    icon: '❖',
    status: 'pending',
    group: 'network',
    hint: 'shell.nav.communityHint',
  },
  {
    key: 'prime',
    label: 'shell.nav.prime',
    icon: '✦',
    permission: Permission.SETTINGS_MANAGE,
    status: 'ready',
    group: 'network',
  },
];

export function visibleNavItems(
  granted: readonly Permission[],
  ownerRoles: readonly OwnerRole[] = [],
  isSuperAdmin = false,
): NavItem[] {
  const set = new Set(granted);
  const hasClinic = set.has(Permission.CLINIC_ACCESS);
  return NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.ownerRole) return ownerRoles.includes(item.ownerRole);
    // An owner with no clinic sees only their businesses and their own profile.
    if (!hasClinic) return item.key === 'profile';
    return !item.permission || set.has(item.permission);
  });
}
