import { useState } from 'react';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../ui';
import type { Pharmacy } from './owner-shared';

/** A pharmacy owner's own pharmacies. */
export function PharmacyOwnerView() {
  const { data, error, loading, reload } = useResource<Pharmacy[]>('/directory/my-pharmacies', {});
  const [editing, setEditing] = useState<Pharmacy | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  const pharmacies = data ?? [];
  return (
    <Panel
      title="My Pharmacy"
      description="Patients see these details on Cura Website. A new pharmacy waits for an admin before it shows."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      {pharmacies.length === 0 ? (
        <p className={s.muted}>No pharmacy added yet.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phones</th>
              <th>Location</th>
              <th>Hours</th>
              <th>Home delivery</th>
              <th>On Cura Website</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pharmacies.map((pharmacy) => (
              <tr key={pharmacy.id}>
                <td>{pharmacy.name}</td>
                <td>{pharmacy.phones.join(', ')}</td>
                <td>{[pharmacy.address, pharmacy.city].filter(Boolean).join(', ') || '—'}</td>
                <td>{pharmacy.opening_hours ?? '—'}</td>
                <td>{pharmacy.home_delivery ? 'Yes' : 'No'}</td>
                <td>{pharmacy.hidden ? 'Waiting for an admin' : 'Visible'}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(pharmacy)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <PharmacyModal
          existing={editing === 'new' ? null : editing}
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

function PharmacyModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Pharmacy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    license_number: existing?.license_number ?? '',
    address: existing?.address ?? '',
    city: existing?.city ?? '',
    phones: (existing?.phones ?? []).join(', '),
    opening_hours: existing?.opening_hours ?? '',
    home_delivery: existing?.home_delivery ?? false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const ok = existing
      ? await save.run(`/directory/my-pharmacies/${existing.id}`, { method: 'PATCH', body: form })
      : await save.run('/directory/my-pharmacies', { method: 'POST', body: form });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? `Edit ${existing.name}` : 'Add pharmacy'}
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
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Drug licence number">
          <input className={s.input} value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Phone numbers" required hint="Separate several numbers with commas.">
          <input className={s.input} value={form.phones} onChange={(e) => set('phones', e.target.value)} />
        </Field>
        <Field label="Opening hours">
          <input className={s.input} value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} />
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
        label="Home delivery"
        checked={form.home_delivery}
        onChange={(checked) => set('home_delivery', checked)}
      />
    </Modal>
  );
}
