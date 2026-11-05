import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { DirectoryIdentity } from '../../../core/ports/directory.ports';
import { Identity, RequireDirectoryAdmin } from '../access/directory-access.decorators';
import { UuidOr404 } from '../access/uuid-or-404.pipe';
import { AdminUsersService } from '../services/admin-users.service';
import { bodyOf } from './shared';

/** Super admin only: every account and the roles it holds. */
@Controller('directory/admin/users')
@RequireDirectoryAdmin()
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.users.list(query);
  }

  @Post()
  create(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.create(bodyOf(body), admin.userId);
  }

  @Get(':id')
  get(@Param('id', UuidOr404) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.update(id, bodyOf(body), admin.userId);
  }

  @Post(':id/password')
  resetPassword(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.resetPassword(id, bodyOf(body), admin.userId);
  }

  @Put(':id/roles/:role')
  grant(@Param('id', UuidOr404) id: string, @Param('role') role: string, @Identity() admin: DirectoryIdentity) {
    return this.users.setRole(id, role, true, admin.userId);
  }

  @Delete(':id/roles/:role')
  revoke(@Param('id', UuidOr404) id: string, @Param('role') role: string, @Identity() admin: DirectoryIdentity) {
    return this.users.setRole(id, role, false, admin.userId);
  }

  @Put(':id/clinic-access')
  setClinicAccess(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.setClinicAccess(id, bodyOf(body), admin.userId);
  }
}

/** Super admin only: every clinic's details, every pharmacy, and ambulance owners. */
@Controller('directory/admin')
@RequireDirectoryAdmin()
export class AdminBusinessesController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('clinics')
  clinics() {
    return this.users.listClinics();
  }

  @Patch('clinics/:id')
  updateClinic(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.updateClinic(id, bodyOf(body), admin.userId);
  }

  @Get('pharmacies')
  pharmacies() {
    return this.users.listPharmacies();
  }

  @Post('pharmacies')
  createPharmacy(@Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.createPharmacy(bodyOf(body), admin.userId);
  }

  @Patch('pharmacies/:id')
  updatePharmacy(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.updatePharmacy(id, bodyOf(body), admin.userId);
  }

  @Delete('pharmacies/:id')
  deletePharmacy(@Param('id', UuidOr404) id: string, @Identity() admin: DirectoryIdentity) {
    return this.users.deletePharmacy(id, admin.userId);
  }

  @Put('ambulances/:id/owner')
  setAmbulanceOwner(@Param('id', UuidOr404) id: string, @Body() body: unknown, @Identity() admin: DirectoryIdentity) {
    return this.users.setAmbulanceOwner(id, bodyOf(body), admin.userId);
  }
}
