import { useState } from 'react';
import {
  Field,
  Modal,
  Row,
  uiStyles as s,
  useMutation,
} from '../../../ui';
import { useT } from '../../../i18n';

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
  const { t, tm } = useT();
  const save = useMutation();
  const [form, setForm] = useState({
    fullName: existing?.fullName ?? '',
    bmdcNumber: existing?.bmdcNumber ?? '',
    mobile: existing?.mobile ?? '',
    email: existing?.email ?? '',
    role: existing?.role ?? (ACCESS_OPTIONS[kind][0] as string),
    specialty: existing?.specialty ?? '',
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

    const temporaryPassword = form.temporaryPassword || null;
    const ok = existing
      ? await save.run(`/settings/staff/${existing.userId}`, { method: 'PATCH', body: shared })
      : await save.run('/settings/staff', {
          method: 'POST',
          body: { ...shared, specialty: form.specialty.trim() || null, temporaryPassword },
        });
    if (ok && existing && !existing.hasLogin && temporaryPassword) {
      const created = await save.run(`/settings/staff/${existing.userId}/login`, {
        method: 'PUT',
        body: { practiceId, temporaryPassword },
      });
      if (!created) return;
    }

    if (ok) onSaved();
  };

  return (
    <Modal
      title={
        existing
          ? t('settings.staff.editMember', { name: form.fullName || t('settings.staff.member') })
          : kind === 'doctor'
            ? t('settings.staff.addDoctor')
            : t('settings.staff.addStaff')
      }
      onClose={onClose}
      wide
      footer={
        <>
          {save.error && (
            <span className={s.error} role="alert">
              {tm(save.error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={save.busy}>
            {save.busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label={t('settings.name')} required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        {kind === 'doctor' && (
          <Field
            label={t('settings.staff.bmdcLabel')}
            hint={t('settings.staff.bmdcHint')}
          >
            <input className={s.input} value={form.bmdcNumber} onChange={(e) => set('bmdcNumber', e.target.value)} />
          </Field>
        )}
      </Row>

      {kind === 'doctor' && !existing && (
        <Field label={t('settings.staff.specialty')} required hint={t('settings.staff.specialtyHint')}>
          <input className={s.input} value={form.specialty} onChange={(e) => set('specialty', e.target.value)} />
        </Field>
      )}

      <Row cols={2}>
        <Field
          label={t('settings.staff.mobile')}
          required
          {...(kind === 'doctor' ? { hint: t('settings.staff.mobileHint') } : {})}
        >
          <input
            className={s.input}
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label={t('settings.staff.emailId')} required={kind === 'staff'}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </Row>

      {(!existing || !existing.hasLogin) && (
        <Field
          label={t('settings.staff.tempPassword')}
          required={kind === 'staff'}
          hint={
            kind === 'doctor'
              ? t('settings.staff.tempHintDoctor')
              : t('settings.staff.tempHintStaff')
          }
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

      <h4 className={s.subtitle}>{t('settings.staff.curaAccess')}</h4>
      <div className={s.radioList}>
        {ACCESS_OPTIONS[kind].map((role) => (
          <label key={role} className={s.radio}>
            <input
              type="radio"
              name="staff-role"
              checked={form.role === role}
              onChange={() => set('role', role)}
            />
            <span>
              <span className={s.checkLabel}>{t(`settings.staff.access.${role}`)}</span>
              <span className={s.checkHint}>{t(`settings.staff.accessDetail.${role}`)}</span>
            </span>
          </label>
        ))}
      </div>
      <h4 className={s.subtitle}>{t('settings.staff.notifications')}</h4>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('settings.type')}</th>
            <th>{t('settings.sms')}</th>
            <th>{t('settings.email')}</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_ROWS.map((row) => (
            <tr key={row.key}>
              <td>{t(`settings.staff.notify.${row.key}`)}</td>
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
