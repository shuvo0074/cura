import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-error';
import {
  BILLING_REPOSITORY,
  PRACTICE_REPOSITORY,
  PRICING_REPOSITORY,
  REPORT_REPOSITORY,
  type BillingRepository,
  type InvoiceItemData,
  type PracticeRepository,
  type PricingRepository,
  type ReportRepository,
} from '../../core/ports/clinical.ports';
import {
  AUDIT_REPOSITORY,
  PATIENT_REPOSITORY,
  type AuditRepository,
  type PatientRepository,
} from '../../core/ports/repositories';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

export interface InvoiceLineInput {
  pricingItemId?: string | undefined;
  description?: string | undefined;
  quantity: number;
  unitMinor?: number | undefined;
  discountMinor: number;
}

/**
 * Invoicing and reporting.
 *
 * Line totals are always computed here from quantity × unit − discount. A
 * client may propose a price, but when a catalog item is referenced the stored
 * price wins — otherwise a tampered request could bill any amount.
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_REPOSITORY) private readonly invoices: BillingRepository,
    @Inject(PRICING_REPOSITORY) private readonly pricing: PricingRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(PRACTICE_REPOSITORY) private readonly practices: PracticeRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async createInvoice(
    practiceId: string,
    input: {
      patientId: string;
      encounterId?: string | undefined;
      lines: InvoiceLineInput[];
      discountMinor: number;
      taxMinor: number;
      notes?: string | undefined;
    },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);

    const patient = await this.patients.findById(practiceId, input.patientId);
    if (!patient) throw new NotFoundError('Patient');
    if (input.lines.length === 0) throw new ValidationError('Add at least one line item.');

    const pricing = await this.pricing.listPricing(practiceId);
    const byId = new Map(pricing.map((item) => [item.id, item]));

    const items: InvoiceItemData[] = input.lines.map((line) => {
      const catalogItem = line.pricingItemId ? byId.get(line.pricingItemId) : undefined;

      if (line.pricingItemId && !catalogItem) {
        throw new ValidationError('One of the selected services no longer exists.');
      }

      // Catalog price is authoritative when an item is referenced.
      const unitMinor = catalogItem ? catalogItem.priceMinor : (line.unitMinor ?? 0);
      const description = catalogItem?.name ?? line.description;

      if (!description) throw new ValidationError('Each line needs a description.');
      if (unitMinor < 0) throw new ValidationError('Unit price cannot be negative.');
      if (line.quantity < 1) throw new ValidationError('Quantity must be at least 1.');

      const gross = unitMinor * line.quantity;
      const discount = Math.min(Math.max(0, line.discountMinor), gross);

      return {
        pricingItemId: catalogItem?.id ?? null,
        description,
        quantity: line.quantity,
        unitMinor,
        discountMinor: discount,
        totalMinor: gross - discount,
      };
    });

    // Retried once: the invoice number is derived from the current maximum, so
    // two concurrent creations can collide on the unique constraint.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const invoice = await this.invoices.create({
          practiceId,
          patientId: input.patientId,
          encounterId: input.encounterId ?? null,
          number: await this.invoices.nextInvoiceNumber(practiceId),
          items,
          discountMinor: Math.max(0, input.discountMinor),
          taxMinor: Math.max(0, input.taxMinor),
          notes: input.notes ?? null,
          createdById: principal.userId,
        });

        await this.audit.record({
          actorUserId: principal.userId,
          action: 'billing.invoice.created',
          resourceType: 'invoice',
          resourceId: invoice.id,
          practiceId,
          ipHash: null,
          userAgent: null,
          requestId: null,
          metadata: { totalMinor: invoice.totalMinor },
        });
        return invoice;
      } catch (error) {
        const isUniqueViolation =
          typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
        if (!isUniqueViolation || attempt === 1) throw error;
      }
    }

    throw new ConflictError('INVOICE_NUMBER_RACE', 'Could not allocate an invoice number. Try again.');
  }

  async addPayment(
    practiceId: string,
    invoiceId: string,
    input: { amountMinor: number; method: string; reference?: string | undefined },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);

    const invoice = await this.invoices.findById(practiceId, invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.status === 'CANCELLED') {
      throw new ConflictError('INVOICE_CANCELLED', 'A cancelled invoice cannot take payment.');
    }
    if (input.amountMinor <= 0) throw new ValidationError('Payment amount must be positive.');

    const outstanding = invoice.totalMinor - invoice.paidMinor;
    if (input.amountMinor > outstanding) {
      throw new ValidationError(
        `Payment exceeds the outstanding balance of ${(outstanding / 100).toFixed(2)}.`,
      );
    }

    const updated = await this.invoices.addPayment({
      invoiceId,
      amountMinor: input.amountMinor,
      method: input.method,
      reference: input.reference ?? null,
      receivedById: principal.userId,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'billing.payment.recorded',
      resourceType: 'invoice',
      resourceId: invoiceId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { amountMinor: input.amountMinor, method: input.method },
    });

    return updated;
  }

  async listForPatient(
    practiceId: string,
    patientId: string,
    principal: AuthenticatedPrincipal,
    query: { cursor?: string | undefined; limit: number },
  ) {
    this.assert(principal, practiceId);
    return this.invoices.listForPatient(practiceId, patientId, query);
  }

  /**
   * The practice ledger.
   *
   * Whether voided invoices appear is the practice's Data Security preference,
   * not a per-request flag: the point of that setting is that the whole team
   * sees a consistent ledger.
   */
  async listInvoices(
    practiceId: string,
    filter: {
      status?: string | undefined;
      patientId?: string | undefined;
      q?: string | undefined;
      from?: Date | undefined;
      to?: Date | undefined;
      cursor?: string | undefined;
      limit: number;
    },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    const practice = await this.practices.findById(practiceId);

    return this.invoices.listForPractice(practiceId, {
      ...filter,
      includeCancelled: !(practice?.hideCancelledInvoices ?? false),
    });
  }

  async listPayments(practiceId: string, invoiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    // Resolved through the practice-scoped finder first, so an invoice id from
    // another clinic cannot be used to read its payment history.
    const invoice = await this.invoices.findById(practiceId, invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    return this.invoices.listPayments(invoiceId);
  }

  async cancelInvoice(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);

    const invoice = await this.invoices.findById(practiceId, id);
    if (!invoice) throw new NotFoundError('Invoice');

    const cancelled = await this.invoices.cancel(practiceId, id);
    if (!cancelled) {
      throw new ConflictError(
        'INVOICE_NOT_CANCELLABLE',
        invoice.paidMinor > 0
          ? 'This invoice has payments against it. Refund them before cancelling.'
          : 'This invoice is already cancelled.',
      );
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'billing.invoice.cancelled',
      resourceType: 'invoice',
      resourceId: id,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { number: invoice.number, totalMinor: invoice.totalMinor },
    });

    return this.invoices.findById(practiceId, id);
  }

  async getInvoice(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    const invoice = await this.invoices.findById(practiceId, id);
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  // -- Reports ---------------------------------------------------------------

  async report(
    practiceId: string,
    kind: 'income' | 'appointments' | 'procedures' | 'demographics',
    from: Date,
    to: Date,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);

    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (spanDays <= 0 || spanDays > 400) {
      throw new ValidationError('Report range must be between 1 and 400 days.');
    }

    switch (kind) {
      case 'income': {
        const rows = await this.reports.income(practiceId, from, to);
        return {
          rows,
          totals: rows.reduce(
            (acc, row) => ({
              invoicedMinor: acc.invoicedMinor + row.invoicedMinor,
              collectedMinor: acc.collectedMinor + row.collectedMinor,
              invoiceCount: acc.invoiceCount + row.invoiceCount,
            }),
            { invoicedMinor: 0, collectedMinor: 0, invoiceCount: 0 },
          ),
        };
      }
      case 'appointments':
        return { rows: await this.reports.appointmentVolume(practiceId, from, to) };
      case 'procedures':
        return { rows: await this.reports.topProcedures(practiceId, from, to, 10) };
      case 'demographics':
        return { rows: await this.reports.patientDemographics(practiceId) };
    }
  }

  private assert(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }
}
