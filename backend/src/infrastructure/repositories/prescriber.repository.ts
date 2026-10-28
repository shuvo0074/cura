import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PrescriberCredentials, PrescriberRepository } from '../../core/ports/clinical.ports';

@Injectable()
export class PrismaPrescriberRepository implements PrescriberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCredentials(userId: string): Promise<PrescriberCredentials | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        bmdcNumber: true,
        qualifications: { select: { degreeName: true }, orderBy: { passingYear: 'asc' } },
      },
    });
    if (!user) return null;
    return {
      fullName: user.fullName,
      bmdcNumber: user.bmdcNumber,
      qualifications: user.qualifications.map((q) => q.degreeName),
    };
  }
}
