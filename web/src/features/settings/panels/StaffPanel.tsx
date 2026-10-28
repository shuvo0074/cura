import { useState } from 'react';
import {
  Failed,
  Loading,
  Panel,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { StaffModal } from './StaffModal';
import { Kind, MEDICAL_ROLES, NOTIFICATION_ROWS, Staff } from './staff-shared';
import { accessLabel } from './staff-shared';

export function StaffPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<Staff[]>('/settings/staff', { practiceId });
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
      title="Practice Staff"
      description="Switching access off ends the member's active sessions immediately."
      action={
        <button type="button" className={s.primary} onClick={() => setEditing('new')}>
          Add
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label="Personnel type">
        {(['doctor', 'staff'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            data-active={kind === k || undefined}
            onClick={() => setKind(k)}
          >
            {k === 'doctor' ? 'Doctors' : 'Other Staff'}
          </button>
        ))}
      </div>

      {mutate.error && <Failed message={mutate.error} />}

      {rows.length === 0 ? (
        <p className={s.muted}>No {kind === 'doctor' ? 'doctors' : 'staff'} added yet.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Access type</th>
              <th>Daily schedule</th>
              <th>Appointments</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <span className={s.staffName}>{row.fullName}</span>
                  <span className={s.staffMeta}>
                    {[row.mobile, row.email, row.bmdcNumber && `BMDC ${row.bmdcNumber}`]
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
                    {row.isActive ? accessLabel(row.role, kind) : 'None'}
                  </button>
                </td>
                {NOTIFICATION_ROWS.map((notification) => (
                  <td key={notification.label}>
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
                            {channel === 'sms' ? 'SMS' : 'Email'}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                ))}
                <td>
                  <button type="button" className={s.linkButton} onClick={() => setEditing(row)}>
                    Edit
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
