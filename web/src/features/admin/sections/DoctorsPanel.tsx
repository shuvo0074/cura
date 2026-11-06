import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useServices } from '../../../app/services';
import { useT, type TranslationKey, type UseT } from '../../../i18n';
import { Failed, Field, Loading, Modal, ModalActions, Panel, Row, uiStyles as s, useResource } from '../../../ui';
import { ImageUpload, fromList, imageSrc } from './admin-kit';
import { DIVISIONS, districtLabel, districtsFor, divisionLabel } from './data/divisions-hospitals';
import d from './DoctorsPanel.module.css';

const BASE = '/directory/admin/doctors';

// -- API shapes ---------------------------------------------------------------

/** One chamber session. Keys the form does not show are kept as they came. */
interface ChamberEntry {
  hospital_id?: string | undefined;
  venue?: string;
  time?: string;
  address?: string;
  phone?: string;
  note?: string;
  [key: string]: unknown;
}

/** A doctor listing as the admin API returns it. */
interface DoctorRecord {
  id: string;
  name: string;
  gender: string | null;
  gender_is_demo?: boolean | null;
  specialty: string;
  department: string | null;
  experience: string | null;
  chamber: string | null;
  fees: number | string | null;
  followup_fees: number | string | null;
  workplace: string | null;
  city: string | null;
  division: string | null;
  hospital_id: string | null;
  hospital_name?: string | null;
  phone: string | null;
  photo: string | null;
  rating: number | string | null;
  about: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  source_url: string | null;
  verified_on: string | null;
  bmdc_no: string | null;
  education: string | null;
  languages: string | null;
  consulting_hours: string | null;
  address: string | null;
  clinical_expertise: string[] | null;
  treatments: string[] | null;
  weekly_schedule: ChamberEntry[] | null;
  hidden: boolean;
}

interface HospitalOption {
  id: string;
  name: string;
  address: string | null;
  hotline: string | null;
  hidden: boolean;
}

interface SpecialtyOption {
  id: string;
  name: string;
}

// -- Form state ---------------------------------------------------------------

/** The form uses the API's body field names, so it is sent as the request body. */
interface DoctorForm {
  name: string;
  gender: string;
  specialty: string;
  department: string;
  experience: string;
  chamber: string;
  fees: string;
  followupFees: string;
  workplace: string;
  city: string;
  division: string;
  hospitalId: string;
  phone: string;
  photo: string;
  rating: string;
  about: string;
  website: string;
  bmdcNo: string;
  education: string;
  languages: string;
  consultingHours: string;
  address: string;
  clinicalExpertise: string;
  treatments: string;
  weeklySchedule: ChamberEntry[];
  lat: string;
  lng: string;
  source_url: string;
  verified_on: string;
}

const BLANK: DoctorForm = {
  name: '',
  gender: '',
  specialty: '',
  department: '',
  experience: '',
  chamber: '',
  fees: '',
  followupFees: '300',
  workplace: '',
  city: '',
  division: '',
  hospitalId: '',
  phone: '',
  photo: '',
  rating: '',
  about: '',
  website: '',
  bmdcNo: '',
  education: '',
  languages: '',
  consultingHours: '',
  address: '',
  clinicalExpertise: '',
  treatments: '',
  weeklySchedule: [],
  lat: '',
  lng: '',
  source_url: '',
  verified_on: '',
};

const str = (value: string | number | null | undefined): string => (value == null ? '' : String(value));

/** Every field goes back on save: the API's PATCH is a full replace. */
function toForm(record: DoctorRecord): DoctorForm {
  return {
    name: record.name ?? '',
    gender: record.gender ?? '',
    specialty: record.specialty ?? '',
    department: str(record.department),
    experience: str(record.experience),
    chamber: str(record.chamber),
    fees: str(record.fees),
    followupFees: str(record.followup_fees),
    workplace: str(record.workplace),
    city: str(record.city),
    division: str(record.division),
    hospitalId: str(record.hospital_id),
    phone: str(record.phone),
    photo: str(record.photo),
    rating: str(record.rating),
    about: str(record.about),
    website: str(record.website),
    bmdcNo: str(record.bmdc_no),
    education: str(record.education),
    languages: str(record.languages),
    consultingHours: str(record.consulting_hours),
    address: str(record.address),
    clinicalExpertise: fromList(record.clinical_expertise),
    treatments: fromList(record.treatments),
    weeklySchedule: record.weekly_schedule ?? [],
    lat: str(record.lat),
    lng: str(record.lng),
    source_url: str(record.source_url),
    verified_on: str(record.verified_on),
  };
}

const genderLabel = (t: UseT['t'], gender: string | null): string =>
  gender === 'female'
    ? t('common.gender.FEMALE')
    : gender === 'male'
      ? t('common.gender.MALE')
      : t('admin.doctors.notSpecified');

/** Visibility filter values stay English; these are their labels. */
const VISIBILITY_LABELS: Record<string, TranslationKey> = {
  Visible: 'admin.doctors.visible',
  Hidden: 'admin.doctors.hidden',
};

const toggled = (list: readonly string[], item: string): string[] =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

// -- List -----------------------------------------------------------------------

interface Filters {
  visibility: string[];
  specialty: string[];
  division: string[];
  city: string[];
}

const NO_FILTERS: Filters = { visibility: [], specialty: [], division: [], city: [] };

type Editing = { record: null } | { record: DoctorRecord; notice?: string };

/** Doctor listings patients find on Cura Website. Each doctor is also a user account. */
export function DoctorsPanel() {
  const { t } = useT();
  const { data, error, loading, reload } = useResource<DoctorRecord[]>(BASE, {});
  const hospitals = useResource<HospitalOption[]>('/directory/admin/hospitals', {});
  const specialties = useResource<SpecialtyOption[]>('/directory/admin/specialties', {});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const all = useMemo(() => data ?? [], [data]);

  const specialtiesInUse = useMemo(
    () => [...new Set(all.map((doctor) => doctor.specialty).filter(Boolean))].sort(),
    [all],
  );
  // The Specialties list, plus any value a doctor still has that is not on it.
  const specialtyOptions = useMemo(
    () => [...new Set([...(specialties.data ?? []).map((entry) => entry.name), ...specialtiesInUse])].sort(),
    [specialties.data, specialtiesInUse],
  );
  const districts = useMemo(() => districtsFor(filters.division), [filters.division]);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((doctor) => {
      if (query && !doctor.name.toLowerCase().includes(query)) return false;
      if (filters.specialty.length && !filters.specialty.includes(doctor.specialty)) return false;
      if (filters.division.length && !filters.division.includes(doctor.division ?? '')) return false;
      if (filters.city.length && !filters.city.includes(doctor.city ?? '')) return false;
      if (filters.visibility.length && !filters.visibility.includes(doctor.hidden ? 'Hidden' : 'Visible')) return false;
      return true;
    });
  }, [all, search, filters]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const filtering = Boolean(
    search || filters.visibility.length || filters.specialty.length || filters.division.length || filters.city.length,
  );

  const toggleDivision = (division: string) =>
    setFilters((current) => {
      const next = toggled(current.division, division);
      // A district outside the chosen divisions would silently hide every row.
      const allowed = new Set(districtsFor(next));
      return { ...current, division: next, city: current.city.filter((city) => allowed.has(city)) };
    });

  return (
    <Panel
      title={t('admin.doctors.title')}
      description={t('admin.doctors.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing({ record: null })}>
          {t('admin.doctors.add')}
        </button>
      }
    >
      <div className={d.toolbar}>
        <input
          className={s.input}
          type="search"
          placeholder={t('admin.doctors.searchByName')}
          aria-label={t('admin.doctors.searchByName')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={d.filterGrid}>
        <FilterGroup
          title={t('admin.doctors.visibility')}
          items={['Visible', 'Hidden']}
          labelOf={(item) => (VISIBILITY_LABELS[item] ? t(VISIBILITY_LABELS[item]) : item)}
          selected={filters.visibility}
          onToggle={(value) => setFilters((current) => ({ ...current, visibility: toggled(current.visibility, value) }))}
        />
        <FilterGroup
          title={t('admin.doctors.specialty')}
          searchable
          items={specialtiesInUse}
          selected={filters.specialty}
          onToggle={(value) => setFilters((current) => ({ ...current, specialty: toggled(current.specialty, value) }))}
        />
        <FilterGroup
          title={t('admin.doctors.division')}
          items={DIVISIONS}
          labelOf={(item) => divisionLabel(t, item)}
          selected={filters.division}
          onToggle={toggleDivision}
        />
        <FilterGroup
          title={t('admin.doctors.district')}
          searchable
          labelOf={(item) => districtLabel(t, item)}
          items={districts}
          selected={filters.city}
          onToggle={(value) => setFilters((current) => ({ ...current, city: toggled(current.city, value) }))}
        />
      </div>
      <p className={s.muted}>
        {t('admin.doctors.showing', { shown: shown.length, total: all.length })}{' '}
        {filtering && (
          <button
            type="button"
            className={s.linkButton}
            onClick={() => {
              setSearch('');
              setFilters(NO_FILTERS);
            }}
          >
            {t('admin.doctors.clearFilters')}
          </button>
        )}
      </p>

      {shown.length === 0 ? (
        <p className={s.muted}>{all.length ? t('admin.doctors.noMatches') : t('admin.doctors.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th aria-label={t('admin.doctors.photo')} />
              <th>{t('admin.doctors.name')}</th>
              <th>{t('admin.doctors.specialty')}</th>
              <th>{t('admin.doctors.primaryHospital')}</th>
              <th>{t('admin.doctors.gender')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((doctor) => (
              <tr
                key={doctor.id}
                className={d.clickRow}
                data-hidden={doctor.hidden || undefined}
                onClick={() => setEditing({ record: doctor })}
              >
                <td>
                  <Thumb photo={doctor.photo} />
                </td>
                <td>
                  {doctor.name}
                  {doctor.hidden && <span className={d.tag}>{t('admin.doctors.hidden')}</span>}
                </td>
                <td>{doctor.specialty}</td>
                <td className={s.mutedCell}>{doctor.hospital_name || t('admin.doctors.noHospital')}</td>
                <td>
                  {genderLabel(t, doctor.gender)}
                  {doctor.gender_is_demo && <span className={s.staffMeta}>{t('admin.doctors.sampleData')}</span>}
                </td>
                <td>
                  <button
                    type="button"
                    className={s.linkButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ record: doctor });
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

      {editing && (
        <DoctorModal
          key={editing.record?.id ?? 'new'}
          record={editing.record}
          notice={'notice' in editing ? editing.notice : undefined}
          hospitals={hospitals.data ?? []}
          specialtyOptions={specialtyOptions}
          onClose={() => setEditing(null)}
          onChanged={() => void reload()}
          onCreatedWithoutPhoto={(record, notice) => setEditing({ record, notice })}
        />
      )}
    </Panel>
  );
}

function Thumb({ photo }: { photo: string | null }) {
  const src = imageSrc(photo);
  return src ? <img className={d.thumb} src={src} alt="" /> : <span className={d.thumb} aria-hidden="true" />;
}

/** A titled list of checkboxes, optionally with a search box. */
function FilterGroup({
  title,
  items,
  selected,
  onToggle,
  searchable,
  labelOf = (item) => item,
}: {
  title: string;
  items: readonly string[];
  selected: readonly string[];
  onToggle: (item: string) => void;
  searchable?: boolean;
  /** The shown label of a value; values themselves stay as stored. */
  labelOf?: (item: string) => string;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = items.filter(
    (item) => item.toLowerCase().includes(needle) || labelOf(item).toLowerCase().includes(needle),
  );
  return (
    <div className={d.filterGroup}>
      <p className={d.filterTitle}>{title}</p>
      {searchable && (
        <input
          className={s.input}
          type="search"
          placeholder={t('admin.doctors.searchIn', { title: title.toLowerCase() })}
          aria-label={t('admin.doctors.searchIn', { title: title.toLowerCase() })}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className={d.filterList}>
        {matches.map((item) => (
          <label key={item} className={d.filterItem}>
            <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} />
            {labelOf(item)}
          </label>
        ))}
        {matches.length === 0 && <span className={s.muted}>{t('admin.doctors.noFilterMatches')}</span>}
      </div>
    </div>
  );
}

// -- Add and edit dialog ----------------------------------------------------------

function DoctorModal({
  record,
  notice,
  hospitals,
  specialtyOptions,
  onClose,
  onChanged,
  onCreatedWithoutPhoto,
}: {
  record: DoctorRecord | null;
  notice: string | undefined;
  hospitals: HospitalOption[];
  specialtyOptions: string[];
  onClose: () => void;
  onChanged: () => void;
  onCreatedWithoutPhoto: (record: DoctorRecord, notice: string) => void;
}) {
  const { t, tm } = useT();
  const { http } = useServices();
  const id = record?.id ?? null;
  const [form, setForm] = useState<DoctorForm>(() => (record ? toForm(record) : BLANK));
  const [hidden, setHidden] = useState(record?.hidden ?? false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  const set = (patch: Partial<DoctorForm>) => setForm((current) => ({ ...current, ...patch }));
  const text = (key: keyof Omit<DoctorForm, 'weeklySchedule'>) => ({
    className: s.input,
    value: form[key],
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }),
  });

  const districtOptions = useMemo(() => districtsFor(form.division ? [form.division] : []), [form.division]);

  const save = async () => {
    setBusy(true);
    setError(null);
    if (id) {
      const result = await http.request<DoctorRecord>(`${BASE}/${id}`, { method: 'PATCH', body: form, retry: false });
      setBusy(false);
      if (!result.ok) return setError(result.error.message);
      onChanged();
      onClose();
      return;
    }

    const created = await http.request<DoctorRecord>(BASE, { method: 'POST', body: form, retry: false });
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
        // The doctor is saved; reopen it so the photo can be tried again.
        setBusy(false);
        onChanged();
        onCreatedWithoutPhoto(
          created.value,
          t('admin.doctors.photoUploadFailed', { error: tm(uploaded.error.message) }),
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
      title={record ? t('admin.doctors.editTitle', { name: record.name }) : t('admin.doctors.add')}
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
        onPhoto={(photo) => {
          set({ photo });
          onChanged();
        }}
      />

      <Row cols={2}>
        <Field label={t('admin.doctors.fullName')} required>
          <input {...text('name')} />
        </Field>
        <SpecialtySelect
          value={form.specialty}
          options={specialtyOptions}
          onChange={(specialty) => set({ specialty })}
        />
      </Row>
      <Row cols={2}>
        <Field
          label={t('admin.doctors.mobile')}
          required={!id}
          hint={id ? undefined : t('admin.doctors.mobileHint')}
        >
          <input {...text('phone')} type="tel" inputMode="tel" placeholder="01712345678" />
        </Field>
        <Field label={t('admin.doctors.gender')}>
          <select className={s.input} value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">{t('admin.doctors.notSpecified')}</option>
            <option value="female">{t('common.gender.FEMALE')}</option>
            <option value="male">{t('common.gender.MALE')}</option>
          </select>
        </Field>
      </Row>
      <Row cols={3}>
        <Field label={t('admin.doctors.department')}>
          <input {...text('department')} />
        </Field>
        <Field label={t('admin.doctors.experience')}>
          <input {...text('experience')} />
        </Field>
        <Field label={t('admin.doctors.workplace')}>
          <input {...text('workplace')} />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label={t('admin.doctors.chamber')}>
          <input {...text('chamber')} />
        </Field>
        <Field label={t('admin.doctors.fee')}>
          <input {...text('fees')} inputMode="numeric" />
        </Field>
        <Field label={t('admin.doctors.followupFee')}>
          <input {...text('followupFees')} inputMode="numeric" />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label={t('admin.doctors.bmdc')} hint={t('admin.doctors.bmdcHint')}>
          <input {...text('bmdcNo')} />
        </Field>
        <Field label={t('admin.doctors.rating')}>
          <input {...text('rating')} type="number" min={0} max={5} step={0.1} />
        </Field>
        <Field label={t('admin.doctors.website')}>
          <input {...text('website')} type="url" placeholder="https://…" />
        </Field>
      </Row>
      <Field label={t('admin.doctors.about')}>
        <textarea className={s.textarea} rows={3} value={form.about} onChange={(e) => set({ about: e.target.value })} />
      </Field>
      <Row cols={3}>
        <Field label={t('admin.doctors.education')}>
          <input {...text('education')} />
        </Field>
        <Field label={t('admin.doctors.languages')}>
          <input {...text('languages')} />
        </Field>
        <Field label={t('admin.doctors.consultingHours')}>
          <input {...text('consultingHours')} />
        </Field>
      </Row>
      <Field label={t('admin.doctors.address')}>
        <input {...text('address')} />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.doctors.clinicalExpertise')} hint={t('admin.doctors.commaHint')}>
          <input {...text('clinicalExpertise')} />
        </Field>
        <Field label={t('admin.doctors.treatments')} hint={t('admin.doctors.commaHint')}>
          <input {...text('treatments')} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.doctors.latitude')}>
          <input {...text('lat')} type="number" step="any" min={-90} max={90} placeholder={t('admin.doctors.latPlaceholder')} />
        </Field>
        <Field label={t('admin.doctors.longitude')}>
          <input {...text('lng')} type="number" step="any" min={-180} max={180} placeholder={t('admin.doctors.lngPlaceholder')} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.doctors.sourceLink')}>
          <input {...text('source_url')} type="url" placeholder="https://…" />
        </Field>
        <Field label={t('admin.doctors.checkedOn')}>
          <input {...text('verified_on')} type="date" />
        </Field>
      </Row>

      <Section title={t('admin.doctors.wherePractise')}>
        <Row cols={3}>
          <Field label={t('admin.doctors.primaryPlace')}>
            <select className={s.input} value={form.hospitalId} onChange={(e) => set({ hospitalId: e.target.value })}>
              <option value="">{t('admin.doctors.noPrimary')}</option>
              {hospitals.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                  {place.hidden ? ` ${t('admin.doctors.hiddenTag')}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.doctors.division')}>
            <select
              className={s.input}
              value={form.division}
              onChange={(e) => {
                const division = e.target.value;
                const allowed = new Set(districtsFor(division ? [division] : []));
                setForm((current) => ({ ...current, division, city: allowed.has(current.city) ? current.city : '' }));
              }}
            >
              <option value="">{t('admin.doctors.noDivision')}</option>
              {DIVISIONS.map((name) => (
                <option key={name} value={name}>
                  {t('admin.doctors.divisionOption', { name: divisionLabel(t, name) })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.doctors.district')}>
            <select className={s.input} value={form.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">{t('admin.doctors.noDistrict')}</option>
              {/* Keep an old value that is not on the list, so saving does not drop it. */}
              {form.city && !districtOptions.includes(form.city) && <option value={form.city}>{form.city}</option>}
              {districtOptions.map((name) => (
                <option key={name} value={name}>
                  {districtLabel(t, name)}
                </option>
              ))}
            </select>
          </Field>
        </Row>
      </Section>

      <Section title={t('admin.doctors.chambers')}>
        <ChambersFields
          entries={form.weeklySchedule}
          hospitals={hospitals}
          onChange={(weeklySchedule) => set({ weeklySchedule })}
        />
      </Section>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={d.section}>
      <h4 className={s.subtitle}>{title}</h4>
      {children}
    </section>
  );
}

const OTHER = '__other__';

/** Known specialties plus any already in use; "Other" lets the admin type a new one. */
function SpecialtySelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  const [custom, setCustom] = useState(() => Boolean(value) && !options.includes(value));
  return (
    <Field label={t('admin.doctors.specialty')} required>
      <select
        className={s.input}
        value={custom ? OTHER : value}
        onChange={(e) => {
          const next = e.target.value;
          setCustom(next === OTHER);
          onChange(next === OTHER ? '' : next);
        }}
      >
        <option value="">{t('admin.doctors.chooseSpecialty')}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OTHER}>{t('admin.doctors.other')}</option>
      </select>
      {custom && (
        <input
          className={s.input}
          autoFocus
          placeholder={t('admin.doctors.newSpecialty')}
          aria-label={t('admin.doctors.newSpecialty')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

const CHAMBER_FIELDS: { key: 'venue' | 'time' | 'address' | 'phone' | 'note'; label: TranslationKey }[] = [
  { key: 'venue', label: 'admin.doctors.chamberVenue' },
  { key: 'time', label: 'admin.doctors.chamberTime' },
  { key: 'address', label: 'admin.doctors.address' },
  { key: 'phone', label: 'admin.doctors.chamberPhone' },
  { key: 'note', label: 'admin.doctors.chamberNote' },
];

/** The doctor's weekly chambers. Choosing a listed place fills in its name, address and hotline. */
function ChambersFields({
  entries,
  hospitals,
  onChange,
}: {
  entries: ChamberEntry[];
  hospitals: HospitalOption[];
  onChange: (entries: ChamberEntry[]) => void;
}) {
  const { t } = useT();
  const update = (index: number, values: Partial<ChamberEntry>) =>
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...values } : entry)));

  return (
    <>
      {entries.length === 0 && <p className={s.muted}>{t('admin.doctors.noChambers')}</p>}
      {entries.map((entry, index) => {
        const placeId = entry.hospital_id || hospitals.find((place) => place.name === entry.venue)?.id || '';
        return (
          <div key={index} className={d.chamber}>
            <Row cols={2}>
              <Field label={t('admin.doctors.chamberPlace')}>
                <select
                  className={s.input}
                  value={placeId}
                  onChange={(e) => {
                    const place = hospitals.find((option) => option.id === e.target.value);
                    update(
                      index,
                      place
                        ? { hospital_id: place.id, venue: place.name, address: place.address ?? '', phone: place.hotline ?? '' }
                        : { hospital_id: undefined },
                    );
                  }}
                >
                  <option value="">{t('admin.doctors.otherVenue')}</option>
                  {hospitals.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </Field>
              {CHAMBER_FIELDS.map(({ key, label }) => (
                <Field key={key} label={t(label)}>
                  <input
                    className={s.input}
                    value={typeof entry[key] === 'string' ? entry[key] : ''}
                    onChange={(e) =>
                      update(index, { [key]: e.target.value, ...(key === 'venue' ? { hospital_id: undefined } : {}) })
                    }
                  />
                </Field>
              ))}
            </Row>
            <button
              type="button"
              className={s.linkDanger}
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
            >
              {t('admin.doctors.removeChamber')}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={s.secondary}
        onClick={() => onChange([...entries, { venue: '', time: '', address: '', phone: '' }])}
      >
        {t('admin.doctors.addChamber')}
      </button>
    </>
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
  const { t, tm } = useT();
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
      // The API refuses while the doctor has bookings, and says so.
      setConfirming(false);
      return setError(result.error.message);
    }
    onDeleted();
  };

  return (
    <div className={d.recordBox}>
      <div className={d.recordHead}>
        <span>
          {hidden ? (
            <>
              <strong className={d.warn}>{t('admin.doctors.hiddenStrong')}</strong> {t('admin.doctors.hiddenNote')}
            </>
          ) : (
            t('admin.doctors.visibleNote')
          )}
        </span>
        <span className={d.recordButtons}>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => void toggleHidden()}>
            {hidden ? t('admin.doctors.show') : t('admin.doctors.hide')}
          </button>
          <button
            type="button"
            className={confirming ? d.dangerSolid : d.dangerOutline}
            disabled={busy}
            onClick={() => void remove()}
          >
            {confirming ? t('admin.doctors.confirmDelete') : t('common.delete')}
          </button>
        </span>
      </div>
      {confirming && !busy && (
        <p className={s.muted}>
          {t('admin.doctors.deleteWarning')}{' '}
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

/** Editing uploads at once; adding keeps the file until the doctor has been created. */
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
  const { t, tm } = useT();
  const { http } = useServices();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
      <div className={d.photo}>{src ? <img src={src} alt="" /> : t('admin.doctors.noPhoto')}</div>
      <div>
        <span className={s.fieldLabel}>{pending ? t('admin.doctors.photoPending') : t('admin.doctors.photo')}</span>
        <div className={d.photoButtons}>
          {id ? (
            <ImageUpload path={`${BASE}/${id}/photo`} label={src ? t('admin.doctors.changePhoto') : t('admin.doctors.uploadPhoto')} onUploaded={onPhoto} />
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
                {src ? t('admin.doctors.changePhoto') : t('admin.doctors.choosePhoto')}
              </button>
            </>
          )}
          {src && (
            <button type="button" className={s.linkDanger} disabled={busy} onClick={() => void remove()}>
              {busy ? t('admin.doctors.removing') : t('common.remove')}
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
