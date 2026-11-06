import type { PharmacyOrderStatus, StockItemInput } from '../../../core/ports/directory.ports';
import { DirectoryValidationError } from './errors';

type Body = Record<string, any>;

const fail = (message: string): never => {
  throw new DirectoryValidationError(message);
};

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : null;

/** Highest price a pharmacy can list, in taka. */
export const MAX_PRICE_TAKA = 1_000_000;

/** One medicine on a pharmacy's stock list. Price is in taka, stored in poisha. */
export function stockItem(body: Body): StockItemInput {
  const name = text(body.name, 160);
  if (!name) fail('Medicine name is required');
  if (body.in_stock !== undefined && typeof body.in_stock !== 'boolean') fail('In stock must be yes or no');

  let priceMinor: number | null = null;
  if (body.price !== undefined && body.price !== null && body.price !== '') {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_TAKA) {
      fail(`Price must be a number from 0 to ${MAX_PRICE_TAKA} taka`);
    }
    priceMinor = Math.round(price * 100);
  }

  return {
    name: name!,
    strength: text(body.strength, 40),
    form: text(body.form, 40),
    priceMinor,
    inStock: body.in_stock !== false,
  };
}

/** The statuses a pharmacy can set, and where each may come from. */
const OWNER_MOVES: Record<string, { to: PharmacyOrderStatus; from: PharmacyOrderStatus[] }> = {
  ready: { to: 'READY', from: ['NEW'] },
  collected: { to: 'COLLECTED', from: ['READY'] },
  cannot_fill: { to: 'CANNOT_FILL', from: ['NEW', 'READY'] },
};

export function ownerMove(body: Body) {
  const status = String(body.status ?? '');
  const move = Object.hasOwn(OWNER_MOVES, status) ? OWNER_MOVES[status] : undefined;
  if (!move) fail('Status must be ready, collected or cannot_fill');
  // Only "cannot fill" carries a reason; other moves clear it.
  const reason = move!.to === 'CANNOT_FILL' ? text(body.reason, 300) : null;
  return { ...move!, reason };
}

/** The patient's note keeps its line breaks. */
export const orderNote = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
