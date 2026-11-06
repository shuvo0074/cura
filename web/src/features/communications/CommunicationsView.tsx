import { useState } from 'react';
import { CommunicationsPanel } from '../settings/panels/CommunicationsPanel';
import { uiStyles as s } from '../../ui';
import { useT } from '../../i18n';
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
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('upcoming');

  return (
    <div className={styles.shell}>
      <header>
        <h1 className={s.title}>{t('patients.comms.title')}</h1>
        <p className={s.hint}>{t('patients.comms.hint')}</p>
      </header>

      {canManage && (
        <div className={s.filters} role="tablist" aria-label={t('patients.comms.section')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            data-active={tab === 'upcoming' || undefined}
            onClick={() => setTab('upcoming')}
          >
            {t('patients.comms.tabUpcoming')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'channels'}
            data-active={tab === 'channels' || undefined}
            onClick={() => setTab('channels')}
          >
            {t('patients.comms.tabChannels')}
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
