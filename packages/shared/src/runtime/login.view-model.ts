import { loginSchema } from '../validation/schemas';
import type { AuthSession, OtpChallenge } from '../domain/models';
import type { SupportedLocale } from '../config/app-config';
import { ViewModel } from './view-model';
import type { AuthApi } from './api-services';

export type LoginPhase = 'credentials' | 'otp';

export interface LoginState {
  phase: LoginPhase;
  identifier: string;
  password: string;
  rememberMe: boolean;
  otpCode: string;
  challenge: OtpChallenge | null;
  submitting: boolean;
  /** Field-level messages keyed by form field name. */
  fieldErrors: Record<string, string>;
  formError: string | null;
  resendAvailableInSeconds: number;
}

/**
 * Login flow.
 *
 * Contains no React and no DOM reference — it is the whole behaviour of the
 * screen expressed as data plus methods, which is what makes it testable in
 * isolation and reusable by the mobile client.
 */
export class LoginViewModel extends ViewModel<LoginState> {
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auth: AuthApi,
    private readonly onAuthenticated: (session: AuthSession) => void,
    _locale: SupportedLocale = 'en',
  ) {
    super({
      phase: 'credentials',
      identifier: '',
      password: '',
      rememberMe: false,
      otpCode: '',
      challenge: null,
      submitting: false,
      fieldErrors: {},
      formError: null,
      resendAvailableInSeconds: 0,
    });
  }

  setIdentifier(value: string): void {
    this.setState({ identifier: value, fieldErrors: {}, formError: null });
  }

  setPassword(value: string): void {
    this.setState({ password: value, fieldErrors: {}, formError: null });
  }

  setRememberMe(value: boolean): void {
    this.setState({ rememberMe: value });
  }

  setOtpCode(value: string): void {
    // Constrain to digits at the edge so the field cannot hold invalid input.
    this.setState({ otpCode: value.replace(/\D/g, '').slice(0, 6), formError: null });
  }

  async submitCredentials(): Promise<void> {
    if (this.state.submitting) return;

    /**
     * Validation runs against the same schema the API enforces, so the user
     * sees identical rules client-side without the two definitions drifting.
     */
    const parsed = loginSchema.safeParse({
      identifier: this.state.identifier,
      password: this.state.password,
      rememberMe: this.state.rememberMe,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        fieldErrors[key] ??= issue.message;
      }
      this.setState({ fieldErrors });
      return;
    }

    this.setState({ submitting: true, formError: null, fieldErrors: {} });
    const result = await this.auth.login(parsed.data);
    this.setState({ submitting: false });

    if (!result.ok) {
      this.setState({ formError: result.error.message });
      return;
    }

    if (result.value.status === 'otp_required') {
      this.beginOtpPhase(result.value.challenge);
      return;
    }

    this.onAuthenticated(result.value.session);
  }

  async submitOtp(): Promise<void> {
    const { challenge, otpCode, submitting } = this.state;
    if (submitting || !challenge) return;

    if (otpCode.length !== 6) {
      this.setState({ formError: 'Enter the 6-digit code.' });
      return;
    }

    this.setState({ submitting: true, formError: null });
    const result = await this.auth.verifyOtp(challenge.challengeId, otpCode);
    this.setState({ submitting: false });

    if (!result.ok) {
      // Clear the field so the next attempt starts fresh.
      this.setState({ formError: result.error.message, otpCode: '' });
      return;
    }

    this.onAuthenticated(result.value);
  }

  backToCredentials(): void {
    this.stopCountdown();
    this.setState({ phase: 'credentials', challenge: null, otpCode: '', formError: null });
  }

  private beginOtpPhase(challenge: OtpChallenge): void {
    this.setState({ phase: 'otp', challenge, otpCode: '', formError: null });
    this.startCountdown(challenge.resendAvailableAt);
  }

  private startCountdown(resendAvailableAt: string): void {
    this.stopCountdown();
    const target = new Date(resendAvailableAt).getTime();

    const tick = (): void => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      this.setState({ resendAvailableInSeconds: remaining });
      if (remaining === 0) this.stopCountdown();
    };

    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  /** Releases the interval so an unmounted screen cannot keep ticking. */
  override dispose(): void {
    this.stopCountdown();
    super.dispose();
  }
}
