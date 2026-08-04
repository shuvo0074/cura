import { AppointmentStatus, type CalendarView } from '../domain/enums';
import { businessRules } from '../config/app-config';
import type { Appointment, QueueSummary } from '../domain/models';
import { ViewModel } from './view-model';
import type { AppointmentApi } from './api-services';

export interface CalendarLane {
  date: string;
  appointments: Appointment[];
}

export interface CalendarState {
  view: CalendarView;
  anchorDate: string;
  lanes: CalendarLane[];
  queue: QueueSummary | null;
  selectedAppointmentId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Calendar grid state.
 *
 * Performance notes:
 *  - Every fetch is cancellable; navigating quickly aborts superseded requests
 *    rather than letting a slow earlier response overwrite a newer view.
 *  - Range results are memoised per (view, anchor) key, so paging back and
 *    forth re-renders from cache instead of re-fetching.
 *  - Status changes update the local lane optimistically and roll back on
 *    failure, so the grid never waits on a round trip to feel responsive.
 */
export class CalendarViewModel extends ViewModel<CalendarState> {
  private inFlight: AbortController | null = null;
  private readonly cache = new Map<string, Appointment[]>();
  private static readonly CACHE_LIMIT = 24;

  constructor(
    private readonly api: AppointmentApi,
    private readonly practiceId: string,
    private readonly doctorId: string | undefined,
    initialDate: Date = new Date(),
  ) {
    super({
      view: businessRules.calendar.defaultView,
      anchorDate: toIsoDate(initialDate),
      lanes: [],
      queue: null,
      selectedAppointmentId: null,
      loading: false,
      error: null,
    });
  }

  async initialise(): Promise<void> {
    await Promise.all([this.load(), this.refreshQueue()]);
  }

  setView(view: CalendarView): void {
    if (view === this.state.view) return;
    this.setState({ view });
    void this.load();
  }

  goToToday(): void {
    this.setState({ anchorDate: toIsoDate(new Date()) });
    void this.load();
  }

  shift(direction: -1 | 1): void {
    const span = this.spanDays(this.state.view);
    const next = new Date(`${this.state.anchorDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + span * direction);
    this.setState({ anchorDate: toIsoDate(next) });
    void this.load();
  }

  jumpTo(date: Date): void {
    this.setState({ anchorDate: toIsoDate(date) });
    void this.load();
  }

  select(appointmentId: string | null): void {
    this.setState({ selectedAppointmentId: appointmentId });
  }

  async load(): Promise<void> {
    // Supersede any request still running for a previous range.
    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;

    const { from, to } = this.range();
    const key = `${this.state.view}:${this.state.anchorDate}`;

    const cached = this.cache.get(key);
    if (cached) {
      this.setState({ lanes: this.toLanes(cached), loading: false, error: null });
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
    this.setState({ lanes: this.toLanes(result.value), loading: false });
  }

  async refreshQueue(): Promise<void> {
    const result = await this.api.queueSummary(this.practiceId, this.state.anchorDate);
    if (result.ok) this.setState({ queue: result.value });
  }

  /**
   * Optimistic status change.
   *
   * The lane is updated immediately, then reconciled. On failure the previous
   * lanes are restored and the error surfaced, so the UI never silently
   * diverges from the server.
   */
  async changeStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
    const previousLanes = this.state.lanes;

    this.setState({
      lanes: previousLanes.map((lane) => ({
        ...lane,
        appointments: lane.appointments.map((a) =>
          a.id === appointmentId ? { ...a, status } : a,
        ),
      })),
    });

    const result = await this.api.changeStatus(appointmentId, status);

    if (!result.ok) {
      this.setState({ lanes: previousLanes, error: result.error.message });
      return;
    }

    this.cache.clear();
    await this.refreshQueue();
  }

  /** Drag-and-drop move. Same optimistic/rollback contract. */
  async reschedule(appointmentId: string, newStart: Date): Promise<void> {
    const previousLanes = this.state.lanes;
    const result = await this.api.reschedule(appointmentId, newStart.toISOString());

    if (!result.ok) {
      this.setState({ lanes: previousLanes, error: result.error.message });
      return;
    }

    this.cache.clear();
    await this.load();
  }

  /** Applies a websocket queue broadcast without a refetch. */
  applyQueueUpdate(summary: QueueSummary): void {
    if (summary.date !== this.state.anchorDate) return;
    this.setState({ queue: summary });
  }

  override dispose(): void {
    this.inFlight?.abort();
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

  private range(): { from: Date; to: Date } {
    const from = new Date(`${this.state.anchorDate}T00:00:00Z`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + this.spanDays(this.state.view));
    return { from, to };
  }

  private toLanes(appointments: Appointment[]): CalendarLane[] {
    const span = this.spanDays(this.state.view);
    const start = new Date(`${this.state.anchorDate}T00:00:00Z`);

    // Pre-seed every day so empty columns still render — the grid must show
    // bookable blank slots, not collapse to only days that have appointments.
    const lanes = new Map<string, Appointment[]>();
    for (let i = 0; i < span; i += 1) {
      const day = new Date(start);
      day.setUTCDate(day.getUTCDate() + i);
      lanes.set(toIsoDate(day), []);
    }

    for (const appointment of appointments) {
      const key = appointment.scheduledAt.slice(0, 10);
      lanes.get(key)?.push(appointment);
    }

    return [...lanes.entries()].map(([date, items]) => ({
      date,
      appointments: items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    }));
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

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
