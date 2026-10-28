import { useState } from 'react';
import { CommunicationsPanel } from '../settings/panels/CommunicationsPanel';
import { uiStyles as s } from '../../ui';
import { UpcomingOutreach } from './UpcomingOutreach';
import styles from './communications.module.css';

type Tab = 'upcoming' | 'channels';

/**
 * Communications (spec 2.2): who the practice should contact next, and — for
 * administrators — which automated SMS / email messages are switched on.
 *
 * The channel matrix is the same component Settings uses, mounted here so the
 * doctor reaches it from the module they are thinking in rather than having to
 * know it lives under Settings.
 */
export function CommunicationsView({
  practiceId,
  canManage,
  onOpenPatient,
}: {
  practiceId: string;
  canManage: boolean;
  onOpenPatient: (patientId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('upcoming');

  return (
    <div className={styles.shell}>
      <header>
        <h1 className={s.title}>Communications</h1>
        <p className={s.hint}>Upcoming follow-ups and birthday wishes, and the messages Cura sends for you.</p>
      </header>

      {canManage && (
        <div className={s.filters} role="tablist" aria-label="Communications section">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            data-active={tab === 'upcoming' || undefined}
            onClick={() => setTab('upcoming')}
          >
            Upcoming follow-ups &amp; wishes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'channels'}
            data-active={tab === 'channels' || undefined}
            onClick={() => setTab('channels')}
          >
            SMS &amp; email settings
          </button>
        </div>
      )}

      {tab === 'upcoming' || !canManage ? (
        <UpcomingOutreach practiceId={practiceId} onOpenPatient={onOpenPatient} />
      ) : (
        <div className={styles.embedded}>
          <CommunicationsPanel practiceId={practiceId} />
        </div>
      )}
    </div>
  );
}
