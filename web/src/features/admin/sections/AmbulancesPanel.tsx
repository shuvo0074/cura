import { useCallback, useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import { useT } from '../../../i18n';
import {
  AMBULANCE_SERVICES,
  AMBULANCE_TYPES,
  ambulanceServiceLabel,
  ambulanceTypeLabel,
  toggled,
  type FareRange,
} from '../../owner/owner-shared';
import { AMBULANCE_AREAS, areaLabel } from './data/ambulance-areas';
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

/** Every ambulance vendor on Cura Website, including hidden ones. */
export function AmbulancesPanel() {
  const { t } = useT();
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
      title={t('admin.ambulances.title')}
      description={t('admin.ambulances.description', { count: visible.length })}
      action={
        <div className={a.toolbar}>
          <input
            className={`${s.input} ${a.search}`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.ambulances.searchPlaceholder')}
            aria-label={t('admin.ambulances.searchAria')}
          />
          <button type="button" className={s.primary} onClick={() => setEditing('new')}>
            {t('admin.ambulances.add')}
          </button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <p className={s.muted}>{t('admin.ambulances.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('admin.ambulances.col.name')}</th>
              <th>{t('admin.ambulances.col.types')}</th>
              <th>{t('admin.ambulances.col.fares')}</th>
              <th>{t('admin.ambulances.col.phone')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id} className={v.hidden ? a.hiddenRow : undefined}>
                <td>
                  {v.name}
                  {v.hidden && <span className={a.tag}>{t('admin.ambulances.hiddenTag')}</span>}
                </td>
                <td>{v.categories.map((key) => ambulanceTypeLabel(t, key)).join(', ')}</td>
                <td>{Object.keys(v.fares ?? {}).length ? t('admin.ambulances.ownFares') : t('admin.ambulances.sampleFares')}</td>
                <td>{v.phones[0] ?? ''}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(v)}>
                    {t('common.edit')}
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
  const { t, tm, fmt, locale } = useT();
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

  const query = areaQuery.trim().toLowerCase();
  const visibleAreas = AMBULANCE_AREAS.filter((area) =>
    [area.name, areaLabel(t, area.id)].some((name) => name.toLowerCase().includes(query)),
  );
  // English keeps the sample as stored; Bangla shows it in Bangla digits.
  const sampleText = (value: number | string): string =>
    locale === 'bn' && value !== '' && Number.isFinite(Number(value)) ? fmt.number(Number(value)) : String(value);

  const submit = async () => {
    const ok = existing
      ? await save.run(`/directory/admin/ambulances/${existing.id}`, { method: 'PATCH', body: form })
      : await save.run('/directory/admin/ambulances', { method: 'POST', body: form });
    if (ok) onDone();
  };

  return (
    <Modal
      title={existing ? t('admin.ambulances.editTitle') : t('admin.ambulances.addTitle')}
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
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={save.busy}>
            {save.busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      {existing && (
        <RecordActions
          path={`/directory/admin/ambulances/${existing.id}`}
          hidden={hidden}
          label={t('admin.ambulances.recordLabel')}
          onHiddenChange={(next) => {
            setHidden(next);
            onChanged();
          }}
          onDeleted={onDone}
        />
      )}

      <Row cols={2}>
        <Field label={t('admin.ambulances.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t('admin.ambulances.nameBn')}>
          <input className={s.input} value={form.name_bn} onChange={(e) => set({ name_bn: e.target.value })} />
        </Field>
        <Field label={t('admin.ambulances.address')}>
          <input className={s.input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label={t('admin.ambulances.addressBn')}>
          <input
            className={s.input}
            value={form.address_bn}
            onChange={(e) => set({ address_bn: e.target.value })}
          />
        </Field>
      </Row>
      <Field
        label={t('admin.ambulances.phones')}
        required
        hint={t('admin.ambulances.phonesHint')}
      >
        <input
          className={s.input}
          value={form.phones}
          placeholder="01714325325, 01993800900"
          onChange={(e) => set({ phones: e.target.value })}
        />
      </Field>

      <h4 className={s.subtitle}>{t('admin.ambulances.typesHeading')}</h4>
      <p className={s.muted}>{t('admin.ambulances.typesNote')}</p>
      {AMBULANCE_TYPES.map((type) => {
        const on = form.categories.includes(type.key);
        const sample = sampleFares[type.key];
        const label = ambulanceTypeLabel(t, type.key);
        return (
          <div key={type.key} className={a.fareRow}>
            <Check
              label={label}
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
                  aria-label={t(edge === 'min' ? 'admin.ambulances.fareLowestAria' : 'admin.ambulances.fareHighestAria', {
                    type: label,
                  })}
                  placeholder={
                    sample
                      ? t(edge === 'min' ? 'admin.ambulances.fareFromSample' : 'admin.ambulances.fareToSample', {
                          amount: sampleText(sample[edge]),
                        })
                      : t(edge === 'min' ? 'admin.ambulances.fareFrom' : 'admin.ambulances.fareTo')
                  }
                  value={form.fares[type.key]?.[edge] ?? ''}
                  onChange={(e) => setFare(type.key, edge, e.target.value)}
                />
              ))}
          </div>
        );
      })}

      <h4 className={s.subtitle}>{t('admin.ambulances.servicesHeading')}</h4>
      {AMBULANCE_SERVICES.map((service) => (
        <Check
          key={service.key}
          label={ambulanceServiceLabel(t, service.key)}
          checked={form.features.includes(service.key)}
          onChange={(checked) => set({ features: toggled(form.features, service.key, checked) })}
        />
      ))}

      <h4 className={s.subtitle}>{t('admin.ambulances.coverageHeading')}</h4>
      <Row cols={2}>
        <Field label={t('admin.ambulances.baseArea')} hint={t('admin.ambulances.baseAreaHint')}>
          <select className={s.input} value={form.base_area} onChange={(e) => set({ base_area: e.target.value })}>
            <option value="">{t('admin.ambulances.noBaseArea')}</option>
            {AMBULANCE_AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {areaLabel(t, area.id)}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Check
        label={t('admin.ambulances.dhakaWide')}
        checked={form.dhaka_wide}
        onChange={(checked) => set({ dhaka_wide: checked })}
      />
      {!form.dhaka_wide && (
        <>
          <p className={s.muted}>{t('admin.ambulances.areasServed', { count: form.service_areas.length })}</p>
          <input
            className={`${s.input} ${a.areaSearch}`}
            type="search"
            value={areaQuery}
            onChange={(e) => setAreaQuery(e.target.value)}
            placeholder={t('admin.ambulances.searchAreas')}
            aria-label={t('admin.ambulances.searchAreas')}
          />
          <div className={a.checkGrid}>
            {visibleAreas.map((area) => (
              <Check
                key={area.id}
                label={areaLabel(t, area.id)}
                checked={form.service_areas.includes(area.id)}
                onChange={(checked) => set({ service_areas: toggled(form.service_areas, area.id, checked) })}
              />
            ))}
          </div>
        </>
      )}

      <h4 className={s.subtitle}>{t('admin.ambulances.sourceHeading')}</h4>
      <Row cols={2}>
        <Field label={t('admin.ambulances.sourceLink')}>
          <input
            className={s.input}
            type="url"
            placeholder="https://…"
            value={form.source_url}
            onChange={(e) => set({ source_url: e.target.value })}
          />
        </Field>
        <Field label={t('admin.ambulances.checkedOn')}>
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
 * `label` is the record's noun in the current language ("vendor", "specialty").
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
  const { t, tm } = useT();
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
        <p>{hidden ? t('admin.ambulances.record.hidden', { label }) : t('admin.ambulances.record.visible')}</p>
        <div className={a.recordButtons}>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => void toggleHidden()}>
            {hidden ? t('admin.ambulances.record.show') : t('admin.ambulances.record.hide')}
          </button>
          <button
            type="button"
            className={a.danger}
            data-confirming={confirming || undefined}
            disabled={busy}
            onClick={() => void remove()}
          >
            {confirming ? t('admin.ambulances.record.confirmDelete') : t('common.delete')}
          </button>
        </div>
      </div>
      {confirming && !busy && (
        <p className={s.muted}>
          {t('admin.ambulances.record.deleteNote')}{' '}
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
