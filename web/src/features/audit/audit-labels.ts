import type { TranslationKey, UseT } from '../../i18n';
import { settings } from '../../i18n/areas/settings';

/** One activity log row as Cura API returns it. */
export interface AuditItem {
  id: string;
  at: string;
  action: string;
  actor: { id: string; fullName: string; email: string | null; clinicRole: string | null; roles: string[] } | null;
  subject: { type: string; id: string | null; name: string | null };
  clinic: { id: string; name: string | null } | null;
  network: string | null;
  userAgent: string | null;
  requestId: string | null;
  details: unknown;
}

type T = UseT['t'];

const known = (key: string): key is keyof typeof settings.en & string => key in settings.en;

/** An action code in plain words; a code nobody has named yet is shown as it is. */
export function actionLabel(t: T, code: string): string {
  const key = `activity.a.${code}`;
  return known(key) ? t(`settings.${key}` as TranslationKey) : code;
}

function subjectType(t: T, type: string): string {
  const key = `activity.s.${type}`;
  return known(key) ? t(`settings.${key}` as TranslationKey) : type;
}

/** What a row was about: a name when Cura API found one, otherwise the kind and a short id. */
export function subjectLabel(t: T, item: AuditItem): string {
  const type = subjectType(t, item.subject.type);
  const path = item.details && typeof item.details === 'object' ? (item.details as { path?: unknown }).path : undefined;
  if (item.subject.name) return `${type}: ${item.subject.name}`;
  if (typeof path === 'string') return `${type}: ${path.replace(/^\/api/, '')}`;
  if (item.subject.id) return `${type} · ${item.subject.id.slice(0, 8)}`;
  return type;
}

/** The role that best explains the person's access: super admin first, then their clinic role. */
export function actorRoleLabel(t: T, actor: NonNullable<AuditItem['actor']>): string {
  const role = actor.roles.includes('super_admin')
    ? 'super_admin'
    : (actor.clinicRole ?? ['ambulance_owner', 'pharmacy_owner', 'hospital_owner', 'doctor', 'patient'].find((r) => actor.roles.includes(r)));
  if (!role) return '';
  const key = `activity.role.${role}`;
  return known(key) ? t(`settings.${key}` as TranslationKey) : role;
}

/** A spreadsheet cell: quoted, and never read as a formula. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(items: AuditItem[], t: T, withClinic: boolean): string {
  const header = [
    t('settings.activity.col.time'),
    t('settings.activity.csv.name'),
    t('settings.activity.csv.email'),
    t('settings.activity.csv.role'),
    t('settings.activity.col.action'),
    t('settings.activity.code'),
    t('settings.activity.col.about'),
    t('settings.activity.subjectId'),
    ...(withClinic ? [t('settings.activity.col.clinic')] : []),
    t('settings.activity.details'),
  ];
  const rows = items.map((item) => [
    item.at,
    item.actor?.fullName ?? '',
    item.actor?.email ?? '',
    item.actor ? actorRoleLabel(t, item.actor) : '',
    actionLabel(t, item.action),
    item.action,
    subjectLabel(t, item),
    item.subject.id ?? '',
    ...(withClinic ? [item.clinic?.name ?? ''] : []),
    item.details === null ? '' : JSON.stringify(item.details),
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
