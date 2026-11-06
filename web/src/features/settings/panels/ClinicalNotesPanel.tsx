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

import { NOTE_KINDS, type NoteKind } from './catalog-shared';

export function ClinicalNotesPanel({ practiceId }: { practiceId: string }) {
  const { t } = useT();
  const [kind, setKind] = useState<NoteKind>('COMPLAINT');
  const { data, error, loading, reload } = useResource<Array<{ id: string; value: string }>>('/settings/catalog', {
    practiceId,
    kind,
  });
  const mutate = useMutation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [term, setTerm] = useState('');

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
      title={t('settings.nav.notes')}
      description={t('settings.notes.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setAdding(true)}>
          {t('common.add')}
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label={t('settings.notes.category')}>
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            data-active={kind === k || undefined}
            onClick={() => {
              setKind(k);
              setAdding(false);
              setEditing(null);
            }}
          >
            {t(`settings.notes.kind.${k}`)}
          </button>
        ))}
      </div>

      <input
        className={s.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t(`settings.notes.search.${kind}`)}
        aria-label={t(`settings.notes.searchLabel.${kind}`)}
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
            placeholder={t(`settings.notes.new.${kind}`)}
          />
          <button type="button" className={s.linkButton} onClick={() => setAdding(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} onClick={() => void add()} disabled={mutate.busy}>
            {t('common.save')}
          </button>
        </div>
      )}

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Failed message={error} />
      ) : rows.length === 0 ? (
        <p className={s.muted}>{t(`settings.notes.empty.${kind}`)}</p>
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
                    {t('common.cancel')}
                  </button>
                  <button type="button" className={s.primary} onClick={() => void rename()}>
                    {t('common.save')}
                  </button>
                </>
              ) : (
                <>
                  <span>{row.value}</span>
                  <button type="button" className={s.linkButton} onClick={() => setEditing({ ...row })}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className={s.linkDanger} onClick={() => void remove(row.id)}>
                    {t('common.delete')}
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
