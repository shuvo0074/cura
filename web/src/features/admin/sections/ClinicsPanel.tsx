import { useState } from 'react';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import { useT } from '../../../i18n';
import type { AdminClinic, ViewedClinic } from './admin-types';

/** Every clinic: edit its details, or open its records read-only. */
export function ClinicsPanel({ onViewClinic }: { onViewClinic: (clinic: ViewedClinic) => void }) {
  const { data, error, loading, reload } = useResource<AdminClinic[]>('/directory/admin/clinics', {});
  const [editing, setEditing] = useState<AdminClinic | null>(null);
  const { t, fmt } = useT();

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  return (
    <Panel
      title={t('admin.clinics.title')}
      description={t('admin.clinics.description')}
    >
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('admin.clinics.col.name')}</th>
            <th>{t('admin.clinics.col.city')}</th>
            <th>{t('admin.clinics.col.contact')}</th>
            <th>{t('admin.clinics.col.staff')}</th>
            <th>{t('admin.clinics.col.patients')}</th>
            <th>{t('admin.clinics.col.status')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((clinic) => (
            <tr key={clinic.id}>
              <td>{clinic.name}</td>
              <td>{clinic.city ?? '—'}</td>
              <td>{clinic.contact_number ?? '—'}</td>
              <td>{fmt.number(clinic.staff_count)}</td>
              <td>{fmt.number(clinic.patient_count)}</td>
              <td>{clinic.is_active ? t('admin.clinics.active') : t('admin.clinics.inactive')}</td>
              <td>
                <button type="button" className={s.linkButton} onClick={() => onViewClinic({ id: clinic.id, name: clinic.name })}>
                  {t('admin.clinics.viewRecords')}
                </button>{' '}
                <button type="button" className={s.linkButton} onClick={() => setEditing(clinic)}>
                  {t('common.edit')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <ClinicModal
          clinic={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}

function ClinicModal({ clinic, onClose, onSaved }: { clinic: AdminClinic; onClose: () => void; onSaved: () => void }) {
  const save = useMutation();
  const { t, tm } = useT();
  const [form, setForm] = useState({
    name: clinic.name,
    specialization: clinic.specialization ?? '',
    contact_number: clinic.contact_number ?? '',
    email: clinic.email ?? '',
    address: clinic.address ?? '',
    city: clinic.city ?? '',
    is_active: clinic.is_active,
  });
  const set = (key: Exclude<keyof typeof form, 'is_active'>, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (await save.run(`/directory/admin/clinics/${clinic.id}`, { method: 'PATCH', body: form })) onSaved();
  };

  return (
    <Modal
      title={t('admin.clinics.editTitle', { name: clinic.name })}
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
          <button type="button" className={s.primary} disabled={save.busy} onClick={() => void submit()}>
            {save.busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label={t('admin.clinics.field.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('admin.clinics.field.specialization')}>
          <input className={s.input} value={form.specialization} onChange={(e) => set('specialization', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.clinics.field.contactNumber')}>
          <input className={s.input} value={form.contact_number} onChange={(e) => set('contact_number', e.target.value)} />
        </Field>
        <Field label={t('admin.clinics.field.email')}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.clinics.field.address')}>
          <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('admin.clinics.field.city')}>
          <input className={s.input} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
      </Row>
      <Check
        label={t('admin.clinics.active')}
        description={t('admin.clinics.activeHint')}
        checked={form.is_active}
        onChange={(on) => setForm((current) => ({ ...current, is_active: on }))}
      />
    </Modal>
  );
}
