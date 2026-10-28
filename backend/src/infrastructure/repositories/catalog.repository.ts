import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// Adapters raise the domain's own not-found error rather than a bare Error:
// these misses are almost always a row belonging to another practice, and that
// must reach the client as a 404, not a 500.
import { NotFoundError } from '../../common/errors/domain-error';
import type {
  CatalogEntryRecord,
  ChartingTemplateRepository,
  ClinicalNoteCatalogRepository,
  DrugCatalogRepository,
  DrugRecord,
  PricingItemRecord,
  PricingRepository,
} from '../../core/ports/clinical.ports';

/**
 * Catalogs backing the prescription auto-suggest.
 *
 * All lookups are prefix matches on a normalised column so they stay
 * index-backed — these fire on every keystroke past the third character, so a
 * sequential scan here would be felt immediately by the doctor typing.
 */
@Injectable()
export class PrismaCatalogRepository
  implements DrugCatalogRepository, ClinicalNoteCatalogRepository, PricingRepository, ChartingTemplateRepository
{
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

  /**
   * The catalog table view (spec: Drug Catalog → "Catalog List & Management").
   *
   * Unlike `searchDrugs` this returns the practice's own entries only — the
   * shared global catalog is auto-suggest fodder, not something the doctor can
   * edit or delete, and showing it here would offer actions that always fail.
   */
  async listDrugs(practiceId: string, term: string | undefined, limit: number): Promise<DrugRecord[]> {
    return this.prisma.drug.findMany({
      where: {
        practiceId,
        deletedAt: null,
        ...(term ? { searchName: { startsWith: this.normalise(term) } } : {}),
      },
      select: { id: true, name: true, form: true, strength: true, unit: true, instruction: true },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async updateDrug(practiceId: string, id: string, data: Omit<DrugRecord, 'id'>): Promise<DrugRecord> {
    const { count } = await this.prisma.drug.updateMany({
      where: { id, practiceId, deletedAt: null },
      data: {
        name: data.name,
        form: data.form,
        strength: data.strength,
        unit: data.unit,
        instruction: data.instruction,
        searchName: this.normalise(data.name),
      },
    });
    if (count === 0) throw new NotFoundError('Drug');
    return { id, ...data };
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

  async updateEntry(practiceId: string, id: string, value: string): Promise<CatalogEntryRecord> {
    const existing = await this.prisma.catalogEntry.findFirst({
      where: { id, practiceId, deletedAt: null },
      select: { kind: true },
    });
    if (!existing) throw new NotFoundError('Catalog entry');

    await this.prisma.catalogEntry.updateMany({
      where: { id, practiceId },
      data: { value, searchValue: this.normalise(value) },
    });
    return { id, kind: existing.kind, value };
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

    // Scoped by practiceId as well as id: an update keyed on the primary key
    // alone would let one practice reprice another's catalog.
    if (data.id) {
      const { count } = await this.prisma.pricingItem.updateMany({
        where: { id: data.id, practiceId, deletedAt: null },
        data: { name: data.name, priceMinor: data.priceMinor, notes: data.notes },
      });
      if (count === 0) throw new NotFoundError('Pricing item');
      const row = await this.prisma.pricingItem.findUniqueOrThrow({
        where: { id: data.id },
        select,
      });
      return row;
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

  async deleteChartingTemplate(practiceId: string, id: string): Promise<void> {
    await this.prisma.chartingTemplate.deleteMany({ where: { id, practiceId } });
  }
}
