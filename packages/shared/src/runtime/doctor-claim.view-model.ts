import { doctorClaimCompleteSchema, doctorClaimStartSchema, passwordSchema } from '../validation/schemas';
import type { AuthSession, OtpChallenge } from '../domain/models';
import { ViewModel } from './view-model';
import type { AuthApi } from './api-services';

export interface DoctorClaimState {
  phase: 'loading' | 'details' | 'otp' | 'notFound';
  /** Pre-filled from the record the admin created, and not editable here. */
  fullName: string;
  specialty: string;
  mobile: string;
  bmdcNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  otpCode: string;
  challenge: OtpChallenge | null;
  submitting: boolean;
  fieldErrors: Record<string, string>;
  formError: string | null;
}

type ClaimField = 'bmdcNumber' | 'email' | 'password' | 'confirmPassword';

/**
 * A doctor an admin added finishes signing up: the form opens pre-filled from
 * their phone number, they give their BMDC number and a password, and a code sent
 * to that phone proves it is theirs before the login is created.
 */
export class DoctorClaimViewModel extends ViewModel<DoctorClaimState> {
  constructor(
    private readonly auth: AuthApi,
    private readonly onAuthenticated: (session: AuthSession) => void,
  ) {
    super({
      phase: 'loading',
      fullName: '',
      specialty: '',
      mobile: '',
      bmdcNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      otpCode: '',
      challenge: null,
      submitting: false,
      fieldErrors: {},
      formError: null,
    });
  }

  async load(mobile: string): Promise<void> {
    const result = await this.auth.lookupDoctorClaim(mobile);
    if (!result.ok) {
      this.setState({ phase: 'details', formError: result.error.message });
      return;
    }
    if (!result.value.claimable) {
      this.setState({ phase: 'notFound' });
      return;
    }
    const { fullName, specialty, mobile: stored } = result.value;
    this.setState({ phase: 'details', fullName, specialty, mobile: stored });
  }

  setField(field: ClaimField, value: string): void {
    const { [field]: _cleared, ...fieldErrors } = this.state.fieldErrors;
    this.setState({ [field]: value, fieldErrors, formError: null });
  }

  setOtpCode(value: string): void {
    this.setState({ otpCode: value.replace(/\D/g, '').slice(0, 6), formError: null });
  }

  async submitDetails(): Promise<void> {
    const { submitting, mobile, bmdcNumber, password, confirmPassword } = this.state;
    if (submitting) return;

    const fieldErrors: Record<string, string> = {};
    const start = doctorClaimStartSchema.safeParse({ mobile, bmdcNumber });
    if (!start.success) fieldErrors.bmdcNumber = 'Enter your BMDC registration number, e.g. A-12345.';
    const strong = passwordSchema.safeParse(password);
    if (!strong.success) fieldErrors.password = strong.error.issues[0]?.message ?? 'Choose a stronger password';
    if (confirmPassword !== password) fieldErrors.confirmPassword = 'Passwords do not match';
    if (!start.success || Object.keys(fieldErrors).length > 0) {
      this.setState({ fieldErrors });
      return;
    }

    this.setState({ submitting: true, formError: null, fieldErrors: {} });
    const result = await this.auth.startDoctorClaim(start.data);
    this.setState({ submitting: false });
    if (!result.ok) {
      if (result.error.code === 'BMDC_MISMATCH' || result.error.code === 'BMDC_ALREADY_REGISTERED') {
        this.setState({ fieldErrors: { bmdcNumber: result.error.message } });
      } else {
        this.setState({ formError: result.error.message });
      }
      return;
    }
    this.setState({ phase: 'otp', challenge: result.value.challenge, otpCode: '' });
  }

  async submitOtp(): Promise<void> {
    const { submitting, challenge, otpCode, bmdcNumber, email, password, confirmPassword } = this.state;
    if (submitting || !challenge) return;

    const parsed = doctorClaimCompleteSchema.safeParse({
      challengeId: challenge.challengeId,
      code: otpCode,
      bmdcNumber,
      password,
      confirmPassword,
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    if (!parsed.success) {
      this.setState({ formError: parsed.error.issues[0]?.message ?? 'Check your details.' });
      return;
    }

    this.setState({ submitting: true, formError: null });
    const result = await this.auth.completeDoctorClaim(parsed.data);
    this.setState({ submitting: false });
    if (!result.ok) {
      this.setState({ formError: result.error.message, otpCode: '' });
      return;
    }
    this.onAuthenticated(result.value);
  }

  backToDetails(): void {
    this.setState({ phase: 'details', challenge: null, otpCode: '', formError: null });
  }
}
