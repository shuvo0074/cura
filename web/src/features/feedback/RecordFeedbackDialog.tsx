import { useState } from 'react';
import { Field, Modal, ModalActions, PatientPicker, uiStyles as s, useMutation, type PickedPatient } from '../../ui';
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
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const mutate = useMutation();

  const save = async () => {
    if (!patient) return setInvalid('Choose the patient.');
    if (!rating) return setInvalid('Pick a rating.');
    setInvalid(null);

    const ok = await mutate.run('/engagement/feedback', {
      method: 'POST',
      body: { practiceId, patientId: patient.id, rating, ...(comment.trim() ? { comment } : {}) },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title="Record feedback"
      onClose={onClose}
      footer={
        <ModalActions error={invalid ?? mutate.error} busy={mutate.busy} onCancel={onClose} onSave={() => void save()} />
      }
    >
      <Field label="Patient" required>
        <PatientPicker practiceId={practiceId} value={patient} onChange={setPatient} />
      </Field>

      <div className={s.field}>
        <span className={s.fieldLabel}>Rating *</span>
        <div className={styles.starPicker} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              data-on={n <= rating || undefined}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Field label="Comment">
        <textarea
          className={s.textarea}
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did the patient say?"
        />
      </Field>
    </Modal>
  );
}
