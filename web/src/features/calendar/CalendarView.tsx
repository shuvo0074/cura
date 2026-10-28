import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarViewModel, isCancelled, useViewModel, type Appointment } from '@cura/shared';
import { useServices } from '../../app/services';
import { Modal, uiStyles as s } from '../../ui';
import { AppointmentDetails } from './AppointmentDetails';
import { BlockCalendarDialog } from './BlockCalendarDialog';
import { CalendarToolbar } from './CalendarToolbar';
import { DoctorFilter, DoctorMarkers, usePracticeDoctors } from './doctors';
import { MiniMonth } from './MiniMonth';
import { MonthGrid } from './MonthGrid';
import { TeamDirectory } from './TeamDirectory';
import { TimeGrid } from './TimeGrid';
import { TodayPane } from './TodayPane';
import { rangeLabel, slotLabel } from './calendar-shared';
import { useCalendarSettings, useClosures } from './use-calendar-settings';
import styles from './calendar.module.css';
import panes from './panes.module.css';

/**
 * Calendar (spec: Calendar module).
 *
 * Three panes under a sticky toolbar: navigator and team on the left, the
 * time grid (or month) in the middle, today's schedule and the selected
 * appointment on the right. Each pane scrolls on its own, so the side panes
 * stay put while a long day scrolls.
 */
export function CalendarView({
  practiceId,
  doctorId,
  onOpenPatient,
  onAddWalkIn,
  canReschedule = false,
  canChangeStatus = true,
  canManageSettings = false,
  canViewStaff = false,
  onOpenCalendarSettings,
}: {
  practiceId: string;
  doctorId?: string;
  /** Opens the patient dashboard, carrying the appointment so the encounter
   *  can be opened in one step (spec: one-click prescription access). */
  onOpenPatient?: (patientId: string, appointmentId?: string) => void;
  /**
   * Opens the intake modal at `at` (or now, for a walk-in), booking with the
   * doctor the calendar is showing. Absent = cannot book.
   */
  onAddWalkIn?: (at?: Date, doctorId?: string) => void;
  /** Drag-and-drop and "Edit" time (APPOINTMENT_WRITE). */
  canReschedule?: boolean;
  /** Check in / Engage / Check out / No show (APPOINTMENT_STATUS_WRITE). */
  canChangeStatus?: boolean;
  /** SETTINGS_MANAGE: practice timings, closures and Block Calendar. */
  canManageSettings?: boolean;
  /** STAFF_MANAGE: the team directory. */
  canViewStaff?: boolean;
  /** Deep-link to Settings → Calendar; absent when Settings is not available. */
  onOpenCalendarSettings?: () => void;
}) {
  const { appointments } = useServices();
  const [blocking, setBlocking] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ appointment: Appointment; at: Date } | null>(null);
  const [state, vm] = useViewModel(() => new CalendarViewModel(appointments, practiceId, doctorId));
  const settings = useCalendarSettings(practiceId, { settings: canManageSettings, staff: canViewStaff });
  const doctors = usePracticeDoctors(practiceId);
  const [doctorFilter, setDoctorFilter] = useState<string | undefined>(doctorId);
  const filterByDoctor = useCallback(
    (id: string | undefined) => {
      setDoctorFilter(id);
      vm.setDoctor(id);
    },
    [vm],
  );

  useEffect(() => {
    void vm.initialise();
  }, [vm]);

  // Practice preference "Always show today as the first day" (admins only can
  // read it; everyone else keeps the default).
  useEffect(() => {
    if (settings.showTodayFirst !== null) vm.setTodayFirst(settings.showTodayFirst);
  }, [vm, settings.showTodayFirst]);

  // Recomputed each render: cheap, and it must follow `setTodayFirst`, which
  // changes the range without changing any state field.
  const range = vm.visibleRange();
  const closures = useClosures(practiceId, range.from, range.to, canManageSettings);

  const lanes = useMemo(
    () =>
      state.showCancelled
        ? state.lanes
        : state.lanes.map((lane) => ({ ...lane, appointments: lane.appointments.filter((a) => !isCancelled(a.status)) })),
    [state.lanes, state.showCancelled],
  );

  const handleSelect = useCallback((id: string) => vm.select(id), [vm]);
  const handleSlot = useCallback((at: Date) => onAddWalkIn?.(at, doctorFilter), [onAddWalkIn, doctorFilter]);
  const handleMove = useCallback(
    (id: string, at: Date) => {
      const appointment = vm.find(id);
      if (appointment && new Date(appointment.scheduledAt).getTime() !== at.getTime()) {
        setPendingMove({ appointment, at });
      }
    },
    [vm],
  );

  const selected = vm.find(state.selectedAppointmentId);

  return (
    <DoctorMarkers doctors={doctors} filtered={doctorFilter !== undefined}>
      <div className={styles.shell}>
        <CalendarToolbar
          clinicName={settings.practiceName}
          view={state.view}
          anchorDate={state.anchorDate}
          label={rangeLabel(state.view, state.anchorDate, range.days)}
          showCancelled={state.showCancelled}
          onShift={(d) => vm.shift(d)}
          onToday={() => vm.goToToday()}
          onJump={(date) => vm.jumpTo(date)}
          onView={(view) => vm.setView(view)}
          onShowCancelled={(show) => vm.setShowCancelled(show)}
          onOpenCalendarSettings={onOpenCalendarSettings}
        />

        <div className={styles.body}>
          <aside className={panes.left} aria-label="Navigator and team">
            {/* Closures are a practice setting; others would only see it fail. */}
            {canManageSettings && (
              <button type="button" className={panes.blockButton} onClick={() => setBlocking(true)}>
                ▦ Block Calendar
              </button>
            )}
            <MiniMonth
              month={state.miniMonth}
              anchorDate={state.anchorDate}
              load={state.monthLoad}
              onBrowse={(d) => vm.browseMonth(d)}
              onPick={(date) => vm.jumpTo(date)}
            />
            {doctors && doctors.length > 1 && (
              <DoctorFilter doctors={doctors} selected={doctorFilter} onSelect={filterByDoctor} />
            )}
            {settings.staff && settings.staff.length > 0 && (
              <TeamDirectory staff={settings.staff} specialization={settings.specialization} />
            )}
          </aside>

          <section className={styles.main} data-loading={state.loading || undefined} aria-label="Schedule">
            {state.error && (
              <p className={styles.error} role="alert">
                {state.error}
                <button type="button" className={s.linkButton} onClick={() => vm.dismissError()}>
                  Dismiss
                </button>
              </p>
            )}
            {state.view === 'month' ? (
              <MonthGrid
                anchorDate={state.anchorDate}
                lanes={lanes}
                selectedId={state.selectedAppointmentId}
                onSelect={handleSelect}
                onOpenDay={(date) => vm.openDay(date)}
                onMove={canReschedule ? handleMove : undefined}
              />
            ) : (
              <TimeGrid
                lanes={lanes}
                config={settings.config}
                closures={closures.closures}
                selectedId={state.selectedAppointmentId}
                onSelect={handleSelect}
                onSlotClick={onAddWalkIn ? handleSlot : undefined}
                onMove={canReschedule ? handleMove : undefined}
              />
            )}
          </section>

          <TodayPane
            queue={state.queue}
            today={state.today}
            showCancelled={state.showCancelled}
            onSelect={handleSelect}
            onAddWalkIn={onAddWalkIn ? () => onAddWalkIn(undefined, doctorFilter) : undefined}
            details={
              selected && (
                <AppointmentDetails
                  key={selected.id}
                  practiceId={practiceId}
                  appointment={selected}
                  doctorName={doctors?.find((d) => d.id === selected.doctorId)?.fullName}
                  canReschedule={canReschedule}
                  canChangeStatus={canChangeStatus}
                  onChangeStatus={(status) => void vm.changeStatus(selected.id, status)}
                  onReschedule={(at) => vm.reschedule(selected.id, at)}
                  onOpenPatient={onOpenPatient}
                  onBack={() => vm.select(null)}
                />
              )
            }
          />
        </div>

        {pendingMove && (
          <Modal
            title="Move appointment"
            onClose={() => setPendingMove(null)}
            footer={
              <>
                <button type="button" className={s.secondary} onClick={() => setPendingMove(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={s.primary}
                  autoFocus
                  onClick={() => {
                    void vm.reschedule(pendingMove.appointment.id, pendingMove.at);
                    setPendingMove(null);
                  }}
                >
                  Move
                </button>
              </>
            }
          >
            <p>
              Move <strong>{pendingMove.appointment.patient.fullName}</strong> from{' '}
              {slotLabel(new Date(pendingMove.appointment.scheduledAt))} to <strong>{slotLabel(pendingMove.at)}</strong>?
            </p>
          </Modal>
        )}

        {blocking && (
          <BlockCalendarDialog
            practiceId={practiceId}
            onClose={() => setBlocking(false)}
            // Blocking changes which slots exist, so the grid is reloaded rather
            // than left showing availability that no longer applies.
            onChanged={() => {
              void vm.load();
              void closures.reload();
            }}
          />
        )}
      </div>
    </DoctorMarkers>
  );
}
