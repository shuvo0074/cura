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

import { ChartingModal } from './ChartingModal';
import { ChartingTemplate } from './catalog-shared';

export function ChartingPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<ChartingTemplate[]>('/settings/charting-templates', {
    practiceId,
  });
  const { t } = useT();
  const mutate = useMutation();
  const [editing, setEditing] = useState<ChartingTemplate | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const remove = async (row: ChartingTemplate) => {
    await mutate.run(`/settings/charting-templates/${row.id}`, { method: 'DELETE', query: { practiceId } });
    await reload();
  };

  return (
    <Panel
      title={t('settings.nav.charting')}
      description={t('settings.charting.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      {mutate.error && <Failed message={mutate.error} />}

      {(data ?? []).length === 0 ? (
        <p className={s.muted}>{t('settings.charting.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('settings.charting.templateName')}</th>
              <th>{t('settings.charting.diagnoses')}</th>
              <th>{t('settings.charting.labOrders')}</th>
              <th>{t('settings.charting.followUp')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={row.diagnoses.length ? undefined : s.mutedCell}>
                  {row.diagnoses.join(', ') || '—'}
                </td>
                <td className={row.labOrders.length ? undefined : s.mutedCell}>{row.labOrders.join(', ') || '—'}</td>
                <td className={row.followUpDays ? undefined : s.mutedCell}>
                  {row.followUpDays ? t('settings.charting.days', { count: row.followUpDays }) : '—'}
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
        <ChartingModal
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
