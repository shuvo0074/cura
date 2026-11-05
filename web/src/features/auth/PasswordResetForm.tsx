import type { FormEvent } from 'react';
import { businessRules, PasswordResetViewModel, useViewModel, type AuthSession } from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './login.module.css';

/**
 * Forgot password, shown inside the login card. A code goes to the mobile number
 * or email the person logs in with; a correct code and a new password log them in.
 */
export function PasswordResetForm({
  initialIdentifier,
  onAuthenticated,
  onDoctorSignupRequired,
  onCancel,
}: {
  initialIdentifier: string;
  onAuthenticated: (session: AuthSession) => void;
  onDoctorSignupRequired: (mobile: string) => void;
  onCancel: () => void;
}) {
  const { auth } = useServices();
  const [state, vm] = useViewModel(() => {
    const model = new PasswordResetViewModel(auth, onAuthenticated, onDoctorSignupRequired);
    model.setField('identifier', initialIdentifier);
    return model;
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (state.phase === 'code') void vm.submitNewPassword();
    else if (state.phase === 'identifier') void vm.requestCode();
  };

  if (state.phase === 'done') {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>Password changed</h1>
        <p className={styles.hint} role="status">
          {state.doneMessage}
        </p>
        <button className={styles.submit} type="button" onClick={onCancel}>
          Back to login
        </button>
      </div>
    );
  }

  const passwordField = (name: 'password' | 'confirmPassword', label: string, hint?: string) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`reset-${name}`}>
        {label}
      </label>
      <input
        id={`reset-${name}`}
        className={styles.input}
        type="password"
        value={state[name]}
        onChange={(e) => vm.setField(name, e.target.value)}
        autoComplete="new-password"
        aria-invalid={Boolean(state.fieldErrors[name])}
        aria-describedby={state.fieldErrors[name] ? `reset-${name}-error` : hint ? `reset-${name}-hint` : undefined}
        disabled={state.submitting}
      />
      {state.fieldErrors[name] ? (
        <span id={`reset-${name}-error`} className={styles.error} role="alert">
          {state.fieldErrors[name]}
        </span>
      ) : (
        hint && (
          <span id={`reset-${name}-hint`} className={styles.fieldHint}>
            {hint}
          </span>
        )
      )}
    </div>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {state.phase === 'code' ? (
        <>
          <h1 className={styles.title}>Choose a new password</h1>
          <p className={styles.hint}>
            If an account uses that address, we sent a {businessRules.auth.otpLength}-digit code to{' '}
            <strong>{state.challenge?.maskedDestination}</strong>.
          </p>
          <label className={styles.field}>
            <span className={styles.label}>Code</span>
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
          {passwordField(
            'password',
            'New password',
            `At least ${businessRules.auth.passwordMinLength} characters, with upper- and lowercase letters and a number.`,
          )}
          {passwordField('confirmPassword', 'Confirm new password')}
          {state.notice && (
            <p className={styles.hint} role="status">
              {state.notice}
            </p>
          )}
        </>
      ) : (
        <>
          <h1 className={styles.title}>Reset your password</h1>
          <p className={styles.hint}>Enter the mobile number or email you log in with. We’ll send you a code.</p>
          <label className={styles.field}>
            <span className={styles.label}>Mobile number or email</span>
            <input
              className={styles.input}
              value={state.identifier}
              onChange={(e) => vm.setField('identifier', e.target.value)}
              autoComplete="username"
              inputMode="email"
              autoFocus
              aria-invalid={Boolean(state.fieldErrors.identifier)}
              disabled={state.submitting}
            />
            {state.fieldErrors.identifier && (
              <span className={styles.error} role="alert">
                {state.fieldErrors.identifier}
              </span>
            )}
          </label>
        </>
      )}

      {state.formError && (
        <p className={styles.formError} role="alert">
          {state.formError}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={state.submitting}>
        {state.submitting ? 'Please wait…' : state.phase === 'code' ? 'Change password' : 'Send code'}
      </button>
      {state.phase === 'code' && (
        <button className={styles.secondary} type="button" onClick={() => void vm.requestCode()} disabled={state.submitting}>
          Send a new code
        </button>
      )}
      <button
        className={styles.secondary}
        type="button"
        onClick={() => (state.phase === 'code' ? vm.backToIdentifier() : onCancel())}
        disabled={state.submitting}
      >
        {state.phase === 'code' ? 'Use a different address' : 'Back to login'}
      </button>
    </form>
  );
}
