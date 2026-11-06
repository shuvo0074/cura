import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Public } from '../../../common/security/decorators';
import type { DirectoryIdentity } from '../../../core/ports/directory.ports';
import {
  Identity,
  RequireAmbulanceOwner,
  RequireDirectoryAdmin,
  RequireHospitalOwner,
  RequirePatient,
  RequirePharmacyOwner,
} from '../access/directory-access.decorators';
import { UuidOr404 } from '../access/uuid-or-404.pipe';
import { AmbulanceService } from '../services/ambulance.service';
import { ClinicOwnerService } from '../services/clinic-owner.service';
import { HospitalService } from '../services/hospital.service';
import { PatientClinicService } from '../services/patient-clinic.service';
import { PatientHealthService } from '../services/patient-health.service';
import { PharmacyService } from '../services/pharmacy.service';
import { PublicReadLimit, bodyOf } from './shared';

/** The clinics a patient can choose. */
@Controller('directory/clinics')
export class ClinicsController {
  constructor(private readonly clinics: PatientClinicService) {}

  @Public()
  @PublicReadLimit()
  @Get()
  list() {
    return this.clinics.listClinics();
  }
}

/** The clinics this patient has joined. */
@Controller('directory/my-clinics')
@RequirePatient()
export class MyClinicsController {
  constructor(private readonly clinics: PatientClinicService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.clinics.mine(identity);
  }

  @Put(':practiceId')
  join(@Param('practiceId', UuidOr404) practiceId: string, @Identity() identity: DirectoryIdentity) {
    return this.clinics.join(identity, practiceId);
  }

  @Delete(':practiceId')
  leave(@Param('practiceId', UuidOr404) practiceId: string, @Identity() identity: DirectoryIdentity) {
    return this.clinics.leave(identity, practiceId);
  }
}

/**
 * "My health": the patient's own visits, prescriptions, invoices and upcoming
 * appointments at the clinics they joined. Read-only, and scoped by the
 * signed-in account alone.
 */
@Controller('directory/my-health')
@RequirePatient()
export class MyHealthController {
  constructor(private readonly health: PatientHealthService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.health.mine(identity);
  }
}

/** Ambulance vendors this owner runs. */
@Controller('directory/my-ambulances')
@RequireAmbulanceOwner()
export class MyAmbulancesController {
  constructor(private readonly ambulances: AmbulanceService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.ambulances.listOwned(identity.userId);
  }

  @Post()
  create(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.ambulances.createOwned(bodyOf(body), identity.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.ambulances.updateOwned(id, bodyOf(body), identity.userId);
  }
}

/** Pharmacies this owner runs. */
@Controller('directory/my-pharmacies')
@RequirePharmacyOwner()
export class MyPharmaciesController {
  constructor(private readonly pharmacies: PharmacyService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.pharmacies.listOwned(identity.userId);
  }

  @Post()
  create(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.pharmacies.create(bodyOf(body), identity.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.pharmacies.update(id, bodyOf(body), identity.userId);
  }
}

/**
 * Hospitals and diagnostic centres this owner runs. They edit the public
 * details only; a super admin links the place and controls everything else.
 */
@Controller('directory/my-hospitals')
@RequireHospitalOwner()
export class MyHospitalsController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.hospitals.listOwned(identity.userId);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.hospitals.updateOwned(id, bodyOf(body), identity.userId);
  }
}

/** Super admin only: clinic owners and the extra roles they can hold. */
@Controller('directory/admin')
@RequireDirectoryAdmin()
export class AdminOwnersController {
  constructor(private readonly owners: ClinicOwnerService) {}

  @Get('owners')
  list() {
    return this.owners.list();
  }

  @Post('owners')
  create(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.owners.create(bodyOf(body), admin.userId);
  }

  @Post('roles')
  grant(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.owners.setRole(bodyOf(body), true, admin.userId);
  }

  @Post('roles/revoke')
  revoke(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.owners.setRole(bodyOf(body), false, admin.userId);
  }
}
