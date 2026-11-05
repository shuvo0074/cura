import { useState } from 'react';
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
  { key: '', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
] as const;

type StatusKey = (typeof STATUSES)[number]['key'];

const statusLabel = (status: string): string =>
  STATUSES.find((item) => item.key === status)?.label ?? status;

/** Every serial booking made on Cura Website, newest first. */
export function AppointmentsPanel() {
  const [status, setStatus] = useState<StatusKey>('');
  const { data, error, loading } = useResource<AdminAppointment[]>('/directory/admin/appointments', {
    status: status || undefined,
  });
  const appointments = data ?? [];

  return (
    <Panel title="Appointments" description="Serial bookings patients made on Cura Website.">
      <div className={s.filters} role="group" aria-label="Filter by status">
        {STATUSES.map((item) => (
          <button
            key={item.key || 'all'}
            type="button"
            data-active={status === item.key || undefined}
            aria-pressed={status === item.key}
            onClick={() => setStatus(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Failed message={error} />
      ) : appointments.length === 0 ? (
        <p className={s.muted}>No appointments.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Patient phone</th>
              <th>Date</th>
              <th>Time</th>
              <th>Serial</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((item) => (
              <tr key={item.id}>
                <td>{item.doctor_name}</td>
                <td>{item.patient_phone ?? ''}</td>
                <td>{item.appointment_date.slice(0, 10)}</td>
                <td>{item.session_time || item.appointment_time.slice(0, 5)}</td>
                <td>
                  {item.serial_no ? (
                    <>
                      #{item.serial_no}
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
