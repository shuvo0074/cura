import { useEffect, type FormEvent } from 'react';
import { businessRules, DoctorClaimViewModel, useViewModel, type AuthSession } from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './login.module.css';

/**
 * Sign-up for a doctor an admin already added. Opened from login, from Register,
 * or from Cura Website when someone uses that doctor's phone number.
 */
export function DoctorClaimForm({
  mobile,
  onAuthenticated,
  onCancel,
}: {
  mobile: string;
  onAuthenticated: (session: AuthSession) => void;
  onCancel: () => void;
}) {
  const { auth } = useServices();
  const [state, vm] = useViewModel(() => new DoctorClaimViewModel(auth, onAuthenticated));

  useEffect(() => {
    void vm.load(mobile);
  }, [vm, mobile]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (state.phase === 'otp') void vm.submitOtp();
    else void vm.submitDetails();
  };

  if (state.phase === 'loading') return <p className={styles.hint}>Finding your details…</p>;

  if (state.phase === 'notFound') {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>No record to finish</h1>
        <p className={styles.hint}>This number has no doctor waiting to sign up. Log in or register instead.</p>
        <button className={styles.submit} type="button" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  const field = (
    name: 'bmdcNumber' | 'email' | 'password' | 'confirmPassword',
    label: string,
    options: { type?: string; autoComplete: string; hint?: string },
  ) => (
    <label className={styles.field}>
      <span id={`claim-${name}`} className={styles.label}>
        {label}
      </span>
      <input
        className={styles.input}
        aria-labelledby={`claim-${name}`}
        type={options.type ?? 'text'}
        value={state[name]}
        onChange={(e) => vm.setField(name, e.target.value)}
        autoComplete={options.autoComplete}
        aria-invalid={Boolean(state.fieldErrors[name])}
        disabled={state.submitting}
      />
      {options.hint && <span className={styles.hint}>{options.hint}</span>}
      {state.fieldErrors[name] && (
        <span className={styles.error} role="alert">
          {state.fieldErrors[name]}
        </span>
      )}
    </label>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {state.phase === 'otp' ? (
        <>
          <h1 className={styles.title}>Confirm your phone</h1>
          <p className={styles.hint}>
            We sent a {businessRules.auth.otpLength}-digit code to <strong>{state.challenge?.maskedDestination}</strong>.
          </p>
          <label className={styles.field}>
            <span className={styles.label}>Verification code</span>
            <input
              className={`${styles.input} ${styles.otp}`}
              value={state.otpCode}
              onChange={(e) => vm.setOtpCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={businessRules.auth.otpLength}
              autoFocus
              disabled={state.submitting}
            />
          </label>
        </>
      ) : (
        <>
          <h1 className={styles.title}>Finish signing up</h1>
          <p className={styles.hint}>A clinic already added you as a doctor. Check your details and create your login.</p>

          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input className={styles.input} value={state.fullName} readOnly />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Specialty</span>
            <input className={styles.input} value={state.specialty} readOnly />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Mobile number</span>
            <input className={styles.input} value={state.mobile} readOnly />
          </label>

          {field('bmdcNumber', 'BMDC registration number', { autoComplete: 'off' })}
          {field('email', 'Email (optional)', { type: 'email', autoComplete: 'email' })}
          {field('password', 'Password', {
            type: 'password',
            autoComplete: 'new-password',
            hint: `At least ${businessRules.auth.passwordMinLength} characters, with upper- and lowercase letters and a number.`,
          })}
          {field('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
        </>
      )}

      {state.formError && (
        <p className={styles.formError} role="alert">
          {state.formError}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={state.submitting}>
        {state.submitting ? 'Please wait…' : state.phase === 'otp' ? 'Verify and finish' : 'Continue'}
      </button>
      <button
        className={styles.secondary}
        type="button"
        onClick={() => (state.phase === 'otp' ? vm.backToDetails() : onCancel())}
      >
        Back
      </button>
    </form>
  );
}
