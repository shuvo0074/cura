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

import { StaffModal } from './StaffModal';
import { Kind, MEDICAL_ROLES, NOTIFICATION_ROWS, Staff } from './staff-shared';
import { accessLabel } from './staff-shared';

export function StaffPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<Staff[]>('/settings/staff', { practiceId });
  const { t, locale } = useT();
  const mutate = useMutation();
  const [kind, setKind] = useState<Kind>('doctor');
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const rows = (data ?? []).filter((row) =>
    kind === 'doctor' ? MEDICAL_ROLES.includes(row.role) : !MEDICAL_ROLES.includes(row.role),
  );

  const toggleAccess = async (row: Staff) => {
    await mutate.run(`/settings/staff/${row.userId}/access`, {
      method: 'PUT',
      body: { practiceId, isActive: !row.isActive },
    });
    await reload();
  };

  const toggleNotification = async (row: Staff, key: string, next: boolean) => {
    await mutate.run(`/settings/staff/${row.userId}`, {
      method: 'PATCH',
      body: { practiceId, [key]: next },
    });
    await reload();
  };

  return (
    <Panel
      title={t('settings.nav.staff')}
      description={t('settings.staff.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          {t('common.add')}
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label={t('settings.staff.personnelType')}>
        {(['doctor', 'staff'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            data-active={kind === k || undefined}
            onClick={() => setKind(k)}
          >
            {k === 'doctor' ? t('settings.staff.doctors') : t('settings.staff.otherStaff')}
          </button>
        ))}
      </div>

      {mutate.error && <Failed message={mutate.error} />}

      {rows.length === 0 ? (
        <p className={s.muted}>{kind === 'doctor' ? t('settings.staff.noDoctors') : t('settings.staff.noStaff')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('settings.name')}</th>
              <th>{t('settings.staff.accessType')}</th>
              <th>{t('settings.staff.dailySchedule')}</th>
              <th>{t('settings.staff.appointments')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <span className={s.staffName}>{row.fullName}</span>
                  <span className={s.staffMeta}>
                    {[
                      row.mobile,
                      row.email,
                      row.bmdcNumber && t('settings.staff.bmdc', { number: row.bmdcNumber }),
                      !row.hasLogin && t('settings.staff.noLogin'),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={s.toggle}
                    data-on={row.isActive || undefined}
                    onClick={() => void toggleAccess(row)}
                  >
                    {row.isActive ? accessLabel(row.role, kind, locale) : t('settings.staff.none')}
                  </button>
                </td>
                {NOTIFICATION_ROWS.map((notification) => (
                  <td key={notification.key}>
                    <div className={s.channelPair}>
                      {(['sms', 'email'] as const).map((channel) => {
                        const key = notification[channel];
                        return (
                          <label key={channel} className={s.channel}>
                            <input
                              type="checkbox"
                              checked={row[key]}
                              onChange={(e) => void toggleNotification(row, key, e.target.checked)}
                            />
                            {channel === 'sms' ? t('settings.sms') : t('settings.email')}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                ))}
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(row)}>
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <StaffModal
          practiceId={practiceId}
          kind={kind}
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
