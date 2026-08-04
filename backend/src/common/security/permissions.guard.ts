import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Permission } from '@cura/shared';
import { PERMISSIONS_KEY } from './decorators';

/**
 * Permission-based authorisation.
 *
 * Handlers declare the capability they need (`@RequirePermissions('patient:write')`),
 * never the role that happens to have it. Adding or re-scoping a role is a
 * change to the role→permission map alone — no controller is touched, which is
 * the open/closed principle applied to access control.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.principal;
    if (!principal) throw new ForbiddenException('Not authorised');

    const granted = new Set(principal.permissions);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      // The message names the capability, not the user's role — it tells the
      // caller what is needed without disclosing the permission model.
      throw new ForbiddenException(`Missing required permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
