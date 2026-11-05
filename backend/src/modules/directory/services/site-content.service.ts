import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_DIRECTORY_REPOSITORY,
  SITE_SETTINGS_REPOSITORY,
  type CatalogDirectoryRepository,
  type Row,
  type SiteSettingsRepository,
} from '../../../core/ports/directory.ports';
import { contactNumbers, homeContent, photoCredits, siteTextPatch } from '../domain/content-rules';
import { DirectoryValidationError } from '../domain/errors';
import { DirectoryAudit } from './directory-audit.service';
import { DirectoryMediaService, type UploadedImage } from './media.service';

const KEYS = { site_text: 'text', home_content: 'home', contact_numbers: 'contacts', photo_credits: 'credits' } as const;

/** Text edits, home page picks, phone numbers and photo credits. */
@Injectable()
export class SiteContentService {
  constructor(
    @Inject(SITE_SETTINGS_REPOSITORY) private readonly settings: SiteSettingsRepository,
    @Inject(CATALOG_DIRECTORY_REPOSITORY) private readonly catalog: CatalogDirectoryRepository,
    private readonly media: DirectoryMediaService,
    private readonly audit: DirectoryAudit,
  ) {}

  async read() {
    const values = await this.settings.getMany(Object.keys(KEYS));
    return Object.fromEntries(
      Object.entries(KEYS).filter(([key]) => key in values).map(([key, name]) => [name, values[key]]),
    );
  }

  /** Merged into what is saved; null removes an edit. */
  async updateText(body: Row, adminId: string) {
    const patch = siteTextPatch(body);
    const current = await this.settings.get<Row>('site_text', { en: {}, bn: {} });
    const next: Record<string, Row> = { en: { ...current.en }, bn: { ...current.bn } };
    for (const [lang, entries] of Object.entries(patch)) {
      for (const [key, value] of Object.entries(entries)) {
        if (value === null) delete next[lang]![key];
        else next[lang]![key] = value;
      }
    }
    return this.save('site_text', next, adminId);
  }

  /** Shortcuts must point at specialty and symptom pages that exist. */
  async updateHome(body: Row, adminId: string) {
    const home = homeContent(body);
    const [specialties, symptoms] = await Promise.all([this.catalog.slugs('specialties'), this.catalog.slugs('symptoms')]);
    const missing = [
      ...home.popular_specialties.filter((s) => !specialties.includes(s.slug)).map((s) => `specialty "${s.slug}"`),
      ...home.common_problems.filter((s) => !symptoms.includes(s.slug)).map((s) => `symptom "${s.slug}"`),
    ];
    if (missing.length) throw new DirectoryValidationError(`No such ${missing.join(', ')}`);
    return this.save('home_content', home, adminId);
  }

  updateContacts(body: Row, adminId: string) {
    return this.save('contact_numbers', contactNumbers(body), adminId);
  }

  updateCredits(body: unknown, adminId: string) {
    return this.save('photo_credits', photoCredits(body), adminId);
  }

  async uploadImage(file: UploadedImage | undefined, adminId: string) {
    const url = await this.media.store(file, 'site-images', 'site');
    await this.audit.record(adminId, 'site_image_uploaded', 'site_setting', null, { url });
    return { url };
  }

  private async save(key: string, value: unknown, adminId: string) {
    await this.settings.set(key, value);
    await this.audit.record(adminId, 'site_content_updated', 'site_setting', key);
    return this.read();
  }
}
