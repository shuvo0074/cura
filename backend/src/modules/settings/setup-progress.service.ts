import { Inject, Injectable } from '@nestjs/common';
import { Permission, permissionsForRole } from '@cura/shared';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import { PRACTICE_REPOSITORY, type PracticeRepository } from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

export type SetupStepKey = 'details' | 'hours' | 'doctor' | 'pricing' | 'deskStaff' | 'firstPatient';

export interface SetupProgress {
  steps: Array<{ key: SetupStepKey; done: boolean; optional: boolean }>;
  /** Required steps done, out of `total` required steps. */
  done: number;
  total: number;
  complete: boolean;
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/**
 * The clinic owner's "Get your clinic ready" checklist. Every step is worked
 * out from the clinic's own records, never from what was clicked.
 */
@Injectable()
export class SetupProgressService {
  constructor(@Inject(PRACTICE_REPOSITORY) private readonly practices: PracticeRepository) {}

  async progress(practiceId: string, principal: AuthenticatedPrincipal): Promise<SetupProgress> {
    // Only the clinic's own owner. A super admin's read widens the principal to
    // every clinic and permission, so the account's own access is checked here.
    const own = principal.ownPracticeIds ?? principal.practiceIds;
    if (!own.includes(practiceId) || !permissionsForRole(principal.role).includes(Permission.SETTINGS_MANAGE)) {
      throw new ForbiddenError('Only the clinic owner can see this checklist.');
    }
    const facts = await this.practices.setupFacts(practiceId);
    if (!facts) throw new NotFoundError('Practice');

    const steps: SetupProgress['steps'] = [
      { key: 'details', done: filled(facts.name) && filled(facts.contactNumber) && filled(facts.address), optional: false },
      { key: 'hours', done: facts.sessions > 0, optional: false },
      { key: 'doctor', done: facts.doctors > 0, optional: false },
      { key: 'pricing', done: facts.pricingItems > 0, optional: false },
      { key: 'deskStaff', done: facts.deskStaff > 0, optional: true },
      { key: 'firstPatient', done: facts.appointments > 0, optional: false },
    ];
    const required = steps.filter((s) => !s.optional);
    const done = required.filter((s) => s.done).length;
    return { steps, done, total: required.length, complete: done === required.length };
  }
}
