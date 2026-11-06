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
import { useT } from '../../../i18n';

import { CommRow, PracticeSettings, isCategory } from './practice-ops-shared';

export function CommunicationsPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<CommRow[]>('/settings/communications', { practiceId });
  const practice = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const mutate = useMutation();
  const { t, tm, rich } = useT();

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
    <Panel title={t('settings.nav.communications')} description={t('settings.comms.description')}>
      <div className={s.identity}>
        <h3 className={s.subtitle}>{t('settings.comms.senderIdentity')}</h3>
        <p className={s.hint}>
          {rich('settings.comms.sentFrom', undefined, {
            sms: <strong>{practice.data?.contactNumber ?? t('settings.comms.practiceNumber')}</strong>,
            email: <strong>{practice.data?.email ?? t('settings.comms.practiceEmail')}</strong>,
          })}
        </p>
      </div>

      <Row cols={1}>
        <Field label={t('settings.comms.smsLanguage')} hint={t('settings.comms.smsLanguageHint')}>
          <select
            className={s.input}
            value={practice.data?.smsLanguage ?? 'en'}
            onChange={(e) => void setLanguage(e.target.value)}
          >
            <option value="en">{t('settings.comms.english')}</option>
            <option value="bn">{t('settings.comms.bangla')}</option>
          </select>
        </Field>
      </Row>

      {mutate.error && <Failed message={mutate.error} />}

      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('settings.comms.category')}</th>
            <th>{t('settings.type')}</th>
            <th>{t('settings.sms')}</th>
            <th>{t('settings.email')}</th>
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
                  {showCategory ? (isCategory(row.category) ? t(`settings.comms.cat.${row.category}`) : row.category) : ''}
                </td>
                <td>
                  {tm(row.label)}
                  {row.offsetDays !== null && (
                    <span className={s.staffMeta}>{t('settings.comms.sentAfter', { count: row.offsetDays })}</span>
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.smsEnabled}
                    aria-label={t('settings.comms.overSms', { label: tm(row.label) })}
                    onChange={(e) => void toggle(row, 'sms', e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.emailEnabled}
                    aria-label={t('settings.comms.overEmail', { label: tm(row.label) })}
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
