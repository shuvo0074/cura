import { useState } from 'react';
import { useT } from '../../i18n';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../ui';
import type { Pharmacy } from './owner-shared';

/** A pharmacy owner's own pharmacies. */
export function PharmacyOwnerView() {
  const { data, error, loading, reload } = useResource<Pharmacy[]>('/directory/my-pharmacies', {});
  const [editing, setEditing] = useState<Pharmacy | 'new' | null>(null);
  const { t } = useT();

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  const pharmacies = data ?? [];
  return (
    <Panel
      title={t('owner.pharmacy.title')}
      description={t('owner.pharmacy.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      {pharmacies.length === 0 ? (
        <p className={s.muted}>{t('owner.pharmacy.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('owner.col.name')}</th>
              <th>{t('owner.col.phones')}</th>
              <th>{t('owner.pharmacy.col.location')}</th>
              <th>{t('owner.pharmacy.col.hours')}</th>
              <th>{t('owner.pharmacy.homeDelivery')}</th>
              <th>{t('owner.col.onWebsite')}</th>
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
                <td>{pharmacy.home_delivery ? t('common.yes') : t('common.no')}</td>
                <td>{pharmacy.hidden ? t('owner.waitingForAdmin') : t('owner.visible')}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(pharmacy)}>
                    {t('common.edit')}
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
  const { t, tm } = useT();
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
      title={existing ? t('owner.editTitle', { name: existing.name }) : t('owner.pharmacy.addTitle')}
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
      <Row cols={2}>
        <Field label={t('owner.field.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('owner.pharmacy.licence')}>
          <input className={s.input} value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('owner.field.phones')} required hint={t('owner.field.phonesHint')}>
          <input className={s.input} value={form.phones} onChange={(e) => set('phones', e.target.value)} />
        </Field>
        <Field label={t('owner.pharmacy.openingHours')}>
          <input className={s.input} value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('owner.field.address')}>
          <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('owner.field.city')}>
          <input className={s.input} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
      </Row>
      <Check
        label={t('owner.pharmacy.homeDelivery')}
        checked={form.home_delivery}
        onChange={(checked) => set('home_delivery', checked)}
      />
    </Modal>
  );
}
