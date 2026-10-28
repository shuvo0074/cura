import { uiStyles as s } from '../../ui';
import styles from './integrations.module.css';

interface Integration {
  key: string;
  name: string;
  summary: string;
  /** What switching it on would do inside Cura. */
  effect: string;
}

/**
 * Integrations (spec 2.2: Integration, Practo Integration).
 *
 * None of these connectors exists in the API yet, so every card says "Not
 * connected" and offers no switch — a toggle that silently does nothing would
 * be worse than an honest catalogue of what is planned.
 */
const INTEGRATIONS: readonly Integration[] = [
  {
    key: 'practo',
    name: 'Practo',
    summary: 'Sync appointments booked through your Practo profile into the Cura calendar.',
    effect: 'Online bookings appear in the calendar as they are made; cancellations flow back.',
  },
  {
    key: 'sms',
    name: 'SMS gateway',
    summary: 'Send confirmations, reminders and wishes from your own masked sender ID.',
    effect: 'Replaces the development console driver used today.',
  },
  {
    key: 'payments',
    name: 'Mobile payments (bKash / Nagad)',
    summary: 'Collect consultation fees online and reconcile them against invoices.',
    effect: 'Payments are recorded on the invoice automatically.',
  },
  {
    key: 'calendar',
    name: 'Google Calendar',
    summary: 'Mirror your sessions and blocked time to a personal calendar.',
    effect: 'One-way export; Cura stays the source of truth.',
  },
  {
    key: 'lab',
    name: 'Diagnostic labs',
    summary: 'Receive lab reports straight into the patient’s files.',
    effect: 'Reports land in Documents under “Lab report”.',
  },
];

export function IntegrationsView() {
  return (
    <div className={styles.shell}>
      <header>
        <h1 className={s.title}>Integrations</h1>
        <p className={s.hint}>
          Connections to outside services. These are not available in this build yet — contact Cura support to be
          notified when one goes live.
        </p>
      </header>

      <ul className={styles.grid}>
        {INTEGRATIONS.map((i) => (
          <li key={i.key} className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.logo} aria-hidden="true">
                {i.name.charAt(0)}
              </span>
              <h2 className={styles.name}>{i.name}</h2>
              <span className={styles.status}>Not connected</span>
            </header>
            <p className={styles.summary}>{i.summary}</p>
            <p className={s.muted}>{i.effect}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
