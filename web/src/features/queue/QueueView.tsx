import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentStatus, type Appointment } from '@cura/shared';
import { useServices } from '../../app/services';
import { Failed, Loading, uiStyles as s } from '../../ui';
import { QueueCard } from './QueueCard';
import styles from './queue.module.css';

/** Board columns, in the order a patient moves through the clinic. */
const COLUMNS: ReadonlyArray<{ status: AppointmentStatus; label: string; hint: string }> = [
  { status: AppointmentStatus.SCHEDULED, label: 'Booked', hint: 'Not arrived yet' },
  { status: AppointmentStatus.WAITING, label: 'Waiting', hint: 'Checked in at the desk' },
  { status: AppointmentStatus.ENGAGED, label: 'With doctor', hint: 'In consultation' },
  { status: AppointmentStatus.DONE, label: 'Done', hint: 'Visit complete' },
];

/** No websocket client on the web yet, so the board refreshes on a timer. */
const REFRESH_MS = 30_000;

/**
 * Patient Management (spec 2.2): today's queue as a board.
 *
 * The calendar answers "when"; this answers "where is everyone right now" —
 * the view the front desk keeps open through a session. Moves use the shared
 * transition graph, so the board offers exactly the actions the API accepts.
 */
export function QueueView({
  practiceId,
  canMove,
  onOpenPatient,
}: {
  practiceId: string;
  canMove: boolean;
  onOpenPatient: (patientId: string, appointmentId?: string) => void;
}) {
  const { appointments } = useServices();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + 86_400_000);
      const result = await appointments.listRange({
        practiceId,
        from: from.toISOString(),
        to: to.toISOString(),
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;
      if (result.ok) {
        setItems(result.value);
        setError(null);
      } else {
        setError(result.error.message);
      }
    },
    [appointments, practiceId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const move = useCallback(
    async (id: string, status: AppointmentStatus) => {
      setBusyId(id);
      const result = await appointments.changeStatus(id, status);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setItems((current) => current?.map((a) => (a.id === id ? { ...a, ...result.value } : a)) ?? null);
    },
    [appointments],
  );

  const byStatus = useMemo(() => {
    const groups = new Map<AppointmentStatus, Appointment[]>();
    for (const a of [...(items ?? [])].sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))) {
      groups.set(a.status, [...(groups.get(a.status) ?? []), a]);
    }
    return groups;
  }, [items]);

  const missed =
    (byStatus.get(AppointmentStatus.CANCELLED)?.length ?? 0) + (byStatus.get(AppointmentStatus.NO_SHOW)?.length ?? 0);

  if (!items && !error) return <Loading />;

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <div>
          <h1 className={s.title}>Patient Management</h1>
          <p className={s.hint}>
            Today&rsquo;s queue —{' '}
            {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}.
            {missed > 0 && ` ${missed} cancelled or no-show.`}
          </p>
        </div>
        <button type="button" className={s.secondary} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {error && <Failed message={error} />}

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status) ?? [];
          return (
            <section key={col.status} className={styles.column} data-status={col.status.toLowerCase()}>
              <header className={styles.columnHead}>
                <span>{col.label}</span>
                <span className={styles.count}>{list.length}</span>
              </header>
              <p className={styles.columnHint}>{col.hint}</p>
              {list.length === 0 ? (
                <p className={styles.empty}>—</p>
              ) : (
                list.map((a) => (
                  <QueueCard
                    key={a.id}
                    appointment={a}
                    busy={busyId === a.id}
                    canMove={canMove}
                    onMove={move}
                    onOpen={onOpenPatient}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
