import type { PatientDashboardState, PatientDashboardViewModel } from '@cura/shared';
import { useT } from '../../i18n';
import { PrescriptionRowEditor } from './PrescriptionRowEditor';
import styles from './patient.module.css';

/**
 * The prescription grid.
 *
 * A blank trailing row is always present, which is the spec's "smart grid" —
 * the doctor never has to click "add row".
 */
export function PrescriptionEditor({
  vm,
  state,
  disabled,
}: {
  vm: PatientDashboardViewModel;
  state: PatientDashboardState;
  disabled: boolean;
}) {
  const { t, tm } = useT();
  return (
    <section className={styles.card} aria-label={t('patients.rx.title')}>
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>{t('patients.rx.title')}</h3>
      </div>

      <div className={styles.grid} role="table">
        <div className={styles.gridHead} role="row">
          <span>{t('patients.rx.drug')}</span>
          <span>{t('patients.rx.strength')}</span>
          <span>{t('patients.rx.duration')}</span>
          <span>{t('patients.rx.dose')}</span>
          <span>{t('patients.rx.meal')}</span>
          <span />
        </div>

        {state.rows.map((row, index) => (
          <PrescriptionRowEditor
            key={row.key}
            row={row}
            index={index}
            disabled={disabled}
            suggestionsOpen={state.suggestionRow === index}
            suggestions={state.drugSuggestions}
            onField={(field, value) => vm.setRowField(index, field, value)}
            onPick={(s) => vm.applyDrugSuggestion(index, s)}
            onRemove={() => vm.removeRow(index)}
          />
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t('patients.rx.investigations')}</span>
        <input
          className={styles.input}
          disabled={disabled}
          value={state.investigations.join(', ')}
          placeholder={t('patients.rx.investigationsPlaceholder')}
          onChange={(e) =>
            vm.setInvestigations(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
          }
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('patients.rx.followUp')}</span>
        <input
          className={styles.input}
          type="date"
          disabled={disabled}
          value={state.followUpDate ?? ''}
          onChange={(e) => vm.setFollowUpDate(e.target.value || null)}
        />
      </label>

      {Object.entries(state.fieldErrors).map(([key, message]) => (
        <p className={styles.error} key={key} role="alert">
          {tm(message)}
        </p>
      ))}
      {state.error && (
        <p className={styles.error} role="alert">
          {tm(state.error)}
        </p>
      )}

      {!disabled && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghost}
            disabled={state.saving}
            onClick={() => void vm.savePrescription()}
          >
            {t('patients.rx.saveDraft')}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={state.saving}
            onClick={() => void vm.signEncounter()}
          >
            {t('patients.rx.sign')}
          </button>
        </div>
      )}
    </section>
  );
}
