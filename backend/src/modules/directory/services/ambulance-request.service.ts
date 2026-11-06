import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AMBULANCE_REQUEST_REPOSITORY,
  type AmbulanceRequestRepository,
  type DirectoryIdentity,
  type Row,
} from '../../../core/ports/directory.ports';
import { ambulanceRequest, ownerRequestMove } from '../domain/ambulance-request-rules';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { DirectoryAudit } from './directory-audit.service';

/** Requests still waiting for or on their way, per patient: enough for a family, not for spam. */
export const MAX_OPEN_REQUESTS = 3;
/** Requests a patient can send in a day, whatever happened to them. */
export const MAX_REQUESTS_PER_DAY = 10;
const REQUEST_LIMIT = 200;

/** Cura Website knows a service by its public slug, as in `GET /directory/ambulances`. */
const SLUG = /^[a-z0-9-]{1,120}$/;

const base = (row: Row) => ({
  id: row.id,
  status: String(row.status).toLowerCase(),
  contact_phone: row.contactPhone,
  pickup_address: row.pickupAddress,
  destination: row.destination,
  note: row.note,
  pickup_at: row.pickupAt ? row.pickupAt.toISOString() : null,
  owner_message: row.ownerMessage,
  created_at: row.createdAt.toISOString(),
  updated_at: row.updatedAt.toISOString(),
});

/** The owner's view: who asked, what they typed, and which service it went to. */
const ownerOut = (row: Row) => ({
  ...base(row),
  patient_name: row.patientName,
  ambulance: { id: row.vendor.id, name: row.vendor.name },
});

/** The patient's view: their request and the service's public details. */
const patientOut = (row: Row) => ({
  ...base(row),
  ambulance: { id: row.vendor.slug, name: row.vendor.name, name_bn: row.vendor.nameBn, phones: row.vendor.phones },
});

/**
 * Ambulance requests patients send through Cura Website.
 *
 * A patient requests only a visible service that has an owner to answer, and
 * sees and cancels only their own requests. Only the service's owner reads its
 * requests and moves them along; the owner gets what the patient typed and
 * their name, never any clinic record.
 */
@Injectable()
export class AmbulanceRequestService {
  constructor(
    @Inject(AMBULANCE_REQUEST_REPOSITORY) private readonly requests: AmbulanceRequestRepository,
    private readonly audit: DirectoryAudit,
  ) {}

  async ownerRequests(ownerId: string, vendorId: string | null = null) {
    if (vendorId) await this.mustOwn(vendorId, ownerId);
    return (await this.requests.ownerRequests(ownerId, vendorId, REQUEST_LIMIT)).map(ownerOut);
  }

  async move(vendorId: string, requestId: string, body: Row, ownerId: string) {
    await this.mustOwn(vendorId, ownerId);
    const move = ownerRequestMove(body);
    const scope = { id: requestId, vendorId, ownerId };
    if (!(await this.requests.move(scope, move.from, move.to, move.message))) {
      const current = await this.requests.status(scope);
      if (!current) throw directoryNotFound('Request');
      throw statusConflict(current);
    }
    await this.audit.record(ownerId, 'ambulance_request_status', 'ambulance_request', requestId, { status: move.to });
    return { ok: true, status: move.to.toLowerCase() };
  }

  async patientRequests(identity: DirectoryIdentity) {
    return (await this.requests.patientRequests(identity.patientId!, REQUEST_LIMIT)).map(patientOut);
  }

  async send(identity: DirectoryIdentity, body: Row) {
    const accountId = identity.patientId!;
    const slug = String(body.ambulance_id ?? '');
    if (!SLUG.test(slug)) throw new DirectoryValidationError('Choose an ambulance');
    const input = ambulanceRequest(body);
    const vendor = await this.requests.requestableVendor(slug);
    if (!vendor) throw directoryNotFound('Ambulance');
    const vendorId = vendor.id;

    if (await this.requests.hasOpenFor(accountId, vendorId)) {
      throw new DirectoryError(
        HttpStatus.CONFLICT,
        'ALREADY_REQUESTED',
        'You already have an open request with this ambulance',
      );
    }
    if ((await this.requests.countOpen(accountId)) >= MAX_OPEN_REQUESTS) {
      throw new DirectoryError(
        HttpStatus.CONFLICT,
        'TOO_MANY_REQUESTS',
        `You can have up to ${MAX_OPEN_REQUESTS} open ambulance requests. Cancel one first`,
      );
    }
    if ((await this.requests.countSince(accountId, new Date(Date.now() - 86_400_000))) >= MAX_REQUESTS_PER_DAY) {
      throw new DirectoryError(
        HttpStatus.CONFLICT,
        'DAILY_LIMIT',
        `You can send up to ${MAX_REQUESTS_PER_DAY} ambulance requests a day. Please call instead`,
      );
    }

    const row = await this.requests.create({
      ...input,
      vendorId,
      accountId,
      patientName: (identity.name || 'Patient').slice(0, 120),
    });
    await this.audit.record(identity.userId, 'ambulance_request_sent', 'ambulance_request', row.id, { vendorId });
    return patientOut(row);
  }

  /** A patient calls off a request that is new or on its way. */
  async cancel(identity: DirectoryIdentity, requestId: string) {
    const scope = { id: requestId, accountId: identity.patientId! };
    if (!(await this.requests.move(scope, ['NEW', 'ACCEPTED'], 'CANCELLED', undefined))) {
      const current = await this.requests.status(scope);
      if (!current) throw directoryNotFound('Request');
      throw statusConflict(current);
    }
    await this.audit.record(identity.userId, 'ambulance_request_cancelled', 'ambulance_request', requestId);
    return { ok: true, status: 'cancelled' };
  }

  /** Another owner's service looks the same as a missing one. */
  private async mustOwn(vendorId: string, ownerId: string) {
    if (!(await this.requests.isOwner(vendorId, ownerId))) throw directoryNotFound('Ambulance');
  }
}

const STATUS_WORDS: Record<string, string> = {
  NEW: 'new',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

const statusConflict = (current: string) =>
  new DirectoryError(
    HttpStatus.CONFLICT,
    'REQUEST_STATUS',
    `This request is already ${STATUS_WORDS[current] ?? current.toLowerCase()}`,
    { status: current.toLowerCase() },
  );
