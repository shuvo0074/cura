import { useState } from 'react';
import { useT } from '../../i18n';
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
import {
  AMBULANCE_SERVICES,
  AMBULANCE_TYPES,
  ambulanceServiceLabel,
  ambulanceTypeLabel,
  toggled, type AmbulanceVendor, type FareRange } from './owner-shared';
import { AmbulanceRequests } from './AmbulanceRequests';

const EMPTY: Omit<AmbulanceVendor, 'id' | 'hidden'> = {
  name: '',
  address: '',
  phones: [],
  categories: [],
  features: [],
  dhaka_wide: false,
  fares: {},
};

/**
 * An ambulance owner's own vendors, and the requests patients send them. New
 * vendors wait for a super admin to publish them.
 */
export function AmbulanceOwnerView() {
  const { data, error, loading, reload } = useResource<AmbulanceVendor[]>('/directory/my-ambulances', {});
  const [editing, setEditing] = useState<AmbulanceVendor | 'new' | null>(null);
  const { t } = useT();

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  const vendors = data ?? [];
  return (
    <>
      {vendors.length > 0 && <AmbulanceRequests vendors={vendors} />}
      <Panel
        title={t('owner.ambulances.title')}
        description={t('owner.ambulances.description')}
        action={
          <button type="button" className={s.primary} onClick={() => setEditing('new')}>
            {t('common.add')}
          </button>
        }
      >
        {vendors.length === 0 ? (
          <p className={s.muted}>{t('owner.ambulances.empty')}</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('owner.col.name')}</th>
                <th>{t('owner.col.phones')}</th>
                <th>{t('owner.ambulances.col.types')}</th>
                <th>{t('owner.col.onWebsite')}</th>
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
                      .map((type) => ambulanceTypeLabel(t, type.key))
                      .join(', ')}
                  </td>
                  <td>{vendor.hidden ? t('owner.waitingForAdmin') : t('owner.visible')}</td>
                  <td>
                    <button type="button" className={s.linkButton} onClick={() => setEditing(vendor)}>
                      {t('common.edit')}
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
    </>
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
  const { t, tm } = useT();
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
      title={existing ? t('owner.editTitle', { name: existing.name }) : t('owner.ambulances.addTitle')}
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
      {!existing && (
        <p className={s.muted}>{t('owner.ambulances.newNote')}</p>
      )}
      <Row cols={2}>
        <Field label={t('owner.field.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('owner.field.phones')} required hint={t('owner.field.phonesHint')}>
          <input className={s.input} value={phones} onChange={(e) => setPhones(e.target.value)} />
        </Field>
      </Row>
      <Field label={t('owner.field.address')}>
        <input className={s.input} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <Check
        label={t('owner.ambulances.dhakaWide')}
        checked={form.dhaka_wide}
        onChange={(checked) => setForm((current) => ({ ...current, dhaka_wide: checked }))}
      />

      <h4 className={s.subtitle}>{t('owner.ambulances.typesAndFares')}</h4>
      {AMBULANCE_TYPES.map((type) => {
        const on = form.categories.includes(type.key);
        return (
          <div key={type.key}>
            <Check
              label={ambulanceTypeLabel(t, type.key)}
              checked={on}
              onChange={(checked) => setList('categories', toggled(form.categories, type.key, checked))}
            />
            {on && (
              <Row cols={2}>
                <Field label={t('owner.ambulances.lowestFare', { type: ambulanceTypeLabel(t, type.key) })}>
                  <input
                    className={s.input}
                    inputMode="numeric"
                    value={form.fares[type.key]?.min ?? ''}
                    onChange={(e) => setFare(type.key, 'min', e.target.value)}
                  />
                </Field>
                <Field label={t('owner.ambulances.highestFare', { type: ambulanceTypeLabel(t, type.key) })}>
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

      <h4 className={s.subtitle}>{t('owner.ambulances.services')}</h4>
      {AMBULANCE_SERVICES.map((service) => (
        <Check
          key={service.key}
          label={ambulanceServiceLabel(t, service.key)}
          checked={form.features.includes(service.key)}
          onChange={(checked) => setList('features', toggled(form.features, service.key, checked))}
        />
      ))}
    </Modal>
  );
}
