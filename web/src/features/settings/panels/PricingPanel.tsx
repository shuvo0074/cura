import { useMemo, useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { PricingModal } from './PricingModal';
import { DEFAULT_TREATMENTS, PricingItem } from './catalog-shared';

export function PricingPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<PricingItem[]>('/settings/pricing', { practiceId });
  const { t, fmt } = useT();
  const mutate = useMutation();
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<PricingItem | 'new' | null>(null);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (data ?? []).filter((row) => !needle || row.name.toLowerCase().includes(needle));
  }, [data, term]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const remove = async (row: PricingItem) => {
    await mutate.run(`/settings/pricing/${row.id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  const seed = async () => {
    for (const name of DEFAULT_TREATMENTS) {
      await mutate.run('/settings/pricing', {
        method: 'PUT',
        body: { practiceId, name, priceMinor: 0, notes: null },
      });
    }
    await reload();
  };

  return (
    <Panel
      title={t('settings.nav.pricing')}
      description={t('settings.pricing.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      <input
        className={s.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('settings.pricing.search')}
        aria-label={t('settings.pricing.searchLabel')}
      />

      {mutate.error && <Failed message={mutate.error} />}

      {(data ?? []).length === 0 ? (
        <div className={s.empty}>
          <p className={s.muted}>{t('settings.pricing.empty')}</p>
          <button type="button" className={s.secondary} onClick={() => void seed()} disabled={mutate.busy}>
            {t('settings.pricing.seed')}
          </button>
        </div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('settings.pricing.treatment')}</th>
              <th>{t('settings.notes')}</th>
              <th className={s.numeric}>{t('settings.pricing.priceBdt')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={row.notes ? undefined : s.mutedCell}>{row.notes ?? '—'}</td>
                <td className={s.numeric}>{fmt.number(row.priceMinor / 100, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: false,
                  })}</td>
                <td className={s.actions}>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(row)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className={s.linkDanger} onClick={() => void remove(row)}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <PricingModal
          practiceId={practiceId}
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
