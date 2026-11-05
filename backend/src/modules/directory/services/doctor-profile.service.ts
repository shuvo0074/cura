import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  DOCTOR_LISTING_REPOSITORY,
  DOCTOR_PROFILE_REPOSITORY,
  type DirectoryIdentity,
  type DoctorListingRepository,
  type DoctorProfileRepository,
  type Row,
} from '../../../core/ports/directory.ports';
import { CLOCK, type Clock } from '../../../core/ports/services';
import {
  ITEM_KINDS,
  cleanItem,
  cleanProfilePatch,
  completeness,
  slugify,
} from '../domain/doctor-profile.rules';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryMediaService, type UploadedImage } from './media.service';
import { DirectoryAudit } from './directory-audit.service';

const MAX_ITEMS_PER_KIND = 40;

const presentItem = ({ createdAt: _createdAt, ...item }: Row) => present(item);

function groupItems(rows: Row[]) {
  const groups: Record<string, Row[]> = Object.fromEntries(ITEM_KINDS.map((kind) => [kind, []]));
  for (const row of rows) groups[String(row.kind).toLowerCase()]!.push(presentItem(row));
  return groups;
}

/** A doctor's own profile and what the public sees of its career entries. */
@Injectable()
export class DoctorProfileService {
  constructor(
    @Inject(DOCTOR_PROFILE_REPOSITORY) private readonly profiles: DoctorProfileRepository,
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly media: DirectoryMediaService,
    private readonly audit: DirectoryAudit,
  ) {}

  /** Creates the profile link the first time the owner needs one. */
  async mine(doctorId: string) {
    const profile = await this.profiles.findSelf(doctorId);
    if (!profile) throw directoryNotFound('Doctor');
    if (!profile.slug) {
      const base = slugify(profile.name);
      const candidates = base ? [base, ...[2, 3, 4, 5].map((n) => `${base}-${n}`)] : [];
      profile.slug = await this.profiles.assignFirstFreeSlug(doctorId, [...candidates, `dr-${doctorId}`]);
    }
    const items = await this.profiles.items(doctorId);
    const lowerKinds = items.map((item) => ({ kind: String(item.kind).toLowerCase() }));
    return { ...present(profile), items: groupItems(items), completeness: completeness(profile, lowerKinds) };
  }

  async update(identity: DirectoryIdentity, body: Row) {
    const doctorId = identity.doctorId!;
    const patch = cleanProfilePatch(body, this.currentYear());
    if (Object.keys(patch).length) {
      await this.profiles.updateSelf(doctorId, patch);
      await this.audit.record(identity.userId, 'doctor_profile_updated', 'doctor_listing', doctorId, {
        fields: Object.keys(patch),
      });
    }
    return this.mine(doctorId);
  }

  async addItem(doctorId: string, body: Row) {
    const item = cleanItem(body, this.currentYear());
    if ((await this.profiles.countItems(doctorId, item.kind)) >= MAX_ITEMS_PER_KIND) {
      throw new DirectoryError(HttpStatus.BAD_REQUEST, 'LIMIT', 'You have reached the limit for this section');
    }
    const created = await this.profiles.addItem(doctorId, item);
    await this.profiles.touch(doctorId);
    return presentItem(created);
  }

  async updateItem(doctorId: string, itemId: string, body: Row) {
    const updated = await this.profiles.updateItem(doctorId, itemId, cleanItem(body, this.currentYear()));
    if (!updated) throw directoryNotFound('Entry');
    await this.profiles.touch(doctorId);
    return presentItem(updated);
  }

  async deleteItem(doctorId: string, itemId: string) {
    if (!(await this.profiles.deleteItem(doctorId, itemId))) throw directoryNotFound('Entry');
    return { ok: true };
  }

  async setPhoto(doctorId: string, file: UploadedImage | undefined) {
    const photo = await this.media.store(file, 'doctor-photos', `doctor-upload-${doctorId}`);
    const previous = await this.listings.setPhoto(doctorId, photo);
    if (previous === undefined) {
      await this.media.discard(photo);
      throw directoryNotFound('Doctor');
    }
    await this.media.discard(previous);
    await this.profiles.touch(doctorId);
    return { photo };
  }

  async removePhoto(doctorId: string) {
    const previous = await this.listings.setPhoto(doctorId, null);
    if (previous === undefined) throw directoryNotFound('Doctor');
    await this.media.discard(previous);
    return { photo: null };
  }

  /** Career entries, endorsements and reviews. Hidden doctors are not visible here. */
  async publicProfile(doctorId: string, identity: DirectoryIdentity | null) {
    const doctor = await this.listings.findVisible(doctorId);
    if (!doctor) throw directoryNotFound('Doctor');
    const expertise = doctor.clinicalExpertise ?? [];
    const viewerDoctorId = identity?.doctorId ?? null;

    const [items, endorsements, summary, recent] = await Promise.all([
      this.profiles.items(doctorId),
      this.profiles.endorsementSummaries(doctorId, expertise),
      this.profiles.reviewSummary(doctorId),
      this.profiles.recentReviews(doctorId, 6),
    ]);

    const isOwner = viewerDoctorId === doctorId;
    return {
      items: groupItems(items),
      endorsements: expertise.map((skill) => {
        const forSkill = endorsements.filter((e) => e.skill === skill);
        return {
          skill,
          count: forSkill.length,
          endorsedByMe: forSkill.some((e) => e.endorserDoctorId === viewerDoctorId),
          endorsers: forSkill.slice(0, 3).map((e) => e.endorser),
        };
      }),
      reviews: { ...summary, recent: recent.map(present) },
      canEndorse: Boolean(identity?.doctorVerified) && !isOwner,
      isOwner,
    };
  }

  async endorse(doctorId: string, identity: DirectoryIdentity, skill: unknown) {
    const endorserId = identity.doctorId!;
    if (doctorId === endorserId) {
      throw new DirectoryError(HttpStatus.BAD_REQUEST, 'SELF_ENDORSE', 'You can’t endorse yourself');
    }
    const doctor = await this.listings.findVisible(doctorId);
    if (!doctor) throw directoryNotFound('Doctor');
    if (!identity.doctorVerified) {
      throw new DirectoryError(HttpStatus.FORBIDDEN, 'NOT_VERIFIED', 'Only BMDC-verified doctors can endorse colleagues');
    }
    if (typeof skill !== 'string' || !doctor.clinicalExpertise.includes(skill)) {
      throw new DirectoryValidationError('That isn’t one of this doctor’s listed areas of expertise');
    }
    await this.profiles.endorse(doctorId, endorserId, skill);
    return { ok: true };
  }

  async unendorse(doctorId: string, identity: DirectoryIdentity, skill: unknown) {
    await this.profiles.unendorse(doctorId, identity.doctorId!, String(skill ?? ''));
    return { ok: true };
  }

  private currentYear(): number {
    return this.clock.now().getUTCFullYear();
  }
}
