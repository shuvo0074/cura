import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { CatalogKind, DirectoryIdentity } from '../../../core/ports/directory.ports';
import { Identity, RequireDirectoryAdmin } from '../access/directory-access.decorators';
import { UuidOr404 } from '../access/uuid-or-404.pipe';
import { AdminDoctorService } from '../services/admin-doctor.service';
import { AmbulanceService } from '../services/ambulance.service';
import { CatalogService } from '../services/catalog.service';
import { HospitalService } from '../services/hospital.service';
import type { UploadedImage } from '../services/media.service';
import { SerialBookingService } from '../services/serial-booking.service';
import { SiteContentService } from '../services/site-content.service';
import { DoctorVerificationService } from '../services/verification.service';
import { PhotoUpload, bodyOf, hiddenFlag } from './shared';

@Controller('directory/admin/verifications')
@RequireDirectoryAdmin()
export class AdminVerificationsController {
  constructor(private readonly verifications: DoctorVerificationService) {}

  @Get()
  list(@Query('status') status: string) {
    return this.verifications.list(status);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.verifications.approve(id, admin.userId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.verifications.reject(id, bodyOf(body).note, admin.userId);
  }
}

@Controller('directory/admin/doctors')
@RequireDirectoryAdmin()
export class AdminDoctorsController {
  constructor(private readonly doctors: AdminDoctorService) {}

  @Get()
  list() {
    return this.doctors.list();
  }

  @Post()
  create(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.doctors.create(bodyOf(body), admin.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.doctors.update(id, bodyOf(body), admin.userId);
  }

  @Patch(':id/hidden')
  setHidden(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.doctors.setHidden(id, hiddenFlag(body), admin.userId);
  }

  @Delete(':id')
  remove(@Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.doctors.remove(id, admin.userId);
  }

  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PhotoUpload())
  setPhoto(@Param('id', UuidOr404) id: string, @UploadedFile() file: UploadedImage | undefined) {
    return this.doctors.setPhoto(id, file);
  }

  @Delete(':id/photo')
  removePhoto(@Param('id', UuidOr404) id: string) {
    return this.doctors.removePhoto(id);
  }
}

@Controller('directory/admin/hospitals')
@RequireDirectoryAdmin()
export class AdminHospitalsController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  list() {
    return this.hospitals.listAdmin();
  }

  @Get(':id')
  get(@Param('id', UuidOr404) id: string) {
    return this.hospitals.getAdmin(id);
  }

  @Post()
  create(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.hospitals.create(bodyOf(body), admin.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.hospitals.update(id, bodyOf(body), admin.userId);
  }

  @Patch(':id/hidden')
  setHidden(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.hospitals.setHidden(id, hiddenFlag(body), admin.userId);
  }

  @Delete(':id')
  remove(@Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.hospitals.remove(id, admin.userId);
  }

  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PhotoUpload())
  setPhoto(@Param('id', UuidOr404) id: string, @UploadedFile() file: UploadedImage | undefined) {
    return this.hospitals.setPhoto(id, file);
  }

  @Delete(':id/photo')
  removePhoto(@Param('id', UuidOr404) id: string) {
    return this.hospitals.removePhoto(id);
  }
}

@Controller('directory/admin/ambulances')
@RequireDirectoryAdmin()
export class AdminAmbulancesController {
  constructor(private readonly ambulances: AmbulanceService) {}

  @Get()
  list() {
    return this.ambulances.listAdmin();
  }

  @Post()
  create(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.ambulances.create(bodyOf(body), admin.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.ambulances.update(id, bodyOf(body), admin.userId);
  }

  @Patch(':id/hidden')
  setHidden(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.ambulances.setHidden(id, hiddenFlag(body), admin.userId);
  }

  @Delete(':id')
  remove(@Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.ambulances.remove(id, admin.userId);
  }
}

@Controller('directory/admin/:kind(specialties|symptoms)')
@RequireDirectoryAdmin()
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('kind') kind: CatalogKind) {
    return this.catalog.listAdmin(kind);
  }

  @Post()
  create(@Param('kind') kind: CatalogKind, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.catalog.create(kind, bodyOf(body), admin.userId);
  }

  @Patch(':id')
  update(
    @Param('kind') kind: CatalogKind,
    @Param('id', UuidOr404) id: string,
    @Body() body: unknown,
    @Identity() admin: DirectoryIdentity,
  ) {
    return this.catalog.update(kind, id, bodyOf(body), admin.userId);
  }

  @Patch(':id/hidden')
  setHidden(
    @Param('kind') kind: CatalogKind,
    @Param('id', UuidOr404) id: string,
    @Body() body: unknown,
    @Identity() admin: DirectoryIdentity,
  ) {
    return this.catalog.setHidden(kind, id, hiddenFlag(body), admin.userId);
  }

  @Delete(':id')
  remove(@Param('kind') kind: CatalogKind, @Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.catalog.remove(kind, id, admin.userId);
  }

  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PhotoUpload())
  setImage(
    @Param('kind') kind: CatalogKind,
    @Param('id', UuidOr404) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    return this.catalog.setImage(kind, id, file);
  }

  @Delete(':id/photo')
  removeImage(@Param('kind') kind: CatalogKind, @Param('id', UuidOr404) id: string) {
    return this.catalog.removeImage(kind, id);
  }
}

@Controller('directory/admin')
@RequireDirectoryAdmin()
export class AdminSiteController {
  constructor(
    private readonly site: SiteContentService,
    private readonly ambulances: AmbulanceService,
    private readonly bookings: SerialBookingService,
  ) {}

  @Get('appointments')
  appointments(@Query('status') status: string) {
    return this.bookings.all(status);
  }

  @Get('sample-prices')
  samplePrices() {
    return this.ambulances.samplePrices();
  }

  @Patch('sample-prices')
  updateSamplePrices(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.ambulances.updateSamplePrices(bodyOf(body), admin.userId);
  }

  @Get('site-content')
  siteContent() {
    return this.site.read();
  }

  @Patch('site-text')
  updateText(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.site.updateText(bodyOf(body), admin.userId);
  }

  @Put('home-content')
  updateHome(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.site.updateHome(bodyOf(body), admin.userId);
  }

  @Put('contacts')
  updateContacts(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.site.updateContacts(bodyOf(body), admin.userId);
  }

  @Put('photo-credits')
  updateCredits(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.site.updateCredits(body, admin.userId);
  }

  @Post('site-images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PhotoUpload())
  uploadImage(@UploadedFile() file: UploadedImage | undefined, @Identity() admin: DirectoryIdentity) {
    return this.site.uploadImage(file, admin.userId);
  }
}
