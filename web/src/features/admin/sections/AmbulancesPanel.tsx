import { useCallback, useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import { AMBULANCE_SERVICES, AMBULANCE_TYPES, toggled, type FareRange } from '../../owner/owner-shared';
import { AMBULANCE_AREAS } from './data/ambulance-areas';
import a from './AmbulancesPanel.module.css';

/** An ambulance vendor as the admin list returns it (snake_case, every column). */
interface AdminAmbulance {
  id: string;
  name: string;
  name_bn: string | null;
  address: string | null;
  address_bn: string | null;
  phones: string[];
  base_area: string | null;
  dhaka_wide: boolean;
  service_areas: string[];
  categories: string[];
  features: string[];
  fares: Record<string, FareRange> | null;
  source_url: string | null;
  source_checked_on: string | null;
  hidden: boolean;
}

interface SampleFares {
  ambulanceFares: Record<string, FareRange>;
}

/** The form keeps every field the API stores, since an update replaces the whole record. */
interface VendorForm {
  name: string;
  name_bn: string;
  address: string;
  address_bn: string;
  phones: string;
  base_area: string;
  dhaka_wide: boolean;
  service_areas: string[];
  categories: string[];
  features: string[];
  fares: Record<string, FareRange>;
  source_url: string;
  source_checked_on: string;
}

const BLANK: VendorForm = {
  name: '',
  name_bn: '',
  address: '',
  address_bn: '',
  phones: '',
  base_area: '',
  dhaka_wide: false,
  service_areas: [],
  categories: [],
  features: [],
  fares: {},
  source_url: '',
  source_checked_on: '',
};

const toForm = (v: AdminAmbulance): VendorForm => ({
  name: v.name,
  name_bn: v.name_bn ?? '',
  address: v.address ?? '',
  address_bn: v.address_bn ?? '',
  phones: (v.phones ?? []).join(', '),
  base_area: v.base_area ?? '',
  dhaka_wide: v.dhaka_wide,
  service_areas: v.service_areas ?? [],
  categories: v.categories ?? [],
  features: v.features ?? [],
  fares: v.fares ?? {},
  source_url: v.source_url ?? '',
  source_checked_on: v.source_checked_on ?? '',
});

const typeLabel = (key: string): string => AMBULANCE_TYPES.find((type) => type.key === key)?.label ?? key;

/** Every ambulance vendor on Cura Website, including hidden ones. */
export function AmbulancesPanel() {
  const { data, error, loading, reload } = useResource<AdminAmbulance[]>('/directory/admin/ambulances', {});
  const samples = useResource<SampleFares>('/directory/admin/sample-prices', {});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminAmbulance | 'new' | null>(null);
  // Stable, so the dialog does not move focus when the list reloads behind it.
  const close = useCallback(() => setEditing(null), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (v) => !q || [v.name, v.name_bn, ...(v.phones ?? [])].some((x) => x?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  return (
    <Panel
      title="Ambulances"
      description={`${visible.length} vendor${visible.length === 1 ? '' : 's'}. Click one to edit, hide or delete it.`}
      action={
        <div className={a.toolbar}>
          <input
            className={`${s.input} ${a.search}`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone"
            aria-label="Search ambulances"
          />
          <button type="button" className={s.primary} onClick={() => setEditing('new')}>
            Add vendor
          </button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <p className={s.muted}>No ambulance vendors match.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Types</th>
              <th>Fares</th>
              <th>Main phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id} className={v.hidden ? a.hiddenRow : undefined}>
                <td>
                  {v.name}
                  {v.hidden && <span className={a.tag}>Hidden</span>}
                </td>
                <td>{v.categories.map(typeLabel).join(', ')}</td>
                <td>{Object.keys(v.fares ?? {}).length ? 'Own fares' : 'Sample fares'}</td>
                <td>{v.phones[0] ?? ''}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(v)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <VendorModal
          existing={editing === 'new' ? null : editing}
          sampleFares={samples.data?.ambulanceFares ?? {}}
          onClose={close}
          onChanged={() => void reload()}
          onDone={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}

function VendorModal({
  existing,
  sampleFares,
  onClose,
  onChanged,
  onDone,
}: {
  existing: AdminAmbulance | null;
  sampleFares: Record<string, FareRange>;
  onClose: () => void;
  onChanged: () => void;
  onDone: () => void;
}) {
  const save = useMutation();
  const [form, setForm] = useState<VendorForm>(existing ? toForm(existing) : BLANK);
  const [hidden, setHidden] = useState(existing?.hidden ?? false);
  const [areaQuery, setAreaQuery] = useState('');

  const set = (patch: Partial<VendorForm>) => setForm((current) => ({ ...current, ...patch }));
  const setFare = (category: string, edge: keyof FareRange, value: string) =>
    setForm((current) => ({
      ...current,
      fares: { ...current.fares, [category]: { min: '', max: '', ...current.fares[category], [edge]: value } },
    }));

  const visibleAreas = AMBULANCE_AREAS.filter((area) =>
    area.name.toLowerCase().includes(areaQuery.trim().toLowerCase()),
  );

  const submit = async () => {
    const ok = existing
      ? await save.run(`/directory/admin/ambulances/${existing.id}`, { method: 'PATCH', body: form })
      : await save.run('/directory/admin/ambulances', { method: 'POST', body: form });
    if (ok) onDone();
  };

  return (
    <Modal
      title={existing ? 'Edit ambulance vendor' : 'Add ambulance vendor'}
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
      {existing && (
        <RecordActions
          path={`/directory/admin/ambulances/${existing.id}`}
          hidden={hidden}
          label="vendor"
          onHiddenChange={(next) => {
            setHidden(next);
            onChanged();
          }}
          onDeleted={onDone}
        />
      )}

      <Row cols={2}>
        <Field label="Name" required>
          <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Name in Bangla">
          <input className={s.input} value={form.name_bn} onChange={(e) => set({ name_bn: e.target.value })} />
        </Field>
        <Field label="Address">
          <input className={s.input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="Address in Bangla">
          <input
            className={s.input}
            value={form.address_bn}
            onChange={(e) => set({ address_bn: e.target.value })}
          />
        </Field>
      </Row>
      <Field
        label="Phone numbers"
        required
        hint="The first one is the main booking line. Separate numbers with commas."
      >
        <input
          className={s.input}
          value={form.phones}
          placeholder="01714325325, 01993800900"
          onChange={(e) => set({ phones: e.target.value })}
        />
      </Field>

      <h4 className={s.subtitle}>Ambulance types and fares (৳)</h4>
      <p className={s.muted}>
        Fares are one way within Dhaka. Leave a fare empty to show the shared sample range, labelled as sample.
      </p>
      {AMBULANCE_TYPES.map((type) => {
        const on = form.categories.includes(type.key);
        const sample = sampleFares[type.key];
        return (
          <div key={type.key} className={a.fareRow}>
            <Check
              label={type.label}
              checked={on}
              onChange={(checked) => set({ categories: toggled(form.categories, type.key, checked) })}
            />
            {on &&
              (['min', 'max'] as const).map((edge) => (
                <input
                  key={edge}
                  className={s.input}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${type.label} ${edge === 'min' ? 'lowest' : 'highest'} fare`}
                  placeholder={`${edge === 'min' ? 'From' : 'To'}${sample ? ` (sample ${sample[edge]})` : ''}`}
                  value={form.fares[type.key]?.[edge] ?? ''}
                  onChange={(e) => setFare(type.key, edge, e.target.value)}
                />
              ))}
          </div>
        );
      })}

      <h4 className={s.subtitle}>Services</h4>
      {AMBULANCE_SERVICES.map((service) => (
        <Check
          key={service.key}
          label={service.label}
          checked={form.features.includes(service.key)}
          onChange={(checked) => set({ features: toggled(form.features, service.key, checked) })}
        />
      ))}

      <h4 className={s.subtitle}>Coverage</h4>
      <Row cols={2}>
        <Field label="Base area" hint="Used for distance from the patient.">
          <select className={s.input} value={form.base_area} onChange={(e) => set({ base_area: e.target.value })}>
            <option value="">No base area</option>
            {AMBULANCE_AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Check
        label="Serves all of Dhaka"
        checked={form.dhaka_wide}
        onChange={(checked) => set({ dhaka_wide: checked })}
      />
      {!form.dhaka_wide && (
        <>
          <p className={s.muted}>Areas served ({form.service_areas.length} selected)</p>
          <input
            className={`${s.input} ${a.areaSearch}`}
            type="search"
            value={areaQuery}
            onChange={(e) => setAreaQuery(e.target.value)}
            placeholder="Search areas"
            aria-label="Search areas"
          />
          <div className={a.checkGrid}>
            {visibleAreas.map((area) => (
              <Check
                key={area.id}
                label={area.name}
                checked={form.service_areas.includes(area.id)}
                onChange={(checked) => set({ service_areas: toggled(form.service_areas, area.id, checked) })}
              />
            ))}
          </div>
        </>
      )}

      <h4 className={s.subtitle}>Source</h4>
      <Row cols={2}>
        <Field label="Source link">
          <input
            className={s.input}
            type="url"
            placeholder="https://…"
            value={form.source_url}
            onChange={(e) => set({ source_url: e.target.value })}
          />
        </Field>
        <Field label="Checked on">
          <input
            className={s.input}
            type="date"
            value={form.source_checked_on}
            onChange={(e) => set({ source_checked_on: e.target.value })}
          />
        </Field>
      </Row>
    </Modal>
  );
}

/**
 * Hide or show a record on Cura Website, or delete it for good. `path` is the
 * record's admin path. Delete asks for a second click; the API refuses it while
 * anything still refers to the record and says why. Also used by CatalogPanel.
 */
export function RecordActions({
  path,
  hidden,
  label,
  onHiddenChange,
  onDeleted,
}: {
  path: string;
  hidden: boolean;
  label: string;
  onHiddenChange: (hidden: boolean) => void;
  onDeleted: () => void;
}) {
  const { http } = useServices();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleHidden = async () => {
    setBusy(true);
    setError(null);
    const result = await http.request<{ hidden: boolean }>(`${path}/hidden`, {
      method: 'PATCH',
      body: { hidden: !hidden },
      retry: false,
    });
    setBusy(false);
    if (result.ok) onHiddenChange(result.value.hidden);
    else setError(result.error.message);
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await http.request(path, { method: 'DELETE', retry: false });
    setBusy(false);
    if (result.ok) {
      onDeleted();
    } else {
      setError(result.error.message);
      setConfirming(false);
    }
  };

  return (
    <div className={a.recordBox}>
      <div className={a.recordHead}>
        <p>{hidden ? `Hidden. Patients can't see this ${label}.` : 'Visible to patients.'}</p>
        <div className={a.recordButtons}>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => void toggleHidden()}>
            {hidden ? 'Show on site' : 'Hide from site'}
          </button>
          <button
            type="button"
            className={a.danger}
            data-confirming={confirming || undefined}
            disabled={busy}
            onClick={() => void remove()}
          >
            {confirming ? 'Click again to delete for good' : 'Delete'}
          </button>
        </div>
      </div>
      {confirming && !busy && (
        <p className={s.muted}>
          Deleting can't be undone. Hide it instead if it might come back.{' '}
          <button type="button" className={s.linkButton} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </p>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
