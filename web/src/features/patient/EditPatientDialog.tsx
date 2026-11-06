import { useState } from 'react';
import { BloodGroup, Gender, type Patient } from '@cura/shared';
import { Field, Modal, ModalActions, Row, uiStyles as s } from '../../ui';
import { useServices } from '../../app/services';
import { useT } from '../../i18n';

/** Profile Management for a patient (spec: "Edit Profile"). */
export function EditPatientDialog({
  practiceId,
  patient,
  onClose,
  onSaved,
}: {
  practiceId: string;
  patient: Patient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { http } = useServices();
  const { t } = useT();
  const [form, setForm] = useState({
    fullName: patient.fullName,
    mobile: patient.mobile,
    email: patient.email ?? '',
    gender: patient.gender ?? '',
    dateOfBirth: patient.dateOfBirth ?? '',
    bloodGroup: patient.bloodGroup ?? '',
    address: patient.address ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await http.request(`/patients/${patient.id}`, {
      method: 'PATCH',
      body: {
        practiceId,
        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        // Cleared fields are sent as null so the server unsets them rather than
        // storing an empty string.
        email: form.email.trim() || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        bloodGroup: form.bloodGroup || null,
        address: form.address.trim() || null,
      },
      retry: false,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal
      title={t('patients.record.editProfile')}
      onClose={onClose}
      wide
      footer={<ModalActions error={error} busy={busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Row cols={2}>
        <Field label={t('patients.field.patientName')} required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label={t('patients.field.mobileNumber')} required>
          <input className={s.input} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
      </Row>

      <Row>
        <Field label={t('patients.field.gender')}>
          <select className={s.input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            {Object.values(Gender).map((g) => (
              <option key={g} value={g}>
                {t(`common.gender.${g}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('patients.field.dateOfBirth')}>
          <input
            className={s.input}
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </Field>
        <Field label={t('patients.field.bloodGroup')}>
          <select className={s.input} value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
            <option value="">—</option>
            {Object.values(BloodGroup).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <Field label={t('patients.field.email')}>
        <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label={t('patients.field.address')}>
        <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
    </Modal>
  );
}
