import { Controller, Get, Query } from '@nestjs/common';
import type { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { SetupProgressService } from './setup-progress.service';

/** Settings → the clinic owner's setup checklist on the Calendar. */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class SetupProgressController {
  constructor(private readonly setup: SetupProgressService) {}

  @Get('setup-progress')
  progress(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.setup.progress(q.practiceId, p);
  }
}
