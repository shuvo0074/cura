import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';

@Module({
  // OtpService drives the patient-consent handshake.
  imports: [AuthModule],
  controllers: [ClinicalController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}
