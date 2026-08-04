import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { permissionsForRole, type Permission, type UserRole } from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { IS_PUBLIC_KEY } from './decorators';
import { USER_REPOSITORY, type UserRepository } from '../../core/ports/repositories';

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  ver: number;
  practices: string[];
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface AuthenticatedPrincipal {
  userId: string;
  role: UserRole;
  permissions: readonly Permission[];
  practiceIds: readonly string[];
}

declare module 'express' {
  interface Request {
    principal?: AuthenticatedPrincipal;
    requestId?: string;
  }
}

/**
 * Bearer-token authentication.
 *
 * Registered globally, so a route is protected unless it explicitly opts out
 * with `@Public()`. Defaulting to closed means forgetting a decorator produces
 * a locked endpoint rather than an open one.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.jwt.accessSecret,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      });
    } catch {
      // Deliberately opaque: never reveal whether a token was expired,
      // malformed or signed with the wrong key.
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user = await this.users.findById(claims.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    /**
     * Token version check. Password changes and the "kill-switch" that
     * force-logs-out staff bump this counter, which invalidates already-issued
     * access tokens without waiting for them to expire.
     */
    if (user.tokenVersion !== claims.ver) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.principal = {
      userId: user.id,
      role: user.role,
      permissions: permissionsForRole(user.role),
      practiceIds: claims.practices ?? [],
    };
    return true;
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
