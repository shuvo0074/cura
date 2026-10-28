import type { PatientDashboardViewModel, VitalsDraft } from '@cura/shared';
import styles from './patient.module.css';

const FIELDS: ReadonlyArray<{
  key: keyof VitalsDraft;
  label: string;
  unit: string;
  placeholder?: string;
}> = [
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'systolic', label: 'BP systolic', unit: 'mmHg', placeholder: '120' },
  { key: 'diastolic', label: 'BP diastolic', unit: 'mmHg', placeholder: '80' },
  { key: 'pulseBpm', label: 'Pulse', unit: 'beats/min' },
  { key: 'temperatureC', label: 'Temperature', unit: '°C' },
  { key: 'respiratoryRate', label: 'Resp. rate', unit: 'breaths/min' },
];

/**
 * Vital signs for the open encounter.
 *
 * Readings stay as text until save: coercing on every keystroke turns a
 * half-typed "12" into 12, and blanking a field would otherwise read as 0 —
 * which is a clinical statement, not "not measured".
 */
export function VitalsEditor({
  vm,
  vitals,
  disabled,
  saving,
  fieldErrors,
}: {
  vm: PatientDashboardViewModel;
  vitals: VitalsDraft;
  disabled: boolean;
  saving: boolean;
  fieldErrors: Record<string, string>;
}) {
  return (
    <section className={styles.card} aria-label="Vital signs">
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>Vital signs</h3>
        {!disabled && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void vm.saveVitals()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save vitals'}
          </button>
        )}
      </div>

      <div className={styles.vitalsGrid}>
        {FIELDS.map((field) => (
          <label key={field.key} className={styles.vital}>
            <span className={styles.label}>
              {field.label} <span className={styles.unit}>({field.unit})</span>
            </span>
            <input
              className={styles.input}
              inputMode="decimal"
              disabled={disabled}
              value={vitals[field.key]}
              placeholder={field.placeholder ?? 'Enter reading'}
              onChange={(e) => vm.setVital(field.key, e.target.value)}
            />
            {fieldErrors[field.key] && (
              <span className={styles.error}>{fieldErrors[field.key]}</span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
