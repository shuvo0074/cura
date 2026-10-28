import { useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { ChartingModal } from './ChartingModal';
import { ChartingTemplate } from './catalog-shared';

export function ChartingPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<ChartingTemplate[]>('/settings/charting-templates', {
    practiceId,
  });
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
      title="Charting Templates"
      description="Reusable bundles of diagnoses, lab orders and a follow-up interval, applied in one click while charting."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      {mutate.error && <Failed message={mutate.error} />}

      {(data ?? []).length === 0 ? (
        <p className={s.muted}>No templates yet.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Template name</th>
              <th>Diagnoses</th>
              <th>Lab orders</th>
              <th>Follow-up</th>
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
                  {row.followUpDays ? `${row.followUpDays} days` : '—'}
                </td>
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
