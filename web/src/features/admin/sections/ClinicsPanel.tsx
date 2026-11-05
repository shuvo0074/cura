import { useState } from 'react';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import type { AdminClinic, ViewedClinic } from './admin-types';

/** Every clinic: edit its details, or open its records read-only. */
export function ClinicsPanel({ onViewClinic }: { onViewClinic: (clinic: ViewedClinic) => void }) {
  const { data, error, loading, reload } = useResource<AdminClinic[]>('/directory/admin/clinics', {});
  const [editing, setEditing] = useState<AdminClinic | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  return (
    <Panel
      title="Clinics"
      description="View records opens the clinic's calendar, patients and billing read-only. Each view is recorded in the audit log."
    >
      <table className={s.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>City</th>
            <th>Contact</th>
            <th>Staff</th>
            <th>Patients</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((clinic) => (
            <tr key={clinic.id}>
              <td>{clinic.name}</td>
              <td>{clinic.city ?? '—'}</td>
              <td>{clinic.contact_number ?? '—'}</td>
              <td>{clinic.staff_count}</td>
              <td>{clinic.patient_count}</td>
              <td>{clinic.is_active ? 'Active' : 'Inactive'}</td>
              <td>
                <button type="button" className={s.linkButton} onClick={() => onViewClinic({ id: clinic.id, name: clinic.name })}>
                  View records
                </button>{' '}
                <button type="button" className={s.linkButton} onClick={() => setEditing(clinic)}>
                  Edit
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
      title={`Edit ${clinic.name}`}
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
          <button type="button" className={s.primary} disabled={save.busy} onClick={() => void submit()}>
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label="Name" required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Specialization">
          <input className={s.input} value={form.specialization} onChange={(e) => set('specialization', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Contact number">
          <input className={s.input} value={form.contact_number} onChange={(e) => set('contact_number', e.target.value)} />
        </Field>
        <Field label="Email">
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Address">
          <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="City">
          <input className={s.input} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
      </Row>
      <Check
        label="Active"
        description="An inactive clinic is hidden from patients choosing clinics on Cura Website."
        checked={form.is_active}
        onChange={(on) => setForm((current) => ({ ...current, is_active: on }))}
      />
    </Modal>
  );
}
