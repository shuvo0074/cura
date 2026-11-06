import type { FormEvent } from 'react';
import { businessRules, PasswordResetViewModel, useViewModel, type AuthSession } from '@cura/shared';
import { useServices } from '../../app/services';
import { useT } from '../../i18n';
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
  const { t, tm, rich } = useT();
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
        <h1 className={styles.title}>{t('auth.passwordChanged')}</h1>
        <p className={styles.hint} role="status">
          {tm(state.doneMessage)}
        </p>
        <button className={styles.submit} type="button" onClick={onCancel}>
          {t('auth.backToLogin')}
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
          {tm(state.fieldErrors[name])}
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
          <h1 className={styles.title}>{t('auth.newPasswordTitle')}</h1>
          <p className={styles.hint}>
            {rich('auth.resetCodeSent', { length: businessRules.auth.otpLength }, {
              to: <strong>{state.challenge?.maskedDestination}</strong>,
            })}
          </p>
          <label className={styles.field}>
            <span className={styles.label}>{t('auth.code')}</span>
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
            t('auth.newPassword'),
            t('auth.passwordHint', { min: businessRules.auth.passwordMinLength }),
          )}
          {passwordField('confirmPassword', t('auth.confirmNewPassword'))}
          {state.notice && (
            <p className={styles.hint} role="status">
              {tm(state.notice)}
            </p>
          )}
        </>
      ) : (
        <>
          <h1 className={styles.title}>{t('auth.resetTitle')}</h1>
          <p className={styles.hint}>{t('auth.resetHint')}</p>
          <label className={styles.field}>
            <span className={styles.label}>{t('auth.identifier')}</span>
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
                {tm(state.fieldErrors.identifier)}
              </span>
            )}
          </label>
        </>
      )}

      {state.formError && (
        <p className={styles.formError} role="alert">
          {tm(state.formError)}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={state.submitting}>
        {state.submitting ? t('auth.pleaseWait') : state.phase === 'code' ? t('auth.changePassword') : t('auth.sendCode')}
      </button>
      {state.phase === 'code' && (
        <button className={styles.secondary} type="button" onClick={() => void vm.requestCode()} disabled={state.submitting}>
          {t('auth.sendNewCode')}
        </button>
      )}
      <button
        className={styles.secondary}
        type="button"
        onClick={() => (state.phase === 'code' ? vm.backToIdentifier() : onCancel())}
        disabled={state.submitting}
      >
        {state.phase === 'code' ? t('auth.differentAddress') : t('auth.backToLogin')}
      </button>
    </form>
  );
}
