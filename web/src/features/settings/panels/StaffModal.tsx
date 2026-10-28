import { useState } from 'react';
import {
  Field,
  Modal,
  Row,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { ACCESS_OPTIONS, Kind, NOTIFICATION_ROWS, Staff } from './staff-shared';

export function StaffModal({
  practiceId,
  kind,
  existing,
  onClose,
  onSaved,
}: {
  practiceId: string;
  kind: Kind;
  existing: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();
  const [form, setForm] = useState({
    fullName: existing?.fullName ?? '',
    bmdcNumber: existing?.bmdcNumber ?? '',
    mobile: existing?.mobile ?? '',
    email: existing?.email ?? '',
    role: existing?.role ?? ACCESS_OPTIONS[kind][0]!.role,
    temporaryPassword: '',
    notifyScheduleSms: existing?.notifyScheduleSms ?? true,
    notifyScheduleEmail: existing?.notifyScheduleEmail ?? true,
    notifyAppointmentSms: existing?.notifyAppointmentSms ?? true,
    notifyAppointmentEmail: existing?.notifyAppointmentEmail ?? true,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const shared = {
      practiceId,
      fullName: form.fullName.trim(),
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      bmdcNumber: form.bmdcNumber.trim() || null,
      role: form.role,
      notifyScheduleSms: form.notifyScheduleSms,
      notifyScheduleEmail: form.notifyScheduleEmail,
      notifyAppointmentSms: form.notifyAppointmentSms,
      notifyAppointmentEmail: form.notifyAppointmentEmail,
    };

    const ok = existing
      ? await save.run(`/settings/staff/${existing.userId}`, { method: 'PATCH', body: shared })
      : await save.run('/settings/staff', {
          method: 'POST',
          body: { ...shared, temporaryPassword: form.temporaryPassword },
        });

    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? `Edit ${form.fullName || 'member'}` : kind === 'doctor' ? 'Add Doctor' : 'Add Staff'}
      onClose={onClose}
      wide
      footer={
        <>
          {save.error && (
            <span className={s.error} role="alert">
              {save.error}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={save.busy}>
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label="Name" required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        {kind === 'doctor' && (
          <Field label="BMDC Registration Number" required hint="Mandatory for medical personnel.">
            <input className={s.input} value={form.bmdcNumber} onChange={(e) => set('bmdcNumber', e.target.value)} />
          </Field>
        )}
      </Row>

      <Row cols={2}>
        <Field label="Mobile Number" required={kind === 'staff'}>
          <input
            className={s.input}
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="Email ID" required={kind === 'staff'}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </Row>

      {!existing && (
        <Field
          label="Temporary password"
          required
          hint="The member is prompted to change this after their first sign-in."
        >
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={form.temporaryPassword}
            onChange={(e) => set('temporaryPassword', e.target.value)}
          />
        </Field>
      )}

      <h4 className={s.subtitle}>Cura access</h4>
      <div className={s.radioList}>
        {ACCESS_OPTIONS[kind].map((option) => (
          <label key={option.role} className={s.radio}>
            <input
              type="radio"
              name="staff-role"
              checked={form.role === option.role}
              onChange={() => set('role', option.role)}
            />
            <span>
              <span className={s.checkLabel}>{option.label}</span>
              <span className={s.checkHint}>{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
      <h4 className={s.subtitle}>Notifications</h4>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Type</th>
            <th>SMS</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_ROWS.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>
                <input type="checkbox" checked={form[row.sms]} onChange={(e) => set(row.sms, e.target.checked)} />
              </td>
              <td>
                <input type="checkbox" checked={form[row.email]} onChange={(e) => set(row.email, e.target.checked)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
