import { useEffect, useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { DrugModal } from './DrugModal';
import { Drug } from './catalog-shared';

export function DrugPanel({ practiceId }: { practiceId: string }) {
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

  const remove = async (row: Drug) => {
    await mutate.run(`/settings/drugs/${row.id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  return (
    <Panel
      title="Drug Catalog"
      description="Feeds the prescription auto-suggest."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      <input
        className={s.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search drugs…"
        aria-label="Search drugs"
      />

      {mutate.error && <Failed message={mutate.error} />}

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Failed message={error} />
      ) : (data ?? []).length === 0 ? (
        <p className={s.muted}>{query ? 'No drugs match that search.' : 'No drugs added yet.'}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Strength</th>
              <th>Instructions</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={row.form ? undefined : s.mutedCell}>{row.form ?? '—'}</td>
                <td className={row.strength ? undefined : s.mutedCell}>
                  {row.strength ? `${row.strength}${row.unit ?? ''}` : '—'}
                </td>
                <td className={row.instruction ? undefined : s.mutedCell}>{row.instruction ?? '—'}</td>
                <td className={s.actions}>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(row)}>
                    Edit
                  </button>
                  <button type="button" className={s.linkDanger} onClick={() => void remove(row)}>
                    Delete
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
