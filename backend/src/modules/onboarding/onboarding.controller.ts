import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import { ValidationError } from '../../common/errors/domain-error';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { OnboardingService, type OnboardingStep } from './onboarding.service';

const draftSchema = z.object({
  step: z.number().int().min(1).max(4),
  payload: z.record(z.unknown()),
});

/**
 * Onboarding wizard endpoints.
 *
 * No `@RequirePermissions` here: every authenticated user may complete their
 * own setup, and the service scopes all writes to `principal.userId`, so there
 * is no id a caller could substitute.
 */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('state')
  async state(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.onboarding.getState(principal);
  }

  /** Debounced autosave target. Accepts partial, unvalidated input by design. */
  @Post('draft')
  async saveDraft(
    @Body(zodBody(draftSchema)) body: z.infer<typeof draftSchema>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.onboarding.saveDraft(principal, body.step, body.payload);
  }

  @Post('steps/:step')
  async submitStep(
    @Param('step', ParseIntPipe) step: number,
    @Body() body: unknown,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.onboarding.submitStep(principal, this.asStep(step), body);
  }

  @Post('steps/:step/skip')
  async skipStep(
    @Param('step', ParseIntPipe) step: number,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.onboarding.skipStep(principal, this.asStep(step));
  }

  @Post('finish')
  async finish(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.onboarding.finish(principal);
  }

  private asStep(value: number): OnboardingStep {
    if (value < 1 || value > 4) throw new ValidationError('Step must be between 1 and 4.');
    return value as OnboardingStep;
  }
}
