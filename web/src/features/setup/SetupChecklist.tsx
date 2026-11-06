import { useEffect, useState } from 'react';
import { useResource, uiStyles as s } from '../../ui';
import type { SettingsKey } from '../settings/settings-nav';
import { readSetupMemory, writeSetupMemory } from './setup-storage';
import styles from './setup.module.css';

type StepKey = 'details' | 'hours' | 'doctor' | 'pricing' | 'deskStaff' | 'firstPatient';

interface SetupProgress {
  steps: Array<{ key: StepKey; done: boolean; optional: boolean }>;
  done: number;
  total: number;
  complete: boolean;
}

type Action = { settings: SettingsKey } | 'addPatient';

const STEPS: Record<StepKey, { label: string; hint: string; button: string; action: Action }> = {
  details: { label: 'Clinic details', hint: 'Name, phone number and address', button: 'Add details', action: { settings: 'practice' } },
  hours: { label: 'Opening hours', hint: 'The days and times you see patients', button: 'Set hours', action: { settings: 'practice' } },
  doctor: { label: 'Add a doctor', hint: 'Who sees patients here', button: 'Add doctor', action: { settings: 'staff' } },
  pricing: { label: 'Set prices', hint: 'Consultation and other fees', button: 'Set prices', action: { settings: 'pricing' } },
  deskStaff: { label: 'Add front desk staff', hint: 'Someone to book and check in patients', button: 'Add staff', action: { settings: 'staff' } },
  firstPatient: { label: 'Book a first patient', hint: 'Add a patient and give them a time', button: 'Book patient', action: 'addPatient' },
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
      <section className={styles.card} data-ready aria-label="Your clinic is ready">
        <span className={styles.readyMark} aria-hidden="true">✓</span>
        <div className={styles.readyText}>
          <h2 className={styles.title}>Your clinic is ready</h2>
          <p className={styles.lead}>Everything is set up. Patients can now be booked and seen.</p>
        </div>
        <button type="button" className={s.secondary} onClick={() => setClosed(true)}>
          Close
        </button>
      </section>
    );
  }

  const percent = Math.round((data.done / data.total) * 100);

  return (
    <section className={styles.card} aria-labelledby="setup-title">
      <header className={styles.head}>
        <div>
          <h2 id="setup-title" className={styles.title}>Get your clinic ready</h2>
          <p className={styles.lead}>A few steps and you are ready to see patients.</p>
        </div>
        <div className={styles.progress}>
          <span className={styles.count}>
            {data.done} of {data.total} done
          </span>
          <span
            className={styles.bar}
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={data.total}
            aria-valuenow={data.done}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        <button type="button" className={s.linkButton} onClick={hide}>
          Hide for now
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
                  {meta.label}
                  {step.optional && <span className={styles.optional}>Optional</span>}
                </strong>
                <span>{meta.hint}</span>
              </span>
              {step.done ? (
                <span className={styles.doneLabel}>Done</span>
              ) : (
                open && (
                  <button type="button" className={styles.action} onClick={open}>
                    {meta.button}
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
