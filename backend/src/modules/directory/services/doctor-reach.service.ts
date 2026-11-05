import { Inject, Injectable } from '@nestjs/common';
import {
  DOCTOR_LISTING_REPOSITORY,
  DOCTOR_PROFILE_REPOSITORY,
  DOCTOR_REACH_REPOSITORY,
  type DirectoryIdentity,
  type DoctorListingRepository,
  type DoctorProfileRepository,
  type DoctorReachRepository,
  type Row,
} from '../../../core/ports/directory.ports';
import { CLOCK, type Clock } from '../../../core/ports/services';
import { directoryNotFound } from '../domain/errors';
import { addDays, dateOnly, dhakaNow } from '../domain/schedule';

const DAYS = 30;

/** Views, shares and call taps, counted on Bangladesh days. */
@Injectable()
export class DoctorReachService {
  constructor(
    @Inject(DOCTOR_REACH_REPOSITORY) private readonly reach: DoctorReachRepository,
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(DOCTOR_PROFILE_REPOSITORY) private readonly profiles: DoctorProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The owner viewing their own page does not count. */
  async view(doctorId: string, identity: DirectoryIdentity | null): Promise<void> {
    if (identity?.doctorId === doctorId) return;
    if (!(await this.listings.findVisible(doctorId))) throw directoryNotFound('Doctor');
    await this.reach.addView(doctorId, dateOnly(this.today()));
  }

  async share(doctorId: string) {
    const row = await this.reach.addShare(doctorId, dateOnly(this.today()));
    if (!row) throw directoryNotFound('Doctor');
    return { id: row.id, share_count: row.shareCount };
  }

  async call(doctorId: string, body: Row) {
    const clean = (value: unknown) => (typeof value === 'string' && value ? value.slice(0, 200) : null);
    const row = await this.reach.addCall(doctorId, clean(body?.venue), clean(body?.phone));
    if (!row) throw directoryNotFound('Doctor');
    return { id: row.id, created_at: row.createdAt };
  }

  /** The last 30 days against the 30 before, with a day-by-day series. */
  async insights(doctorId: string) {
    const today = this.today();
    const firstCurrent = addDays(today, -(DAYS - 1));
    const firstPrevious = addDays(today, -(DAYS * 2 - 1));
    const [stats, callTimes, endorsements, reviews] = await Promise.all([
      this.reach.dailyStats(doctorId, dateOnly(firstPrevious)),
      this.reach.callTimes(doctorId, new Date(dateOnly(firstPrevious).getTime() - 86_400_000)),
      this.profiles.endorsementTotals(doctorId),
      this.profiles.reviewSummary(doctorId),
    ]);

    const statDays = stats.map((row) => ({ ...row, date: row.day.toISOString().slice(0, 10) }));
    const callDays = callTimes.map((time) => dhakaNow(time).date).filter((date) => date >= firstPrevious);
    const sum = (rows: typeof statDays, field: 'views' | 'shares', current: boolean) =>
      rows.filter((r) => (r.date >= firstCurrent) === current).reduce((total, r) => total + r[field], 0);

    const series = Array.from({ length: DAYS }, (_, index) => {
      const day = addDays(firstCurrent, index);
      return {
        day,
        views: statDays.find((row) => row.date === day)?.views ?? 0,
        calls: callDays.filter((date) => date === day).length,
      };
    });

    return {
      days: DAYS,
      series,
      views: sum(statDays, 'views', true),
      views_prev: sum(statDays, 'views', false),
      shares: sum(statDays, 'shares', true),
      shares_prev: sum(statDays, 'shares', false),
      calls: callDays.filter((date) => date >= firstCurrent).length,
      calls_prev: callDays.filter((date) => date < firstCurrent).length,
      recognitions: endorsements.recognitions,
      peers: endorsements.peers,
      reviews,
    };
  }

  private today(): string {
    return dhakaNow(this.clock.now()).date;
  }
}
