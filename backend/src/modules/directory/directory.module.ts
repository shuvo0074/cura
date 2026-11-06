import { Module } from '@nestjs/common';
import { AppointmentModule } from '../appointments/appointment.module';
import { AuthModule } from '../auth/auth.module';
import {
  AdminAmbulancesController,
  AdminCatalogController,
  AdminDoctorsController,
  AdminHospitalsController,
  AdminSiteController,
  AdminVerificationsController,
} from './controllers/admin.controllers';
import {
  AdminOwnersController,
  ClinicsController,
  MyAmbulancesController,
  MyClinicsController,
  MyHealthController,
  MyPharmaciesController,
} from './controllers/accounts.controllers';
import { AdminBusinessesController, AdminUsersController } from './controllers/admin-users.controllers';
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
import { AdminUsersService } from './services/admin-users.service';
import { AmbulanceService } from './services/ambulance.service';
import { CatalogService } from './services/catalog.service';
import { ClinicOwnerService } from './services/clinic-owner.service';
import { PatientClinicService } from './services/patient-clinic.service';
import { PatientHealthService } from './services/patient-health.service';
import { PharmacyService } from './services/pharmacy.service';
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
 * verification, serial booking and patients joining clinics. The only clinical
 * table it writes is `patients`. It reads clinical records only for "My health",
 * through a read-only port that returns a patient's own records.
 */
@Module({
  imports: [AuthModule, AppointmentModule],
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
    AdminOwnersController,
    ClinicsController,
    MyClinicsController,
    MyHealthController,
    MyAmbulancesController,
    MyPharmaciesController,
    AdminUsersController,
    AdminBusinessesController,
  ],
  providers: [
    DirectoryAccountService,
    AdminDoctorService,
    AdminUsersService,
    AmbulanceService,
    CatalogService,
    ClinicOwnerService,
    PatientClinicService,
    PatientHealthService,
    PharmacyService,
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
