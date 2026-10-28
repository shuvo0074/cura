import { AppointmentStatus, type CalendarView } from '../domain/enums';
import { businessRules } from '../config/app-config';
import type { Appointment, QueueSummary } from '../domain/models';
import { ViewModel } from './view-model';
import type { AppointmentApi } from './api-services';

export interface CalendarLane {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  appointments: Appointment[];
}

export interface CalendarState {
  view: CalendarView;
  anchorDate: string;
  lanes: CalendarLane[];
  /** Counters for today (the "Today's Schedule" pane), not the visible range. */
  queue: QueueSummary | null;
  /** Today's appointments in time order, independent of where the grid is. */
  today: Appointment[];
  selectedAppointmentId: string | null;
  /** Spec quick setting: cancelled / no-show slots are hidden unless this is on. */
  showCancelled: boolean;
  /** Month (`YYYY-MM`) shown in the mini navigator; browsing it leaves the grid alone. */
  miniMonth: string;
  /** Bookings per local day across `miniMonth`, for the load dots. */
  monthLoad: Readonly<Record<string, number>>;
  loading: boolean;
  error: string | null;
}

export interface CalendarOptions {
  /**
   * Spec "Always show today as the first day": multi-day views start at the
   * anchor. When off, the week view snaps to Sunday like a wall calendar.
   */
  todayFirst?: boolean;
}

/**
 * Calendar grid state.
 *
 * Dates are local calendar days. Appointments arrive as UTC instants, and a
 * clinic in UTC+6 has visits before 06:00 local that fall on the previous UTC
 * date — bucketing by the ISO prefix would file them under the wrong day.
 *
 * Performance notes:
 *  - Every fetch is cancellable; navigating quickly aborts superseded requests
 *    rather than letting a slow earlier response overwrite a newer view.
 *  - Range results are memoised per visible range, so paging back and forth
 *    re-renders from cache instead of re-fetching.
 *  - Status changes update the local lane optimistically and roll back on
 *    failure, so the grid never waits on a round trip to feel responsive.
 */
export class CalendarViewModel extends ViewModel<CalendarState> {
  /** Bookings on one day at which the mini navigator marks it as heavy. */
  static readonly HEAVY_DAY_THRESHOLD = 8;

  private inFlight: AbortController | null = null;
  private monthInFlight: AbortController | null = null;
  private readonly cache = new Map<string, Appointment[]>();
  private static readonly CACHE_LIMIT = 24;
  private todayFirst: boolean;

  constructor(
    private readonly api: AppointmentApi,
    private readonly practiceId: string,
    private doctorId: string | undefined,
    initialDate: Date = new Date(),
    options: CalendarOptions = {},
  ) {
    super({
      view: businessRules.calendar.defaultView,
      anchorDate: toDateKey(initialDate),
      lanes: [],
      queue: null,
      today: [],
      selectedAppointmentId: null,
      showCancelled: false,
      miniMonth: toDateKey(initialDate).slice(0, 7),
      monthLoad: {},
      loading: false,
      error: null,
    });
    this.todayFirst = options.todayFirst ?? businessRules.calendar.todayFirstByDefault;
  }

  async initialise(): Promise<void> {
    await Promise.all([this.load(), this.refreshToday(), this.loadMonthLoad()]);
  }

  setView(view: CalendarView): void {
    if (view === this.state.view) return;
    this.setState({ view });
    void this.load();
  }

  /** The doctor whose diary is shown; undefined shows every doctor. */
  get doctor(): string | undefined {
    return this.doctorId;
  }

  /**
   * Narrows the grid, today's list, the counters and the month dots to one
   * doctor, or widens them back to all (undefined). Cached ranges belong to
   * the previous filter, so they are dropped.
   */
  setDoctor(doctorId: string | undefined): void {
    if (doctorId === this.doctorId) return;
    this.doctorId = doctorId;
    this.cache.clear();
    this.setState({ selectedAppointmentId: null });
    void this.initialise();
  }

  /** Applies the practice's "today first" preference once it has loaded. */
  setTodayFirst(todayFirst: boolean): void {
    if (todayFirst === this.todayFirst) return;
    this.todayFirst = todayFirst;
    void this.load();
  }

  goToToday(): void {
    this.jumpTo(new Date());
  }

  /** One period back or forward: a calendar month in month view, else the span. */
  shift(direction: -1 | 1): void {
    const next = fromDateKey(this.state.anchorDate);
    if (this.state.view === 'month') {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    } else {
      next.setDate(next.getDate() + this.spanDays(this.state.view) * direction);
    }
    this.jumpTo(next);
  }

  jumpTo(date: Date): void {
    const anchorDate = toDateKey(date);
    this.setState({ anchorDate, miniMonth: anchorDate.slice(0, 7) });
    void this.load();
    void this.loadMonthLoad();
  }

  /** Month cell click: drill into that single day. */
  openDay(date: Date): void {
    this.setState({ view: 'day' });
    this.jumpTo(date);
  }

  select(appointmentId: string | null): void {
    this.setState({ selectedAppointmentId: appointmentId });
  }

  setShowCancelled(showCancelled: boolean): void {
    this.setState({ showCancelled });
  }

  /** Mini navigator arrows: browse months without moving the main grid. */
  browseMonth(direction: -1 | 1): void {
    const [y, m] = this.state.miniMonth.split('-').map(Number);
    this.setState({ miniMonth: toDateKey(new Date(y!, m! - 1 + direction, 1)).slice(0, 7), monthLoad: {} });
    void this.loadMonthLoad();
  }

  /** First and last visible days (local), plus every day key in between. */
  visibleRange(): { from: Date; to: Date; days: string[] } {
    const anchor = fromDateKey(this.state.anchorDate);
    let from: Date;
    let count: number;

    if (this.state.view === 'month') {
      // Whole weeks covering the calendar month, Sunday first.
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      from = addDays(first, -first.getDay());
      count = Math.round((addDays(last, 6 - last.getDay()).getTime() - from.getTime()) / 86_400_000) + 1;
    } else {
      from = this.state.view === 'week' && !this.todayFirst ? addDays(anchor, -anchor.getDay()) : anchor;
      count = this.spanDays(this.state.view);
    }

    const days = Array.from({ length: count }, (_, i) => toDateKey(addDays(from, i)));
    return { from, to: addDays(from, count), days };
  }

  /** The appointment by id, wherever it is loaded (grid or today's list). */
  find(appointmentId: string | null): Appointment | null {
    if (!appointmentId) return null;
    return (
      this.state.lanes.flatMap((lane) => lane.appointments).find((a) => a.id === appointmentId) ??
      this.state.today.find((a) => a.id === appointmentId) ??
      null
    );
  }

  async load(): Promise<void> {
    // Supersede any request still running for a previous range.
    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;

    const { from, to, days } = this.visibleRange();
    const key = `${days[0]}:${days.length}`;

    const cached = this.cache.get(key);
    if (cached) {
      this.setState({ lanes: toLanes(days, cached), loading: false, error: null });
      return;
    }

    this.setState({ loading: true, error: null });

    const result = await this.api.listRange({
      practiceId: this.practiceId,
      from: from.toISOString(),
      to: to.toISOString(),
      ...(this.doctorId ? { doctorId: this.doctorId } : {}),
      signal: controller.signal,
    });

    // A newer navigation started while this was in flight — discard the result.
    if (controller.signal.aborted) return;

    if (!result.ok) {
      this.setState({ loading: false, error: result.error.message });
      return;
    }

    this.remember(key, result.value);
    this.setState({ lanes: toLanes(days, result.value), loading: false });
  }

  async refreshQueue(): Promise<void> {
    const result = await this.api.queueSummary(this.practiceId, toDateKey(new Date()), this.doctorId);
    if (result.ok) this.setState({ queue: result.value });
  }

  /** Today's list and counters for the right-hand pane. */
  async refreshToday(): Promise<void> {
    const start = fromDateKey(toDateKey(new Date()));
    const [list] = await Promise.all([
      this.api.listRange({
        practiceId: this.practiceId,
        from: start.toISOString(),
        to: addDays(start, 1).toISOString(),
        ...(this.doctorId ? { doctorId: this.doctorId } : {}),
      }),
      this.refreshQueue(),
    ]);
    if (list.ok) this.setState({ today: byTime(list.value) });
  }

  /**
   * Optimistic status change.
   *
   * The lane is updated immediately, then reconciled. On failure the previous
   * lanes are restored and the error surfaced, so the UI never silently
   * diverges from the server.
   */
  async changeStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
    const previous = { lanes: this.state.lanes, today: this.state.today };
    const patch = (a: Appointment) => (a.id === appointmentId ? { ...a, status } : a);

    this.setState({
      lanes: previous.lanes.map((lane) => ({ ...lane, appointments: lane.appointments.map(patch) })),
      today: previous.today.map(patch),
    });

    const result = await this.api.changeStatus(appointmentId, status);

    if (!result.ok) {
      this.setState({ ...previous, error: result.error.message });
      return;
    }

    this.cache.clear();
    await Promise.all([this.refreshToday(), this.loadMonthLoad()]);
  }

  /**
   * Drag-and-drop or "Edit time" move. Same optimistic/rollback contract:
   * the card jumps to its new slot at once and returns if the server refuses
   * (e.g. the slot is taken). Resolves `false` on failure.
   */
  async reschedule(appointmentId: string, newStart: Date): Promise<boolean> {
    const previousLanes = this.state.lanes;
    const moved = (a: Appointment): Appointment => {
      if (a.id !== appointmentId) return a;
      const length = new Date(a.endsAt).getTime() - new Date(a.scheduledAt).getTime();
      return {
        ...a,
        scheduledAt: newStart.toISOString(),
        endsAt: new Date(newStart.getTime() + length).toISOString(),
      };
    };
    const days = previousLanes.map((lane) => lane.date);
    this.setState({
      lanes: toLanes(days, previousLanes.flatMap((lane) => lane.appointments).map(moved)),
      error: null,
    });

    const result = await this.api.reschedule(appointmentId, newStart.toISOString());

    if (!result.ok) {
      this.setState({ lanes: previousLanes, error: result.error.message });
      return false;
    }

    this.cache.clear();
    await Promise.all([this.load(), this.refreshToday(), this.loadMonthLoad()]);
    return true;
  }

  /** Clears a surfaced error, e.g. after a refused drag. */
  dismissError(): void {
    this.setState({ error: null });
  }

  /** Applies a websocket queue broadcast without a refetch. */
  applyQueueUpdate(summary: QueueSummary): void {
    if (summary.date !== toDateKey(new Date())) return;
    // Broadcasts are practice-wide; one doctor's counters are fetched instead.
    if (this.doctorId) {
      void this.refreshQueue();
      return;
    }
    this.setState({ queue: summary });
  }

  override dispose(): void {
    this.inFlight?.abort();
    this.monthInFlight?.abort();
    this.cache.clear();
    super.dispose();
  }

  // -------------------------------------------------------------------------

  private spanDays(view: CalendarView): number {
    switch (view) {
      case 'day':
        return 1;
      case 'threeDay':
        return 3;
      case 'week':
        return 7;
      case 'month':
        return 30;
    }
  }

  /** Booking counts for the mini navigator's month (cancellations excluded). */
  private async loadMonthLoad(): Promise<void> {
    this.monthInFlight?.abort();
    const controller = new AbortController();
    this.monthInFlight = controller;

    const month = this.state.miniMonth;
    const [y, m] = month.split('-').map(Number);
    // Counts, not appointments: the dots need ~30 numbers, and a busy month is
    // ~1,500 bookings — fetching those just to count them was the heaviest
    // request the calendar made.
    const result = await this.api.dailyCounts({
      practiceId: this.practiceId,
      from: new Date(y!, m! - 1, 1).toISOString(),
      to: new Date(y!, m!, 1).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(this.doctorId ? { doctorId: this.doctorId } : {}),
      signal: controller.signal,
    });
    if (controller.signal.aborted || !result.ok) return;

    const load: Record<string, number> = {};
    for (const { date, count } of result.value) load[date] = count;
    this.setState({ monthLoad: load });
  }

  /** Bounded LRU so long sessions cannot grow the cache without limit. */
  private remember(key: string, value: Appointment[]): void {
    if (this.cache.size >= CalendarViewModel.CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }
}

/** Cancelled and no-show both free the slot; the grid treats them alike. */
export const isCancelled = (status: AppointmentStatus): boolean =>
  status === AppointmentStatus.CANCELLED || status === AppointmentStatus.NO_SHOW;

/** Local calendar date of an instant, `YYYY-MM-DD`. */
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Local midnight of a `YYYY-MM-DD` key. */
export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const byTime = (list: Appointment[]): Appointment[] =>
  [...list].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

/**
 * Buckets appointments into local days. Every day is pre-seeded so empty
 * columns still render — the grid must show bookable blank slots, not
 * collapse to only days that have appointments.
 */
function toLanes(days: string[], appointments: Appointment[]): CalendarLane[] {
  const lanes = new Map<string, Appointment[]>(days.map((day) => [day, []]));
  for (const appointment of appointments) {
    lanes.get(toDateKey(new Date(appointment.scheduledAt)))?.push(appointment);
  }
  return [...lanes.entries()].map(([date, items]) => ({ date, appointments: byTime(items) }));
}
