import { useMemo, useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { NOTE_KINDS } from './catalog-shared';

export function ClinicalNotesPanel({ practiceId }: { practiceId: string }) {
  const [kind, setKind] = useState<string>('COMPLAINT');
  const { data, error, loading, reload } = useResource<Array<{ id: string; value: string }>>('/settings/catalog', {
    practiceId,
    kind,
  });
  const mutate = useMutation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [term, setTerm] = useState('');

  const active = NOTE_KINDS.find((k) => k.key === kind)!;

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (data ?? []).filter((row) => !needle || row.value.toLowerCase().includes(needle));
  }, [data, term]);

  const add = async () => {
    if (!draft.trim()) return;
    const ok = await mutate.run('/settings/catalog', {
      method: 'POST',
      body: { practiceId, kind, value: draft.trim() },
    });
    if (ok) {
      setDraft('');
      setAdding(false);
      await reload();
    }
  };

  const rename = async () => {
    if (!editing || !editing.value.trim()) return;
    const ok = await mutate.run(`/settings/catalog/${editing.id}`, {
      method: 'PUT',
      body: { practiceId, value: editing.value.trim() },
    });
    if (ok) {
      setEditing(null);
      await reload();
    }
  };

  const remove = async (id: string) => {
    await mutate.run(`/settings/catalog/${id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  return (
    <Panel
      title="Clinical Notes Catalog"
      description="Auto-suggest source for the matching field on a prescription."
      action={
        <button type="button" className={s.primary} onClick={() => setAdding(true)}>
          Add
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label="Catalog category">
        {NOTE_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="tab"
            aria-selected={kind === k.key}
            data-active={kind === k.key || undefined}
            onClick={() => {
              setKind(k.key);
              setAdding(false);
              setEditing(null);
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <input
        className={s.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={`Search ${active.label.toLowerCase()}…`}
        aria-label={`Search ${active.label}`}
      />

      {mutate.error && <Failed message={mutate.error} />}

      {adding && (
        // Spec: "Clicking Add opens an input field within the list view."
        <div className={s.inlineRow}>
          <input
            className={s.input}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder={`New ${active.label.replace(/e?s$/, '').toLowerCase()}`}
          />
          <button type="button" className={s.linkButton} onClick={() => setAdding(false)}>
            Cancel
          </button>
          <button type="button" className={s.primary} onClick={() => void add()} disabled={mutate.busy}>
            Save
          </button>
        </div>
      )}

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Failed message={error} />
      ) : rows.length === 0 ? (
        <p className={s.muted}>No {active.label.toLowerCase()} added yet.</p>
      ) : (
        <ul className={s.list}>
          {rows.map((row) => (
            <li key={row.id} className={s.listRow}>
              {editing?.id === row.id ? (
                <>
                  <input
                    className={s.input}
                    autoFocus
                    value={editing.value}
                    onChange={(e) => setEditing({ id: row.id, value: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && void rename()}
                  />
                  <button type="button" className={s.linkButton} onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button type="button" className={s.primary} onClick={() => void rename()}>
                    Save
                  </button>
                </>
              ) : (
                <>
                  <span>{row.value}</span>
                  <button type="button" className={s.linkButton} onClick={() => setEditing({ ...row })}>
                    Edit
                  </button>
                  <button type="button" className={s.linkDanger} onClick={() => void remove(row.id)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
