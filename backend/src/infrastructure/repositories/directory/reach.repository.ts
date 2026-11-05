import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DoctorReachRepository } from '../../../core/ports/directory.ports';
import { orNull } from './prisma-errors';

@Injectable()
export class PrismaDoctorReachRepository implements DoctorReachRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addView(doctorId: string, day: Date): Promise<void> {
    await this.prisma.doctorDailyStat.upsert({
      where: { doctorId_day: { doctorId, day } },
      create: { doctorId, day, views: 1 },
      update: { views: { increment: 1 } },
    });
  }

  async addShare(doctorId: string, day: Date) {
    const visible = await this.prisma.doctorListing.findFirst({ where: { id: doctorId, hidden: false }, select: { id: true } });
    if (!visible) return null;
    const [row] = await this.prisma.$transaction([
      this.prisma.doctorListing.update({
        where: { id: doctorId },
        data: { shareCount: { increment: 1 } },
        select: { id: true, shareCount: true },
      }),
      this.prisma.doctorDailyStat.upsert({
        where: { doctorId_day: { doctorId, day } },
        create: { doctorId, day, shares: 1 },
        update: { shares: { increment: 1 } },
      }),
    ]);
    return row;
  }

  async addCall(doctorId: string, venue: string | null, phone: string | null) {
    const visible = await this.prisma.doctorListing.findFirst({ where: { id: doctorId, hidden: false }, select: { id: true } });
    if (!visible) return null;
    return orNull(
      this.prisma.callLog.create({ data: { doctorId, venue, phone }, select: { id: true, createdAt: true } }),
    );
  }

  dailyStats(doctorId: string, since: Date) {
    return this.prisma.doctorDailyStat.findMany({
      where: { doctorId, day: { gte: since } },
      select: { day: true, views: true, shares: true },
    });
  }

  async callTimes(doctorId: string, since: Date): Promise<Date[]> {
    const rows = await this.prisma.callLog.findMany({
      where: { doctorId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return rows.map((row) => row.createdAt);
  }
}
