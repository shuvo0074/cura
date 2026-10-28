import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AwardRecord,
  OnboardingProgress,
  OnboardingRepository,
  PersonalDetailsRecord,
  QualificationRecord,
} from '../../core/ports/onboarding.ports';

@Injectable()
export class PrismaOnboardingRepository implements OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProgress(userId: string): Promise<OnboardingProgress | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingStep: true, onboardingComplete: true, onboardingDraft: true },
    });
    if (!user) return null;
    return {
      step: user.onboardingStep,
      complete: user.onboardingComplete,
      draft: (user.onboardingDraft?.payload as Record<string, unknown>) ?? null,
    };
  }

  async isComplete(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingComplete: true },
    });
    return user?.onboardingComplete ?? false;
  }

  async findDraft(userId: string): Promise<Record<string, unknown> | null> {
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { userId },
      select: { payload: true },
    });
    return (draft?.payload as Record<string, unknown>) ?? null;
  }

  async saveDraft(userId: string, step: number, draft: Record<string, unknown>): Promise<void> {
    await this.prisma.onboardingDraft.upsert({
      where: { userId },
      create: { userId, step, payload: draft as never },
      update: { step, payload: draft as never },
    });
  }

  async saveDraftAndAdvance(
    userId: string,
    step: number,
    draft: Record<string, unknown>,
    nextStep: number,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.onboardingDraft.upsert({
        where: { userId },
        create: { userId, step, payload: draft as never },
        update: { step, payload: draft as never },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingStep: nextStep },
      }),
    ]);
  }

  async setStep(userId: string, step: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: step },
    });
  }

  async markComplete(userId: string, finalStep: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingComplete: true, onboardingStep: finalStep },
    });
  }

  async nidTakenByOther(fingerprint: string, userId: string): Promise<boolean> {
    const clash = await this.prisma.user.findFirst({
      where: { nidFingerprint: fingerprint, NOT: { id: userId } },
      select: { id: true },
    });
    return clash !== null;
  }

  async bmdcTakenByOther(bmdcNumber: string, userId: string): Promise<boolean> {
    const clash = await this.prisma.user.findFirst({
      where: { bmdcNumber, NOT: { id: userId } },
      select: { id: true },
    });
    return clash !== null;
  }

  async savePersonalDetails(userId: string, details: PersonalDetailsRecord): Promise<void> {
    const { nid, gender, ...rest } = details;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        gender: gender as never,
        ...(nid ? { nidEncrypted: nid.encrypted, nidFingerprint: nid.fingerprint } : {}),
      },
    });
  }

  async setBmdcNumber(userId: string, bmdcNumber: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { bmdcNumber },
    });
  }

  async replaceAcademicRecord(
    userId: string,
    qualifications: QualificationRecord[],
    awards: AwardRecord[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.qualification.deleteMany({ where: { userId } }),
      this.prisma.award.deleteMany({ where: { userId } }),
      this.prisma.qualification.createMany({
        data: qualifications.map((q) => ({ userId, ...q })),
      }),
      this.prisma.award.createMany({
        data: awards.map((a) => ({ userId, ...a })),
      }),
    ]);
  }
}
