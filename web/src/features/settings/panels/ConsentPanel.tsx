import { useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { ConsentModal } from './ConsentModal';
import { ConsentForm } from './catalog-shared';

export function ConsentPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<ConsentForm[]>('/settings/consent-forms', { practiceId });
  const { t } = useT();
  const mutate = useMutation();
  const [editing, setEditing] = useState<ConsentForm | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const remove = async (row: ConsentForm) => {
    await mutate.run(`/settings/consent-forms/${row.id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  const toggle = async (row: ConsentForm) => {
    await mutate.run('/settings/consent-forms', {
      method: 'PUT',
      body: { practiceId, id: row.id, title: row.title, bodyHtml: row.bodyHtml, isActive: !row.isActive },
    });
    await reload();
  };

  return (
    <Panel
      title={t('settings.nav.consent')}
      description={t('settings.consent.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      {mutate.error && <Failed message={mutate.error} />}

      {(data ?? []).length === 0 ? (
        <p className={s.muted}>{t('settings.consent.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('settings.titleField')}</th>
              <th>{t('settings.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>
                  <button
                    type="button"
                    className={s.toggle}
                    data-on={row.isActive || undefined}
                    onClick={() => void toggle(row)}
                  >
                    {row.isActive ? t('settings.consent.active') : t('settings.consent.inactive')}
                  </button>
                </td>
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
        <ConsentModal
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
