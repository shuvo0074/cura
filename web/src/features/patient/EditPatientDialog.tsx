import { useState } from 'react';
import { BloodGroup, Gender, type Patient } from '@cura/shared';
import { Field, Modal, ModalActions, Row, uiStyles as s } from '../../ui';
import { useServices } from '../../app/services';

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
      title="Edit profile"
      onClose={onClose}
      wide
      footer={<ModalActions error={error} busy={busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Row cols={2}>
        <Field label="Patient name" required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label="Mobile number" required>
          <input className={s.input} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
      </Row>

      <Row>
        <Field label="Gender">
          <select className={s.input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            {Object.values(Gender).map((g) => (
              <option key={g} value={g}>
                {g.charAt(0) + g.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date of birth">
          <input
            className={s.input}
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </Field>
        <Field label="Blood group">
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

      <Field label="Email">
        <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="Address">
        <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
    </Modal>
  );
}
