import { passwordResetConfirmSchema, passwordResetRequestSchema, passwordSchema } from '../validation/schemas';
import type { AuthSession, OtpChallenge } from '../domain/models';
import { ViewModel } from './view-model';
import type { AuthApi } from './api-services';
import { canUseDashboard } from './login.view-model';

export interface PasswordResetState {
  /** `done` means the password changed but the person still has to log in. */
  phase: 'identifier' | 'code' | 'done';
  identifier: string;
  otpCode: string;
  password: string;
  confirmPassword: string;
  challenge: OtpChallenge | null;
  submitting: boolean;
  /** Shown on `done`: why they still need to log in. */
  doneMessage: string;
  /** A short note after a new code is sent. */
  notice: string | null;
  fieldErrors: Record<string, string>;
  formError: string | null;
}

type ResetField = 'identifier' | 'password' | 'confirmPassword';

/**
 * Forgot password on Cura Dashboard: the person gives the mobile number or email
 * they log in with, gets a code there, and chooses a new password. A successful
 * reset logs them straight in.
 */
export class PasswordResetViewModel extends ViewModel<PasswordResetState> {
  constructor(
    private readonly auth: AuthApi,
    private readonly onAuthenticated: (session: AuthSession) => void,
    /** A clinic added this doctor and they have no login yet. */
    private readonly onDoctorSignupRequired?: (mobile: string) => void,
  ) {
    super({
      phase: 'identifier',
      identifier: '',
      otpCode: '',
      password: '',
      confirmPassword: '',
      challenge: null,
      submitting: false,
      doneMessage: '',
      notice: null,
      fieldErrors: {},
      formError: null,
    });
  }

  setField(field: ResetField, value: string): void {
    const { [field]: _cleared, ...fieldErrors } = this.state.fieldErrors;
    this.setState({ [field]: value, fieldErrors, formError: null });
  }

  setOtpCode(value: string): void {
    this.setState({ otpCode: value.replace(/\D/g, '').slice(0, 6), formError: null });
  }

  /** Sends the code. Also used to send a new one from the code step. */
  async requestCode(): Promise<void> {
    if (this.state.submitting) return;
    const parsed = passwordResetRequestSchema.safeParse({ identifier: this.state.identifier });
    if (!parsed.success) {
      this.setState({
        fieldErrors: { identifier: parsed.error.issues[0]?.message ?? 'Enter your mobile number or email' },
      });
      return;
    }

    const resending = this.state.phase === 'code';
    this.setState({ submitting: true, formError: null, fieldErrors: {}, notice: null });
    const result = await this.auth.requestPasswordReset(parsed.data);
    this.setState({ submitting: false });
    if (!result.ok) {
      if (result.error.code === 'DOCTOR_SIGNUP_REQUIRED' && this.onDoctorSignupRequired) {
        this.onDoctorSignupRequired(parsed.data.identifier);
        return;
      }
      this.setState({ formError: result.error.message });
      return;
    }
    this.setState({
      phase: 'code',
      challenge: result.value.challenge,
      otpCode: '',
      notice: resending ? 'We sent a new code.' : null,
    });
  }

  async submitNewPassword(): Promise<void> {
    const { submitting, challenge, otpCode, password, confirmPassword } = this.state;
    if (submitting || !challenge) return;

    const fieldErrors: Record<string, string> = {};
    const strong = passwordSchema.safeParse(password);
    if (!strong.success) fieldErrors.password = strong.error.issues[0]?.message ?? 'Choose a stronger password';
    if (confirmPassword !== password) fieldErrors.confirmPassword = 'Passwords do not match';
    if (Object.keys(fieldErrors).length > 0) {
      this.setState({ fieldErrors });
      return;
    }

    const parsed = passwordResetConfirmSchema.safeParse({
      challengeId: challenge.challengeId,
      code: otpCode,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      this.setState({ formError: parsed.error.issues[0]?.message ?? 'Check your details.' });
      return;
    }

    this.setState({ submitting: true, formError: null, fieldErrors: {}, notice: null });
    const result = await this.auth.confirmPasswordReset(parsed.data);
    this.setState({ submitting: false });
    if (!result.ok) {
      this.setState({ formError: result.error.message, otpCode: '' });
      return;
    }

    if (result.value.status === 'login_required') {
      this.finishWithoutSession('Your password has changed. Log in with your new password.');
      return;
    }
    const session = result.value.session;
    if (!canUseDashboard(session)) {
      await this.auth.logout();
      this.finishWithoutSession('Your password has changed. This account is for Cura Website, so log in there.');
      return;
    }
    this.onAuthenticated(session);
  }

  backToIdentifier(): void {
    this.setState({ phase: 'identifier', challenge: null, otpCode: '', formError: null, notice: null });
  }

  private finishWithoutSession(message: string): void {
    this.setState({
      phase: 'done',
      doneMessage: message,
      challenge: null,
      otpCode: '',
      password: '',
      confirmPassword: '',
    });
  }
}
