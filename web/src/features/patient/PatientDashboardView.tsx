import { memo, useEffect, useState } from 'react';
import {
  PatientDashboardViewModel,
  useViewModel,
  type EncounterView,
  type PrescriptionRow,
} from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './patient.module.css';

/**
 * Patient dashboard (View).
 *
 * Left: the clinical timeline, including an explicit locked-history panel when
 * records fall outside the privacy window. Right: the prescription writer,
 * which becomes read-only the moment the encounter is signed.
 */
export function PatientDashboardView({
  practiceId,
  patientId,
  appointmentId,
  onClose,
}: {
  practiceId: string;
  patientId: string;
  appointmentId?: string | undefined;
  onClose: () => void;
}) {
  const { clinical, settings } = useServices();
  const [state, vm] = useViewModel(
    () => new PatientDashboardViewModel(clinical, settings, practiceId, patientId),
  );

  useEffect(() => {
    void vm.loadTimeline();
    void vm.loadComplaintSuggestions();
    if (appointmentId) void vm.openEncounter(appointmentId);
  }, [vm, appointmentId]);

  const signed = state.activeEncounter?.signedAt !== null && state.activeEncounter !== null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onClose}>
          ← Back to calendar
        </button>
        {state.saving && <span className={styles.busy}>Saving…</span>}
      </header>

      <div className={styles.columns}>
        {/* ---- Timeline ---------------------------------------------------- */}
        <section className={styles.timeline} aria-label="Clinical timeline">
          <h2 className={styles.sectionTitle}>Timeline</h2>

          {state.hasLockedHistory && (
            <ConsentPanel
              windowDays={state.privacyWindowDays}
              challengeOpen={state.consentChallengeId !== null}
              maskedTarget={state.consentMaskedTarget}
              onRequest={() => void vm.requestConsent()}
              onConfirm={(code) => void vm.confirmConsent(code)}
            />
          )}

          {state.loading && <p className={styles.muted}>Loading history…</p>}
          {!state.loading && state.entries.length === 0 && (
            <p className={styles.muted}>No visits recorded in the last {state.privacyWindowDays} days.</p>
          )}

          {state.entries.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </section>

        {/* ---- Prescription writer ----------------------------------------- */}
        <section className={styles.editor} aria-label="Prescription">
          <div className={styles.editorHead}>
            <h2 className={styles.sectionTitle}>Prescription</h2>
            {signed && <span className={styles.signedBadge}>Signed — read only</span>}
          </div>

          {!state.activeEncounter ? (
            <p className={styles.muted}>
              Open an appointment from the calendar to start writing.
            </p>
          ) : (
            <>
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
                    disabled={signed}
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
                  disabled={signed}
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
                  disabled={signed}
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

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={signed || state.saving}
                  onClick={() => void vm.savePrescription()}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={signed || state.saving}
                  onClick={() => void vm.signEncounter()}
                >
                  Sign &amp; complete visit
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const PrescriptionRowEditor = memo(function PrescriptionRowEditor({
  row,
  disabled,
  suggestionsOpen,
  suggestions,
  onField,
  onPick,
  onRemove,
}: {
  row: PrescriptionRow;
  index: number;
  disabled: boolean;
  suggestionsOpen: boolean;
  suggestions: Array<{ id: string; name: string; strength: string | null; form: string | null; instruction: string | null }>;
  /** `key` is a local render id, never a prescription field — excluded here. */
  onField: (field: Exclude<keyof PrescriptionRow, 'key'>, value: never) => void;
  onPick: (s: { id: string; name: string; strength: string | null; form: string | null; instruction: string | null }) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.gridRow} role="row">
      <div className={styles.suggestWrap}>
        <input
          className={styles.input}
          value={row.drugName}
          disabled={disabled}
          placeholder="Start typing…"
          onChange={(e) => onField('drugName', e.target.value as never)}
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPick(s)}>
                  <strong>{s.name}</strong>
                  {s.strength && <span> {s.strength}</span>}
                  {s.form && <em> · {s.form}</em>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        className={styles.input}
        value={row.strength ?? ''}
        disabled={disabled}
        onChange={(e) => onField('strength', (e.target.value || null) as never)}
      />
      <input
        className={styles.input}
        type="number"
        min={1}
        value={row.durationDays ?? ''}
        disabled={disabled}
        onChange={(e) => onField('durationDays', (e.target.value === '' ? null : Number(e.target.value)) as never)}
      />
      <div className={styles.doseGroup}>
        {(['morning', 'noon', 'night'] as const).map((slot) => (
          <input
            key={slot}
            className={styles.dose}
            type="number"
            min={0}
            step={0.5}
            aria-label={slot}
            value={row[slot]}
            disabled={disabled}
            onChange={(e) => onField(slot, Number(e.target.value) as never)}
          />
        ))}
      </div>
      <select
        className={styles.input}
        value={row.mealRelation}
        disabled={disabled}
        onChange={(e) => onField('mealRelation', e.target.value as never)}
      >
        <option value="ANY">Any</option>
        <option value="BEFORE">Before</option>
        <option value="AFTER">After</option>
      </select>
      <button type="button" className={styles.remove} onClick={onRemove} disabled={disabled} aria-label="Remove row">
        ×
      </button>
    </div>
  );
});

const TimelineEntry = memo(function TimelineEntry({ entry }: { entry: EncounterView }) {
  const date = new Date(entry.occurredAt).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className={styles.entry}>
      <header className={styles.entryHead}>
        <span className={styles.entryDate}>{date}</span>
        <span className={styles.entryDoctor}>{entry.doctorName}</span>
        {entry.signedAt && <span className={styles.signedDot} title="Signed" />}
      </header>

      {entry.vitals && (
        <p className={styles.entryLine}>
          <strong>Vitals</strong> {entry.vitals.weightKg ?? '—'} kg · {entry.vitals.systolic ?? '—'}/
          {entry.vitals.diastolic ?? '—'} · pulse {entry.vitals.pulseBpm ?? '—'}
        </p>
      )}
      {entry.clinicalNote && (
        <p className={styles.entryLine}>
          <strong>Diagnosis</strong> {entry.clinicalNote.diagnoses.join(', ') || '—'}
        </p>
      )}
      {entry.prescription && entry.prescription.items.length > 0 && (
        <ul className={styles.entryDrugs}>
          {entry.prescription.items.map((item, i) => (
            <li key={i}>
              {item.drugName} {item.strength ?? ''} — {item.morning}+{item.noon}+{item.night}
              {item.durationDays ? ` × ${item.durationDays}d` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});

/**
 * Locked-history panel.
 *
 * Makes the privacy rule legible: the doctor is told records exist, why they
 * are withheld, and that the patient must approve access.
 */
function ConsentPanel({
  windowDays,
  challengeOpen,
  maskedTarget,
  onRequest,
  onConfirm,
}: {
  windowDays: number;
  challengeOpen: boolean;
  maskedTarget: string | null;
  onRequest: () => void;
  onConfirm: (code: string) => void;
}) {
  const [code, setCode] = useState('');

  return (
    <div className={styles.consent}>
      <p className={styles.consentText}>
        Records older than {windowDays} days are locked. Ask the patient to approve access.
      </p>
      {!challengeOpen ? (
        <button type="button" className={styles.ghost} onClick={onRequest}>
          Request patient consent
        </button>
      ) : (
        <div className={styles.consentRow}>
          <span className={styles.muted}>Code sent to {maskedTarget}</span>
          <input
            className={styles.codeInput}
            value={code}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="Consent code"
          />
          <button type="button" className={styles.primary} onClick={() => onConfirm(code)}>
            Unlock
          </button>
        </div>
      )}
    </div>
  );
}
