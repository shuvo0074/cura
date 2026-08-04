import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  AppointmentStatus,
  businessRules,
  visitTypePrefix,
  type Appointment,
  type CalendarView as CalendarViewMode,
} from '@cura/shared';
import { useViewModel } from '@cura/shared';
import { useServices } from '../../app/services';
import { CalendarViewModel, type CalendarLane } from '@cura/shared';
import styles from './calendar.module.css';

/**
 * Appointment card.
 *
 * Memoised on identity: a lane re-render caused by a sibling status change does
 * not repaint unaffected cards. With 30+ slots per day across a week view this
 * is the difference between repainting ~10 nodes and ~200.
 */
const AppointmentCard = memo(function AppointmentCard({
  appointment,
  selected,
  onSelect,
}: {
  appointment: Appointment;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const time = useMemo(
    () =>
      new Date(appointment.scheduledAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [appointment.scheduledAt],
  );

  return (
    <button
      type="button"
      className={styles.card}
      data-status={appointment.status.toLowerCase()}
      data-selected={selected || undefined}
      onClick={() => onSelect(appointment.id)}
      aria-pressed={selected}
    >
      <span className={styles.cardTime}>{time}</span>
      <span className={styles.cardName}>
        <span className={styles.visitBadge} data-visit={appointment.visitType.toLowerCase()}>
          {visitTypePrefix[appointment.visitType]}
        </span>
        {appointment.patient.fullName}
      </span>
      {appointment.tokenNumber !== null && (
        <span className={styles.cardToken}>#{appointment.tokenNumber}</span>
      )}
    </button>
  );
});

const DayLane = memo(function DayLane({
  lane,
  selectedId,
  onSelect,
}: {
  lane: CalendarLane;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const heading = useMemo(
    () =>
      new Date(`${lane.date}T00:00:00Z`).toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [lane.date],
  );

  return (
    <section className={styles.lane} aria-label={heading}>
      <header className={styles.laneHeader}>{heading}</header>
      <div className={styles.laneBody}>
        {lane.appointments.length === 0 ? (
          <p className={styles.empty}>No appointments</p>
        ) : (
          lane.appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              selected={appointment.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
});

const VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: 'Day',
  threeDay: '3 Day',
  week: 'Week',
  month: 'Month',
};

export function CalendarView({
  practiceId,
  doctorId,
  onOpenPatient,
}: {
  practiceId: string;
  doctorId?: string;
  /** Opens the patient dashboard, carrying the appointment so the encounter
   *  can be opened in one step (spec: one-click prescription access). */
  onOpenPatient?: (patientId: string, appointmentId?: string) => void;
}) {
  const { appointments } = useServices();
  const [state, vm] = useViewModel(
    () => new CalendarViewModel(appointments, practiceId, doctorId),
  );

  useEffect(() => {
    void vm.initialise();
  }, [vm]);

  const handleSelect = useCallback((id: string) => vm.select(id), [vm]);

  const selected = useMemo(
    () =>
      state.lanes
        .flatMap((lane) => lane.appointments)
        .find((a) => a.id === state.selectedAppointmentId) ?? null,
    [state.lanes, state.selectedAppointmentId],
  );

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button type="button" onClick={() => vm.shift(-1)} aria-label="Previous period">
            ‹
          </button>
          <span className={styles.anchor}>{state.anchorDate}</span>
          <button type="button" onClick={() => vm.shift(1)} aria-label="Next period">
            ›
          </button>
          <button type="button" className={styles.today} onClick={() => vm.goToToday()}>
            Today
          </button>
        </div>

        <div className={styles.viewGroup} role="tablist" aria-label="Calendar view">
          {(businessRules.calendar.views as readonly CalendarViewMode[]).map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={state.view === view}
              data-active={state.view === view || undefined}
              onClick={() => vm.setView(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.grid} data-loading={state.loading || undefined}>
          {state.error ? (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          ) : (
            state.lanes.map((lane) => (
              <DayLane
                key={lane.date}
                lane={lane}
                selectedId={state.selectedAppointmentId}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>

        <aside className={styles.sidePanel} aria-label="Details">
          {state.queue && (
            <div className={styles.counters}>
              <Counter label="Waiting" value={state.queue.waiting} tone="waiting" />
              <Counter label="Engaged" value={state.queue.engaged} tone="engaged" />
              <Counter label="Done" value={state.queue.done} tone="done" />
              <Counter label="Cancelled" value={state.queue.cancelled} tone="cancelled" />
            </div>
          )}

          {selected ? (
            <div className={styles.details}>
              <h2 className={styles.detailsName}>{selected.patient.fullName}</h2>
              <p className={styles.detailsMeta}>
                {selected.patient.curaId} · {selected.patient.mobile}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => void vm.changeStatus(selected.id, AppointmentStatus.WAITING)}
                  disabled={selected.status !== AppointmentStatus.SCHEDULED}
                >
                  Check in
                </button>
                <button
                  type="button"
                  onClick={() => void vm.changeStatus(selected.id, AppointmentStatus.ENGAGED)}
                  disabled={selected.status !== AppointmentStatus.WAITING}
                >
                  Engage
                </button>
                <button
                  type="button"
                  onClick={() => void vm.changeStatus(selected.id, AppointmentStatus.NO_SHOW)}
                  disabled={selected.status === AppointmentStatus.DONE}
                >
                  No show
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPatient?.(selected.patient.id, selected.id)}
                >
                  Write prescription
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.placeholder}>Select a patient slot to view details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

const Counter = memo(function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={styles.counter} data-tone={tone}>
      <span className={styles.counterValue}>{value}</span>
      <span className={styles.counterLabel}>{label}</span>
    </div>
  );
});
