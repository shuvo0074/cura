import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Field, Loading, Modal, ModalActions, Panel, Row, uiStyles as s, useResource } from '../../../ui';
import { ImageUpload, imageSrc } from './admin-kit';
import {
  ALL_DAY,
  COMMON_TESTS,
  FACILITIES,
  HOSPITAL_TYPES,
  PAYMENT_METHODS,
  SERVICE_GROUPS,
  TEST_CATEGORIES,
  typeLabel,
} from './data/hospital-catalogue';
import { DIVISIONS, districtsFor } from './data/divisions-hospitals';
import h from './HospitalsPanel.module.css';

const BASE = '/directory/admin/hospitals';

// -- API shapes ---------------------------------------------------------------

interface Beds {
  general: number | null;
  cabin: number | null;
  icu: number | null;
}

interface ServiceHours {
  key: string;
  hours: string | null;
}

interface TestPrice {
  name: string;
  category: string;
  price: number | null;
  source_url?: string | null;
  source_checked_on?: string | null;
  source_test_name?: string | null;
}

/** A hospital or diagnostic centre as the admin API returns it (the list leaves out test prices). */
export interface HospitalRecord {
  id: string;
  name: string;
  location: string;
  division: string | null;
  address: string | null;
  hotline: string | null;
  photo: string | null;
  website: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  source_url: string | null;
  verified_on: string | null;
  type: string | null;
  opening_hours: string | null;
  visiting_hours: string | null;
  beds: Partial<Beds> | null;
  services: ServiceHours[] | null;
  facilities: string[] | null;
  payment_methods: string[] | null;
  tests?: TestPrice[] | null;
  hidden: boolean;
}

// -- Form state ---------------------------------------------------------------

interface TestRow {
  name: string;
  category: string;
  price: number | '';
  /** Present (even empty) while the source link row is shown. */
  source_url?: string;
  source_checked_on?: string;
  source_test_name?: string;
}

/** The form uses the API's field names, so it is sent as the request body. */
export interface HospitalForm {
  name: string;
  location: string;
  division: string;
  address: string;
  hotline: string;
  photo: string;
  website: string;
  description: string;
  lat: string;
  lng: string;
  source_url: string;
  verified_on: string;
  type: string;
  opening_hours: string;
  visiting_hours: string;
  beds: Beds | null;
  services: { key: string; hours: string }[];
  facilities: string[];
  payment_methods: string[];
  tests: TestRow[];
}

const BLANK: HospitalForm = {
  name: '',
  location: '',
  division: '',
  address: '',
  hotline: '',
  photo: '',
  website: '',
  description: '',
  lat: '',
  lng: '',
  source_url: '',
  verified_on: '',
  type: 'hospital',
  opening_hours: '',
  visiting_hours: '',
  beds: null,
  services: [],
  facilities: [],
  payment_methods: ['cash'],
  tests: [],
};

export function toForm(record: HospitalRecord): HospitalForm {
  return {
    name: record.name ?? '',
    location: record.location ?? '',
    division: record.division ?? '',
    address: record.address ?? '',
    hotline: record.hotline ?? '',
    photo: record.photo ?? '',
    website: record.website ?? '',
    description: record.description ?? '',
    lat: record.lat == null ? '' : String(record.lat),
    lng: record.lng == null ? '' : String(record.lng),
    source_url: record.source_url ?? '',
    verified_on: record.verified_on ?? '',
    type: record.type ?? '',
    opening_hours: record.opening_hours ?? '',
    visiting_hours: record.visiting_hours ?? '',
    beds: record.beds
      ? { general: record.beds.general ?? null, cabin: record.beds.cabin ?? null, icu: record.beds.icu ?? null }
      : null,
    services: (record.services ?? []).map((service) => ({ key: service.key, hours: service.hours ?? '' })),
    facilities: record.facilities ?? [],
    payment_methods: record.payment_methods ?? [],
    tests: (record.tests ?? []).map((test) => {
      const row: TestRow = { name: test.name, category: test.category, price: test.price ?? '' };
      if (test.source_url != null) {
        row.source_url = test.source_url;
        row.source_checked_on = test.source_checked_on ?? '';
        row.source_test_name = test.source_test_name ?? '';
      }
      return row;
    }),
  };
}

const toggled = (list: readonly string[], key: string): string[] =>
  list.includes(key) ? list.filter((item) => item !== key) : [...list, key];

// -- List -----------------------------------------------------------------------

type Visibility = 'all' | 'visible' | 'hidden';
type Editing = { id: null } | { id: string; notice?: string };

/** Hospitals and diagnostic centres patients find on Cura Website. */
export function HospitalsPanel() {
  const { data, error, loading, reload } = useResource<HospitalRecord[]>(BASE, {});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [type, setType] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');

  const districts = useMemo(() => districtsFor(division ? [division] : []), [division]);

  const all = data ?? [];
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((place) => {
      if (query && !place.name.toLowerCase().includes(query)) return false;
      if (visibility !== 'all' && place.hidden !== (visibility === 'hidden')) return false;
      if (type && place.type !== type) return false;
      if (division && place.division !== division) return false;
      if (district && place.location !== district) return false;
      return true;
    });
  }, [all, search, visibility, type, division, district]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const filtering = Boolean(search || visibility !== 'all' || type || division || district);
  const clear = () => {
    setSearch('');
    setVisibility('all');
    setType('');
    setDivision('');
    setDistrict('');
  };

  return (
    <Panel
      title="Hospitals and diagnostic centres"
      description="Places patients find on Cura Website. Click a row to edit it."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing({ id: null })}>
          Add place
        </button>
      }
    >
      <div className={h.toolbar}>
        <input
          className={s.input}
          type="search"
          placeholder="Search by name"
          aria-label="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={s.input} aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {HOSPITAL_TYPES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={s.input}
          aria-label="Division"
          value={division}
          onChange={(e) => {
            const next = e.target.value;
            setDivision(next);
            // A district outside the new division would silently hide every row.
            if (district && !districtsFor(next ? [next] : []).includes(district)) setDistrict('');
          }}
        >
          <option value="">All divisions</option>
          {DIVISIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select className={s.input} aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">All districts</option>
          {districts.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className={s.filters}>
        {(['all', 'visible', 'hidden'] as const).map((value) => (
          <button
            key={value}
            type="button"
            data-active={visibility === value || undefined}
            onClick={() => setVisibility(value)}
          >
            {value === 'all' ? 'All' : value === 'visible' ? 'Visible' : 'Hidden'}
          </button>
        ))}
      </div>
      <p className={s.muted}>
        Showing {shown.length} of {all.length}.{' '}
        {filtering && (
          <button type="button" className={s.linkButton} onClick={clear}>
            Clear filters
          </button>
        )}
      </p>

      {shown.length === 0 ? (
        <p className={s.muted}>{all.length ? 'No places match these filters.' : 'No places added yet.'}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th aria-label="Photo" />
              <th>Name</th>
              <th>Type</th>
              <th>Location</th>
              <th>Division</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((place) => (
              <tr key={place.id} className={h.clickRow} data-hidden={place.hidden || undefined} onClick={() => setEditing({ id: place.id })}>
                <td>
                  <Thumb photo={place.photo} />
                </td>
                <td>
                  {place.name}
                  {place.hidden && <span className={h.hiddenTag}>Hidden</span>}
                </td>
                <td>{typeLabel(place.type)}</td>
                <td>{place.location}</td>
                <td className={s.mutedCell}>{place.division ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className={s.linkButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ id: place.id });
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing &&
        (editing.id === null ? (
          <HospitalModal
            key="new"
            id={null}
            initial={BLANK}
            hidden={false}
            onClose={() => setEditing(null)}
            onChanged={() => void reload()}
            onCreatedWithoutPhoto={(id, notice) => setEditing({ id, notice })}
          />
        ) : (
          <HospitalLoader
            key={editing.id}
            id={editing.id}
            notice={'notice' in editing ? editing.notice : undefined}
            onClose={() => setEditing(null)}
            onChanged={() => void reload()}
          />
        ))}
    </Panel>
  );
}

function Thumb({ photo }: { photo: string | null }) {
  const src = imageSrc(photo);
  return src ? <img className={h.thumb} src={src} alt="" /> : <span className={h.thumb} aria-hidden="true" />;
}

// -- Edit dialog ----------------------------------------------------------------

/** The list leaves out test prices, so editing loads the full record; otherwise saving would wipe them. */
function HospitalLoader({
  id,
  notice,
  onClose,
  onChanged,
}: {
  id: string;
  notice: string | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, error, loading } = useResource<HospitalRecord>(`${BASE}/${id}`, {});

  if (!data) {
    return (
      <Modal title="Edit place" onClose={onClose} wide>
        {loading ? <Loading /> : <Failed message={error ?? 'Could not load this place.'} />}
      </Modal>
    );
  }
  return (
    <HospitalModal
      id={id}
      initial={toForm(data)}
      hidden={data.hidden}
      notice={notice}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function HospitalModal({
  id,
  initial,
  hidden: initialHidden,
  notice,
  onClose,
  onChanged,
  onCreatedWithoutPhoto,
}: {
  id: string | null;
  initial: HospitalForm;
  hidden: boolean;
  notice?: string | undefined;
  onClose: () => void;
  onChanged: () => void;
  onCreatedWithoutPhoto?: (id: string, notice: string) => void;
}) {
  const { http } = useServices();
  const [form, setForm] = useState<HospitalForm>(initial);
  const [hidden, setHidden] = useState(initialHidden);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  const set = (patch: Partial<HospitalForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    setBusy(true);
    setError(null);
    if (id) {
      const result = await http.request<HospitalRecord>(`${BASE}/${id}`, { method: 'PATCH', body: form, retry: false });
      setBusy(false);
      if (!result.ok) return setError(result.error.message);
      onChanged();
      onClose();
      return;
    }

    const created = await http.request<HospitalRecord>(BASE, { method: 'POST', body: form, retry: false });
    if (!created.ok) {
      setBusy(false);
      return setError(created.error.message);
    }
    if (pendingPhoto) {
      const body = new FormData();
      body.append('photo', pendingPhoto);
      const uploaded = await http.request<{ photo: string }>(`${BASE}/${created.value.id}/photo`, {
        method: 'POST',
        body,
        retry: false,
      });
      if (!uploaded.ok) {
        // The place is saved; reopen it so the photo can be tried again.
        setBusy(false);
        onChanged();
        onCreatedWithoutPhoto?.(created.value.id, `Place saved, but the photo did not upload: ${uploaded.error.message}`);
        return;
      }
    }
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <Modal
      title={id ? `Edit ${initial.name || 'place'}` : 'Add place'}
      onClose={onClose}
      wide
      footer={<ModalActions error={error} busy={busy} onCancel={onClose} onSave={() => void save()} />}
    >
      {id && (
        <RecordActions
          id={id}
          hidden={hidden}
          onHidden={(next) => {
            setHidden(next);
            onChanged();
          }}
          onDeleted={() => {
            onChanged();
            onClose();
          }}
        />
      )}

      <PhotoField
        id={id}
        photo={form.photo}
        pending={pendingPhoto}
        onPending={setPendingPhoto}
        onPhoto={(photo) => set({ photo })}
      />

      <Field label="Name" required>
        <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label="City or location" required>
          <input className={s.input} value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Division">
          <select className={s.input} value={form.division} onChange={(e) => set({ division: e.target.value })}>
            <option value="">No division</option>
            {DIVISIONS.map((name) => (
              <option key={name} value={name}>
                {name} Division
              </option>
            ))}
          </select>
        </Field>
      </Row>
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
      <Row cols={2}>
        <Field label="Latitude">
          <input
            className={s.input}
            type="number"
            step="any"
            min={-90}
            max={90}
            placeholder="e.g. 23.7465"
            value={form.lat}
            onChange={(e) => set({ lat: e.target.value })}
          />
        </Field>
        <Field label="Longitude">
          <input
            className={s.input}
            type="number"
            step="any"
            min={-180}
            max={180}
            placeholder="e.g. 90.3760"
            value={form.lng}
            onChange={(e) => set({ lng: e.target.value })}
          />
        </Field>
      </Row>
      <p className={s.muted}>
        Without latitude and longitude, the place is not shown on the home page map. In Google Maps, right-click the
        building and click the numbers to copy them.
      </p>
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
            value={form.verified_on}
            onChange={(e) => set({ verified_on: e.target.value })}
          />
        </Field>
      </Row>

      <ExtrasFields form={form} set={set} />
    </Modal>
  );
}

// -- Hide, show and delete ------------------------------------------------------

function RecordActions({
  id,
  hidden,
  onHidden,
  onDeleted,
}: {
  id: string;
  hidden: boolean;
  onHidden: (hidden: boolean) => void;
  onDeleted: () => void;
}) {
  const { http } = useServices();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleHidden = async () => {
    setBusy(true);
    setError(null);
    const result = await http.request<{ hidden?: boolean }>(`${BASE}/${id}/hidden`, {
      method: 'PATCH',
      body: { hidden: !hidden },
      retry: false,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    onHidden(result.value.hidden ?? !hidden);
  };

  const remove = async () => {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setError(null);
    const result = await http.request(`${BASE}/${id}`, { method: 'DELETE', retry: false });
    setBusy(false);
    if (!result.ok) {
      // The API refuses while doctors still list this place, and says so.
      setConfirming(false);
      return setError(result.error.message);
    }
    onDeleted();
  };

  return (
    <div className={h.recordBox}>
      <div className={h.recordHead}>
        <span>
          {hidden ? (
            <>
              <strong className={h.warn}>Hidden.</strong> Patients cannot see this place.
            </>
          ) : (
            'Visible to patients.'
          )}
        </span>
        <span className={h.recordButtons}>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => void toggleHidden()}>
            {hidden ? 'Show on site' : 'Hide from site'}
          </button>
          <button
            type="button"
            className={confirming ? h.dangerSolid : h.dangerOutline}
            disabled={busy}
            onClick={() => void remove()}
          >
            {confirming ? 'Click again to delete' : 'Delete'}
          </button>
        </span>
      </div>
      {confirming && !busy && (
        <p className={s.muted}>
          Deleting cannot be undone. Hide it instead if it might come back.{' '}
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

// -- Photo ----------------------------------------------------------------------

/** Editing uploads at once; adding keeps the file until the place has been created. */
function PhotoField({
  id,
  photo,
  pending,
  onPending,
  onPhoto,
}: {
  id: string | null;
  photo: string;
  pending: File | null;
  onPending: (file: File | null) => void;
  onPhoto: (photo: string) => void;
}) {
  const { http } = useServices();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const src = preview ?? imageSrc(photo);

  const remove = async () => {
    setError(null);
    if (!id) {
      onPending(null);
      return;
    }
    setBusy(true);
    const result = await http.request(`${BASE}/${id}/photo`, { method: 'DELETE', retry: false });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    onPhoto('');
  };

  return (
    <div className={s.logoRow}>
      <div className={h.photo}>{src ? <img src={src} alt="" /> : 'No photo'}</div>
      <div>
        <span className={s.fieldLabel}>Photo{pending ? ' (uploads when you save)' : ''}</span>
        <div className={h.photoButtons}>
          {id ? (
            <ImageUpload path={`${BASE}/${id}/photo`} label={src ? 'Change photo' : 'Upload photo'} onUploaded={onPhoto} />
          ) : (
            <>
              <input
                ref={picker}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onPending(file);
                }}
              />
              <button type="button" className={s.secondary} onClick={() => picker.current?.click()}>
                {src ? 'Change photo' : 'Choose photo'}
              </button>
            </>
          )}
          {src && (
            <button type="button" className={s.linkDanger} disabled={busy} onClick={() => void remove()}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// -- Type, hours, beds, services, facilities, payment and test prices -----------

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={h.section}>
      <h4 className={s.subtitle}>{title}</h4>
      {hint && <p className={s.hint}>{hint}</p>}
      {children}
    </section>
  );
}

/** Hours text with a 24/7 shortcut; stores '24/7' or the typed text. */
function HoursInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const allDay = value === ALL_DAY;
  return (
    <div className={h.hours}>
      <input
        className={s.input}
        aria-label={label}
        value={allDay ? '' : value}
        disabled={allDay}
        placeholder={allDay ? 'Open 24/7' : placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className={h.inlineCheck}>
        <input type="checkbox" checked={allDay} onChange={(e) => onChange(e.target.checked ? ALL_DAY : '')} />
        24/7
      </label>
    </div>
  );
}

const BED_KINDS: readonly { key: keyof Beds; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'cabin', label: 'Cabins' },
  { key: 'icu', label: 'ICU' },
];

/**
 * Hours, beds, services, facilities, payment and test prices. Also used by a
 * hospital owner's My Hospital screen (`forOwner`), which cannot change the type.
 */
export function ExtrasFields({
  form,
  set,
  forOwner = false,
}: {
  form: HospitalForm;
  set: (patch: Partial<HospitalForm>) => void;
  forOwner?: boolean;
}) {
  const offered = new Map(form.services.map((service) => [service.key, service]));
  const beds: Beds = form.beds ?? { general: null, cabin: null, icu: null };

  const toggleService = (key: string) =>
    set({
      services: offered.has(key)
        ? form.services.filter((service) => service.key !== key)
        : [...form.services, { key, hours: '' }],
    });
  const serviceHours = (key: string, hours: string) =>
    set({ services: form.services.map((service) => (service.key === key ? { ...service, hours } : service)) });

  const setTest = (index: number, next: TestRow) =>
    set({ tests: form.tests.map((test, i) => (i === index ? next : test)) });
  const dropSource = (test: TestRow): TestRow => ({ name: test.name, category: test.category, price: test.price });

  return (
    <>
      <Section title={forOwner ? 'Hours' : 'Type and hours'}>
        <Row cols={2}>
          {!forOwner && (
            <Field label="Type">
              <select className={s.input} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="">Not set</option>
                {HOSPITAL_TYPES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className={s.field}>
            <span className={s.fieldLabel}>Opening hours</span>
            <HoursInput
              label="Opening hours"
              value={form.opening_hours}
              onChange={(opening_hours) => set({ opening_hours })}
              placeholder="Sat – Thu, 9:00 AM – 10:00 PM"
            />
          </div>
        </Row>
        <Field label="Visiting hours (inpatients)">
          <input
            className={s.input}
            placeholder="11:00 AM – 1:00 PM, 5:00 PM – 7:00 PM"
            value={form.visiting_hours}
            onChange={(e) => set({ visiting_hours: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Beds" hint="Leave empty for outpatient-only places.">
        <Row cols={3}>
          {BED_KINDS.map((kind) => (
            <Field key={kind.key} label={kind.label}>
              <input
                className={s.input}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={beds[kind.key] ?? ''}
                onChange={(e) =>
                  set({ beds: { ...beds, [kind.key]: e.target.value === '' ? null : Number(e.target.value) } })
                }
              />
            </Field>
          ))}
        </Row>
      </Section>

      <Section title="Services" hint="Tick what is offered here, then add its hours.">
        {SERVICE_GROUPS.map((group) => (
          <div key={group.key} className={h.group}>
            <p className={h.groupLabel}>{group.label}</p>
            {group.services.map((service) => {
              const on = offered.get(service.key);
              return (
                <div key={service.key} className={h.serviceRow}>
                  <Check label={service.label} checked={Boolean(on)} onChange={() => toggleService(service.key)} />
                  {on && (
                    <HoursInput
                      label={`${service.label} hours`}
                      value={on.hours}
                      onChange={(hours) => serviceHours(service.key, hours)}
                      placeholder="8:00 AM – 10:00 PM"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Section>

      <Section title="Facilities and payment">
        <p className={h.groupLabel}>Facilities</p>
        <div className={h.chips}>
          {FACILITIES.map((option) => (
            <Check
              key={option.key}
              label={option.label}
              checked={form.facilities.includes(option.key)}
              onChange={() => set({ facilities: toggled(form.facilities, option.key) })}
            />
          ))}
        </div>
        <p className={h.groupLabel}>Payment methods</p>
        <div className={h.chips}>
          {PAYMENT_METHODS.map((option) => (
            <Check
              key={option.key}
              label={option.label}
              checked={form.payment_methods.includes(option.key)}
              onChange={() => set({ payment_methods: toggled(form.payment_methods, option.key) })}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Test prices"
        hint={
          forOwner
            ? 'Prices in taka. Empty prices on common tests show a sample price, labelled as sample. ' +
              'Other empty prices show "Price not published". Rows without a name are ignored.'
            : 'Prices in taka. Add a source link for prices the centre publishes; the site links to it. ' +
              'Empty prices on common diagnostic tests show the sample price from the Sample prices tab, labelled as sample. ' +
              'Other empty prices show "Price not published". Rows without a name are ignored.'
        }
      >
        <datalist id="hospital-common-tests">
          {COMMON_TESTS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {form.tests.length > 0 && (
          <div className={`${h.testRow} ${h.testHead}`}>
            <span>Test</span>
            <span>Category</span>
            <span>Price (৳)</span>
            <span />
          </div>
        )}
        {form.tests.map((test, index) => (
          <div key={index} className={h.test}>
            <div className={h.testRow}>
              <input
                className={s.input}
                list="hospital-common-tests"
                aria-label="Test name"
                placeholder="Test name"
                value={test.name}
                onChange={(e) => setTest(index, { ...test, name: e.target.value })}
              />
              <select
                className={s.input}
                aria-label="Category"
                value={test.category}
                onChange={(e) => setTest(index, { ...test, category: e.target.value })}
              >
                {TEST_CATEGORIES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                className={s.input}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label="Price in taka"
                placeholder="0"
                value={test.price}
                onChange={(e) => setTest(index, { ...test, price: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <button
                type="button"
                className={s.iconButton}
                aria-label={`Remove ${test.name || 'test'}`}
                onClick={() => set({ tests: form.tests.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
            {test.source_url !== undefined ? (
              <div className={h.sourceRow}>
                <input
                  className={s.input}
                  type="url"
                  aria-label={`Source link for ${test.name || 'test'}`}
                  placeholder="Published at https://…"
                  value={test.source_url}
                  onChange={(e) => setTest(index, { ...test, source_url: e.target.value })}
                />
                <input
                  className={s.input}
                  type="date"
                  aria-label={`Source checked on for ${test.name || 'test'}`}
                  value={test.source_checked_on ?? ''}
                  onChange={(e) => setTest(index, { ...test, source_checked_on: e.target.value })}
                />
                <button type="button" className={s.linkDanger} onClick={() => setTest(index, dropSource(test))}>
                  Remove source
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={s.linkButton}
                onClick={() => setTest(index, { ...test, source_url: '' })}
              >
                Add source link
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={s.secondary}
          onClick={() => set({ tests: [...form.tests, { name: '', category: 'blood', price: '' }] })}
        >
          Add test
        </button>
      </Section>
    </>
  );
}
