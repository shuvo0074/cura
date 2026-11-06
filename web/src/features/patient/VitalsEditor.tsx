import type { PatientDashboardViewModel, VitalsDraft } from '@cura/shared';
import { useT, type TranslationKey } from '../../i18n';
import styles from './patient.module.css';

const FIELDS: ReadonlyArray<{
  key: keyof VitalsDraft;
  label: TranslationKey;
  /** A unit read the same in both languages, or a key for one that is translated. */
  unit: string | { key: TranslationKey };
  placeholder?: string;
}> = [
  { key: 'weightKg', label: 'patients.vitals.weight', unit: 'kg' },
  { key: 'systolic', label: 'patients.vitals.systolic', unit: 'mmHg', placeholder: '120' },
  { key: 'diastolic', label: 'patients.vitals.diastolic', unit: 'mmHg', placeholder: '80' },
  { key: 'pulseBpm', label: 'patients.vitals.pulse', unit: { key: 'patients.vitals.beatsPerMin' } },
  { key: 'temperatureC', label: 'patients.vitals.temperature', unit: '°C' },
  { key: 'respiratoryRate', label: 'patients.vitals.respiratoryRate', unit: { key: 'patients.vitals.breathsPerMin' } },
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
  const { t, tm } = useT();
  return (
    <section className={styles.card} aria-label={t('patients.vitals.title')}>
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>{t('patients.vitals.title')}</h3>
        {!disabled && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void vm.saveVitals()}
            disabled={saving}
          >
            {saving ? t('common.saving') : t('patients.vitals.save')}
          </button>
        )}
      </div>

      <div className={styles.vitalsGrid}>
        {FIELDS.map((field) => (
          <label key={field.key} className={styles.vital}>
            <span className={styles.label}>
              {t(field.label)}{' '}
              <span className={styles.unit}>({typeof field.unit === 'string' ? field.unit : t(field.unit.key)})</span>
            </span>
            <input
              className={styles.input}
              inputMode="decimal"
              disabled={disabled}
              value={vitals[field.key]}
              placeholder={field.placeholder ?? t('patients.vitals.placeholder')}
              onChange={(e) => vm.setVital(field.key, e.target.value)}
            />
            {fieldErrors[field.key] && (
              <span className={styles.error}>{tm(fieldErrors[field.key])}</span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
