import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../common/security/decorators';
import type { DirectoryIdentity } from '../../../core/ports/directory.ports';
import { Identity, RequirePatient } from '../access/directory-access.decorators';
import { UuidOr404 } from '../access/uuid-or-404.pipe';
import { directoryNotFound } from '../domain/errors';
import { AmbulanceService } from '../services/ambulance.service';
import { CatalogService } from '../services/catalog.service';
import { HospitalService } from '../services/hospital.service';
import { PharmacyService } from '../services/pharmacy.service';
import { DirectoryMediaService } from '../services/media.service';
import { SerialBookingService } from '../services/serial-booking.service';
import { SiteContentService } from '../services/site-content.service';
import { PublicReadLimit, bodyOf } from './shared';

@Controller('directory/hospitals')
@Public()
@PublicReadLimit()
export class HospitalsController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  list() {
    return this.hospitals.listPublic();
  }

  @Get(':id')
  get(@Param('id', UuidOr404) id: string) {
    return this.hospitals.getPublic(id);
  }

  @Get(':id/doctors')
  doctors(@Param('id', UuidOr404) id: string) {
    return this.hospitals.doctors(id);
  }
}

@Controller('directory')
@Public()
@PublicReadLimit()
export class PublicContentController {
  constructor(
    private readonly ambulances: AmbulanceService,
    private readonly pharmacies: PharmacyService,
    private readonly catalog: CatalogService,
    private readonly site: SiteContentService,
  ) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('ambulances')
  listAmbulances() {
    return this.ambulances.listPublic();
  }

  @Get('pharmacies')
  listPharmacies() {
    return this.pharmacies.listPublic();
  }

  @Get('specialties')
  specialties() {
    return this.catalog.listPublic('specialties');
  }

  @Get('symptoms')
  symptoms() {
    return this.catalog.listPublic('symptoms');
  }

  @Get('site-content')
  siteContent() {
    return this.site.read();
  }
}

/** Public images. Patient documents are stored elsewhere and never served here. */
@Controller('directory/media')
@Public()
@PublicReadLimit()
export class MediaController {
  constructor(private readonly media: DirectoryMediaService) {}

  @Get(':folder/:file')
  async get(
    @Param('folder') folder: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const opened = await this.media.open(`${folder}/${file}`);
    if (!opened) throw directoryNotFound('File');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(opened.stream as never, { type: opened.mimeType });
  }
}

@Controller('directory/appointments')
@RequirePatient()
export class AppointmentsController {
  constructor(private readonly bookings: SerialBookingService) {}

  @Post()
  book(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.bookings.book(identity, bodyOf(body));
  }

  @Get('me')
  mine(@Identity() identity: DirectoryIdentity) {
    return this.bookings.forPatient(identity.patientId!);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.bookings.cancel(id, identity);
  }

  @Post(':id/review')
  review(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.bookings.review(id, identity, bodyOf(body));
  }
}
