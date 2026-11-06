import { useState } from 'react';
import { useServices } from '../../../app/services';
import { useT } from '../../../i18n';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
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
  hidden: boolean;
  owner: { id: string; full_name: string; email: string | null } | null;
}

/** Every pharmacy and its owner. */
export function PharmaciesPanel() {
  const { t, tm } = useT();
  const { data, error, loading, reload } = useResource<AdminPharmacy[]>('/directory/admin/pharmacies', {});
  const [editing, setEditing] = useState<AdminPharmacy | 'new' | null>(null);
  const visibility = useMutation();

  const setHidden = async (pharmacy: AdminPharmacy, hidden: boolean) => {
    const ok = await visibility.run(`/directory/admin/pharmacies/${pharmacy.id}/hidden`, { method: 'PATCH', body: { hidden } });
    if (ok) void reload();
  };

  if (loading && !data) return <Loading />;
  if (error) return <Failed message={error} />;

  return (
    <Panel
      title={t('admin.pharmacies.title')}
      description={t('admin.pharmacies.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      {(data ?? []).length === 0 ? (
        <p className={s.muted}>{t('admin.pharmacies.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('admin.pharmacies.col.name')}</th>
              <th>{t('admin.pharmacies.col.owner')}</th>
              <th>{t('admin.pharmacies.col.phones')}</th>
              <th>{t('admin.pharmacies.col.location')}</th>
              <th>{t('admin.pharmacies.col.onWebsite')}</th>
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
                  {pharmacy.hidden ? t('admin.pharmacies.hidden') : t('admin.pharmacies.visible')}{' '}
                  <button
                    type="button"
                    className={s.linkButton}
                    disabled={visibility.busy}
                    aria-label={t(pharmacy.hidden ? 'admin.pharmacies.showAria' : 'admin.pharmacies.hideAria', {
                      name: pharmacy.name,
                    })}
                    onClick={() => void setHidden(pharmacy, !pharmacy.hidden)}
                  >
                    {pharmacy.hidden ? t('admin.pharmacies.show') : t('admin.pharmacies.hide')}
                  </button>
                </td>
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
      {visibility.error && (
        <p className={s.error} role="alert">
          {tm(visibility.error)}
        </p>
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
  const { t, tm } = useT();
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
      title={existing ? t('admin.pharmacies.editTitle', { name: existing.name }) : t('admin.pharmacies.addTitle')}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          {existing && (
            <button type="button" className={s.linkDanger} onClick={() => void remove()}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <Field label={t('admin.pharmacies.owner')} required hint={t('admin.pharmacies.ownerHint')}>
        <input className={s.input} value={owner} onChange={(e) => setOwner(e.target.value)} />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.pharmacies.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('admin.pharmacies.licence')}>
          <input className={s.input} value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.pharmacies.phones')} required hint={t('admin.pharmacies.phonesHint')}>
          <input className={s.input} value={form.phones} onChange={(e) => set('phones', e.target.value)} />
        </Field>
        <Field label={t('admin.pharmacies.hours')}>
          <input className={s.input} value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.pharmacies.address')}>
          <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('admin.pharmacies.city')}>
          <input className={s.input} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
      </Row>
      <Check label={t('admin.pharmacies.homeDelivery')} checked={form.home_delivery} onChange={(on) => setForm((current) => ({ ...current, home_delivery: on }))} />
    </Modal>
  );
}
