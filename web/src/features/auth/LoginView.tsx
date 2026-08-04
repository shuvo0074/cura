import { useCallback, type FormEvent } from 'react';
import { businessRules, type AuthSession } from '@cura/shared';
import { useViewModel } from '@cura/shared';
import { useServices } from '../../app/services';
import { LoginViewModel } from '@cura/shared';
import styles from './login.module.css';

/**
 * Login screen (View).
 *
 * Renders `LoginViewModel` state and forwards events. It holds no business
 * logic — no validation, no branching on API results — which is what keeps the
 * MVVM boundary intact and the screen trivially reviewable.
 */
export function LoginView({ onAuthenticated }: { onAuthenticated: (s: AuthSession) => void }) {
  const { auth } = useServices();
  const [state, vm] = useViewModel(() => new LoginViewModel(auth, onAuthenticated));

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void (state.phase === 'credentials' ? vm.submitCredentials() : vm.submitOtp());
    },
    [state.phase, vm],
  );

  return (
    <main className={styles.shell}>
      <section className={styles.hero} aria-hidden="true">
        <div className={styles.heroArt} />
        <p className={styles.heroCaption}>Practice management, built around the consultation.</p>
      </section>

      <section className={styles.panel}>
        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <h1 className={styles.title}>
            {state.phase === 'credentials' ? 'Sign in' : 'Verify it&rsquo;s you'}
          </h1>

          {state.phase === 'credentials' ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Mobile number or email</span>
                <input
                  className={styles.input}
                  value={state.identifier}
                  onChange={(e) => vm.setIdentifier(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  aria-invalid={Boolean(state.fieldErrors.identifier)}
                  aria-describedby={state.fieldErrors.identifier ? 'identifier-error' : undefined}
                  disabled={state.submitting}
                />
                {state.fieldErrors.identifier && (
                  <span id="identifier-error" className={styles.error} role="alert">
                    {state.fieldErrors.identifier}
                  </span>
                )}
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Password</span>
                <input
                  className={styles.input}
                  type="password"
                  value={state.password}
                  onChange={(e) => vm.setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(state.fieldErrors.password)}
                  disabled={state.submitting}
                />
                {state.fieldErrors.password && (
                  <span className={styles.error} role="alert">
                    {state.fieldErrors.password}
                  </span>
                )}
              </label>

              <div className={styles.row}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={state.rememberMe}
                    onChange={(e) => vm.setRememberMe(e.target.checked)}
                    disabled={state.submitting}
                  />
                  <span>Remember me for {businessRules.auth.rememberMeDays} days</span>
                </label>
                <a className={styles.link} href="/forgot-password">
                  Forgot password?
                </a>
              </div>
            </>
          ) : (
            <>
              <p className={styles.hint}>
                We sent a {businessRules.auth.otpLength}-digit code to{' '}
                <strong>{state.challenge?.maskedDestination}</strong>.
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

              <p className={styles.hint}>
                {state.resendAvailableInSeconds > 0
                  ? `You can request a new code in ${state.resendAvailableInSeconds}s.`
                  : 'You can request a new code now.'}
              </p>
            </>
          )}

          {state.formError && (
            <p className={styles.formError} role="alert">
              {state.formError}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={state.submitting}>
            {state.submitting ? 'Please wait…' : state.phase === 'credentials' ? 'Sign in' : 'Verify'}
          </button>

          {state.phase === 'otp' && (
            <button className={styles.secondary} type="button" onClick={() => vm.backToCredentials()}>
              Use a different account
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
