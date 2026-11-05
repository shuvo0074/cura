import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DoctorClinic, WebsiteBookingLinkRepository } from '../../core/ports/repositories';

@Injectable()
export class PrismaWebsiteBookingLinkRepository implements WebsiteBookingLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async doctorClinics(doctorUserId: string): Promise<DoctorClinic[]> {
    const rows = await this.prisma.practiceMembership.findMany({
      where: {
        userId: doctorUserId,
        role: 'DOCTOR',
        isActive: true,
        practice: { isActive: true, deletedAt: null },
      },
      select: { practice: { select: { id: true, name: true, slotMinutes: true, timezone: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ practice }) => ({
      practiceId: practice.id,
      name: practice.name,
      slotMinutes: practice.slotMinutes,
      timezone: practice.timezone,
    }));
  }

  async clinicPatientId(accountId: string, practiceId: string): Promise<string | null> {
    const row = await this.prisma.patient.findFirst({
      where: { accountId, practiceId, deletedAt: null },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async link(bookingId: string, appointmentId: string): Promise<void> {
    await this.prisma.serialBooking.update({ where: { id: bookingId }, data: { appointmentId } });
  }

  async settle(appointmentId: string, status: 'CANCELLED' | 'COMPLETED'): Promise<string | null> {
    const booking = await this.prisma.serialBooking.findUnique({
      where: { appointmentId },
      select: { id: true },
    });
    if (!booking) return null;
    const { count } = await this.prisma.serialBooking.updateMany({
      where: { id: booking.id, status: 'CONFIRMED' },
      data: { status },
    });
    return count ? booking.id : null;
  }
}
