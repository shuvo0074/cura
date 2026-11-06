import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useServices } from '../../../app/services';
import { useT } from '../../../i18n';
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
  catalogueLabel,
  typeLabel,
} from './data/hospital-catalogue';
import { DIVISIONS, districtLabel, districtsFor, divisionLabel } from './data/divisions-hospitals';
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
  const { t } = useT();
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
      title={t('admin.hospitals.title')}
      description={t('admin.hospitals.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing({ id: null })}>
          {t('admin.hospitals.add')}
        </button>
      }
    >
      <div className={h.toolbar}>
        <input
          className={s.input}
          type="search"
          placeholder={t('admin.hospitals.searchByName')}
          aria-label={t('admin.hospitals.searchByName')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={s.input} aria-label={t('admin.hospitals.type')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('admin.hospitals.allTypes')}</option>
          {HOSPITAL_TYPES.map((option) => (
            <option key={option.key} value={option.key}>
              {catalogueLabel(t, 'type', option.key)}
            </option>
          ))}
        </select>
        <select
          className={s.input}
          aria-label={t('admin.hospitals.division')}
          value={division}
          onChange={(e) => {
            const next = e.target.value;
            setDivision(next);
            // A district outside the new division would silently hide every row.
            if (district && !districtsFor(next ? [next] : []).includes(district)) setDistrict('');
          }}
        >
          <option value="">{t('admin.hospitals.allDivisions')}</option>
          {DIVISIONS.map((name) => (
            <option key={name} value={name}>
              {divisionLabel(t, name)}
            </option>
          ))}
        </select>
        <select className={s.input} aria-label={t('admin.hospitals.district')} value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">{t('admin.hospitals.allDistricts')}</option>
          {districts.map((name) => (
            <option key={name} value={name}>
              {districtLabel(t, name)}
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
            {t(`admin.hospitals.filter.${value}`)}
          </button>
        ))}
      </div>
      <p className={s.muted}>
        {t('admin.hospitals.showing', { shown: shown.length, total: all.length })}{' '}
        {filtering && (
          <button type="button" className={s.linkButton} onClick={clear}>
            {t('admin.hospitals.clearFilters')}
          </button>
        )}
      </p>

      {shown.length === 0 ? (
        <p className={s.muted}>{all.length ? t('admin.hospitals.noMatch') : t('admin.hospitals.none')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th aria-label={t('admin.hospitals.col.photo')} />
              <th>{t('admin.hospitals.col.name')}</th>
              <th>{t('admin.hospitals.col.type')}</th>
              <th>{t('admin.hospitals.col.location')}</th>
              <th>{t('admin.hospitals.col.division')}</th>
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
                  {place.hidden && <span className={h.hiddenTag}>{t('admin.hospitals.hiddenTag')}</span>}
                </td>
                <td>{typeLabel(t, place.type)}</td>
                <td>{districtLabel(t, place.location)}</td>
                <td className={s.mutedCell}>{place.division ? divisionLabel(t, place.division) : '—'}</td>
                <td>
                  <button
                    type="button"
                    className={s.linkButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ id: place.id });
                    }}
                  >
                    {t('common.edit')}
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
  const { t } = useT();
  const { data, error, loading } = useResource<HospitalRecord>(`${BASE}/${id}`, {});

  if (!data) {
    return (
      <Modal title={t('admin.hospitals.editPlace')} onClose={onClose} wide>
        {loading ? <Loading /> : <Failed message={error ?? t('admin.hospitals.loadFailed')} />}
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
  const { t, tm } = useT();
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
        onCreatedWithoutPhoto?.(
          created.value.id,
          t('admin.hospitals.photoUploadFailed', { message: tm(uploaded.error.message) }),
        );
        return;
      }
    }
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <Modal
      title={
        id
          ? initial.name
            ? t('admin.hospitals.editNamed', { name: initial.name })
            : t('admin.hospitals.editPlace')
          : t('admin.hospitals.add')
      }
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

      <Field label={t('admin.hospitals.name')} required>
        <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.hospitals.location')} required>
          <input className={s.input} value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label={t('admin.hospitals.division')}>
          <select className={s.input} value={form.division} onChange={(e) => set({ division: e.target.value })}>
            <option value="">{t('admin.hospitals.noDivision')}</option>
            {DIVISIONS.map((name) => (
              <option key={name} value={name}>
                {t('admin.hospitals.divisionOption', { name: divisionLabel(t, name) })}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Field label={t('admin.hospitals.address')}>
        <input className={s.input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.hospitals.hotline')}>
          <input className={s.input} value={form.hotline} onChange={(e) => set({ hotline: e.target.value })} />
        </Field>
        <Field label={t('admin.hospitals.website')}>
          <input className={s.input} value={form.website} onChange={(e) => set({ website: e.target.value })} />
        </Field>
      </Row>
      <Field label={t('admin.hospitals.descriptionField')}>
        <textarea
          className={s.textarea}
          rows={3}
          placeholder={t('admin.hospitals.descriptionPlaceholder')}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.hospitals.latitude')}>
          <input
            className={s.input}
            type="number"
            step="any"
            min={-90}
            max={90}
            placeholder={t('admin.hospitals.latPlaceholder')}
            value={form.lat}
            onChange={(e) => set({ lat: e.target.value })}
          />
        </Field>
        <Field label={t('admin.hospitals.longitude')}>
          <input
            className={s.input}
            type="number"
            step="any"
            min={-180}
            max={180}
            placeholder={t('admin.hospitals.lngPlaceholder')}
            value={form.lng}
            onChange={(e) => set({ lng: e.target.value })}
          />
        </Field>
      </Row>
      <p className={s.muted}>{t('admin.hospitals.mapHint')}</p>
      <Row cols={2}>
        <Field label={t('admin.hospitals.sourceLink')}>
          <input
            className={s.input}
            type="url"
            placeholder="https://…"
            value={form.source_url}
            onChange={(e) => set({ source_url: e.target.value })}
          />
        </Field>
        <Field label={t('admin.hospitals.checkedOn')}>
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
  const { t, tm } = useT();
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
              <strong className={h.warn}>{t('admin.hospitals.hiddenLabel')}</strong> {t('admin.hospitals.hiddenNote')}
            </>
          ) : (
            t('admin.hospitals.visibleNote')
          )}
        </span>
        <span className={h.recordButtons}>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => void toggleHidden()}>
            {hidden ? t('admin.hospitals.showOnSite') : t('admin.hospitals.hideFromSite')}
          </button>
          <button
            type="button"
            className={confirming ? h.dangerSolid : h.dangerOutline}
            disabled={busy}
            onClick={() => void remove()}
          >
            {confirming ? t('admin.hospitals.confirmDelete') : t('common.delete')}
          </button>
        </span>
      </div>
      {confirming && !busy && (
        <p className={s.muted}>
          {t('admin.hospitals.deleteWarning')}{' '}
          <button type="button" className={s.linkButton} onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>
        </p>
      )}
      {error && (
        <p className={s.error} role="alert">
          {tm(error)}
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
  const { t, tm } = useT();
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
      <div className={h.photo}>{src ? <img src={src} alt="" /> : t('admin.hospitals.noPhoto')}</div>
      <div>
        <span className={s.fieldLabel}>{pending ? t('admin.hospitals.photoPending') : t('admin.hospitals.photo')}</span>
        <div className={h.photoButtons}>
          {id ? (
            <ImageUpload path={`${BASE}/${id}/photo`} label={src ? t('admin.hospitals.changePhoto') : t('admin.hospitals.uploadPhoto')} onUploaded={onPhoto} />
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
                {src ? t('admin.hospitals.changePhoto') : t('admin.hospitals.choosePhoto')}
              </button>
            </>
          )}
          {src && (
            <button type="button" className={s.linkDanger} disabled={busy} onClick={() => void remove()}>
              {busy ? t('admin.hospitals.removing') : t('common.remove')}
            </button>
          )}
        </div>
        {error && (
          <p className={s.error} role="alert">
            {tm(error)}
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
  const { t } = useT();
  const allDay = value === ALL_DAY;
  return (
    <div className={h.hours}>
      <input
        className={s.input}
        aria-label={label}
        value={allDay ? '' : value}
        disabled={allDay}
        placeholder={allDay ? t('admin.hospitals.open24') : placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className={h.inlineCheck}>
        <input type="checkbox" checked={allDay} onChange={(e) => onChange(e.target.checked ? ALL_DAY : '')} />
        {t('admin.hospitals.allDay')}
      </label>
    </div>
  );
}

const BED_KINDS: readonly (keyof Beds)[] = ['general', 'cabin', 'icu'];

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
  const { t } = useT();
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
      <Section title={forOwner ? t('admin.hospitals.hours') : t('admin.hospitals.typeAndHours')}>
        <Row cols={2}>
          {!forOwner && (
            <Field label={t('admin.hospitals.type')}>
              <select className={s.input} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="">{t('admin.hospitals.notSet')}</option>
                {HOSPITAL_TYPES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {catalogueLabel(t, 'type', option.key)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className={s.field}>
            <span className={s.fieldLabel}>{t('admin.hospitals.openingHours')}</span>
            <HoursInput
              label={t('admin.hospitals.openingHours')}
              value={form.opening_hours}
              onChange={(opening_hours) => set({ opening_hours })}
              placeholder={t('admin.hospitals.openingHoursPlaceholder')}
            />
          </div>
        </Row>
        <Field label={t('admin.hospitals.visitingHours')}>
          <input
            className={s.input}
            placeholder={t('admin.hospitals.visitingHoursPlaceholder')}
            value={form.visiting_hours}
            onChange={(e) => set({ visiting_hours: e.target.value })}
          />
        </Field>
      </Section>

      <Section title={t('admin.hospitals.beds')} hint={t('admin.hospitals.bedsHint')}>
        <Row cols={3}>
          {BED_KINDS.map((kind) => (
            <Field key={kind} label={t(`admin.hospitals.bed.${kind}`)}>
              <input
                className={s.input}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={beds[kind] ?? ''}
                onChange={(e) =>
                  set({ beds: { ...beds, [kind]: e.target.value === '' ? null : Number(e.target.value) } })
                }
              />
            </Field>
          ))}
        </Row>
      </Section>

      <Section title={t('admin.hospitals.services')} hint={t('admin.hospitals.servicesHint')}>
        {SERVICE_GROUPS.map((group) => (
          <div key={group.key} className={h.group}>
            <p className={h.groupLabel}>{catalogueLabel(t, 'group', group.key)}</p>
            {group.services.map((service) => {
              const on = offered.get(service.key);
              const label = catalogueLabel(t, 'service', service.key);
              return (
                <div key={service.key} className={h.serviceRow}>
                  <Check label={label} checked={Boolean(on)} onChange={() => toggleService(service.key)} />
                  {on && (
                    <HoursInput
                      label={t('admin.hospitals.serviceHours', { service: label })}
                      value={on.hours}
                      onChange={(hours) => serviceHours(service.key, hours)}
                      placeholder={t('admin.hospitals.serviceHoursPlaceholder')}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Section>

      <Section title={t('admin.hospitals.facilitiesAndPayment')}>
        <p className={h.groupLabel}>{t('admin.hospitals.facilities')}</p>
        <div className={h.chips}>
          {FACILITIES.map((option) => (
            <Check
              key={option.key}
              label={catalogueLabel(t, 'facility', option.key)}
              checked={form.facilities.includes(option.key)}
              onChange={() => set({ facilities: toggled(form.facilities, option.key) })}
            />
          ))}
        </div>
        <p className={h.groupLabel}>{t('admin.hospitals.paymentMethods')}</p>
        <div className={h.chips}>
          {PAYMENT_METHODS.map((option) => (
            <Check
              key={option.key}
              label={catalogueLabel(t, 'payment', option.key)}
              checked={form.payment_methods.includes(option.key)}
              onChange={() => set({ payment_methods: toggled(form.payment_methods, option.key) })}
            />
          ))}
        </div>
      </Section>

      <Section
        title={t('admin.hospitals.testPrices')}
        hint={forOwner ? t('admin.hospitals.testPricesHintOwner') : t('admin.hospitals.testPricesHint')}
      >
        <datalist id="hospital-common-tests">
          {COMMON_TESTS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {form.tests.length > 0 && (
          <div className={`${h.testRow} ${h.testHead}`}>
            <span>{t('admin.hospitals.col.test')}</span>
            <span>{t('admin.hospitals.col.category')}</span>
            <span>{t('admin.hospitals.col.price')}</span>
            <span />
          </div>
        )}
        {form.tests.map((test, index) => (
          <div key={index} className={h.test}>
            <div className={h.testRow}>
              <input
                className={s.input}
                list="hospital-common-tests"
                aria-label={t('admin.hospitals.testName')}
                placeholder={t('admin.hospitals.testName')}
                value={test.name}
                onChange={(e) => setTest(index, { ...test, name: e.target.value })}
              />
              <select
                className={s.input}
                aria-label={t('admin.hospitals.category')}
                value={test.category}
                onChange={(e) => setTest(index, { ...test, category: e.target.value })}
              >
                {TEST_CATEGORIES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {catalogueLabel(t, 'testCategory', option.key)}
                  </option>
                ))}
              </select>
              <input
                className={s.input}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label={t('admin.hospitals.priceInTaka')}
                placeholder="0"
                value={test.price}
                onChange={(e) => setTest(index, { ...test, price: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <button
                type="button"
                className={s.iconButton}
                aria-label={t('admin.hospitals.removeTest', { name: test.name || t('admin.hospitals.test') })}
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
                  aria-label={t('admin.hospitals.sourceLinkFor', { name: test.name || t('admin.hospitals.test') })}
                  placeholder={t('admin.hospitals.sourcePlaceholder')}
                  value={test.source_url}
                  onChange={(e) => setTest(index, { ...test, source_url: e.target.value })}
                />
                <input
                  className={s.input}
                  type="date"
                  aria-label={t('admin.hospitals.sourceCheckedFor', { name: test.name || t('admin.hospitals.test') })}
                  value={test.source_checked_on ?? ''}
                  onChange={(e) => setTest(index, { ...test, source_checked_on: e.target.value })}
                />
                <button type="button" className={s.linkDanger} onClick={() => setTest(index, dropSource(test))}>
                  {t('admin.hospitals.removeSource')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={s.linkButton}
                onClick={() => setTest(index, { ...test, source_url: '' })}
              >
                {t('admin.hospitals.addSource')}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={s.secondary}
          onClick={() => set({ tests: [...form.tests, { name: '', category: 'blood', price: '' }] })}
        >
          {t('admin.hospitals.addTest')}
        </button>
      </Section>
    </>
  );
}
