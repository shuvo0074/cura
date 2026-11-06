import { useState } from 'react';
import { Field, Modal, ModalActions, PatientPicker, uiStyles as s, useMutation, type PickedPatient } from '../../ui';
import { useT } from '../../i18n';
import styles from './feedback.module.css';

/** Records a rating the patient gave at the desk, by phone or on paper. */
export function RecordFeedbackDialog({
  practiceId,
  onClose,
  onSaved,
}: {
  practiceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const mutate = useMutation();

  const save = async () => {
    if (!patient) return setInvalid(t('patients.fb.choosePatient'));
    if (!rating) return setInvalid(t('patients.fb.pickRating'));
    setInvalid(null);

    const ok = await mutate.run('/engagement/feedback', {
      method: 'POST',
      body: { practiceId, patientId: patient.id, rating, ...(comment.trim() ? { comment } : {}) },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={t('patients.fb.dialogTitle')}
      onClose={onClose}
      footer={
        <ModalActions error={invalid ?? mutate.error} busy={mutate.busy} onCancel={onClose} onSave={() => void save()} />
      }
    >
      <Field label={t('patients.field.patient')} required>
        <PatientPicker practiceId={practiceId} value={patient} onChange={setPatient} />
      </Field>

      <div className={s.field}>
        <span className={s.fieldLabel}>{t('patients.fb.rating')} *</span>
        <div className={styles.starPicker} role="radiogroup" aria-label={t('patients.fb.rating')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t('patients.fbStarCount', { count: n })}
              data-on={n <= rating || undefined}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Field label={t('patients.fb.comment')}>
        <textarea
          className={s.textarea}
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('patients.fb.commentPlaceholder')}
        />
      </Field>
    </Modal>
  );
}
