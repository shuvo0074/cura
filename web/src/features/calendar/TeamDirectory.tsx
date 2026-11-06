import { useCallback, useState } from 'react';
import { UserRole, initials } from '@cura/shared';
import { useDismiss } from './calendar-shared';
import type { StaffMember } from './use-calendar-settings';
import { useT, type TranslationKey } from '../../i18n';
import styles from './panes.module.css';

/** Doctors are anyone with the clinical role or a BMDC registration. */
const isDoctor = (m: StaffMember) => m.role === UserRole.DOCTOR || !!m.bmdcNumber;

const ROLE_LABELS: Record<string, TranslationKey> = {
  [UserRole.ADMINISTRATOR]: 'calendar.role.ADMINISTRATOR',
  [UserRole.DESK_STAFF]: 'calendar.role.DESK_STAFF',
  [UserRole.DOCTOR]: 'calendar.role.DOCTOR',
};

/**
 * Team directory (spec: Left Part, lower segment).
 *
 * The first doctor on the roster is shown as the lead consultant with the
 * practice's specialization, the rest as assistants, then the support team.
 * A name opens a quick-contact card with mobile and email.
 */
export function TeamDirectory({
  staff,
  specialization,
}: {
  staff: readonly StaffMember[];
  specialization: string | null;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const ref = useDismiss(open !== null, close);

  const doctors = staff.filter(isDoctor);
  const [lead, ...assistants] = doctors;
  const support = staff.filter((m) => !isDoctor(m));

  const person = (m: StaffMember, detail?: string | null) => (
    <li key={m.userId} className={styles.person}>
      <button
        type="button"
        className={styles.personButton}
        onClick={() => setOpen((current) => (current === m.userId ? null : m.userId))}
        aria-expanded={open === m.userId}
      >
        <span className={styles.personAvatar} aria-hidden="true">
          {initials(m.fullName)}
        </span>
        <span className={styles.personText}>
          <span className={styles.personName}>{m.fullName}</span>
          <span className={styles.personRole}>{detail ?? (ROLE_LABELS[m.role] ? t(ROLE_LABELS[m.role]!) : m.role)}</span>
        </span>
      </button>
      {open === m.userId && (
        <div className={styles.contactCard} role="dialog" aria-label={t('calendar.contact', { name: m.fullName })}>
          <strong>{m.fullName}</strong>
          {m.mobile ? <a href={`tel:${m.mobile}`}>☎ {m.mobile}</a> : <span>☎ {t('calendar.notAvailable')}</span>}
          {m.email ? <a href={`mailto:${m.email}`}>✉ {m.email}</a> : <span>✉ {t('calendar.notAvailable')}</span>}
        </div>
      )}
    </li>
  );

  return (
    <div className={styles.team} ref={ref}>
      {lead && (
        <section>
          <h3 className={styles.groupTitle}>{t('calendar.leadDoctor')}</h3>
          <ul className={styles.people}>{person(lead, specialization ?? t('calendar.leadConsultant'))}</ul>
        </section>
      )}
      {assistants.length > 0 && (
        <section>
          <h3 className={styles.groupTitle}>{t('calendar.assistantDoctors')}</h3>
          <ul className={styles.people}>{assistants.map((m) => person(m, t('calendar.assistantDoctor')))}</ul>
        </section>
      )}
      {support.length > 0 && (
        <section>
          <h3 className={styles.groupTitle}>{t('calendar.staffAndDesk')}</h3>
          <ul className={styles.people}>{support.map((m) => person(m))}</ul>
        </section>
      )}
    </div>
  );
}
