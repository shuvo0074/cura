import { loginIdentifierSchema, registerSchema } from '../validation/schemas';
import type { OtpChallenge } from '../domain/models';
import { ViewModel } from './view-model';
import type { AuthApi } from './api-services';

export interface RegisterState {
  /** Mobile number or email — one field, dispatched on `@` like login. */
  identifier: string;
  bmdcNumber: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  submitting: boolean;
  /** Field-level messages keyed by form field name. */
  fieldErrors: Record<string, string>;
  formError: string | null;
}

type RegisterField = 'identifier' | 'bmdcNumber' | 'fullName' | 'password' | 'confirmPassword';

/**
 * Doctor self-registration (spec 1.3.2).
 *
 * Owns only the details form. A successful submission yields an OTP challenge,
 * which is handed to `onChallenge` — in practice `LoginViewModel.beginVerification`
 * — so registration and login share a single verification step that ends in
 * the same authenticated session.
 */
export class RegisterViewModel extends ViewModel<RegisterState> {
  constructor(
    private readonly auth: AuthApi,
    private readonly onChallenge: (challenge: OtpChallenge) => void,
  ) {
    super({
      identifier: '',
      bmdcNumber: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      submitting: false,
      fieldErrors: {},
      formError: null,
    });
  }

  setField(field: RegisterField, value: string): void {
    // Clear only the edited field's message so the others stay visible.
    const { [field]: _cleared, ...fieldErrors } = this.state.fieldErrors;
    this.setState({ [field]: value, fieldErrors, formError: null });
  }

  async submit(): Promise<void> {
    if (this.state.submitting) return;

    const { identifier, bmdcNumber, fullName, password, confirmPassword } = this.state;
    const contact = identifier.trim();

    /**
     * The API takes `mobile` and `email` as separate optional fields; the form
     * offers one. Routing on `@` mirrors the login identifier, and the request
     * is then checked against the exact schema the register endpoint enforces.
     */
    const parsed = registerSchema.safeParse({
      fullName,
      bmdcNumber,
      password,
      confirmPassword,
      ...(contact.includes('@') ? { email: contact } : contact ? { mobile: contact } : {}),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const raw = String(issue.path[0] ?? 'form');
        const key = raw === 'mobile' || raw === 'email' ? 'identifier' : raw;
        fieldErrors[key] ??= issue.message;
      }

      // Object-level refinements only run once every field parses, so surface
      // the contact and match checks up front rather than one round at a time.
      if (!fieldErrors.identifier) {
        const contactCheck = loginIdentifierSchema.safeParse(contact);
        if (!contactCheck.success) {
          fieldErrors.identifier = contactCheck.error.issues[0]?.message ?? 'Required';
        }
      }
      if (!fieldErrors.confirmPassword && confirmPassword !== password) {
        fieldErrors.confirmPassword = 'Passwords do not match';
      }

      this.setState({ fieldErrors });
      return;
    }

    this.setState({ submitting: true, formError: null, fieldErrors: {} });
    const result = await this.auth.register(parsed.data);
    this.setState({ submitting: false });

    if (!result.ok) {
      // A duplicate BMDC number belongs to one field; pin it there.
      if (result.error.code === 'BMDC_ALREADY_REGISTERED') {
        this.setState({ fieldErrors: { bmdcNumber: result.error.message } });
      } else {
        this.setState({ formError: result.error.message });
      }
      return;
    }

    this.onChallenge(result.value.challenge);
  }
}
