import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  CLINICAL_NOTE_CATALOG_REPOSITORY,
  DRUG_CATALOG_REPOSITORY,
  type ClinicalNoteCatalogRepository,
  type DrugCatalogRepository,
  type DrugRecord,
} from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/**
 * The two catalogs behind the prescription auto-suggest: drugs, and the
 * clinical-note entries (complaints, observations, diagnoses, advice, notes).
 */
@Injectable()
export class CatalogSettingsService {
  constructor(
    @Inject(DRUG_CATALOG_REPOSITORY) private readonly drugs: DrugCatalogRepository,
    @Inject(CLINICAL_NOTE_CATALOG_REPOSITORY) private readonly notes: ClinicalNoteCatalogRepository,
  ) {}

  // -- Drugs -----------------------------------------------------------------

  async searchDrugs(practiceId: string, term: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.drugs.searchDrugs(practiceId, term, 20);
  }

  async listDrugs(practiceId: string, term: string | undefined, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.drugs.listDrugs(practiceId, term, 200);
  }

  async createDrug(practiceId: string, data: Omit<DrugRecord, 'id'>, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.drugs.createDrug(practiceId, data);
  }

  async updateDrug(
    practiceId: string,
    id: string,
    data: Omit<DrugRecord, 'id'>,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.drugs.updateDrug(practiceId, id, data);
  }

  async deleteDrug(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.drugs.deleteDrug(practiceId, id);
    return { deleted: true };
  }

  // -- Clinical-note entries -------------------------------------------------

  async listCatalog(
    practiceId: string,
    kind: string,
    term: string | undefined,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.notes.listEntries(practiceId, kind, term);
  }

  async createCatalogEntry(
    practiceId: string,
    kind: string,
    value: string,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.notes.createEntry(practiceId, kind, value);
  }

  async updateCatalogEntry(
    practiceId: string,
    id: string,
    value: string,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.notes.updateEntry(practiceId, id, value);
  }

  async deleteCatalogEntry(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.notes.deleteEntry(practiceId, id);
    return { deleted: true };
  }
}
