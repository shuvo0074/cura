import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../common/security/decorators';
import type { DirectoryIdentity } from '../../../core/ports/directory.ports';
import { RefreshCookie } from '../../auth/refresh-cookie';
import { Identity, RequireSignedIn } from '../access/directory-access.decorators';
import { DirectoryAccountService } from '../services/account.service';
import { RegisterLimit, bodyOf } from './shared';

/**
 * Directory accounts. These sit under `/auth` because the refresh cookie is scoped
 * to that path. Login, refresh and logout are the shared routes in `AuthController`.
 */
@Controller('auth')
export class DirectoryAuthController {
  constructor(
    private readonly accounts: DirectoryAccountService,
    private readonly cookie: RefreshCookie,
  ) {}

  @Public()
  @RegisterLimit()
  @Post('register/patient')
  async registerPatient(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, body: session } = await this.accounts.registerPatient(bodyOf(body), this.context(req));
    this.cookie.set(res, refreshToken);
    return session;
  }

  @RequireSignedIn()
  @Get('me')
  me(@Identity() identity: DirectoryIdentity) {
    return this.accounts.describe(identity);
  }

  private context(req: Request) {
    return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
  }
}
