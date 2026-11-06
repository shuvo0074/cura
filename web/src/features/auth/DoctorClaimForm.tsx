import { useEffect, type FormEvent } from 'react';
import { businessRules, DoctorClaimViewModel, useViewModel, type AuthSession } from '@cura/shared';
import { useServices } from '../../app/services';
import { useT } from '../../i18n';
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
  const { t, tm, rich } = useT();
  const [state, vm] = useViewModel(() => new DoctorClaimViewModel(auth, onAuthenticated));

  useEffect(() => {
    void vm.load(mobile);
  }, [vm, mobile]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (state.phase === 'otp') void vm.submitOtp();
    else void vm.submitDetails();
  };

  if (state.phase === 'loading') return <p className={styles.hint}>{t('auth.findingDetails')}</p>;

  if (state.phase === 'notFound') {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>{t('auth.noRecord')}</h1>
        <p className={styles.hint}>{t('auth.noRecordHint')}</p>
        <button className={styles.submit} type="button" onClick={onCancel}>
          {t('auth.back')}
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
          {tm(state.fieldErrors[name])}
        </span>
      )}
    </label>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {state.phase === 'otp' ? (
        <>
          <h1 className={styles.title}>{t('auth.confirmPhone')}</h1>
          <p className={styles.hint}>
            {rich('auth.codeSent', { length: businessRules.auth.otpLength }, {
              to: <strong>{state.challenge?.maskedDestination}</strong>,
            })}
          </p>
          <label className={styles.field}>
            <span className={styles.label}>{t('auth.verificationCode')}</span>
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
          <h1 className={styles.title}>{t('auth.finishSignup')}</h1>
          <p className={styles.hint}>{t('auth.finishSignupHint')}</p>

          <label className={styles.field}>
            <span className={styles.label}>{t('auth.fullName')}</span>
            <input className={styles.input} value={state.fullName} readOnly />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('auth.specialty')}</span>
            <input className={styles.input} value={state.specialty} readOnly />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('auth.mobile')}</span>
            <input className={styles.input} value={state.mobile} readOnly />
          </label>

          {field('bmdcNumber', t('auth.bmdc'), { autoComplete: 'off' })}
          {field('email', t('auth.emailOptional'), { type: 'email', autoComplete: 'email' })}
          {field('password', t('auth.password'), {
            type: 'password',
            autoComplete: 'new-password',
            hint: t('auth.passwordHint', { min: businessRules.auth.passwordMinLength }),
          })}
          {field('confirmPassword', t('auth.confirmPassword'), { type: 'password', autoComplete: 'new-password' })}
        </>
      )}

      {state.formError && (
        <p className={styles.formError} role="alert">
          {tm(state.formError)}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={state.submitting}>
        {state.submitting ? t('auth.pleaseWait') : state.phase === 'otp' ? t('auth.verifyAndFinish') : t('auth.continue')}
      </button>
      <button
        className={styles.secondary}
        type="button"
        onClick={() => (state.phase === 'otp' ? vm.backToDetails() : onCancel())}
      >
        {t('auth.back')}
      </button>
    </form>
  );
}
