import type { PatientDashboardState, PatientDashboardViewModel } from '@cura/shared';
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
  return (
    <section className={styles.card} aria-label="Prescription">
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>Prescription</h3>
      </div>

      <div className={styles.grid} role="table">
        <div className={styles.gridHead} role="row">
          <span>Drug</span>
          <span>Strength</span>
          <span>Duration</span>
          <span>M / N / E</span>
          <span>Meal</span>
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
        <span className={styles.label}>Investigations</span>
        <input
          className={styles.input}
          disabled={disabled}
          value={state.investigations.join(', ')}
          placeholder="CBC, CRP…"
          onChange={(e) =>
            vm.setInvestigations(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
          }
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Follow-up date</span>
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
          {message}
        </p>
      ))}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
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
            Save draft
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={state.saving}
            onClick={() => void vm.signEncounter()}
          >
            Sign &amp; complete visit
          </button>
        </div>
      )}
    </section>
  );
}
