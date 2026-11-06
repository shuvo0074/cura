import type { NoteDraft, NoteListField, PatientDashboardViewModel } from '@cura/shared';
import { useT, type TranslationKey } from '../../i18n';
import { TagListInput } from './TagListInput';
import styles from './patient.module.css';

const SECTIONS: ReadonlyArray<{
  key: NoteListField;
  label: TranslationKey;
  kind: string;
  placeholder: TranslationKey;
}> = [
  { key: 'complaints', label: 'patients.notes.complaints', kind: 'COMPLAINT', placeholder: 'patients.notes.complaintsPlaceholder' },
  { key: 'observations', label: 'patients.notes.observations', kind: 'OBSERVATION', placeholder: 'patients.notes.observationsPlaceholder' },
  { key: 'diagnoses', label: 'patients.notes.diagnoses', kind: 'DIAGNOSIS', placeholder: 'patients.notes.diagnosesPlaceholder' },
  { key: 'advice', label: 'patients.notes.advice', kind: 'ADVICE', placeholder: 'patients.notes.advicePlaceholder' },
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
  const { t } = useT();
  return (
    <section className={styles.card} aria-label={t('patients.notes.title')}>
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>{t('patients.notes.title')}</h3>
        {!disabled && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void vm.saveNote()}
            disabled={saving}
          >
            {saving ? t('common.saving') : t('patients.notes.save')}
          </button>
        )}
      </div>

      {SECTIONS.map((section) => (
        <TagListInput
          key={section.key}
          label={t(section.label)}
          practiceId={practiceId}
          catalogKind={section.kind}
          placeholder={t(section.placeholder)}
          disabled={disabled}
          values={note[section.key]}
          onChange={(values) => vm.setNoteList(section.key, values)}
        />
      ))}

      <label className={styles.field}>
        <span className={styles.label}>{t('patients.notes.notes')}</span>
        <textarea
          className={styles.textarea}
          rows={3}
          disabled={disabled}
          value={note.notes}
          placeholder={t('patients.notes.notesPlaceholder')}
          onChange={(e) => vm.setNoteText(e.target.value)}
        />
      </label>
    </section>
  );
}
