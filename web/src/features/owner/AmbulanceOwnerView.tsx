import { useState } from 'react';
import {
  Check,
  Failed,
  Field,
  Loading,
  Modal,
  Panel,
  Row,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../ui';
import { AMBULANCE_SERVICES, AMBULANCE_TYPES, toggled, type AmbulanceVendor, type FareRange } from './owner-shared';

const EMPTY: Omit<AmbulanceVendor, 'id' | 'hidden'> = {
  name: '',
  address: '',
  phones: [],
  categories: [],
  features: [],
  dhaka_wide: false,
  fares: {},
};

/** An ambulance owner's own vendors. New ones wait for a super admin to publish them. */
export function AmbulanceOwnerView() {
  const { data, error, loading, reload } = useResource<AmbulanceVendor[]>('/directory/my-ambulances', {});
  const [editing, setEditing] = useState<AmbulanceVendor | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  const vendors = data ?? [];
  return (
    <Panel
      title="My Ambulances"
      description="Patients see these details on Cura Website."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      {vendors.length === 0 ? (
        <p className={s.muted}>No ambulance service added yet.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phones</th>
              <th>Types</th>
              <th>On Cura Website</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                <td>{vendor.phones.join(', ')}</td>
                <td>
                  {AMBULANCE_TYPES.filter((type) => vendor.categories.includes(type.key))
                    .map((type) => type.label)
                    .join(', ')}
                </td>
                <td>{vendor.hidden ? 'Waiting for an admin' : 'Visible'}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(vendor)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <AmbulanceModal
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

function AmbulanceModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: AmbulanceVendor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();
  const [form, setForm] = useState<Omit<AmbulanceVendor, 'id' | 'hidden'>>({ ...EMPTY, ...existing });
  const [phones, setPhones] = useState((existing?.phones ?? []).join(', '));
  const set = (key: 'name' | 'address', value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setList = (key: 'categories' | 'features', value: string[]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setFare = (category: string, edge: keyof FareRange, value: string) =>
    setForm((current) => ({
      ...current,
      fares: {
        ...current.fares,
        [category]: { ...{ min: '', max: '' }, ...current.fares[category], [edge]: value },
      },
    }));

  const submit = async () => {
    // The API replaces the whole record, so fields this form does not show go back as they came.
    const body = { ...form, phones };
    const ok = existing
      ? await save.run(`/directory/my-ambulances/${existing.id}`, { method: 'PATCH', body })
      : await save.run('/directory/my-ambulances', { method: 'POST', body });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? `Edit ${existing.name}` : 'Add ambulance service'}
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
      {!existing && (
        <p className={s.muted}>Patients see a new service after a Cura admin publishes it.</p>
      )}
      <Row cols={2}>
        <Field label="Name" required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Phone numbers" required hint="Separate several numbers with commas.">
          <input className={s.input} value={phones} onChange={(e) => setPhones(e.target.value)} />
        </Field>
      </Row>
      <Field label="Address">
        <input className={s.input} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <Check
        label="Serves all of Dhaka"
        checked={form.dhaka_wide}
        onChange={(checked) => setForm((current) => ({ ...current, dhaka_wide: checked }))}
      />

      <h4 className={s.subtitle}>Ambulance types and fares (৳)</h4>
      {AMBULANCE_TYPES.map((type) => {
        const on = form.categories.includes(type.key);
        return (
          <div key={type.key}>
            <Check
              label={type.label}
              checked={on}
              onChange={(checked) => setList('categories', toggled(form.categories, type.key, checked))}
            />
            {on && (
              <Row cols={2}>
                <Field label={`${type.label} lowest fare`}>
                  <input
                    className={s.input}
                    inputMode="numeric"
                    value={form.fares[type.key]?.min ?? ''}
                    onChange={(e) => setFare(type.key, 'min', e.target.value)}
                  />
                </Field>
                <Field label={`${type.label} highest fare`}>
                  <input
                    className={s.input}
                    inputMode="numeric"
                    value={form.fares[type.key]?.max ?? ''}
                    onChange={(e) => setFare(type.key, 'max', e.target.value)}
                  />
                </Field>
              </Row>
            )}
          </div>
        );
      })}

      <h4 className={s.subtitle}>Services</h4>
      {AMBULANCE_SERVICES.map((service) => (
        <Check
          key={service.key}
          label={service.label}
          checked={form.features.includes(service.key)}
          onChange={(checked) => setList('features', toggled(form.features, service.key, checked))}
        />
      ))}
    </Modal>
  );
}
