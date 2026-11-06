import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AmbulanceRequestRepository,
  AmbulanceRequestScope,
  AmbulanceRequestStatus,
  NewAmbulanceRequest,
  Row,
} from '../../../core/ports/directory.ports';

const BASE = {
  id: true,
  status: true,
  contactPhone: true,
  pickupAddress: true,
  destination: true,
  note: true,
  pickupAt: true,
  ownerMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AmbulanceRequestSelect;

/** What an owner reads: the request as the patient typed it, and which of their services it went to. */
const FOR_OWNER = {
  ...BASE,
  patientName: true,
  vendor: { select: { id: true, name: true } },
} satisfies Prisma.AmbulanceRequestSelect;

/** What the patient reads: their request plus the service's public details. */
const FOR_PATIENT = {
  ...BASE,
  vendor: { select: { slug: true, name: true, nameBn: true, phones: true } },
} satisfies Prisma.AmbulanceRequestSelect;

const OPEN: AmbulanceRequestStatus[] = ['NEW', 'ACCEPTED'];

@Injectable()
export class PrismaAmbulanceRequestRepository implements AmbulanceRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  requestableVendor(slug: string) {
    return this.prisma.ambulanceVendor.findFirst({
      where: { slug, hidden: false, ownerId: { not: null } },
      select: { id: true, name: true },
    });
  }

  async isOwner(vendorId: string, ownerId: string): Promise<boolean> {
    return (await this.prisma.ambulanceVendor.count({ where: { id: vendorId, ownerId } })) > 0;
  }

  countOpen(accountId: string): Promise<number> {
    return this.prisma.ambulanceRequest.count({ where: { accountId, status: { in: OPEN } } });
  }

  async hasOpenFor(accountId: string, vendorId: string): Promise<boolean> {
    return (await this.prisma.ambulanceRequest.count({ where: { accountId, vendorId, status: { in: OPEN } } })) > 0;
  }

  countSince(accountId: string, since: Date): Promise<number> {
    return this.prisma.ambulanceRequest.count({ where: { accountId, createdAt: { gte: since } } });
  }

  create(data: NewAmbulanceRequest): Promise<Row> {
    return this.prisma.ambulanceRequest.create({ data, select: FOR_PATIENT });
  }

  patientRequests(accountId: string, limit: number): Promise<Row[]> {
    return this.prisma.ambulanceRequest.findMany({
      where: { accountId },
      select: FOR_PATIENT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  ownerRequests(ownerId: string, vendorId: string | null, limit: number): Promise<Row[]> {
    return this.prisma.ambulanceRequest.findMany({
      where: { vendor: { ownerId }, ...(vendorId ? { vendorId } : {}) },
      select: FOR_OWNER,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async status(scope: AmbulanceRequestScope): Promise<AmbulanceRequestStatus | null> {
    const row = await this.prisma.ambulanceRequest.findFirst({ where: this.scoped(scope), select: { status: true } });
    return row?.status ?? null;
  }

  async move(
    scope: AmbulanceRequestScope,
    from: AmbulanceRequestStatus[],
    to: AmbulanceRequestStatus,
    message: string | null | undefined,
  ): Promise<boolean> {
    // One conditional update, so two clicks (or the owner and the patient) at once cannot both move it.
    const { count } = await this.prisma.ambulanceRequest.updateMany({
      where: { ...this.scoped(scope), status: { in: from } },
      data: { status: to, ...(message !== undefined ? { ownerMessage: message } : {}) },
    });
    return count > 0;
  }

  private scoped(scope: AmbulanceRequestScope): Prisma.AmbulanceRequestWhereInput {
    return 'ownerId' in scope
      ? { id: scope.id, vendorId: scope.vendorId, vendor: { ownerId: scope.ownerId } }
      : { id: scope.id, accountId: scope.accountId };
  }
}
