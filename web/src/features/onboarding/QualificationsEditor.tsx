import type { OnboardingViewModel } from '@cura/shared';
import styles from './onboarding.module.css';

/** Repeater for degrees and awards (spec: "Add More" dynamic rows). */
export function QualificationsEditor({
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
            onChange={(e) =>
              update(index, 'passingYear', e.target.value === '' ? undefined : Number(e.target.value))
            }
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
