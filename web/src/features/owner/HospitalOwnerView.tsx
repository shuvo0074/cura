import { useState } from 'react';
import { Failed, Field, Loading, Modal, ModalActions, Panel, Row, uiStyles as s, useMutation, useResource } from '../../ui';
import { ExtrasFields, toForm, type HospitalForm, type HospitalRecord } from '../admin/sections/HospitalsPanel';
import { typeLabel } from '../admin/sections/data/hospital-catalogue';

/** The fields an owner may change. The API ignores anything else. */
const OWNER_FIELDS = [
  'name',
  'address',
  'hotline',
  'website',
  'description',
  'opening_hours',
  'visiting_hours',
  'services',
  'facilities',
  'payment_methods',
  'beds',
  'tests',
] as const satisfies readonly (keyof HospitalForm)[];

/** A hospital owner's own places. Changes show on Cura Website at once. */
export function HospitalOwnerView() {
  const { data, error, loading, reload } = useResource<HospitalRecord[]>('/directory/my-hospitals', {});
  const [editing, setEditing] = useState<HospitalRecord | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  const places = data ?? [];
  return (
    <Panel title="My Hospital" description="Patients see these details on Cura Website. Your changes show at once.">
      {places.length === 0 ? (
        <p className={s.muted}>No hospital or diagnostic centre is linked to your account yet. Ask a Cura super admin to link it.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Hotline</th>
              <th>On Cura Website</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {places.map((place) => (
              <tr key={place.id}>
                <td>{place.name}</td>
                <td>{typeLabel(place.type)}</td>
                <td>{place.hotline ?? '—'}</td>
                <td>{place.hidden ? 'Hidden by an admin' : 'Visible'}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(place)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <HospitalModal
          place={editing}
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

function HospitalModal({ place, onClose, onSaved }: { place: HospitalRecord; onClose: () => void; onSaved: () => void }) {
  const save = useMutation();
  const [form, setForm] = useState<HospitalForm>(() => toForm(place));
  const set = (patch: Partial<HospitalForm>) => setForm((current) => ({ ...current, ...patch }));

  const submit = async () => {
    const body = Object.fromEntries(OWNER_FIELDS.map((field) => [field, form[field]]));
    if (await save.run(`/directory/my-hospitals/${place.id}`, { method: 'PATCH', body })) onSaved();
  };

  return (
    <Modal
      title={`Edit ${place.name}`}
      onClose={onClose}
      wide
      footer={<ModalActions error={save.error} busy={save.busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <p className={s.muted}>
        {typeLabel(place.type)} in {place.location}. To change the type, location, map pin or photo, ask a Cura super admin.
      </p>
      <Field label="Name" required>
        <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Address">
        <input className={s.input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label="Hotline">
          <input className={s.input} value={form.hotline} onChange={(e) => set({ hotline: e.target.value })} />
        </Field>
        <Field label="Website">
          <input className={s.input} value={form.website} onChange={(e) => set({ website: e.target.value })} />
        </Field>
      </Row>
      <Field label="Description">
        <textarea
          className={s.textarea}
          rows={3}
          placeholder="A short description of the place"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <ExtrasFields form={form} set={set} forOwner />
    </Modal>
  );
}
