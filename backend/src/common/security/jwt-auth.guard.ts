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
import { Permission, permissionsForRole, type UserRole } from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './decorators';
import {
  AUDIT_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  type AuditRepository,
  type RefreshTokenRepository,
  type UserRepository,
} from '../../core/ports/repositories';

const READ_METHODS = new Set(['GET', 'HEAD']);
const ALL_PERMISSIONS = Object.values(Permission);

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  ver: number;
  practices: string[];
  /** Refresh family this token belongs to; absent on tokens minted before it existed. */
  fid?: string;
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
  /** Set on a super admin's read: `practiceIds` then holds every clinic. */
  ownPracticeIds?: readonly string[];
  /** Refresh family of the session that sent the request, when the token names one. */
  familyId?: string;
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
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);

    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOptional) {
      // Personalises a public response; a bad token simply means "anonymous".
      if (token) {
        try {
          request.principal = await this.authenticate(token);
        } catch (error) {
          if (!(error instanceof UnauthorizedException)) throw error;
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException('Authentication required');
    request.principal = await this.withSuperAdminReads(await this.authenticate(token), request);
    return true;
  }

  /**
   * A super admin may read any clinic's records and change none of them. Reads
   * get every permission and every clinic, writes keep the account's own access,
   * and each read of a clinic they do not belong to is audited.
   */
  private async withSuperAdminReads(
    principal: AuthenticatedPrincipal,
    request: Request,
  ): Promise<AuthenticatedPrincipal> {
    if (!READ_METHODS.has(request.method) || !(await this.users.isSuperAdmin(principal.userId))) {
      return principal;
    }
    const widened = {
      ...principal,
      permissions: ALL_PERMISSIONS,
      practiceIds: await this.users.allPracticeIds(),
      ownPracticeIds: principal.practiceIds,
    };
    const raw = request.query?.practiceId ?? request.params?.practiceId;
    const practiceId = typeof raw === 'string' ? raw : null;
    if (practiceId && !principal.practiceIds.includes(practiceId)) {
      await this.audit.record({
        actorUserId: principal.userId,
        action: 'super_admin.clinic_read',
        resourceType: 'http',
        resourceId: null,
        practiceId,
        ipHash: null,
        userAgent: request.headers['user-agent'] ?? null,
        requestId: request.requestId ?? null,
        metadata: { path: request.path },
      });
    }
    return widened;
  }

  private async authenticate(token: string): Promise<AuthenticatedPrincipal> {
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

    // Logging out one device ends its refresh family; its access token ends too.
    if (claims.fid && !(await this.refreshTokens.isFamilyActive(claims.fid))) {
      throw new UnauthorizedException('Session has been revoked');
    }

    return {
      userId: user.id,
      role: user.role,
      permissions: permissionsForRole(user.role),
      practiceIds: claims.practices ?? [],
      ...(claims.fid ? { familyId: claims.fid } : {}),
    };
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
