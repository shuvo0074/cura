import { useState } from 'react';
import { useT } from '../../i18n';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../ui';
import type { StockItem } from './owner-shared';

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

/** One pharmacy's medicine list. Patients see the in-stock ones on Cura Website. */
export function PharmacyStock({ pharmacyId }: { pharmacyId: string }) {
  const base = `/directory/my-pharmacies/${pharmacyId}/stock`;
  const { data, error, loading, reload } = useResource<StockItem[]>(base, {});
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null);
  const [term, setTerm] = useState('');
  const mutate = useMutation();
  const { t, tm, fmt } = useT();

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const items = data ?? [];
  const words = normalise(term).split(' ').filter(Boolean);
  const visible = items.filter((item) => {
    const haystack = normalise([item.name, item.strength, item.form].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });

  const toggle = async (item: StockItem) => {
    await mutate.run(`${base}/${item.id}`, {
      method: 'PATCH',
      body: { ...item, in_stock: !item.in_stock },
    });
    await reload();
  };

  const remove = async (item: StockItem) => {
    if (!window.confirm(t('owner.stock.removeConfirm', { name: item.name }))) return;
    await mutate.run(`${base}/${item.id}`, { method: 'DELETE' });
    await reload();
  };

  return (
    <Panel
      title={t('owner.stock.title')}
      description={t('owner.stock.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('owner.stock.addTitle')}
        </button>
      }
    >
      {mutate.error && (
        <p className={s.error} role="alert">
          {tm(mutate.error)}
        </p>
      )}
      {items.length === 0 ? (
        <p className={s.muted}>{t('owner.stock.empty')}</p>
      ) : (
        <>
          <div className={s.inlineRow}>
            <input
              className={s.input}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('owner.stock.search')}
              aria-label={t('owner.stock.search')}
            />
            <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>
              {t('owner.stock.count', { count: visible.length })}
            </span>
          </div>
          {visible.length === 0 ? (
            <p className={s.muted}>{t('owner.stock.noMatch')}</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('owner.stock.col.medicine')}</th>
                  <th>{t('owner.stock.col.strength')}</th>
                  <th>{t('owner.stock.col.form')}</th>
                  <th className={s.numeric}>{t('owner.stock.col.price')}</th>
                  <th>{t('owner.stock.col.inStock')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.strength ?? '—'}</td>
                    <td>{item.form ?? '—'}</td>
                    <td className={s.numeric}>{item.price === null ? '—' : fmt.money(item.price)}</td>
                    <td>
                      <button
                        type="button"
                        className={s.toggle}
                        data-on={item.in_stock || undefined}
                        aria-pressed={item.in_stock}
                        disabled={mutate.busy}
                        onClick={() => void toggle(item)}
                      >
                        {item.in_stock ? t('owner.stock.inStock') : t('owner.stock.outOfStock')}
                      </button>
                    </td>
                    <td>
                      <div className={s.actions}>
                        <button type="button" className={s.linkButton} onClick={() => setEditing(item)}>
                          {t('common.edit')}
                        </button>
                        <button type="button" className={s.linkDanger} onClick={() => void remove(item)}>
                          {t('common.remove')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {editing && (
        <StockModal
          base={base}
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

function StockModal({
  base,
  existing,
  onClose,
  onSaved,
}: {
  base: string;
  existing: StockItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();
  const { t, tm } = useT();
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    strength: existing?.strength ?? '',
    form: existing?.form ?? '',
    price: existing?.price === null || existing?.price === undefined ? '' : String(existing.price),
    in_stock: existing?.in_stock ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const ok = existing
      ? await save.run(`${base}/${existing.id}`, {
          method: 'PATCH',
          body: form,
        })
      : await save.run(base, { method: 'POST', body: form });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? t('owner.editTitle', { name: existing.name }) : t('owner.stock.addTitle')}
      onClose={onClose}
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
      <Field label={t('owner.stock.field.name')} required>
        <input className={s.input} value={form.name} maxLength={160} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Row cols={2}>
        <Field label={t('owner.stock.field.strength')} hint={t('owner.stock.field.strengthHint')}>
          <input
            className={s.input}
            value={form.strength}
            maxLength={40}
            onChange={(e) => set('strength', e.target.value)}
          />
        </Field>
        <Field label={t('owner.stock.field.form')} hint={t('owner.stock.field.formHint')}>
          <input className={s.input} value={form.form} maxLength={40} onChange={(e) => set('form', e.target.value)} />
        </Field>
      </Row>
      <Field label={t('owner.stock.field.price')} hint={t('owner.stock.field.priceHint')}>
        <input
          className={s.input}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={form.price}
          onChange={(e) => set('price', e.target.value)}
        />
      </Field>
      <Check
        label={t('owner.stock.inStock')}
        description={t('owner.stock.field.inStockHint')}
        checked={form.in_stock}
        onChange={(checked) => set('in_stock', checked)}
      />
    </Modal>
  );
}
