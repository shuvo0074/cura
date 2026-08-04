import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission } from '@cura/shared';
import type { AuthenticatedPrincipal } from './jwt-auth.guard';

export const IS_PUBLIC_KEY = 'cura:isPublic';
export const PERMISSIONS_KEY = 'cura:permissions';

/** Opts a route out of the global auth guard. Use sparingly and deliberately. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Declares the capabilities a handler needs. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Injects the authenticated principal.
 *
 * Handlers receive an already-verified identity rather than parsing headers, so
 * there is exactly one place where a caller's identity is established.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.principal) {
      throw new Error('CurrentUser used on a route without authentication');
    }
    return request.principal;
  },
);

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.requestId ?? 'unknown';
});
