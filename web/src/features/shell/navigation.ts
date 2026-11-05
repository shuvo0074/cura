import { OwnerRole, Permission } from '@cura/shared';

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
  | 'community'
  | 'prime'
  | 'profile';

export interface NavItem {
  key: RouteKey;
  label: string;
  icon: string;
  permission?: Permission;
  /** Shown only to accounts that own this kind of business. */
  ownerRole?: OwnerRole;
  status: 'ready' | 'partial' | 'pending';
  hint?: string;
  /** Second sidebar block: the doctor's outward-facing presence and add-ons. */
  group?: 'network';
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'calendar',
    label: 'Calendar',
    icon: '▦',
    permission: Permission.APPOINTMENT_READ,
    status: 'ready',
  },
  {
    key: 'patients',
    label: 'Patients',
    icon: '☰',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'queue',
    label: 'Patient Management',
    icon: '⇶',
    permission: Permission.APPOINTMENT_READ,
    status: 'ready',
  },
  {
    key: 'communications',
    label: 'Communication',
    icon: '✉',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: '৳',
    permission: Permission.BILLING_READ,
    status: 'ready',
  },
  {
    key: 'reports',
    label: 'Statistics',
    icon: '◔',
    permission: Permission.REPORTS_READ,
    status: 'ready',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙',
    permission: Permission.SETTINGS_MANAGE,
    status: 'ready',
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: '⎘',
    permission: Permission.PATIENT_READ,
    status: 'ready',
  },
  {
    key: 'integrations',
    label: 'Integrations',
    icon: '⇄',
    permission: Permission.SETTINGS_MANAGE,
    status: 'pending',
  },
  {
    key: 'ambulances',
    label: 'My Ambulances',
    icon: '✚',
    ownerRole: OwnerRole.AMBULANCE_OWNER,
    status: 'ready',
  },
  {
    key: 'pharmacy',
    label: 'My Pharmacy',
    icon: '℞',
    ownerRole: OwnerRole.PHARMACY_OWNER,
    status: 'ready',
  },
  {
    // No permission: every account holder administers their own profile.
    key: 'profile',
    label: 'Profile',
    icon: '◍',
    status: 'ready',
    group: 'network',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    icon: '☆',
    permission: Permission.PATIENT_READ,
    status: 'ready',
    group: 'network',
  },
  {
    key: 'community',
    label: 'Community',
    icon: '❖',
    status: 'pending',
    group: 'network',
    hint: 'Professional forums, peer networking and medical news. This module has no backend yet — it is planned, not built.',
  },
  {
    key: 'prime',
    label: 'Prime Services',
    icon: '✦',
    permission: Permission.SETTINGS_MANAGE,
    status: 'ready',
    group: 'network',
  },
];

export function visibleNavItems(granted: readonly Permission[], ownerRoles: readonly OwnerRole[] = []): NavItem[] {
  const set = new Set(granted);
  const hasClinic = set.has(Permission.CLINIC_ACCESS);
  return NAV_ITEMS.filter((item) => {
    if (item.ownerRole) return ownerRoles.includes(item.ownerRole);
    // An owner with no clinic sees only their businesses and their own profile.
    if (!hasClinic) return item.key === 'profile';
    return !item.permission || set.has(item.permission);
  });
}
