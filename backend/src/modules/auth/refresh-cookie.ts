import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../../config/app.config';

const REFRESH_COOKIE = 'cura_rt';

/**
 * Everything about the refresh cookie, in one place for each auth controller.
 *
 * httpOnly, SameSite=Strict and scoped to the auth routes, so page scripts cannot
 * read it and it is not attached to every API call as an ambient credential.
 */
@Injectable()
export class RefreshCookie {
  constructor(private readonly config: AppConfigService) {}

  read(req: Request): string | null {
    const raw = req.headers.cookie;
    if (!raw) return null;
    for (const part of raw.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  set(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, this.options(this.config.rules.auth.rememberMeDays * 86_400_000));
  }

  clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.options(0));
  }

  private options(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict' as const,
      path: `/${this.config.apiPrefix}/auth`,
      maxAge: maxAgeMs,
    };
  }
}
