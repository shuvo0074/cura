import { useEffect, useState } from 'react';
import { useResource, uiStyles as s } from '../../ui';
import type { SettingsKey } from '../settings/settings-nav';
import { readSetupMemory, writeSetupMemory } from './setup-storage';
import { useT } from '../../i18n';
import styles from './setup.module.css';

type StepKey = 'details' | 'hours' | 'doctor' | 'pricing' | 'deskStaff' | 'firstPatient';

interface SetupProgress {
  steps: Array<{ key: StepKey; done: boolean; optional: boolean }>;
  done: number;
  total: number;
  complete: boolean;
}

type Action = { settings: SettingsKey } | 'addPatient';

/** Each step's words are `setup.<key>.label`, `.hint` and `.button` in i18n/areas/setup.ts. */
const STEPS: Record<StepKey, { action: Action }> = {
  details: { action: { settings: 'practice' } },
  hours: { action: { settings: 'practice' } },
  doctor: { action: { settings: 'staff' } },
  pricing: { action: { settings: 'pricing' } },
  deskStaff: { action: { settings: 'staff' } },
  firstPatient: { action: 'addPatient' },
};

/**
 * "Get your clinic ready": a clinic owner's first-time checklist on the
 * Calendar. Each tick comes from the clinic's records, so it stays honest
 * however the step was done. Shown until every required step is done; then
 * "Your clinic is ready" once, and nothing after.
 */
export function SetupChecklist({
  practiceId,
  onOpenSettings,
  onAddPatient,
}: {
  practiceId: string;
  onOpenSettings: (section: SettingsKey) => void;
  onAddPatient?: (() => void) | undefined;
}) {
  const { t } = useT();
  const { data } = useResource<SetupProgress>('/settings/setup-progress', { practiceId });
  // Read once: marking the ready message as shown must not hide it straight away.
  const [memory] = useState(() => readSetupMemory(practiceId));
  const [closed, setClosed] = useState(memory.hidden);

  const celebrate = Boolean(data?.complete && memory.seenIncomplete && !memory.celebrated);

  useEffect(() => {
    if (!data || closed) return;
    if (!data.complete) writeSetupMemory(practiceId, { seenIncomplete: true, celebrated: false });
    else if (celebrate) writeSetupMemory(practiceId, { celebrated: true });
  }, [data, closed, celebrate, practiceId]);

  if (!data || closed || (data.complete && !celebrate)) return null;

  const hide = () => {
    writeSetupMemory(practiceId, { hidden: true });
    setClosed(true);
  };

  if (data.complete) {
    return (
      <section className={styles.card} data-ready aria-label={t('setup.ready')}>
        <span className={styles.readyMark} aria-hidden="true">✓</span>
        <div className={styles.readyText}>
          <h2 className={styles.title}>{t('setup.ready')}</h2>
          <p className={styles.lead}>{t('setup.readyLead')}</p>
        </div>
        <button type="button" className={s.secondary} onClick={() => setClosed(true)}>
          {t('setup.close')}
        </button>
      </section>
    );
  }

  const percent = Math.round((data.done / data.total) * 100);

  return (
    <section className={styles.card} aria-labelledby="setup-title">
      <header className={styles.head}>
        <div>
          <h2 id="setup-title" className={styles.title}>{t('setup.title')}</h2>
          <p className={styles.lead}>{t('setup.lead')}</p>
        </div>
        <div className={styles.progress}>
          <span className={styles.count}>
            {t('setup.progress', { done: data.done, total: data.total })}
          </span>
          <span
            className={styles.bar}
            role="progressbar"
            aria-label={t('setup.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={data.total}
            aria-valuenow={data.done}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        <button type="button" className={s.linkButton} onClick={hide}>
          {t('setup.hide')}
        </button>
      </header>

      <ol className={styles.steps}>
        {data.steps.map((step) => {
          const meta = STEPS[step.key];
          if (!meta) return null;
          const action = meta.action;
          const open =
            action === 'addPatient' ? onAddPatient : () => onOpenSettings(action.settings);
          return (
            <li key={step.key} className={styles.step} data-done={step.done || undefined}>
              <span className={styles.mark} aria-hidden="true">
                {step.done ? '✓' : ''}
              </span>
              <span className={styles.stepText}>
                <strong>
                  {t(`setup.${step.key}.label`)}
                  {step.optional && <span className={styles.optional}>{t('setup.optional')}</span>}
                </strong>
                <span>{t(`setup.${step.key}.hint`)}</span>
              </span>
              {step.done ? (
                <span className={styles.doneLabel}>{t('setup.done')}</span>
              ) : (
                open && (
                  <button type="button" className={styles.action} onClick={open}>
                    {t(`setup.${step.key}.button`)}
                  </button>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
