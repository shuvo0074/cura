import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BookableDoctor } from '@cura/shared';
import { useServices } from '../../app/services';
import { useDismiss } from './calendar-shared';
import styles from './panes.module.css';

/** Theme slots for doctor colours (`--color-doctor-*`), assigned in roster order. */
const COLOR_SLOTS = ['one', 'two', 'three', 'four', 'five', 'six'] as const;

export interface CalendarDoctor extends BookableDoctor {
  /** CSS colour (a theme variable) marking this doctor's appointments. */
  color: string;
}

/** The practice's doctors, each with a colour; null until loaded. */
export function usePracticeDoctors(practiceId: string): CalendarDoctor[] | null {
  const { appointments } = useServices();
  const [doctors, setDoctors] = useState<CalendarDoctor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void appointments.listDoctors(practiceId).then((result) => {
      if (cancelled || !result.ok) return;
      setDoctors(
        result.value.map((d, i) => ({ ...d, color: `var(--color-doctor-${COLOR_SLOTS[i % COLOR_SLOTS.length]})` })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [appointments, practiceId]);

  return doctors;
}

/**
 * Which doctor marker, if any, each card shows. Markers appear only when the
 * calendar mixes several doctors' diaries; filtered to one, they are noise.
 */
const MarkerContext = createContext<ReadonlyMap<string, CalendarDoctor> | null>(null);

export function DoctorMarkers({
  doctors,
  filtered,
  children,
}: {
  doctors: readonly CalendarDoctor[] | null;
  filtered: boolean;
  children: ReactNode;
}) {
  const byId = useMemo(
    () => (doctors && doctors.length > 1 && !filtered ? new Map(doctors.map((d) => [d.id, d])) : null),
    [doctors, filtered],
  );
  return <MarkerContext.Provider value={byId}>{children}</MarkerContext.Provider>;
}

/** The doctor to mark an appointment with, or null when markers are off. */
export function useDoctorMarker(doctorId: string): CalendarDoctor | null {
  return useContext(MarkerContext)?.get(doctorId) ?? null;
}

/**
 * Left-pane doctor filter: a dropdown of "All doctors" or one doctor's diary.
 * Each name carries the colour that marks that doctor's cards in the
 * all-doctors view, so the open list doubles as the colour key.
 */
export function DoctorFilter({
  doctors,
  selected,
  onSelect,
}: {
  doctors: readonly CalendarDoctor[];
  selected: string | undefined;
  onSelect: (doctorId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const current = doctors.find((d) => d.id === selected);

  const swatch = (color?: string) => (
    <span className={styles.doctorSwatch} style={color ? { background: color } : undefined} aria-hidden="true" />
  );

  const option = (id: string | undefined, label: string, color?: string) => (
    <button
      key={id ?? 'all'}
      type="button"
      role="radio"
      aria-checked={selected === id}
      className={styles.doctorOption}
      onClick={() => {
        onSelect(id);
        setOpen(false);
      }}
    >
      {swatch(color)}
      <span className={styles.doctorName}>{label}</span>
    </button>
  );

  return (
    <section className={styles.doctorFilter} ref={ref}>
      <h3 className={styles.groupTitle} id="doctor-filter-title">
        Show schedule for
      </h3>
      <button
        type="button"
        className={styles.doctorTrigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby="doctor-filter-title doctor-filter-value"
        onClick={() => setOpen((o) => !o)}
      >
        {swatch(current?.color)}
        <span className={styles.doctorName} id="doctor-filter-value">
          {current?.fullName ?? 'All doctors'}
        </span>
        <span className={styles.doctorChevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div role="radiogroup" aria-labelledby="doctor-filter-title" className={styles.doctorMenu}>
          {option(undefined, 'All doctors')}
          {doctors.map((d) => option(d.id, d.fullName, d.color))}
        </div>
      )}
    </section>
  );
}

/** Colour dot for one appointment's doctor; renders nothing when markers are off. */
export function DoctorDot({ doctorId, className }: { doctorId: string; className?: string | undefined }) {
  const doctor = useDoctorMarker(doctorId);
  if (!doctor) return null;
  return (
    <span
      className={className}
      style={{ background: doctor.color }}
      role="img"
      aria-label={doctor.fullName}
      title={doctor.fullName}
    />
  );
}
