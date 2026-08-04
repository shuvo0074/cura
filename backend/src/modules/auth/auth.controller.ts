import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  type LoginInput,
  type RegisterInput,
  type VerifyOtpInput,
} from '@cura/shared';
import { Public } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import { UnauthenticatedError } from '../../common/errors/domain-error';
import { AppConfigService } from '../../config/app.config';
import { AuthService, type RequestContext } from './auth.service';

const REFRESH_COOKIE = 'cura_rt';

/**
 * Authentication endpoints.
 *
 * The refresh token is delivered as an httpOnly, SameSite=Strict, Secure cookie
 * rather than in the JSON body. Script running on the page cannot read it, so
 * an XSS foothold cannot exfiltrate long-lived credentials; the short-lived
 * access token is the only value JavaScript ever holds.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async register(@Body(zodBody(registerSchema)) dto: RegisterInput, @Req() req: Request) {
    return this.auth.register(dto, this.contextOf(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Tighter than the global limit: credential endpoints are the prime target
  // for stuffing attacks.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async login(
    @Body(zodBody(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.contextOf(req));
    if (result.status === 'authenticated') {
      // The refresh token leaves via the cookie only — it is stripped from the
      // JSON body so it can never be read by page scripts or logged by a proxy.
      this.setCookie(res, result.refreshToken);
      return { status: result.status, session: result.session };
    }
    return result;
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async verifyOtp(
    @Body(zodBody(verifyOtpSchema)) dto: VerifyOtpInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken } = await this.auth.verifyOtp(
      dto.challengeId,
      dto.code,
      this.contextOf(req),
    );
    this.setCookie(res, refreshToken);
    return session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 900_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = this.readRefreshCookie(req);
    if (!presented) throw new UnauthenticatedError();

    const issued = await this.auth.refresh(presented, this.contextOf(req));
    this.setCookie(res, issued.refreshToken);
    return {
      accessToken: issued.accessToken,
      expiresIn: issued.expiresIn,
      tokenType: 'Bearer' as const,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const presented = this.readRefreshCookie(req);
    if (presented) await this.auth.logout(presented);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
  }

  // -------------------------------------------------------------------------

  private contextOf(req: Request): RequestContext {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
      requestId: req.requestId ?? null,
    };
  }

  private readRefreshCookie(req: Request): string | null {
    const raw = req.headers.cookie;
    if (!raw) return null;
    for (const part of raw.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(
      REFRESH_COOKIE,
      token,
      this.cookieOptions(this.config.rules.auth.rememberMeDays * 86_400_000),
    );
  }

  private cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict' as const,
      // Scoped to the refresh route only, so the cookie is not attached to
      // every API call and cannot be used as an ambient credential.
      path: `/${this.config.apiPrefix}/auth`,
      maxAge: maxAgeMs,
    };
  }
}
