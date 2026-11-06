import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
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
import { AmbulanceRequestService } from '../services/ambulance-request.service';
import { ClinicOwnerService } from '../services/clinic-owner.service';
import { HospitalService } from '../services/hospital.service';
import { PatientClinicService } from '../services/patient-clinic.service';
import { PatientHealthService } from '../services/patient-health.service';
import { PharmacyService } from '../services/pharmacy.service';
import { PharmacyShopService } from '../services/pharmacy-shop.service';
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
  constructor(
    private readonly ambulances: AmbulanceService,
    private readonly requests: AmbulanceRequestService,
  ) {}

  /** Requests patients sent to any of this owner's services. */
  @Get('requests')
  allRequests(@Identity() identity: DirectoryIdentity) {
    return this.requests.ownerRequests(identity.userId);
  }

  @Get(':id/requests')
  requestsFor(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.requests.ownerRequests(identity.userId, id);
  }

  @Patch(':id/requests/:requestId')
  moveRequest(
    @Param('id', UuidOr404) id: string,
    @Param('requestId', UuidOr404) requestId: string,
    @Body() body: unknown,
    @Identity() identity: DirectoryIdentity,
  ) {
    return this.requests.move(id, requestId, bodyOf(body), identity.userId);
  }

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

/**
 * Ambulances a patient asked for through Cura Website. Scoped by the signed-in
 * account alone: a patient sees and cancels only their own.
 */
@Controller('directory/my-ambulance-requests')
@RequirePatient()
export class MyAmbulanceRequestsController {
  constructor(private readonly requests: AmbulanceRequestService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.requests.patientRequests(identity);
  }

  @Post()
  send(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.requests.send(identity, bodyOf(body));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.requests.cancel(identity, id);
  }
}

/** Pharmacies this owner runs. */
@Controller('directory/my-pharmacies')
@RequirePharmacyOwner()
export class MyPharmaciesController {
  constructor(
    private readonly pharmacies: PharmacyService,
    private readonly shop: PharmacyShopService,
  ) {}

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

  @Get(':id/stock')
  stock(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.shop.ownerStock(id, identity.userId);
  }

  @Post(':id/stock')
  addStock(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.shop.addStock(id, bodyOf(body), identity.userId);
  }

  @Patch(':id/stock/:itemId')
  updateStock(
    @Param('id', UuidOr404) id: string,
    @Param('itemId', UuidOr404) itemId: string,
    @Body() body: unknown,
    @Identity() identity: DirectoryIdentity,
  ) {
    return this.shop.updateStock(id, itemId, bodyOf(body), identity.userId);
  }

  @Delete(':id/stock/:itemId')
  removeStock(@Param('id', UuidOr404) id: string, @Param('itemId', UuidOr404) itemId: string, @Identity() identity: DirectoryIdentity) {
    return this.shop.removeStock(id, itemId, identity.userId);
  }

  /** Prescriptions patients sent to this pharmacy. */
  @Get(':id/orders')
  orders(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.shop.ownerOrders(id, identity.userId);
  }

  @Patch(':id/orders/:orderId')
  moveOrder(
    @Param('id', UuidOr404) id: string,
    @Param('orderId', UuidOr404) orderId: string,
    @Body() body: unknown,
    @Identity() identity: DirectoryIdentity,
  ) {
    return this.shop.moveOrder(id, orderId, bodyOf(body), identity.userId);
  }
}

/**
 * Prescriptions a patient sent to a pharmacy to collect. Scoped by the
 * signed-in account alone: a patient sees and cancels only their own.
 */
@Controller('directory/my-pharmacy-orders')
@RequirePatient()
export class MyPharmacyOrdersController {
  constructor(private readonly shop: PharmacyShopService) {}

  @Get()
  mine(@Identity() identity: DirectoryIdentity) {
    return this.shop.patientOrders(identity);
  }

  @Post()
  send(@Body() body: unknown, @Identity() identity: DirectoryIdentity) {
    return this.shop.send(identity, bodyOf(body));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', UuidOr404) id: string, @Identity() identity: DirectoryIdentity) {
    return this.shop.cancel(identity, id);
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
