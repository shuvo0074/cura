import { SetMetadata, applyDecorators, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { OPTIONAL_AUTH_KEY } from '../../../common/security/decorators';
import type { DirectoryIdentity, DirectoryRoleName } from '../../../core/ports/directory.ports';

export const DIRECTORY_ACCESS_KEY = 'cura:directoryAccess';

export interface DirectoryAccessRule {
  roles?: DirectoryRoleName[];
  linkedDoctor?: boolean;
}

declare module 'express' {
  interface Request {
    directoryIdentity?: DirectoryIdentity | null;
  }
}

/** Requires a signed-in user holding one of these directory roles. */
export const DirectoryAccess = (rule: DirectoryAccessRule) => SetMetadata(DIRECTORY_ACCESS_KEY, rule);

export const RequireDirectoryAdmin = () => DirectoryAccess({ roles: ['super_admin'] });
export const RequireAmbulanceOwner = () => DirectoryAccess({ roles: ['ambulance_owner'] });
export const RequirePharmacyOwner = () => DirectoryAccess({ roles: ['pharmacy_owner'] });
export const RequireHospitalOwner = () => DirectoryAccess({ roles: ['hospital_owner'] });
export const RequireLinkedDoctor = () => DirectoryAccess({ roles: ['doctor'], linkedDoctor: true });
export const RequirePatient = () => DirectoryAccess({ roles: ['patient'] });
/** Any signed-in account, whatever its directory roles. */
export const RequireSignedIn = () => DirectoryAccess({});

/** Public, but loads the caller's directory identity when they are signed in. */
export const OptionalDirectoryUser = () =>
  applyDecorators(SetMetadata(OPTIONAL_AUTH_KEY, true), SetMetadata(DIRECTORY_ACCESS_KEY, { optional: true }));

export const Identity = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<Request>().directoryIdentity ?? null;
});
