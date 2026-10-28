import {
  Failed,
  Field,
  Loading,
  Panel,
  Row,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { CATEGORY_LABEL, CommRow, PracticeSettings } from './practice-ops-shared';

export function CommunicationsPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<CommRow[]>('/settings/communications', { practiceId });
  const practice = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const mutate = useMutation();

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const toggle = async (row: CommRow, channel: 'sms' | 'email', next: boolean) => {
    await mutate.run('/settings/communications', {
      method: 'PUT',
      body: {
        practiceId,
        category: row.category,
        type: row.type,
        smsEnabled: channel === 'sms' ? next : row.smsEnabled,
        emailEnabled: channel === 'email' ? next : row.emailEnabled,
        offsetDays: row.offsetDays,
      },
    });
    await reload();
  };

  const setLanguage = async (smsLanguage: string) => {
    await mutate.run('/settings/communications/language', { method: 'PUT', body: { practiceId, smsLanguage } });
    await practice.reload();
  };

  let previousCategory = '';

  return (
    <Panel title="Communications" description="Which events reach patients, and over which channel.">
      <div className={s.identity}>
        <h3 className={s.subtitle}>Sender identity</h3>
        <p className={s.hint}>
          Messages are sent from{' '}
          <strong>{practice.data?.contactNumber ?? 'the practice number'}</strong> (SMS) and{' '}
          <strong>{practice.data?.email ?? 'the practice email'}</strong> (email). Change these in Practice Details.
        </p>
      </div>

      <Row cols={1}>
        <Field label="SMS language" hint="Applies to every outgoing message template.">
          <select
            className={s.input}
            value={practice.data?.smsLanguage ?? 'en'}
            onChange={(e) => void setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="bn">বাংলা (Bangla)</option>
          </select>
        </Field>
      </Row>

      {mutate.error && <Failed message={mutate.error} />}

      <table className={s.table}>
        <thead>
          <tr>
            <th>Category</th>
            <th>Type</th>
            <th>SMS</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((row) => {
            // Category is printed once per run, matching the grouped layout of
            // the reference table.
            const showCategory = row.category !== previousCategory;
            previousCategory = row.category;
            return (
              <tr key={`${row.category}-${row.type}`}>
                <td className={showCategory ? undefined : s.mutedCell}>
                  {showCategory ? (CATEGORY_LABEL[row.category] ?? row.category) : ''}
                </td>
                <td>
                  {row.label}
                  {row.offsetDays !== null && <span className={s.staffMeta}>sent {row.offsetDays} days after</span>}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.smsEnabled}
                    aria-label={`${row.label} over SMS`}
                    onChange={(e) => void toggle(row, 'sms', e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.emailEnabled}
                    aria-label={`${row.label} over email`}
                    onChange={(e) => void toggle(row, 'email', e.target.checked)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
