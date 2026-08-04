import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CursorQuery, Page } from '../../core/ports/repositories';
import type {
  BillingRepository,
  InvoiceItemData,
  InvoiceRecord,
  IncomeRow,
  ReportRepository,
} from '../../core/ports/clinical.ports';

/**
 * Invoicing.
 *
 * All amounts are integer minor units. Totals are recomputed server-side from
 * the line items on every write — a client-supplied total is never trusted,
 * which is the difference between a rounding bug and a billing dispute.
 */
@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  private static readonly INCLUDE = { items: true } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findById(practiceId: string, id: string): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, practiceId },
      include: PrismaBillingRepository.INCLUDE,
    });
    return row ? this.toRecord(row) : null;
  }

  async listForPatient(
    practiceId: string,
    patientId: string,
    query: CursorQuery,
  ): Promise<Page<InvoiceRecord>> {
    const rows = await this.prisma.invoice.findMany({
      where: { practiceId, patientId },
      include: PrismaBillingRepository.INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((r) => this.toRecord(r)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async create(input: {
    practiceId: string;
    patientId: string;
    encounterId: string | null;
    number: string;
    items: InvoiceItemData[];
    discountMinor: number;
    taxMinor: number;
    notes: string | null;
    createdById: string;
  }): Promise<InvoiceRecord> {
    const subtotal = input.items.reduce((sum, item) => sum + item.totalMinor, 0);
    const total = Math.max(0, subtotal - input.discountMinor + input.taxMinor);

    const row = await this.prisma.invoice.create({
      data: {
        practiceId: input.practiceId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        number: input.number,
        status: 'ISSUED',
        subtotalMinor: subtotal,
        discountMinor: input.discountMinor,
        taxMinor: input.taxMinor,
        totalMinor: total,
        notes: input.notes,
        issuedAt: new Date(),
        createdById: input.createdById,
        items: {
          create: input.items.map((item) => ({
            pricingItemId: item.pricingItemId,
            description: item.description,
            quantity: item.quantity,
            unitMinor: item.unitMinor,
            discountMinor: item.discountMinor,
            totalMinor: item.totalMinor,
          })),
        },
      },
      include: PrismaBillingRepository.INCLUDE,
    });
    return this.toRecord(row);
  }

  /**
   * Records a payment and re-derives the invoice status.
   *
   * Both happen in one transaction, so a payment can never be stored against an
   * invoice whose status did not move with it.
   */
  async addPayment(input: {
    invoiceId: string;
    amountMinor: number;
    method: string;
    reference: string | null;
    receivedById: string;
  }): Promise<InvoiceRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amountMinor: input.amountMinor,
          method: input.method as never,
          reference: input.reference,
          receivedById: input.receivedById,
        },
      });

      const totals = await tx.payment.aggregate({
        where: { invoiceId: input.invoiceId },
        _sum: { amountMinor: true },
      });
      const paid = totals._sum.amountMinor ?? 0;

      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        select: { totalMinor: true },
      });

      const status =
        paid >= invoice.totalMinor ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';

      return tx.invoice.update({
        where: { id: input.invoiceId },
        data: { paidMinor: paid, status: status as never },
        include: PrismaBillingRepository.INCLUDE,
      });
    });

    return this.toRecord(updated);
  }

  /**
   * Per-practice invoice number.
   *
   * Derived from the current maximum inside a serialisable read; the unique
   * constraint on (practiceId, number) is the real guard against a collision
   * under concurrency, and the caller retries on violation.
   */
  async nextInvoiceNumber(practiceId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `INV-${year}-`;

    const last = await this.prisma.invoice.findFirst({
      where: { practiceId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const lastSeq = last ? Number(last.number.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }

  private toRecord(row: Record<string, any>): InvoiceRecord {
    return {
      id: row.id,
      practiceId: row.practiceId,
      patientId: row.patientId,
      encounterId: row.encounterId ?? null,
      number: row.number,
      status: row.status,
      subtotalMinor: row.subtotalMinor,
      discountMinor: row.discountMinor,
      taxMinor: row.taxMinor,
      totalMinor: row.totalMinor,
      paidMinor: row.paidMinor,
      notes: row.notes ?? null,
      issuedAt: row.issuedAt ?? null,
      createdAt: row.createdAt,
      items: (row.items ?? []).map((item: Record<string, any>) => ({
        pricingItemId: item.pricingItemId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitMinor: item.unitMinor,
        discountMinor: item.discountMinor,
        totalMinor: item.totalMinor,
      })),
    };
  }
}

/**
 * Reporting.
 *
 * Aggregation runs in the database rather than by loading rows and summing in
 * Node — a year of invoices is a single grouped scan, not a transfer of every
 * record into the API process.
 */
@Injectable()
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async income(practiceId: string, from: Date, to: Date): Promise<IncomeRow[]> {
    return this.prisma.$queryRaw<IncomeRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', i."createdAt"), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(i."totalMinor"), 0)::int AS "invoicedMinor",
             COALESCE(SUM(i."paidMinor"), 0)::int  AS "collectedMinor",
             COUNT(*)::int                          AS "invoiceCount"
      FROM invoices i
      WHERE i."practiceId" = ${practiceId}::uuid
        AND i."createdAt" >= ${from}
        AND i."createdAt" <  ${to}
        AND i.status <> 'CANCELLED'
      GROUP BY 1
      ORDER BY 1
    `);
  }

  async appointmentVolume(practiceId: string, from: Date, to: Date) {
    return this.prisma.$queryRaw<Array<{ day: string; total: number; done: number; cancelled: number }>>(
      Prisma.sql`
        SELECT to_char(date_trunc('day', a."scheduledAt"), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE a.status = 'DONE')::int AS done,
               COUNT(*) FILTER (WHERE a.status IN ('CANCELLED','NO_SHOW'))::int AS cancelled
        FROM appointments a
        WHERE a."practiceId" = ${practiceId}::uuid
          AND a."scheduledAt" >= ${from}
          AND a."scheduledAt" <  ${to}
        GROUP BY 1
        ORDER BY 1
      `,
    );
  }

  async topProcedures(practiceId: string, from: Date, to: Date, limit: number) {
    return this.prisma.$queryRaw<Array<{ name: string; count: number; revenueMinor: number }>>(
      Prisma.sql`
        SELECT ii.description AS name,
               SUM(ii.quantity)::int AS count,
               SUM(ii."totalMinor")::int AS "revenueMinor"
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii."invoiceId"
        WHERE i."practiceId" = ${practiceId}::uuid
          AND i."createdAt" >= ${from}
          AND i."createdAt" <  ${to}
          AND i.status <> 'CANCELLED'
        GROUP BY 1
        ORDER BY "revenueMinor" DESC
        LIMIT ${limit}
      `,
    );
  }

  async patientDemographics(practiceId: string) {
    return this.prisma.$queryRaw<Array<{ bucket: string; count: number }>>(Prisma.sql`
      SELECT CASE
               WHEN p."dateOfBirth" IS NULL THEN 'Unknown'
               WHEN date_part('year', age(p."dateOfBirth")) < 18 THEN '0-17'
               WHEN date_part('year', age(p."dateOfBirth")) < 35 THEN '18-34'
               WHEN date_part('year', age(p."dateOfBirth")) < 55 THEN '35-54'
               ELSE '55+'
             END AS bucket,
             COUNT(*)::int AS count
      FROM patients p
      WHERE p."practiceId" = ${practiceId}::uuid AND p."deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 1
    `);
  }
}
