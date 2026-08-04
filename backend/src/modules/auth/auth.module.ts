import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, OtpService],
  // OtpService is exported because the clinical module reuses the same
  // challenge machinery for the patient-consent handshake — one OTP
  // implementation, not two subtly different ones.
  exports: [TokenService, OtpService],
})
export class AuthModule {}
