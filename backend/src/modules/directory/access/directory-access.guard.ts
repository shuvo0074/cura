import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ForbiddenError } from '../../../common/errors/domain-error';
import {
  DIRECTORY_ACCOUNT_REPOSITORY,
  type DirectoryAccountRepository,
} from '../../../core/ports/directory.ports';
import { DirectoryError } from '../domain/errors';
import { DIRECTORY_ACCESS_KEY, type DirectoryAccessRule } from './directory-access.decorators';

/**
 * Authorisation for directory routes.
 *
 * This is deliberately not part of the clinic's `Permission` model.
 * `ADMINISTRATOR` is granted every value in that model, so a directory permission
 * added there would hand every clinic owner control of the public site. It only
 * queries on routes that declare a rule, so clinic requests cost nothing extra.
 */
@Injectable()
export class DirectoryAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DIRECTORY_ACCOUNT_REPOSITORY) private readonly accounts: DirectoryAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<DirectoryAccessRule & { optional?: boolean }>(
      DIRECTORY_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rule) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const identity = request.principal ? await this.accounts.loadIdentity(request.principal.userId) : null;
    request.directoryIdentity = identity;
    if (rule.optional) return true;

    if (!identity) throw new ForbiddenError();
    if (rule.roles && !rule.roles.some((role) => identity.roles.includes(role))) {
      throw new ForbiddenError();
    }
    if (rule.linkedDoctor && !identity.doctorId) {
      throw new DirectoryError(
        HttpStatus.FORBIDDEN,
        'DOCTOR_NOT_VERIFIED',
        'Your doctor profile is awaiting verification',
      );
    }
    return true;
  }
}
