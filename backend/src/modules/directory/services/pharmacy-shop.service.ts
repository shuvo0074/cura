import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  PHARMACY_SHOP_REPOSITORY,
  type DirectoryIdentity,
  type PharmacyShopRepository,
  type Row,
} from '../../../core/ports/directory.ports';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { orderNote, ownerMove, stockItem } from '../domain/pharmacy-rules';
import { DirectoryAudit } from './directory-audit.service';

/** A pharmacy's list stays a list people can scroll, not a warehouse. */
export const MAX_STOCK_ITEMS = 2000;
/** Orders still waiting at pharmacies, per patient: enough for real use, not for spam. */
export const MAX_OPEN_ORDERS = 20;
const ORDER_LIMIT = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stockOut = (row: Row) => ({
  id: row.id,
  name: row.name,
  strength: row.strength,
  form: row.form,
  price: row.priceMinor === null ? null : row.priceMinor / 100,
  in_stock: row.inStock,
  updated_at: row.updatedAt.toISOString(),
});

const orderBase = (row: Row) => ({
  id: row.id,
  status: String(row.status).toLowerCase(),
  doctor_name: row.doctorName,
  prescribed_at: row.prescribedAt.toISOString(),
  items: row.items,
  note: row.note,
  reason: row.reason,
  created_at: row.createdAt.toISOString(),
  updated_at: row.updatedAt.toISOString(),
});

/** The pharmacy's view: the patient's name and phone and what they sent. */
const pharmacyOrderOut = (row: Row) => ({
  ...orderBase(row),
  patient_name: row.patientName,
  patient_phone: row.patientPhone,
});

/** The patient's view: their order and where it went. */
const patientOrderOut = (row: Row) => ({
  ...orderBase(row),
  prescription_id: row.prescriptionId,
  pharmacy: {
    id: row.pharmacy.id,
    name: row.pharmacy.name,
    address: row.pharmacy.address,
    city: row.pharmacy.city,
    phones: row.pharmacy.phones,
    opening_hours: row.pharmacy.openingHours,
  },
});

/**
 * Medicine stock lists and prescription pickup orders.
 *
 * Only a pharmacy's owner changes its stock list or reads its orders. A patient
 * sends only their own signed prescriptions (through their linked clinic
 * records), only to a pharmacy patients can see, and sees and cancels only
 * their own orders. The pharmacy gets a copy of the prescribed medicines, the
 * prescriber and the patient's name and phone: never the visit or any other
 * record.
 */
@Injectable()
export class PharmacyShopService {
  constructor(
    @Inject(PHARMACY_SHOP_REPOSITORY) private readonly shop: PharmacyShopRepository,
    private readonly audit: DirectoryAudit,
  ) {}

  /** In-stock medicines of a visible pharmacy, for Cura Website. */
  async publicStock(pharmacyId: string) {
    if (!(await this.shop.visiblePharmacy(pharmacyId))) throw directoryNotFound('Pharmacy');
    return (await this.shop.listStock(pharmacyId, true)).map(({ id, name, strength, form, priceMinor }) => ({
      id,
      name,
      strength,
      form,
      price: priceMinor === null ? null : priceMinor / 100,
    }));
  }

  async ownerStock(pharmacyId: string, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    return (await this.shop.listStock(pharmacyId, false)).map(stockOut);
  }

  async addStock(pharmacyId: string, body: Row, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    const data = stockItem(body);
    if ((await this.shop.countStock(pharmacyId)) >= MAX_STOCK_ITEMS) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'STOCK_FULL', `A pharmacy can list up to ${MAX_STOCK_ITEMS} medicines`);
    }
    return stockOut(await this.shop.createStock(pharmacyId, data));
  }

  async updateStock(pharmacyId: string, itemId: string, body: Row, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    const row = await this.shop.updateStock(pharmacyId, itemId, stockItem(body));
    if (!row) throw directoryNotFound('Medicine');
    return stockOut(row);
  }

  async removeStock(pharmacyId: string, itemId: string, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    if (!(await this.shop.deleteStock(pharmacyId, itemId))) throw directoryNotFound('Medicine');
    return { ok: true };
  }

  async ownerOrders(pharmacyId: string, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    return (await this.shop.pharmacyOrders(pharmacyId, ORDER_LIMIT)).map(pharmacyOrderOut);
  }

  async moveOrder(pharmacyId: string, orderId: string, body: Row, ownerId: string) {
    await this.mustOwn(pharmacyId, ownerId);
    const move = ownerMove(body);
    const scope = { id: orderId, pharmacyId, ownerId };
    if (!(await this.shop.moveOrder(scope, move.from, move.to, move.reason))) {
      const current = await this.shop.orderStatus(scope);
      if (!current) throw directoryNotFound('Order');
      throw statusConflict(current);
    }
    await this.audit.record(ownerId, 'pharmacy_order_status', 'pharmacy_order', orderId, { status: move.to });
    return { ok: true, status: move.to.toLowerCase() };
  }

  async patientOrders(identity: DirectoryIdentity) {
    return (await this.shop.patientOrders(identity.patientId!, ORDER_LIMIT)).map(patientOrderOut);
  }

  async send(identity: DirectoryIdentity, body: Row) {
    const accountId = identity.patientId!;
    const prescriptionId = String(body.prescription_id ?? '');
    const pharmacyId = String(body.pharmacy_id ?? '');
    if (!UUID.test(prescriptionId)) throw new DirectoryValidationError('Choose a prescription');
    if (!UUID.test(pharmacyId)) throw new DirectoryValidationError('Choose a pharmacy');

    const prescription = await this.shop.sendablePrescription(accountId, prescriptionId);
    if (!prescription) throw directoryNotFound('Prescription');
    if (!prescription.items.length) throw new DirectoryValidationError('This prescription has no medicines');
    // Every pharmacy has an owner; a hidden one is not open to patients yet.
    if (!(await this.shop.visiblePharmacy(pharmacyId))) throw directoryNotFound('Pharmacy');

    if (await this.shop.hasOpenOrder(accountId, prescriptionId, pharmacyId)) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'ALREADY_SENT', 'You already sent this prescription to this pharmacy');
    }
    if ((await this.shop.countOpenOrders(accountId)) >= MAX_OPEN_ORDERS) {
      throw new DirectoryError(
        HttpStatus.CONFLICT,
        'TOO_MANY_ORDERS',
        'You have too many open pharmacy orders. Cancel one or wait for a pharmacy to finish one',
      );
    }

    const row = await this.shop.createOrder({
      pharmacyId,
      accountId,
      prescriptionId,
      patientName: prescription.patientName.slice(0, 120),
      patientPhone: prescription.patientPhone?.slice(0, 20) ?? null,
      doctorName: prescription.doctorName.slice(0, 120),
      prescribedAt: prescription.prescribedAt,
      items: prescription.items,
      note: orderNote(body.note),
    });
    await this.audit.record(identity.userId, 'pharmacy_order_sent', 'pharmacy_order', row.id, { pharmacyId });
    return patientOrderOut(row);
  }

  /** A patient takes back an order the pharmacy has not started on. */
  async cancel(identity: DirectoryIdentity, orderId: string) {
    const scope = { id: orderId, accountId: identity.patientId! };
    if (!(await this.shop.moveOrder(scope, ['NEW'], 'CANCELLED', null))) {
      const current = await this.shop.orderStatus(scope);
      if (!current) throw directoryNotFound('Order');
      throw statusConflict(current);
    }
    await this.audit.record(identity.userId, 'pharmacy_order_cancelled', 'pharmacy_order', orderId);
    return { ok: true, status: 'cancelled' };
  }

  /** Another owner's pharmacy looks the same as a missing one. */
  private async mustOwn(pharmacyId: string, ownerId: string) {
    if (!(await this.shop.isOwner(pharmacyId, ownerId))) throw directoryNotFound('Pharmacy');
  }
}

const STATUS_WORDS: Record<string, string> = {
  NEW: 'new',
  READY: 'ready for pickup',
  COLLECTED: 'collected',
  CANNOT_FILL: 'marked as cannot fill',
  CANCELLED: 'cancelled',
};

const statusConflict = (current: string) =>
  new DirectoryError(HttpStatus.CONFLICT, 'ORDER_STATUS', `This order is already ${STATUS_WORDS[current] ?? current.toLowerCase()}`, {
    status: current.toLowerCase(),
  });
