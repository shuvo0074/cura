import { Injectable } from '@nestjs/common';
import type { OtpPurpose } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  OtpChallengeRecord,
  OtpRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../core/ports/repositories';

/**
 * Refresh-token storage with rotation lineage.
 *
 * Only SHA-256 digests are persisted, so a database disclosure does not yield
 * usable tokens. Each token records the `familyId` it descends from; presenting
 * an already-rotated token is treated as theft and revokes the whole family.
 */
@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async issue(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipHash?: string | null;
  }): Promise<RefreshTokenRecord> {
    const row = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        ipHash: input.ipHash ?? null,
      },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
    return row;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  }

  async markRotated(oldId: string, newTokenHash: string): Promise<void> {
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
      select: { id: true },
    });
    await this.prisma.refreshToken.update({
      where: { id: oldId },
      data: { revokedAt: new Date(), replacedById: replacement?.id ?? null },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(before: Date): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }
}

/**
 * OTP challenge storage.
 *
 * Codes are stored only as peppered HMACs. Attempt counts are incremented
 * server-side and the row is consumed on success, so a code is single-use.
 */
@Injectable()
export class PrismaOtpRepository implements OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    purpose: OtpPurpose;
    destination: string;
    codeHash: string;
    subjectId: string | null;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<OtpChallengeRecord> {
    const row = await this.prisma.otpChallenge.create({
      data: {
        purpose: input.purpose as never,
        destination: input.destination,
        codeHash: input.codeHash,
        subjectId: input.subjectId,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts,
      },
    });
    return this.toRecord(row);
  }

  async findActiveById(
    id: string,
  ): Promise<(OtpChallengeRecord & { codeHash: string }) | null> {
    const row = await this.prisma.otpChallenge.findFirst({
      where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    return row ? { ...this.toRecord(row), codeHash: row.codeHash } : null;
  }

  async incrementAttempts(id: string): Promise<number> {
    const row = await this.prisma.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return row.attempts;
  }

  async consume(id: string): Promise<void> {
    await this.prisma.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  async lastIssuedAt(destination: string, purpose: OtpPurpose): Promise<Date | null> {
    const row = await this.prisma.otpChallenge.findFirst({
      where: { destination, purpose: purpose as never },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }

  private toRecord(row: {
    id: string;
    purpose: string;
    destination: string;
    subjectId: string | null;
    attempts: number;
    maxAttempts: number;
    consumedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
  }): OtpChallengeRecord {
    return { ...row, purpose: row.purpose as OtpPurpose };
  }
}
