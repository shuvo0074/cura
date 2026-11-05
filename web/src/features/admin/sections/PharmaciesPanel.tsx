import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useResource } from '../../../ui';
import type { AdminUser } from './admin-types';

interface AdminPharmacy {
  id: string;
  name: string;
  license_number: string | null;
  address: string | null;
  city: string | null;
  phones: string[];
  opening_hours: string | null;
  home_delivery: boolean;
  owner: { id: string; full_name: string; email: string | null } | null;
}

/** Every pharmacy and its owner. */
export function PharmaciesPanel() {
  const { data, error, loading, reload } = useResource<AdminPharmacy[]>('/directory/admin/pharmacies', {});
  const [editing, setEditing] = useState<AdminPharmacy | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  return (
    <Panel
      title="Pharmacies"
      description="Owners manage their own pharmacies on Cura Dashboard."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      {(data ?? []).length === 0 ? (
        <p className={s.muted}>No pharmacies yet.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Phones</th>
              <th>Location</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((pharmacy) => (
              <tr key={pharmacy.id}>
                <td>{pharmacy.name}</td>
                <td>{pharmacy.owner?.full_name ?? '—'}</td>
                <td>{pharmacy.phones.join(', ')}</td>
                <td>{[pharmacy.address, pharmacy.city].filter(Boolean).join(', ') || '—'}</td>
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
  existing: AdminPharmacy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { http } = useServices();
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    license_number: existing?.license_number ?? '',
    address: existing?.address ?? '',
    city: existing?.city ?? '',
    phones: (existing?.phones ?? []).join(', '),
    opening_hours: existing?.opening_hours ?? '',
    home_delivery: existing?.home_delivery ?? false,
  });
  const [owner, setOwner] = useState(existing?.owner?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: Exclude<keyof typeof form, 'home_delivery'>, value: string) => setForm((current) => ({ ...current, [key]: value }));

  /** Finds the one account matching the email or mobile typed. */
  const findOwner = async (): Promise<string | null> => {
    const result = await http.request<{ items: AdminUser[] }>('/directory/admin/users', { query: { q: owner.trim(), limit: 5 } });
    if (!result.ok) throw new Error(result.error.message);
    if (result.value.items.length !== 1) throw new Error('Type the owner\'s exact email or mobile, so one account matches.');
    return result.value.items[0]!.id;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const changedOwner = !existing || owner.trim() !== (existing.owner?.email ?? '');
      const ownerId = changedOwner && owner.trim() ? await findOwner() : null;
      if (!existing && !ownerId) throw new Error('Choose the owner.');
      const body = { ...form, ...(ownerId ? { owner_id: ownerId } : {}) };
      const result = existing
        ? await http.request(`/directory/admin/pharmacies/${existing.id}`, { method: 'PATCH', body, retry: false })
        : await http.request('/directory/admin/pharmacies', { method: 'POST', body, retry: false });
      if (!result.ok) throw new Error(result.error.message);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const result = await http.request(`/directory/admin/pharmacies/${existing.id}`, { method: 'DELETE', retry: false });
    if (result.ok) onSaved();
    else setError(result.error.message);
  };

  return (
    <Modal
      title={existing ? `Edit ${existing.name}` : 'Add pharmacy'}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
          {existing && (
            <button type="button" className={s.linkDanger} onClick={() => void remove()}>
              Delete
            </button>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Owner's email or mobile" required hint="They get the pharmacy owner role if they lack it.">
        <input className={s.input} value={owner} onChange={(e) => setOwner(e.target.value)} />
      </Field>
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
      <Check label="Home delivery" checked={form.home_delivery} onChange={(on) => setForm((current) => ({ ...current, home_delivery: on }))} />
    </Modal>
  );
}
