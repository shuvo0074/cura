import { ForbiddenError } from '../errors/domain-error';
import type { AuthenticatedPrincipal } from './jwt-auth.guard';

/**
 * Tenancy check for practice-scoped operations.
 *
 * The practice id arrives from the client, so membership is asserted before
 * any read or write — a valid token for practice A must never reach B's data.
 */
export function assertPracticeAccess(principal: AuthenticatedPrincipal, practiceId: string): void {
  if (!principal.practiceIds.includes(practiceId)) {
    throw new ForbiddenError('You do not have access to this practice.');
  }
}
