import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission, businessRules } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { BillingService } from './billing.service';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const lineSchema = z
  .object({
    pricingItemId: z.string().uuid().optional(),
    description: z.string().trim().max(200).optional(),
    quantity: z.number().int().min(1).max(999).default(1),
    unitMinor: z.number().int().min(0).optional(),
    discountMinor: z.number().int().min(0).default(0),
  })
  .refine((l) => l.pricingItemId || (l.description && l.unitMinor !== undefined), {
    message: 'Provide a catalog item, or a description with a unit price',
  });

const invoiceSchema = practiceQuery.extend({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1).max(50),
  discountMinor: z.number().int().min(0).default(0),
  taxMinor: z.number().int().min(0).default(0),
  notes: z.string().trim().max(600).optional(),
});

const paymentSchema = practiceQuery.extend({
  amountMinor: z.number().int().positive(),
  method: z.enum(['CASH', 'CARD', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  reference: z.string().trim().max(120).optional(),
});

const ledgerQuery = practiceQuery.extend({
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  patientId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(businessRules.pagination.maxPageSize)
    .default(businessRules.pagination.defaultPageSize),
});

const reportQuery = practiceQuery.extend({
  kind: z.enum(['income', 'appointments', 'procedures', 'demographics']),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('invoices')
  @RequirePermissions(Permission.BILLING_WRITE)
  create(@Body(zodBody(invoiceSchema)) b: z.infer<typeof invoiceSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...rest } = b;
    return this.billing.createInvoice(practiceId, rest, p);
  }

  /** Practice ledger backing the Billing module. */
  @Get('invoices')
  @RequirePermissions(Permission.BILLING_READ)
  list(@Query(zodBody(ledgerQuery)) q: z.infer<typeof ledgerQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.billing.listInvoices(
      q.practiceId,
      {
        status: q.status,
        patientId: q.patientId,
        q: q.q,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        cursor: q.cursor,
        limit: q.limit,
      },
      p,
    );
  }

  @Get('invoices/:id/payments')
  @RequirePermissions(Permission.BILLING_READ)
  payments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.billing.listPayments(q.practiceId, id, p);
  }

  @Post('invoices/:id/cancel')
  @RequirePermissions(Permission.BILLING_WRITE)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(practiceQuery)) b: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.billing.cancelInvoice(b.practiceId, id, p);
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.BILLING_READ)
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.billing.getInvoice(q.practiceId, id, p);
  }

  @Get('patients/:patientId/invoices')
  @RequirePermissions(Permission.BILLING_READ)
  listForPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query(zodBody(practiceQuery.extend({
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(businessRules.pagination.maxPageSize).default(businessRules.pagination.defaultPageSize),
    })))
    q: { practiceId: string; cursor?: string; limit: number },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.billing.listForPatient(q.practiceId, patientId, p, { cursor: q.cursor, limit: q.limit });
  }

  @Post('invoices/:id/payments')
  @RequirePermissions(Permission.BILLING_WRITE)
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(paymentSchema)) b: z.infer<typeof paymentSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.billing.addPayment(b.practiceId, id, b, p);
  }

  @Get('reports')
  @RequirePermissions(Permission.REPORTS_READ)
  report(@Query(zodBody(reportQuery)) q: z.infer<typeof reportQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.billing.report(q.practiceId, q.kind, new Date(q.from), new Date(q.to), p);
  }
}
