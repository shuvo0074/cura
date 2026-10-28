import type { NoteDraft, NoteListField, PatientDashboardViewModel } from '@cura/shared';
import { TagListInput } from './TagListInput';
import styles from './patient.module.css';

const SECTIONS: ReadonlyArray<{ key: NoteListField; label: string; kind: string; placeholder: string }> = [
  { key: 'complaints', label: 'Chief complaints', kind: 'COMPLAINT', placeholder: 'Fever for 3 days' },
  { key: 'observations', label: 'Observations', kind: 'OBSERVATION', placeholder: 'Chest clear' },
  { key: 'diagnoses', label: 'Diagnoses', kind: 'DIAGNOSIS', placeholder: 'Viral fever' },
  { key: 'advice', label: 'Advice', kind: 'ADVICE', placeholder: 'Rest, plenty of fluids' },
];

/**
 * Clinical notes (spec: the five SOAP-style fields).
 *
 * Each list auto-suggests from its own catalog only — typing in Diagnoses must
 * never offer a complaint, which is what makes the catalogs worth curating.
 */
export function ClinicalNotesEditor({
  vm,
  practiceId,
  note,
  disabled,
  saving,
}: {
  vm: PatientDashboardViewModel;
  practiceId: string;
  note: NoteDraft;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <section className={styles.card} aria-label="Clinical notes">
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>Clinical notes</h3>
        {!disabled && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void vm.saveNote()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        )}
      </div>

      {SECTIONS.map((section) => (
        <TagListInput
          key={section.key}
          label={section.label}
          practiceId={practiceId}
          catalogKind={section.kind}
          placeholder={section.placeholder}
          disabled={disabled}
          values={note[section.key]}
          onChange={(values) => vm.setNoteList(section.key, values)}
        />
      ))}

      <label className={styles.field}>
        <span className={styles.label}>Notes</span>
        <textarea
          className={styles.textarea}
          rows={3}
          disabled={disabled}
          value={note.notes}
          placeholder="General remarks or internal documentation"
          onChange={(e) => vm.setNoteText(e.target.value)}
        />
      </label>
    </section>
  );
}
