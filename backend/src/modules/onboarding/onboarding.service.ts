import { Inject, Injectable } from '@nestjs/common';
import {
  academicDetailsSchema,
  personalDetailsSchema,
  professionalDetailsSchema,
  type AcademicDetailsInput,
  type PersonalDetailsInput,
  type ProfessionalDetailsInput,
} from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/domain-error';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../core/ports/repositories';
import { CLOCK, type Clock } from '../../core/ports/services';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingState {
  step: number;
  completed: boolean;
  /** Steps whose mandatory fields have been satisfied and persisted. */
  completedSteps: number[];
  draft: Record<string, unknown>;
}

/**
 * The 4-step account-creation wizard.
 *
 * Three rules from the specification are enforced here rather than trusted to
 * the client:
 *
 *  - **Validation gate** — step 3 is unreachable until steps 1 and 2 have been
 *    validated and stored. A client that skips ahead is rejected.
 *  - **Skippable steps** — 2, 3 and 4 may be skipped; step 1 may not.
 *  - **One-time execution** — once complete, the wizard cannot be re-entered
 *    and subsequent logins go straight to the dashboard.
 *
 * Draft state is persisted server-side on every autosave, so a browser refresh
 * mid-step loses nothing.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly crypto: CryptoService,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getState(principal: AuthenticatedPrincipal): Promise<OnboardingState> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      select: { onboardingStep: true, onboardingComplete: true, onboardingDraft: true },
    });
    if (!user) throw new NotFoundError('User');

    const draft = (user.onboardingDraft?.payload as Record<string, unknown>) ?? {};
    return {
      step: user.onboardingStep || 1,
      completed: user.onboardingComplete,
      completedSteps: this.completedStepsFrom(draft, user.onboardingStep),
      draft,
    };
  }

  /**
   * Autosave. Deliberately unvalidated — a half-typed step must still persist,
   * or the "refresh loses nothing" guarantee fails. Validation happens on
   * `submitStep`, which is what actually advances the wizard.
   */
  async saveDraft(
    principal: AuthenticatedPrincipal,
    step: number,
    payload: Record<string, unknown>,
  ): Promise<{ savedAt: string }> {
    await this.assertNotComplete(principal.userId);

    const existing = await this.prisma.onboardingDraft.findUnique({
      where: { userId: principal.userId },
      select: { payload: true },
    });

    const merged = {
      ...((existing?.payload as Record<string, unknown>) ?? {}),
      [`step${step}`]: payload,
    };

    await this.prisma.onboardingDraft.upsert({
      where: { userId: principal.userId },
      create: { userId: principal.userId, step, payload: merged as never },
      update: { step, payload: merged as never },
    });

    return { savedAt: this.clock.now().toISOString() };
  }

  async submitStep(
    principal: AuthenticatedPrincipal,
    step: OnboardingStep,
    payload: unknown,
  ): Promise<OnboardingState> {
    await this.assertNotComplete(principal.userId);
    await this.assertGate(principal.userId, step);

    switch (step) {
      case 1:
        await this.savePersonal(principal.userId, personalDetailsSchema.parse(payload));
        break;
      case 2:
        await this.saveProfessional(principal.userId, professionalDetailsSchema.parse(payload));
        break;
      case 3:
        await this.saveAcademic(principal.userId, academicDetailsSchema.parse(payload));
        break;
      case 4:
        // Documents arrive through the upload endpoint; this step only records
        // that the doctor reviewed and confirmed them.
        break;
    }

    await this.recordStepDone(principal.userId, step, payload);
    return this.getState(principal);
  }

  /** Spec 3.2.6.3(iii): steps 2–4 may be skipped and completed later. */
  async skipStep(principal: AuthenticatedPrincipal, step: OnboardingStep): Promise<OnboardingState> {
    await this.assertNotComplete(principal.userId);

    if (!(this.config.rules.onboarding.skippableSteps as readonly number[]).includes(step)) {
      throw new ValidationError('This step is required and cannot be skipped.');
    }

    // Clamped to the last step: skipping step 4 leaves the wizard *on* step 4
    // awaiting "Finish", rather than pointing at a step that does not exist.
    await this.prisma.user.update({
      where: { id: principal.userId },
      data: { onboardingStep: Math.min(step + 1, this.config.rules.onboarding.totalSteps) },
    });
    return this.getState(principal);
  }

  /**
   * Finishes the wizard.
   *
   * Requires step 1 to have been satisfied — everything else is optional by
   * specification. Sets `onboardingComplete`, which is what makes the flow
   * one-time.
   */
  async finish(principal: AuthenticatedPrincipal): Promise<OnboardingState> {
    await this.assertNotComplete(principal.userId);

    const state = await this.getState(principal);
    if (!state.completedSteps.includes(1)) {
      throw new ValidationError('Complete your personal details before finishing.');
    }

    await this.prisma.user.update({
      where: { id: principal.userId },
      data: { onboardingComplete: true, onboardingStep: 4 },
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'onboarding.completed',
      resourceType: 'user',
      resourceId: principal.userId,
      practiceId: null,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return this.getState(principal);
  }

  // -------------------------------------------------------------------------

  private async savePersonal(userId: string, input: PersonalDetailsInput): Promise<void> {
    // NID is sensitive: stored as AES-256-GCM ciphertext plus a keyed
    // fingerprint, so duplicates can be detected without ever decrypting.
    const nidEncrypted = input.nid ? this.crypto.encryptField(input.nid) : null;
    const nidFingerprint = input.nid ? this.crypto.fingerprint(input.nid) : null;

    if (nidFingerprint) {
      const clash = await this.prisma.user.findFirst({
        where: { nidFingerprint, NOT: { id: userId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictError('NID_IN_USE', 'That NID is already registered to another account.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        gender: input.gender as never,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        bloodGroup: input.bloodGroup ?? null,
        secondaryPhone: input.secondaryPhone ?? null,
        locale: input.language,
        ...(nidEncrypted ? { nidEncrypted, nidFingerprint } : {}),
      },
    });
  }

  private async saveProfessional(userId: string, input: ProfessionalDetailsInput): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: { bmdcNumber: input.bmdcNumber, NOT: { id: userId } },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictError(
        'BMDC_IN_USE',
        'That BMDC registration number belongs to another account.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { bmdcNumber: input.bmdcNumber },
    });
  }

  private async saveAcademic(userId: string, input: AcademicDetailsInput): Promise<void> {
    // Replaced wholesale so the stored list always mirrors what the doctor sees
    // in the repeater, including removals.
    await this.prisma.$transaction([
      this.prisma.qualification.deleteMany({ where: { userId } }),
      this.prisma.award.deleteMany({ where: { userId } }),
      this.prisma.qualification.createMany({
        data: input.qualifications.map((q) => ({
          userId,
          degreeName: q.degreeName,
          instituteName: q.instituteName,
          passingYear: q.passingYear ?? null,
          country: q.country ?? null,
        })),
      }),
      this.prisma.award.createMany({
        data: input.awards.map((a) => ({
          userId,
          title: a.title,
          year: a.year ?? null,
          issuer: a.issuer ?? null,
          country: a.country ?? null,
        })),
      }),
    ]);
  }

  private async recordStepDone(userId: string, step: number, payload: unknown): Promise<void> {
    const existing = await this.prisma.onboardingDraft.findUnique({
      where: { userId },
      select: { payload: true },
    });
    const draft = (existing?.payload as Record<string, unknown>) ?? {};
    const done = new Set<number>((draft._completedSteps as number[] | undefined) ?? []);
    done.add(step);

    const merged = {
      ...draft,
      [`step${step}`]: payload,
      _completedSteps: [...done].sort(),
    };

    await this.prisma.$transaction([
      this.prisma.onboardingDraft.upsert({
        where: { userId },
        create: { userId, step, payload: merged as never },
        update: { step, payload: merged as never },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingStep: Math.min(step + 1, 4) },
      }),
    ]);
  }

  /**
   * The validation gate. Step 3 requires 1 and 2; step 2 requires 1. Enforced
   * server-side because a client-side stepper is a convenience, not a control.
   */
  private async assertGate(userId: string, step: OnboardingStep): Promise<void> {
    if (step === 1) return;

    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { userId },
      select: { payload: true },
    });
    const done = new Set<number>(
      ((draft?.payload as Record<string, unknown>)?._completedSteps as number[] | undefined) ?? [],
    );

    const required = step === 2 ? [1] : step === 3 ? [1, 2] : [1];
    const missing = required.filter((r) => !done.has(r));

    if (missing.length > 0) {
      throw new ValidationError(
        `Complete step ${missing.join(' and ')} before continuing to step ${step}.`,
      );
    }
  }

  private async assertNotComplete(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingComplete: true },
    });
    if (user?.onboardingComplete) {
      throw new ConflictError(
        'ONBOARDING_COMPLETE',
        'Account setup is already complete. Edit your details from Profile settings instead.',
      );
    }
  }

  private completedStepsFrom(draft: Record<string, unknown>, step: number): number[] {
    const recorded = draft._completedSteps as number[] | undefined;
    if (recorded) return recorded;
    return step > 1 ? Array.from({ length: step - 1 }, (_, i) => i + 1) : [];
  }
}
