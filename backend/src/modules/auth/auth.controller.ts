import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  doctorClaimCompleteSchema,
  doctorClaimLookupSchema,
  doctorClaimStartSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  verifyOtpSchema,
  type DoctorClaimCompleteInput,
  type DoctorClaimLookupInput,
  type DoctorClaimStartInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type RegisterInput,
  type VerifyOtpInput,
} from '@cura/shared';
import { Public } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import { UnauthenticatedError } from '../../common/errors/domain-error';
import { CurrentUser } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { RefreshCookie } from './refresh-cookie';
import { AuthService, type RequestContext } from './auth.service';

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
    private readonly cookie: RefreshCookie,
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
      this.cookie.set(res, result.refreshToken);
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
    this.cookie.set(res, refreshToken);
    return session;
  }

  @Public()
  @Post('doctor-claim/lookup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  lookupDoctorClaim(@Body(zodBody(doctorClaimLookupSchema)) dto: DoctorClaimLookupInput) {
    return this.auth.lookupDoctorClaim(dto.mobile);
  }

  @Public()
  @Post('doctor-claim/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  startDoctorClaim(@Body(zodBody(doctorClaimStartSchema)) dto: DoctorClaimStartInput) {
    return this.auth.startDoctorClaim(dto);
  }

  @Public()
  @Post('doctor-claim/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async completeDoctorClaim(
    @Body(zodBody(doctorClaimCompleteSchema)) dto: DoctorClaimCompleteInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken } = await this.auth.completeDoctorClaim(dto, this.contextOf(req));
    this.cookie.set(res, refreshToken);
    return session;
  }

  /** Always answers with a code challenge, whether or not the account exists. */
  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestPasswordReset(@Body(zodBody(passwordResetRequestSchema)) dto: PasswordResetRequestInput) {
    return this.auth.requestPasswordReset(dto.identifier);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async confirmPasswordReset(
    @Body(zodBody(passwordResetConfirmSchema)) dto: PasswordResetConfirmInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.confirmPasswordReset(dto, this.contextOf(req));
    if (result.status === 'authenticated') {
      this.cookie.set(res, result.refreshToken);
      return { status: result.status, session: result.session };
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 900_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = this.cookie.read(req);
    if (!presented) throw new UnauthenticatedError();

    const issued = await this.auth.refresh(presented, this.contextOf(req));
    this.cookie.set(res, issued.refreshToken);
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
    const presented = this.cookie.read(req);
    if (presented) await this.auth.logout(presented);
    this.cookie.clear(res);
  }

  /** Ends every session on every device, including this one. */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logoutEverywhere(principal.userId);
    this.cookie.clear(res);
    return { ok: true };
  }

  // -------------------------------------------------------------------------

  private contextOf(req: Request): RequestContext {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
      requestId: req.requestId ?? null,
    };
  }
}
