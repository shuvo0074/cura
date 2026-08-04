import { Permission } from '@cura/shared';

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
  | 'settings'
  | 'reports'
  | 'billing'
  | 'documents'
  | 'communication'
  | 'profile';

export interface NavItem {
  key: RouteKey;
  label: string;
  icon: string;
  permission?: Permission;
  status: 'ready' | 'partial' | 'pending';
  hint?: string;
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
    key: 'billing',
    label: 'Billing',
    icon: '৳',
    permission: Permission.BILLING_READ,
    status: 'partial',
    hint: 'Invoices are listed per patient from the patient record.',
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
    status: 'partial',
    hint: 'Upload and download work through the API; the browser UI is not built.',
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: '✉',
    permission: Permission.SETTINGS_MANAGE,
    status: 'partial',
    hint: 'The SMS/email toggle matrix lives under Settings → Communications.',
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: '◍',
    status: 'pending',
    hint: 'Edit qualifications and chamber details — not built yet.',
  },
];

export function visibleNavItems(granted: readonly Permission[]): NavItem[] {
  const set = new Set(granted);
  return NAV_ITEMS.filter((item) => !item.permission || set.has(item.permission));
}
