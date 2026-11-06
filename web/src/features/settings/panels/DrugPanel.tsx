import { useEffect, useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { DrugModal } from './DrugModal';
import { Drug, isDrugForm } from './catalog-shared';

export function DrugPanel({ practiceId }: { practiceId: string }) {
  const { t, locale } = useT();
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useResource<Drug[]>(
    '/settings/drugs/list',
    query ? { practiceId, q: query } : { practiceId },
  );
  const mutate = useMutation();
  const [editing, setEditing] = useState<Drug | 'new' | null>(null);

  // Debounced so the table does not refetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  // English keeps the stored code ("TABLET") as it always showed; Bangla gets the word.
  const formLabel = (form: string) =>
    locale !== 'en' && isDrugForm(form) ? t(`settings.drugs.form.${form}`) : form;

  const remove = async (row: Drug) => {
    await mutate.run(`/settings/drugs/${row.id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  return (
    <Panel
      title={t('settings.nav.drugs')}
      description={t('settings.drugs.description')}
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
        placeholder={t('settings.drugs.search')}
        aria-label={t('settings.drugs.searchLabel')}
      />

      {mutate.error && <Failed message={mutate.error} />}

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Failed message={error} />
      ) : (data ?? []).length === 0 ? (
        <p className={s.muted}>{query ? t('settings.drugs.noMatch') : t('settings.drugs.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('settings.name')}</th>
              <th>{t('settings.type')}</th>
              <th>{t('settings.drugs.strength')}</th>
              <th>{t('settings.drugs.instructions')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={row.form ? undefined : s.mutedCell}>{row.form ? formLabel(row.form) : '—'}</td>
                <td className={row.strength ? undefined : s.mutedCell}>
                  {row.strength ? `${row.strength}${row.unit ?? ''}` : '—'}
                </td>
                <td className={row.instruction ? undefined : s.mutedCell}>{row.instruction ?? '—'}</td>
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
        <DrugModal
          practiceId={practiceId}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => void reload()}
          onDone={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}
