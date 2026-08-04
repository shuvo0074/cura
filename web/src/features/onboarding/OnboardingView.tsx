import { useCallback, useEffect, useMemo } from 'react';
import { BloodGroup, Gender, OnboardingViewModel, useViewModel } from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './onboarding.module.css';

const STEP_TITLES = [
  'Personal details',
  'Professional details',
  'Academic information',
  'Identification & documents',
] as const;

/**
 * Account-creation wizard (View).
 *
 * The stepper renders from `completedSteps`, so the validation gate the server
 * enforces is visible in the UI rather than only surfacing as an error after a
 * failed submit.
 */
export function OnboardingView({ onFinished }: { onFinished: () => void }) {
  const { onboarding } = useServices();
  const [state, vm] = useViewModel(() => new OnboardingViewModel(onboarding, onFinished));

  useEffect(() => {
    void vm.initialise();
  }, [vm]);

  const set = useCallback(
    (name: string) => (event: { target: { value: string } }) =>
      vm.setField(state.step, name, event.target.value),
    [vm, state.step],
  );

  const value = useCallback(
    (name: string) => (vm.field(state.step, name) as string | undefined) ?? '',
    [vm, state.step],
  );

  const savedLabel = useMemo(() => {
    if (state.saving) return 'Saving…';
    if (!state.lastSavedAt) return null;
    return `Saved ${new Date(state.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [state.saving, state.lastSavedAt]);

  if (state.loading) {
    return <div className={styles.splash}>Loading your setup…</div>;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Complete your account</h1>
          <p className={styles.subtitle}>
            Step {state.step} of {vm.totalSteps} — {STEP_TITLES[state.step - 1]}
          </p>
          {savedLabel && <span className={styles.saved}>{savedLabel}</span>}
        </header>

        <ol className={styles.stepper}>
          {STEP_TITLES.map((label, index) => {
            const step = index + 1;
            const done = state.completedSteps.includes(step);
            return (
              <li key={label}>
                <button
                  type="button"
                  className={styles.stepDot}
                  data-active={state.step === step || undefined}
                  data-done={done || undefined}
                  data-locked={!vm.canEnter(step) || undefined}
                  onClick={() => vm.goToStep(step)}
                  aria-current={state.step === step ? 'step' : undefined}
                >
                  <span className={styles.stepNumber}>{done ? '✓' : step}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <section className={styles.body}>
          {state.step === 1 && (
            <>
              <Field label="Full name" error={state.fieldErrors.fullName}>
                <input className={styles.input} value={value('fullName')} onChange={set('fullName')} />
              </Field>
              <Field label="Mobile number *" error={state.fieldErrors.mobile}>
                <input className={styles.input} value={value('mobile')} onChange={set('mobile')} inputMode="tel" />
              </Field>
              <Field label="Email *" error={state.fieldErrors.email}>
                <input className={styles.input} value={value('email')} onChange={set('email')} inputMode="email" />
              </Field>
              <Field label="Gender *" error={state.fieldErrors.gender}>
                <select className={styles.input} value={value('gender')} onChange={set('gender')}>
                  <option value="">Select…</option>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date of birth" error={state.fieldErrors.dateOfBirth}>
                <input className={styles.input} type="date" value={value('dateOfBirth')} onChange={set('dateOfBirth')} />
              </Field>
              <Field label="NID / birth registration" error={state.fieldErrors.nid}>
                <input className={styles.input} value={value('nid')} onChange={set('nid')} inputMode="numeric" />
              </Field>
              <Field label="Blood group" error={state.fieldErrors.bloodGroup}>
                <select className={styles.input} value={value('bloodGroup')} onChange={set('bloodGroup')}>
                  <option value="">Select…</option>
                  {Object.values(BloodGroup).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {state.step === 2 && (
            <>
              <Field label="BMDC number *" error={state.fieldErrors.bmdcNumber}>
                <input className={styles.input} value={value('bmdcNumber')} onChange={set('bmdcNumber')} />
              </Field>
              <Field label="Specialization *" error={state.fieldErrors.specializations}>
                <input
                  className={styles.input}
                  placeholder="Cardiology, Cardiovascular Surgery…"
                  value={((vm.field(2, 'specializations') as string[] | undefined) ?? []).join(', ')}
                  onChange={(e) =>
                    vm.setField(
                      2,
                      'specializations',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    )
                  }
                />
              </Field>
              <Field label="Years of experience" error={state.fieldErrors.yearsOfExperience}>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={(vm.field(2, 'yearsOfExperience') as number | undefined) ?? ''}
                  onChange={(e) =>
                    vm.setField(2, 'yearsOfExperience', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Workplace" error={state.fieldErrors.workplace}>
                <input className={styles.input} value={value('workplace')} onChange={set('workplace')} />
              </Field>
            </>
          )}

          {state.step === 3 && <QualificationsEditor vm={vm} state={state} />}

          {state.step === 4 && (
            <p className={styles.hint}>
              Upload your NID, medical certificates and digital signature from the Documents
              section after finishing. You can complete this later.
            </p>
          )}
        </section>

        {state.formError && (
          <p className={styles.formError} role="alert">
            {state.formError}
          </p>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={() => vm.back()} disabled={state.step === 1}>
            Previous
          </button>
          <span className={styles.spacer} />
          {vm.canSkip(state.step) && (
            <button type="button" className={styles.ghost} onClick={() => void vm.skipCurrentStep()} disabled={state.submitting}>
              Skip
            </button>
          )}
          {state.step < vm.totalSteps ? (
            <button type="button" className={styles.primary} onClick={() => void vm.submitCurrentStep()} disabled={state.submitting}>
              {state.submitting ? 'Saving…' : 'Save & continue'}
            </button>
          ) : (
            <button type="button" className={styles.primary} onClick={() => void vm.finish()} disabled={state.submitting}>
              {state.submitting ? 'Finishing…' : 'Finish'}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}

/** Repeater for degrees and awards (spec: "Add More" dynamic rows). */
function QualificationsEditor({
  vm,
  state,
}: {
  vm: OnboardingViewModel;
  state: { fieldErrors: Record<string, string> };
}) {
  const rows = (vm.field(3, 'qualifications') as Array<Record<string, unknown>> | undefined) ?? [];

  const update = (index: number, key: string, value: unknown) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    vm.setField(3, 'qualifications', next);
  };

  return (
    <>
      {rows.map((row, index) => (
        <div className={styles.repeaterRow} key={index}>
          <input
            className={styles.input}
            placeholder="Degree (MBBS, FCPS…)"
            value={(row.degreeName as string) ?? ''}
            onChange={(e) => update(index, 'degreeName', e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Institute"
            value={(row.instituteName as string) ?? ''}
            onChange={(e) => update(index, 'instituteName', e.target.value)}
          />
          <input
            className={styles.inputSmall}
            type="number"
            placeholder="Year"
            value={(row.passingYear as number | undefined) ?? ''}
            onChange={(e) => update(index, 'passingYear', e.target.value === '' ? undefined : Number(e.target.value))}
          />
          <button
            type="button"
            className={styles.ghost}
            onClick={() => vm.setField(3, 'qualifications', rows.filter((_, i) => i !== index))}
            aria-label="Remove qualification"
          >
            ×
          </button>
        </div>
      ))}

      {state.fieldErrors.qualifications && (
        <p className={styles.error}>{state.fieldErrors.qualifications}</p>
      )}

      <button
        type="button"
        className={styles.ghost}
        onClick={() => vm.setField(3, 'qualifications', [...rows, {}])}
      >
        + Add qualification
      </button>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}
