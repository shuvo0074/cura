import { HttpStatus, Injectable } from '@nestjs/common';
import type { SerialBookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { NewBooking, Row, SerialBookingRepository } from '../../../core/ports/directory.ports';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { uniqueViolationFields } from './prisma-errors';

const DOCTOR_FIELDS = {
  name: true,
  specialty: true,
  photo: true,
  chamber: true,
  hospital: { select: { name: true } },
} as const;

const PATIENT_FIELDS = { name: true, user: { select: { mobile: true } } } as const;

const asPatientView = ({ doctor, review, ...row }: Row): Row => ({
  ...row,
  doctorName: doctor.name,
  specialty: doctor.specialty,
  doctorPhoto: doctor.photo,
  chamber: doctor.chamber,
  hospitalName: doctor.hospital?.name ?? null,
  reviewRating: review?.rating ?? null,
});

const asDoctorView = ({ patient, ...row }: Row): Row => ({
  ...row,
  patientName: patient.name,
  patientMobile: patient.user.mobile,
});

@Injectable()
export class PrismaSerialBookingRepository implements SerialBookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async book(booking: NewBooking): Promise<Row> {
    const { patientId, doctorId, bookingDate, venue, sessionTime } = booking;
    const sessionKey = `serial:${doctorId}:${bookingDate.toISOString()}:${venue}:${sessionTime}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionKey}))::text`;
        const existing = await tx.serialBooking.findFirst({
          where: { patientId, doctorId, bookingDate, venue, sessionTime, status: { not: 'CANCELLED' } },
          select: { serialNo: true },
        });
        if (existing) {
          throw new DirectoryError(
            HttpStatus.CONFLICT,
            'ALREADY_BOOKED',
            `You already have serial #${existing.serialNo} in this session.`,
            { serial: existing.serialNo },
          );
        }
        // Counts cancelled rows too, so a serial number is never reused.
        const { _max } = await tx.serialBooking.aggregate({
          where: { doctorId, bookingDate, venue, sessionTime },
          _max: { serialNo: true },
        });
        return tx.serialBooking.create({ data: { ...booking, serialNo: (_max.serialNo ?? 0) + 1 } });
      });
    } catch (error) {
      // Only reachable if the lock were bypassed; the indexes still hold.
      if (uniqueViolationFields(error)) {
        throw new DirectoryError(HttpStatus.CONFLICT, 'SERIAL_TAKEN', 'That serial was just booked. Please try again.');
      }
      throw error;
    }
  }

  async sessionCounts(doctorId: string, date: Date) {
    const rows = await this.prisma.serialBooking.findMany({
      where: { doctorId, bookingDate: date },
      select: { venue: true, sessionTime: true, serialNo: true, status: true },
    });
    const sessions = new Map<string, { venue: string; sessionTime: string; lastSerial: number; booked: number }>();
    for (const row of rows) {
      const key = `${row.venue} ${row.sessionTime}`;
      const entry = sessions.get(key) ?? { venue: row.venue, sessionTime: row.sessionTime, lastSerial: 0, booked: 0 };
      entry.lastSerial = Math.max(entry.lastSerial, row.serialNo);
      if (row.status !== 'CANCELLED') entry.booked += 1;
      sessions.set(key, entry);
    }
    return [...sessions.values()];
  }

  patientActive(doctorId: string, date: Date, patientId: string): Promise<Row[]> {
    return this.prisma.serialBooking.findMany({
      where: { doctorId, bookingDate: date, patientId, status: { not: 'CANCELLED' } },
      select: { id: true, venue: true, sessionTime: true, serialNo: true },
    });
  }

  async listForPatient(patientId: string): Promise<Row[]> {
    const rows = await this.prisma.serialBooking.findMany({
      where: { patientId },
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      include: { doctor: { select: DOCTOR_FIELDS }, review: { select: { rating: true } } },
    });
    return rows.map(asPatientView);
  }

  async listForDoctor(doctorId: string): Promise<Row[]> {
    const rows = await this.prisma.serialBooking.findMany({
      where: { doctorId },
      // Within a day: by session, then serial, the order patients are seen.
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'asc' }, { venue: 'asc' }, { serialNo: 'asc' }],
      include: { patient: { select: PATIENT_FIELDS } },
    });
    return rows.map(asDoctorView);
  }

  async listAll(status: string | null): Promise<Row[]> {
    const rows = await this.prisma.serialBooking.findMany({
      where: status ? { status: status.toUpperCase() as SerialBookingStatus } : {},
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      include: { doctor: { select: { name: true } }, patient: { select: PATIENT_FIELDS } },
    });
    return rows.map(({ doctor, patient, ...row }) => ({
      ...row,
      doctorName: doctor.name,
      patientMobile: patient.user.mobile,
    }));
  }

  async cancel(id: string, patientId: string): Promise<Row | null> {
    const { count } = await this.prisma.serialBooking.updateMany({
      where: { id, patientId, status: 'CONFIRMED' },
      data: { status: 'CANCELLED' },
    });
    if (!count) return null;
    const row = await this.prisma.serialBooking.findUniqueOrThrow({
      where: { id },
      include: { doctor: { select: DOCTOR_FIELDS }, review: { select: { rating: true } } },
    });
    return asPatientView(row);
  }

  async complete(id: string, doctorId: string): Promise<Row | null> {
    const { count } = await this.prisma.serialBooking.updateMany({
      where: { id, doctorId, status: 'CONFIRMED' },
      data: { status: 'COMPLETED' },
    });
    if (!count) return null;
    const row = await this.prisma.serialBooking.findUniqueOrThrow({
      where: { id },
      include: { patient: { select: PATIENT_FIELDS } },
    });
    return asDoctorView(row);
  }

  findForReview(id: string, patientId: string) {
    return this.prisma.serialBooking.findFirst({ where: { id, patientId }, select: { doctorId: true, status: true } });
  }

  async addReview(input: { bookingId: string; doctorId: string; patientId: string; rating: number; comment: string | null }) {
    try {
      return await this.prisma.doctorReview.create({
        data: input,
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
    } catch (error) {
      if (uniqueViolationFields(error)) return null;
      throw error;
    }
  }
}
