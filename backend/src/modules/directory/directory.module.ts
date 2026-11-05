import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminAmbulancesController,
  AdminCatalogController,
  AdminDoctorsController,
  AdminHospitalsController,
  AdminSiteController,
  AdminVerificationsController,
} from './controllers/admin.controllers';
import { DirectoryAuthController } from './controllers/auth.controller';
import { DoctorMeController, DoctorsController, VerificationRequestController } from './controllers/doctors.controller';
import {
  AppointmentsController,
  HospitalsController,
  MediaController,
  PublicContentController,
} from './controllers/public-content.controller';
import { DirectoryAccountService } from './services/account.service';
import { AdminDoctorService } from './services/admin-doctor.service';
import { AmbulanceService } from './services/ambulance.service';
import { CatalogService } from './services/catalog.service';
import { DirectoryAudit } from './services/directory-audit.service';
import { DoctorDirectoryService } from './services/doctor-directory.service';
import { DoctorProfileService } from './services/doctor-profile.service';
import { DoctorReachService } from './services/doctor-reach.service';
import { HospitalService } from './services/hospital.service';
import { DirectoryMediaService } from './services/media.service';
import { SerialBookingService } from './services/serial-booking.service';
import { SiteContentService } from './services/site-content.service';
import { DoctorVerificationService } from './services/verification.service';

/**
 * The public directory: doctor, hospital and ambulance listings, doctor
 * verification and serial booking. It reads no clinical table.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    DirectoryAuthController,
    // Before DoctorsController, so `me` is not matched as a doctor id.
    DoctorMeController,
    DoctorsController,
    VerificationRequestController,
    HospitalsController,
    PublicContentController,
    MediaController,
    AppointmentsController,
    AdminVerificationsController,
    AdminDoctorsController,
    AdminHospitalsController,
    AdminAmbulancesController,
    AdminCatalogController,
    AdminSiteController,
  ],
  providers: [
    DirectoryAccountService,
    AdminDoctorService,
    AmbulanceService,
    CatalogService,
    DirectoryAudit,
    DoctorDirectoryService,
    DoctorProfileService,
    DoctorReachService,
    HospitalService,
    DirectoryMediaService,
    SerialBookingService,
    SiteContentService,
    DoctorVerificationService,
  ],
})
export class DirectoryModule {}
