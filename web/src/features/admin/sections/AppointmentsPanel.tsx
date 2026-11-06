import { useState } from 'react';
import { useT, type TranslationKey } from '../../../i18n';
import { Failed, Loading, Panel, uiStyles as s, useResource } from '../../../ui';

/** A serial booking as the admin list returns it. */
interface AdminAppointment {
  id: string;
  doctor_name: string;
  patient_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  session_time: string | null;
  serial_no: number | null;
  venue: string | null;
  status: string;
}

const STATUSES = [
  { key: '', label: 'admin.appointments.status.all' },
  { key: 'confirmed', label: 'admin.appointments.status.confirmed' },
  { key: 'cancelled', label: 'admin.appointments.status.cancelled' },
  { key: 'completed', label: 'admin.appointments.status.completed' },
] as const satisfies readonly { key: string; label: TranslationKey }[];

type StatusKey = (typeof STATUSES)[number]['key'];

/** Every serial booking made on Cura Website, newest first. */
export function AppointmentsPanel() {
  const [status, setStatus] = useState<StatusKey>('');
  const { data, error, loading } = useResource<AdminAppointment[]>('/directory/admin/appointments', {
    status: status || undefined,
  });
  const appointments = data ?? [];
  const { t, fmt } = useT();
  const statusLabel = (value: string): string => {
    const item = STATUSES.find((entry) => entry.key === value);
    return item ? t(item.label) : value;
  };

  return (
    <Panel title={t('admin.appointments.title')} description={t('admin.appointments.description')}>
      <div className={s.filters} role="group" aria-label={t('admin.appointments.filterAria')}>
        {STATUSES.map((item) => (
          <button
            key={item.key || 'all'}
            type="button"
            data-active={status === item.key || undefined}
            aria-pressed={status === item.key}
            onClick={() => setStatus(item.key)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Failed message={error} />
      ) : appointments.length === 0 ? (
        <p className={s.muted}>{t('admin.appointments.empty')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('admin.appointments.col.doctor')}</th>
              <th>{t('admin.appointments.col.patientPhone')}</th>
              <th>{t('admin.appointments.col.date')}</th>
              <th>{t('admin.appointments.col.time')}</th>
              <th>{t('admin.appointments.col.serial')}</th>
              <th>{t('admin.appointments.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((item) => (
              <tr key={item.id}>
                <td>{item.doctor_name}</td>
                <td>{item.patient_phone ?? ''}</td>
                <td>{fmt.date(`${item.appointment_date.slice(0, 10)}T00:00`)}</td>
                <td>
                  {item.session_time ||
                    fmt.time(`${item.appointment_date.slice(0, 10)}T${item.appointment_time.slice(0, 5)}`)}
                </td>
                <td>
                  {item.serial_no ? (
                    <>
                      {t('admin.appointments.serialNo', { serial: item.serial_no })}
                      {item.venue && <span className={s.staffMeta}>{item.venue}</span>}
                    </>
                  ) : (
                    ''
                  )}
                </td>
                <td>{statusLabel(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
