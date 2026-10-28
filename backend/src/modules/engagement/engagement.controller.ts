import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { EngagementService } from './engagement.service';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const upcomingQuery = practiceQuery.extend({
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const feedbackQuery = practiceQuery.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  // Left as the raw query string: `zodBody` needs matching input/output types.
  unanswered: z.enum(['true', 'false']).optional(),
});

const feedbackSchema = practiceQuery.extend({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const replySchema = practiceQuery.extend({
  reply: z.string().trim().min(1, 'Write a reply.').max(1000),
});

/** Communications outreach list and Feedback Management. */
@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get('upcoming')
  @RequirePermissions(Permission.PATIENT_READ)
  upcoming(@Query(zodBody(upcomingQuery)) q: z.infer<typeof upcomingQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.engagement.upcoming(p, q.practiceId, q.days, q.limit);
  }

  @Get('feedback')
  @RequirePermissions(Permission.PATIENT_READ)
  listFeedback(@Query(zodBody(feedbackQuery)) q: z.infer<typeof feedbackQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.engagement.listFeedback(p, q.practiceId, { rating: q.rating, unanswered: q.unanswered === 'true' });
  }

  @Post('feedback')
  @RequirePermissions(Permission.PATIENT_WRITE)
  recordFeedback(@Body(zodBody(feedbackSchema)) b: z.infer<typeof feedbackSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.engagement.recordFeedback(p, b);
  }

  @Put('feedback/:id/reply')
  @RequirePermissions(Permission.PATIENT_WRITE)
  reply(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(zodBody(replySchema)) b: z.infer<typeof replySchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.engagement.reply(p, b.practiceId, id, b.reply);
  }
}
