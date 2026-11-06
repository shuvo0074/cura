import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  NewPharmacyOrder,
  OrderScope,
  PharmacyOrderStatus,
  PharmacyShopRepository,
  Row,
  SendablePrescription,
  StockItemInput,
} from '../../../core/ports/directory.ports';

const STOCK = {
  id: true,
  name: true,
  strength: true,
  form: true,
  priceMinor: true,
  inStock: true,
  updatedAt: true,
} satisfies Prisma.PharmacyStockItemSelect;

/** What a pharmacy reads of an order: the copy the patient sent, nothing else. */
const ORDER_FOR_PHARMACY = {
  id: true,
  status: true,
  patientName: true,
  patientPhone: true,
  doctorName: true,
  prescribedAt: true,
  items: true,
  note: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PharmacyOrderSelect;

/** What the patient reads: their order plus the pharmacy's public details. */
const ORDER_FOR_PATIENT = {
  id: true,
  prescriptionId: true,
  status: true,
  doctorName: true,
  prescribedAt: true,
  items: true,
  note: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
  pharmacy: { select: { id: true, name: true, address: true, city: true, phones: true, openingHours: true } },
} satisfies Prisma.PharmacyOrderSelect;

const OPEN: PharmacyOrderStatus[] = ['NEW', 'READY'];

@Injectable()
export class PrismaPharmacyShopRepository implements PharmacyShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isOwner(pharmacyId: string, ownerId: string): Promise<boolean> {
    return (await this.prisma.pharmacy.count({ where: { id: pharmacyId, ownerId } })) > 0;
  }

  visiblePharmacy(pharmacyId: string) {
    return this.prisma.pharmacy.findFirst({ where: { id: pharmacyId, hidden: false }, select: { id: true, name: true } });
  }

  listStock(pharmacyId: string, onlyInStock: boolean): Promise<Row[]> {
    return this.prisma.pharmacyStockItem.findMany({
      where: { pharmacyId, ...(onlyInStock ? { inStock: true } : {}) },
      select: STOCK,
      orderBy: [{ name: 'asc' }, { strength: 'asc' }, { id: 'asc' }],
    });
  }

  countStock(pharmacyId: string): Promise<number> {
    return this.prisma.pharmacyStockItem.count({ where: { pharmacyId } });
  }

  createStock(pharmacyId: string, data: StockItemInput): Promise<Row> {
    return this.prisma.pharmacyStockItem.create({ data: { ...data, pharmacyId }, select: STOCK });
  }

  async updateStock(pharmacyId: string, itemId: string, data: StockItemInput): Promise<Row | null> {
    const { count } = await this.prisma.pharmacyStockItem.updateMany({ where: { id: itemId, pharmacyId }, data });
    if (!count) return null;
    return this.prisma.pharmacyStockItem.findUnique({ where: { id: itemId }, select: STOCK });
  }

  async deleteStock(pharmacyId: string, itemId: string): Promise<boolean> {
    const { count } = await this.prisma.pharmacyStockItem.deleteMany({ where: { id: itemId, pharmacyId } });
    return count > 0;
  }

  async sendablePrescription(accountId: string, prescriptionId: string): Promise<SendablePrescription | null> {
    const row = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        // Only a signed visit reaches the patient, as on "My health".
        encounter: { signedAt: { not: null }, patient: { accountId, deletedAt: null } },
      },
      select: {
        id: true,
        encounter: {
          select: {
            occurredAt: true,
            doctor: { select: { fullName: true } },
            appointment: { select: { doctor: { select: { fullName: true } } } },
            patient: { select: { fullName: true, mobile: true, account: { select: { user: { select: { mobile: true } } } } } },
          },
        },
        items: {
          orderBy: { position: 'asc' },
          select: {
            drugName: true,
            strength: true,
            form: true,
            morning: true,
            noon: true,
            night: true,
            mealRelation: true,
            durationDays: true,
            instruction: true,
          },
        },
      },
    });
    if (!row) return null;
    const { encounter } = row;
    return {
      id: row.id,
      patientName: encounter.patient.fullName,
      // The website account's phone first: that is the number the patient uses now.
      patientPhone: encounter.patient.account?.user.mobile ?? encounter.patient.mobile ?? null,
      doctorName: encounter.appointment?.doctor.fullName ?? encounter.doctor.fullName,
      prescribedAt: encounter.occurredAt,
      items: row.items.map((item) => ({
        drug_name: item.drugName,
        strength: item.strength,
        form: item.form,
        morning: Number(item.morning),
        noon: Number(item.noon),
        night: Number(item.night),
        meal_relation: item.mealRelation.toLowerCase(),
        duration_days: item.durationDays,
        instruction: item.instruction,
      })),
    };
  }

  countOpenOrders(accountId: string): Promise<number> {
    return this.prisma.pharmacyOrder.count({ where: { accountId, status: { in: OPEN } } });
  }

  async hasOpenOrder(accountId: string, prescriptionId: string, pharmacyId: string): Promise<boolean> {
    const count = await this.prisma.pharmacyOrder.count({
      where: { accountId, prescriptionId, pharmacyId, status: { in: OPEN } },
    });
    return count > 0;
  }

  createOrder(data: NewPharmacyOrder): Promise<Row> {
    return this.prisma.pharmacyOrder.create({
      data: { ...data, items: data.items as unknown as Prisma.InputJsonValue },
      select: ORDER_FOR_PATIENT,
    });
  }

  patientOrders(accountId: string, limit: number): Promise<Row[]> {
    return this.prisma.pharmacyOrder.findMany({
      where: { accountId },
      select: ORDER_FOR_PATIENT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  pharmacyOrders(pharmacyId: string, limit: number): Promise<Row[]> {
    return this.prisma.pharmacyOrder.findMany({
      where: { pharmacyId },
      select: ORDER_FOR_PHARMACY,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async orderStatus(scope: OrderScope): Promise<PharmacyOrderStatus | null> {
    const row = await this.prisma.pharmacyOrder.findFirst({ where: this.scoped(scope), select: { status: true } });
    return row?.status ?? null;
  }

  async moveOrder(scope: OrderScope, from: PharmacyOrderStatus[], to: PharmacyOrderStatus, reason: string | null): Promise<boolean> {
    // One conditional update, so two clicks at once cannot both move it.
    const { count } = await this.prisma.pharmacyOrder.updateMany({
      where: { ...this.scoped(scope), status: { in: from } },
      data: { status: to, reason },
    });
    return count > 0;
  }

  private scoped(scope: OrderScope): Prisma.PharmacyOrderWhereInput {
    return 'ownerId' in scope
      ? { id: scope.id, pharmacyId: scope.pharmacyId, pharmacy: { ownerId: scope.ownerId } }
      : { id: scope.id, accountId: scope.accountId };
  }
}
