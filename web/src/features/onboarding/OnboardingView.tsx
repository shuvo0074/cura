import { useCallback, useEffect, useMemo } from 'react';
import { BloodGroup, Gender, OnboardingViewModel, useViewModel } from '@cura/shared';
import { useServices } from '../../app/services';
import { QualificationsEditor } from './QualificationsEditor';
import { OnboardingField as Field } from './OnboardingField';
import { useT } from '../../i18n';
import styles from './onboarding.module.css';

const STEP_TITLES = ['onboarding.step.1', 'onboarding.step.2', 'onboarding.step.3', 'onboarding.step.4'] as const;

/**
 * Account-creation wizard (View).
 *
 * The stepper renders from `completedSteps`, so the validation gate the server
 * enforces is visible in the UI rather than only surfacing as an error after a
 * failed submit.
 */
export function OnboardingView({ onFinished }: { onFinished: () => void }) {
  const { onboarding } = useServices();
  const { t, tm, fmt } = useT();
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
    if (state.saving) return t('common.saving');
    if (!state.lastSavedAt) return null;
    return t('onboarding.savedAt', { time: fmt.time(state.lastSavedAt) });
  }, [state.saving, state.lastSavedAt, t, fmt]);

  if (state.loading) {
    return <div className={styles.splash}>{t('onboarding.loading')}</div>;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('onboarding.title')}</h1>
          <p className={styles.subtitle}>
            {t('onboarding.stepOf', {
              step: state.step,
              total: vm.totalSteps,
              title: t(STEP_TITLES[state.step - 1] ?? STEP_TITLES[0]),
            })}
          </p>
          {savedLabel && <span className={styles.saved}>{savedLabel}</span>}
        </header>

        <ol className={styles.stepper}>
          {STEP_TITLES.map((key, index) => {
            const label = t(key);
            const step = index + 1;
            const done = state.completedSteps.includes(step);
            return (
              <li key={key}>
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
              <Field label={t('onboarding.fullName')} error={tm(state.fieldErrors.fullName)}>
                <input className={styles.input} value={value('fullName')} onChange={set('fullName')} />
              </Field>
              <Field label={t('onboarding.mobile')} error={tm(state.fieldErrors.mobile)}>
                <input className={styles.input} value={value('mobile')} onChange={set('mobile')} inputMode="tel" />
              </Field>
              <Field label={t('onboarding.email')} error={tm(state.fieldErrors.email)}>
                <input className={styles.input} value={value('email')} onChange={set('email')} inputMode="email" />
              </Field>
              <Field label={t('onboarding.gender')} error={tm(state.fieldErrors.gender)}>
                <select className={styles.input} value={value('gender')} onChange={set('gender')}>
                  <option value="">{t('onboarding.select')}</option>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>
                      {t(`common.gender.${g}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('onboarding.dateOfBirth')} error={tm(state.fieldErrors.dateOfBirth)}>
                <input className={styles.input} type="date" value={value('dateOfBirth')} onChange={set('dateOfBirth')} />
              </Field>
              <Field label={t('onboarding.nid')} error={tm(state.fieldErrors.nid)}>
                <input className={styles.input} value={value('nid')} onChange={set('nid')} inputMode="numeric" />
              </Field>
              <Field label={t('onboarding.bloodGroup')} error={tm(state.fieldErrors.bloodGroup)}>
                <select className={styles.input} value={value('bloodGroup')} onChange={set('bloodGroup')}>
                  <option value="">{t('onboarding.select')}</option>
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
              <Field label={t('onboarding.bmdc')} error={tm(state.fieldErrors.bmdcNumber)}>
                <input className={styles.input} value={value('bmdcNumber')} onChange={set('bmdcNumber')} />
              </Field>
              <Field label={t('onboarding.specialization')} error={tm(state.fieldErrors.specializations)}>
                <input
                  className={styles.input}
                  placeholder={t('onboarding.specializationPlaceholder')}
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
              <Field label={t('onboarding.experience')} error={tm(state.fieldErrors.yearsOfExperience)}>
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
              <Field label={t('onboarding.workplace')} error={tm(state.fieldErrors.workplace)}>
                <input className={styles.input} value={value('workplace')} onChange={set('workplace')} />
              </Field>
            </>
          )}

          {state.step === 3 && <QualificationsEditor vm={vm} state={state} />}

          {state.step === 4 && (
            <p className={styles.hint}>
              {t('onboarding.documentsHint')}
            </p>
          )}
        </section>

        {state.formError && (
          <p className={styles.formError} role="alert">
            {tm(state.formError)}
          </p>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={() => vm.back()} disabled={state.step === 1}>
            {t('onboarding.previous')}
          </button>
          <span className={styles.spacer} />
          {vm.canSkip(state.step) && (
            <button type="button" className={styles.ghost} onClick={() => void vm.skipCurrentStep()} disabled={state.submitting}>
              {t('onboarding.skip')}
            </button>
          )}
          {state.step < vm.totalSteps ? (
            <button type="button" className={styles.primary} onClick={() => void vm.submitCurrentStep()} disabled={state.submitting}>
              {state.submitting ? t('common.saving') : t('onboarding.saveContinue')}
            </button>
          ) : (
            <button type="button" className={styles.primary} onClick={() => void vm.finish()} disabled={state.submitting}>
              {state.submitting ? t('onboarding.finishing') : t('onboarding.finish')}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
