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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../../../common/security/decorators';
import type { DirectoryIdentity, Row } from '../../../core/ports/directory.ports';
import {
  Identity,
  OptionalDirectoryUser,
  RequireLinkedDoctor,
  RequireSignedIn,
} from '../access/directory-access.decorators';
import { UuidOr404 } from '../access/uuid-or-404.pipe';
import { DirectoryAccountService } from '../services/account.service';
import { DoctorDirectoryService } from '../services/doctor-directory.service';
import { DoctorProfileService } from '../services/doctor-profile.service';
import { DoctorReachService } from '../services/doctor-reach.service';
import type { UploadedImage } from '../services/media.service';
import { SerialBookingService } from '../services/serial-booking.service';
import { PhotoUpload, PublicReadLimit, ReachLimit, bodyOf } from './shared';

/** The signed-in doctor. Registered before the `:id` routes so `me` is not read as an id. */
@Controller('directory/doctors/me')
@RequireLinkedDoctor()
export class DoctorMeController {
  constructor(
    private readonly profiles: DoctorProfileService,
    private readonly reach: DoctorReachService,
    private readonly bookings: SerialBookingService,
  ) {}

  @Get('appointments')
  appointments(@Identity() identity: DirectoryIdentity) {
    return this.bookings.forDoctor(identity.doctorId!);
  }

  @Patch('appointments/:id/complete')
  complete(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.bookings.complete(id, identity);
  }

  @Get('insights')
  insights(@Identity() identity: DirectoryIdentity) {
    return this.reach.insights(identity.doctorId!);
  }

  @Get('profile')
  profile(@Identity() identity: DirectoryIdentity) {
    return this.profiles.mine(identity.doctorId!);
  }

  @Patch('profile')
  update(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.profiles.update(identity, bodyOf(body));
  }

  @Post('profile/items')
  addItem(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.profiles.addItem(identity.doctorId!, bodyOf(body));
  }

  @Patch('profile/items/:itemId')
  updateItem(@Param('itemId', UuidOr404) itemId: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.profiles.updateItem(identity.doctorId!, itemId, bodyOf(body));
  }

  @Delete('profile/items/:itemId')
  deleteItem(@Param('itemId', UuidOr404) itemId: string, @Identity() identity: DirectoryIdentity) {
    return this.profiles.deleteItem(identity.doctorId!, itemId);
  }

  @Post('profile/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PhotoUpload())
  setPhoto(@UploadedFile() file: UploadedImage | undefined, @Identity() identity: DirectoryIdentity) {
    return this.profiles.setPhoto(identity.doctorId!, file);
  }

  @Delete('profile/photo')
  removePhoto(@Identity() identity: DirectoryIdentity) {
    return this.profiles.removePhoto(identity.doctorId!);
  }
}

@Controller('directory/doctors')
export class DoctorsController {
  constructor(
    private readonly directory: DoctorDirectoryService,
    private readonly profiles: DoctorProfileService,
    private readonly reach: DoctorReachService,
  ) {}

  @Public()
  @PublicReadLimit()
  @Get()
  list(@Query() query: Row) {
    return this.directory.list(query);
  }

  @Public()
  @PublicReadLimit()
  @Get('featured')
  featured(@Query('limit') limit: string) {
    return this.directory.featured(limit);
  }

  @Public()
  @PublicReadLimit()
  @Get('stats')
  stats() {
    return this.directory.stats();
  }

  @Public()
  @PublicReadLimit()
  @Get('by-slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.directory.bySlug(slug);
  }

  @Public()
  @PublicReadLimit()
  @Get(':id')
  byId(@Param('id', UuidOr404) id: string) {
    return this.directory.byId(id);
  }

  @OptionalDirectoryUser()
  @PublicReadLimit()
  @Get(':id/profile')
  profile(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity | null) {
    return this.profiles.publicProfile(id, identity);
  }

  @OptionalDirectoryUser()
  @PublicReadLimit()
  @Get(':id/sessions')
  sessions(@Param('id', UuidOr404) id: string, @Query('date') date: string, @Identity() identity: DirectoryIdentity | null) {
    return this.directory.sessions(id, date, identity);
  }

  @OptionalDirectoryUser()
  @ReachLimit()
  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async view(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity | null): Promise<void> {
    await this.reach.view(id, identity);
  }

  @Public()
  @ReachLimit()
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('id', UuidOr404) id: string) {
    return this.reach.share(id);
  }

  @Public()
  @ReachLimit()
  @Post(':id/call')
  @HttpCode(HttpStatus.OK)
  call(@Param('id', UuidOr404) id: string, @Body() body: unknown) {
    return this.reach.call(id, bodyOf(body));
  }

  @RequireLinkedDoctor()
  @Post(':id/endorsements')
  endorse(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.profiles.endorse(id, identity, bodyOf(body).skill);
  }

  @RequireLinkedDoctor()
  @Delete(':id/endorsements')
  unendorse(@Param('id', UuidOr404) id: string, @Query('skill') skill: string, @Identity() identity: DirectoryIdentity) {
    return this.profiles.unendorse(id, identity, skill);
  }
}

/** A signed-in account asks to be verified: a clinic doctor, or a rejected applicant. */
@Controller('directory/verifications')
export class VerificationRequestController {
  constructor(private readonly accounts: DirectoryAccountService) {}

  @RequireSignedIn()
  @Post()
  submit(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.accounts.submitVerification(identity, bodyOf(body));
  }
}
