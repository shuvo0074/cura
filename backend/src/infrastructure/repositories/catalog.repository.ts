import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CatalogEntryRecord,
  CatalogRepository,
  DrugRecord,
  PricingItemRecord,
} from '../../core/ports/clinical.ports';

/**
 * Catalogs backing the prescription auto-suggest.
 *
 * All lookups are prefix matches on a normalised column so they stay
 * index-backed — these fire on every keystroke past the third character, so a
 * sequential scan here would be felt immediately by the doctor typing.
 */
@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private normalise(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // -- Drugs ---------------------------------------------------------------

  async searchDrugs(practiceId: string, term: string, limit: number): Promise<DrugRecord[]> {
    const rows = await this.prisma.drug.findMany({
      where: {
        deletedAt: null,
        // Practice-owned entries plus the shared/global catalog (practiceId null).
        OR: [{ practiceId }, { practiceId: null }],
        searchName: { startsWith: this.normalise(term) },
      },
      select: { id: true, name: true, form: true, strength: true, unit: true, instruction: true },
      take: limit,
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  async createDrug(practiceId: string, data: Omit<DrugRecord, 'id'>): Promise<DrugRecord> {
    return this.prisma.drug.create({
      data: {
        practiceId,
        name: data.name,
        form: data.form,
        strength: data.strength,
        unit: data.unit,
        instruction: data.instruction,
        searchName: this.normalise(data.name),
      },
      select: { id: true, name: true, form: true, strength: true, unit: true, instruction: true },
    });
  }

  async deleteDrug(practiceId: string, id: string): Promise<void> {
    // Soft delete: prescriptions already written must keep resolving.
    await this.prisma.drug.updateMany({
      where: { id, practiceId },
      data: { deletedAt: new Date() },
    });
  }

  // -- Clinical note catalog (complaints / observations / …) ----------------

  async listEntries(practiceId: string, kind: string, term?: string): Promise<CatalogEntryRecord[]> {
    const rows = await this.prisma.catalogEntry.findMany({
      where: {
        practiceId,
        kind,
        deletedAt: null,
        ...(term ? { searchValue: { startsWith: this.normalise(term) } } : {}),
      },
      select: { id: true, kind: true, value: true },
      orderBy: { value: 'asc' },
      take: 200,
    });
    return rows;
  }

  async createEntry(practiceId: string, kind: string, value: string): Promise<CatalogEntryRecord> {
    return this.prisma.catalogEntry.upsert({
      where: { practiceId_kind_value: { practiceId, kind, value } },
      create: { practiceId, kind, value, searchValue: this.normalise(value) },
      update: { deletedAt: null },
      select: { id: true, kind: true, value: true },
    });
  }

  async deleteEntry(practiceId: string, id: string): Promise<void> {
    await this.prisma.catalogEntry.updateMany({
      where: { id, practiceId },
      data: { deletedAt: new Date() },
    });
  }

  // -- Pricing --------------------------------------------------------------

  async listPricing(practiceId: string): Promise<PricingItemRecord[]> {
    return this.prisma.pricingItem.findMany({
      where: { practiceId, deletedAt: null },
      select: { id: true, name: true, priceMinor: true, notes: true, isDefault: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async upsertPricing(
    practiceId: string,
    data: Omit<PricingItemRecord, 'id'> & { id?: string },
  ): Promise<PricingItemRecord> {
    const select = { id: true, name: true, priceMinor: true, notes: true, isDefault: true } as const;

    if (data.id) {
      return this.prisma.pricingItem.update({
        where: { id: data.id },
        data: { name: data.name, priceMinor: data.priceMinor, notes: data.notes },
        select,
      });
    }

    return this.prisma.pricingItem.upsert({
      where: { practiceId_name: { practiceId, name: data.name } },
      create: {
        practiceId,
        name: data.name,
        priceMinor: data.priceMinor,
        notes: data.notes,
        isDefault: data.isDefault,
      },
      update: { priceMinor: data.priceMinor, notes: data.notes, deletedAt: null },
      select,
    });
  }

  async deletePricing(practiceId: string, id: string): Promise<void> {
    await this.prisma.pricingItem.updateMany({
      where: { id, practiceId },
      data: { deletedAt: new Date() },
    });
  }

  // -- Charting templates ---------------------------------------------------

  async listChartingTemplates(practiceId: string) {
    return this.prisma.chartingTemplate.findMany({
      where: { practiceId },
      select: { id: true, name: true, diagnoses: true, labOrders: true, followUpDays: true },
      orderBy: { name: 'asc' },
    });
  }

  async upsertChartingTemplate(
    practiceId: string,
    data: { id?: string; name: string; diagnoses: string[]; labOrders: string[]; followUpDays: number | null },
  ): Promise<{ id: string }> {
    return this.prisma.chartingTemplate.upsert({
      where: { practiceId_name: { practiceId, name: data.name } },
      create: {
        practiceId,
        name: data.name,
        diagnoses: data.diagnoses,
        labOrders: data.labOrders,
        followUpDays: data.followUpDays,
      },
      update: {
        diagnoses: data.diagnoses,
        labOrders: data.labOrders,
        followUpDays: data.followUpDays,
      },
      select: { id: true },
    });
  }
}
