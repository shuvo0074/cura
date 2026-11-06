import { bdMobileSchema } from '@cura/shared';
import type { AmbulanceRequestInput, AmbulanceRequestStatus } from '../../../core/ports/directory.ports';
import { DirectoryValidationError } from './errors';

type Body = Record<string, any>;

const fail = (message: string): never => {
  throw new DirectoryValidationError(message);
};

const line = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : null;

/** How far ahead a patient can book a pickup. */
export const MAX_DAYS_AHEAD = 7;
/** A pickup time a little in the past still means "now": the form may have sat open. */
const PAST_GRACE_MS = 15 * 60_000;

/** A patient's ambulance request, checked. `now` is passed in so tests can pin it. */
export function ambulanceRequest(body: Body, now = new Date()): AmbulanceRequestInput {
  const pickupAddress = line(body.pickup_address, 300);
  if (!pickupAddress || pickupAddress.length < 5) fail('Enter the pickup address');

  const phone = bdMobileSchema.safeParse(typeof body.contact_phone === 'string' ? body.contact_phone : '');
  if (!phone.success) fail('Enter a valid mobile number, e.g. 01712345678');

  let pickupAt: Date | null = null;
  if (body.pickup_at !== undefined && body.pickup_at !== null && body.pickup_at !== '') {
    const at = typeof body.pickup_at === 'string' ? new Date(body.pickup_at) : new Date(NaN);
    if (Number.isNaN(at.getTime())) fail('Choose a valid pickup time');
    if (at.getTime() < now.getTime() - PAST_GRACE_MS) fail('The pickup time has already passed');
    if (at.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) {
      fail(`Choose a pickup time within ${MAX_DAYS_AHEAD} days`);
    }
    pickupAt = at;
  }

  return {
    contactPhone: phone.data!,
    pickupAddress: pickupAddress!,
    destination: line(body.destination, 200),
    // The note keeps its line breaks.
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null,
    pickupAt,
  };
}

/**
 * The statuses an owner can set, and where each may come from. Accepting and
 * declining carry an optional message; completing keeps the arrival message.
 */
const OWNER_MOVES: Record<string, { to: AmbulanceRequestStatus; from: AmbulanceRequestStatus[]; message: boolean }> = {
  accepted: { to: 'ACCEPTED', from: ['NEW'], message: true },
  completed: { to: 'COMPLETED', from: ['ACCEPTED'], message: false },
  declined: { to: 'DECLINED', from: ['NEW', 'ACCEPTED'], message: true },
};

export function ownerRequestMove(body: Body) {
  const status = String(body.status ?? '');
  const move = Object.hasOwn(OWNER_MOVES, status) ? OWNER_MOVES[status] : undefined;
  if (!move) fail('Status must be accepted, completed or declined');
  return { to: move!.to, from: move!.from, message: move!.message ? line(body.message, 300) : undefined };
}
