import { useEffect, useMemo, useState } from 'react';
import { AppointmentStatus, type Appointment } from '@cura/shared';
import { useServices } from '../../../app/services';
import styles from './header.module.css';

import { Alert, clockTime, useDismiss } from './header-shared';

/**
 * Notification Center (spec 2.1.3).
 *
 * The feed is derived from today's appointments rather than stored: arrivals
 * and imminent appointments are exactly the state the calendar already holds,
 * and a separate notifications table would be a second source of truth that
 * can disagree with the schedule.
 */
export function NotificationBell({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Appointment[]>([]);
  const [seenAt, setSeenAt] = useState<number>(() => Number(localStorage.getItem('cura.alerts.seen') ?? 0));

  const ref = useDismiss(open, () => setOpen(false));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const to = new Date(from.getTime() + 86_400_000);

      const result = await http.request<Appointment[]>('/appointments', {
        query: { practiceId, from: from.toISOString(), to: to.toISOString() },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && result.ok) setRows(result.value);
    };

    void load();
    // Polled rather than pushed: the WebSocket carries queue counters, not the
    // appointment rows this list needs. A minute is well inside the useful
    // window for "a patient has arrived".
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [http, practiceId]);

  const alerts = useMemo<Alert[]>(() => {
    const now = Date.now();
    const soon = now + 60 * 60_000;

    return rows
      .flatMap<Alert>((row) => {
        if (row.status === AppointmentStatus.WAITING && row.checkedInAt) {
          return [
            {
              id: `arrival-${row.id}`,
              text: `${row.patient.fullName} has checked in`,
              detail: `Waiting since ${clockTime(row.checkedInAt)}`,
              tone: 'arrival',
            },
          ];
        }
        const at = new Date(row.scheduledAt).getTime();
        if (row.status === AppointmentStatus.SCHEDULED && at >= now && at <= soon) {
          return [
            {
              id: `upcoming-${row.id}`,
              text: `${row.patient.fullName} at ${clockTime(row.scheduledAt)}`,
              detail: `${row.durationMinutes} min · ${row.visitType.replace('_', ' ').toLowerCase()}`,
              tone: 'upcoming',
            },
          ];
        }
        return [];
      })
      .slice(0, 12);
  }, [rows]);

  // Unread is time-based: anything newer than the last time the tray was
  // opened. Storing per-alert read state would need ids that survive a poll.
  const unread = seenAt === 0 ? alerts.length : alerts.filter((a) => a.tone === 'arrival').length;

  const toggle = () => {
    setOpen((o) => {
      if (!o) {
        const now = Date.now();
        setSeenAt(now);
        localStorage.setItem('cura.alerts.seen', String(now));
      }
      return !o;
    });
  };

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={toggle}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Notifications">
          <header className={styles.popoverHead}>Notifications</header>
          {alerts.length === 0 ? (
            <p className={styles.popoverEmpty}>Nothing needs your attention right now.</p>
          ) : (
            <ul className={styles.alertList}>
              {alerts.map((alert) => (
                <li key={alert.id} data-tone={alert.tone}>
                  <span className={styles.alertText}>{alert.text}</span>
                  <span className={styles.alertDetail}>{alert.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
