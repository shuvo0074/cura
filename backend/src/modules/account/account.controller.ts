import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Gender, passwordSchema } from '@cura/shared';
import { CurrentUser } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { AccountService } from './account.service';

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  // Kept as an ISO date string here and widened to a Date in the handler:
  // `zodBody` requires a schema whose input and output types match.
  dateOfBirth: z.string().date().nullable().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  secondaryPhone: z.string().trim().max(20).nullable().optional(),
  avatarUrl: z.string().trim().max(512).nullable().optional(),
  locale: z.enum(['en', 'bn']).optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
});

/**
 * The signed-in user's own account (spec: Profile Management, Data Security).
 *
 * No `@RequirePermissions`: every authenticated user administers their own
 * account, and the service reads the subject from the token rather than the
 * request, so there is nothing to authorise beyond being signed in.
 */
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  getProfile(@CurrentUser() p: AuthenticatedPrincipal) {
    return this.account.getProfile(p);
  }

  @Patch('profile')
  updateProfile(
    @Body(zodBody(profileSchema)) body: z.infer<typeof profileSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    const { dateOfBirth, ...rest } = body;
    return this.account.updateProfile(p, {
      ...rest,
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth === null ? null : new Date(dateOfBirth) }
        : {}),
    });
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  // Rate-limited like the credential endpoints: this route confirms whether a
  // guessed current password is correct, so it is an oracle if left open.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  changePassword(
    @Body(zodBody(passwordChangeSchema)) body: z.infer<typeof passwordChangeSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.account.changePassword(p, body.currentPassword, body.newPassword);
  }

  @Put('two-factor')
  setTwoFactor(
    @Body(zodBody(z.object({ enabled: z.boolean() }))) body: { enabled: boolean },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.account.setTwoFactor(p, body.enabled);
  }
}
