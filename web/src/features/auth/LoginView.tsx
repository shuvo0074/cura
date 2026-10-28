import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  businessRules,
  LoginViewModel,
  RegisterViewModel,
  useViewModel,
  type AuthSession,
  type RegisterState,
} from '@cura/shared';
import { useServices } from '../../app/services';
import { HeroIllustration } from './HeroIllustration';
import styles from './login.module.css';

type WelcomeTab = 'login' | 'register';

const TABS: ReadonlyArray<{ id: WelcomeTab; label: string }> = [
  { id: 'login', label: 'Login' },
  { id: 'register', label: 'Register' },
];

/**
 * Welcome screen (View) — spec 1.3: split-screen hero + Login / Register.
 *
 * Renders `LoginViewModel` and `RegisterViewModel` state and forwards events.
 * It holds no business logic — no validation, no branching on API results —
 * which is what keeps the MVVM boundary intact and the screen trivially
 * reviewable. The only local state is which tab is showing.
 *
 * Registration ends in the login ViewModel's OTP step, so both paths produce
 * the session through the same `onAuthenticated`; App then routes a new
 * account into onboarding.
 */
export function LoginView({ onAuthenticated }: { onAuthenticated: (s: AuthSession) => void }) {
  const { auth } = useServices();
  const [tab, setTab] = useState<WelcomeTab>('login');
  const [state, vm] = useViewModel(() => new LoginViewModel(auth, onAuthenticated));

  // StrictMode may replace the login ViewModel after mount; the ref keeps the
  // registration hand-off pointed at the live instance.
  const loginVmRef = useRef(vm);
  loginVmRef.current = vm;
  const [reg, regVm] = useViewModel(
    () => new RegisterViewModel(auth, (challenge) => loginVmRef.current.beginVerification(challenge)),
  );

  const verifying = state.phase === 'otp';
  const submitting = state.submitting || reg.submitting;

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (verifying) void vm.submitOtp();
      else if (tab === 'login') void vm.submitCredentials();
      else void regVm.submit();
    },
    [verifying, tab, vm, regVm],
  );

  // WAI-ARIA tabs pattern: arrow keys move between tabs.
  const handleTabKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next: WelcomeTab = tab === 'login' ? 'register' : 'login';
      setTab(next);
      document.getElementById(`welcome-tab-${next}`)?.focus();
    },
    [tab],
  );

  return (
    <div className={styles.shell}>
      {/* Spec: a sub-bar that stays fixed across every welcome screen. */}
      <header className={styles.subBar}>
        <span className={styles.brand}>
          <svg className={styles.brandMark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect className={styles.brandMarkTile} x="1" y="1" width="22" height="22" rx="6" />
            <path className={styles.brandMarkCross} d="M12 6.5V17.5M6.5 12H17.5" />
          </svg>
          Cura
        </span>
        <nav className={styles.subBarLinks} aria-label="Help and legal">
          <a className={styles.subBarLink} href="/help">
            Help
          </a>
          <a className={styles.subBarLink} href="/privacy">
            Privacy
          </a>
          <a className={styles.subBarLink} href="/terms">
            Terms
          </a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-hidden="true">
          <HeroIllustration className={styles.heroArt} />
          <p className={styles.heroCaption}>Practice management, built around the consultation.</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.card}>
            {!verifying && (
              <div className={styles.tabs} role="tablist" aria-label="Welcome">
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    id={`welcome-tab-${id}`}
                    className={styles.tab}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls="welcome-panel"
                    tabIndex={tab === id ? 0 : -1}
                    onClick={() => setTab(id)}
                    onKeyDown={handleTabKey}
                    disabled={submitting}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <form
              id="welcome-panel"
              className={styles.form}
              onSubmit={handleSubmit}
              noValidate
              {...(verifying ? {} : { role: 'tabpanel', 'aria-labelledby': `welcome-tab-${tab}` })}
            >
              {verifying ? (
                <OtpStep
                  title={tab === 'register' ? 'Confirm your account' : 'Verify it’s you'}
                  maskedDestination={state.challenge?.maskedDestination}
                  code={state.otpCode}
                  onCode={(value) => vm.setOtpCode(value)}
                  resendIn={state.resendAvailableInSeconds}
                  submitting={state.submitting}
                />
              ) : tab === 'login' ? (
                <>
                  <h1 className={styles.title}>Welcome back</h1>

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
                      aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
                      disabled={state.submitting}
                    />
                    {state.fieldErrors.password && (
                      <span id="password-error" className={styles.error} role="alert">
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
                  <h1 className={styles.title}>Create your account</h1>

                  <RegisterField
                    name="identifier"
                    label="Mobile number or email"
                    state={reg}
                    onChange={(v) => regVm.setField('identifier', v)}
                    autoComplete="username"
                    inputMode="email"
                    hint="We’ll send a verification code here."
                  />
                  <RegisterField
                    name="bmdcNumber"
                    label="BMDC registration number"
                    state={reg}
                    onChange={(v) => regVm.setField('bmdcNumber', v)}
                    autoComplete="off"
                  />
                  <RegisterField
                    name="fullName"
                    label="Full name"
                    state={reg}
                    onChange={(v) => regVm.setField('fullName', v)}
                    autoComplete="name"
                  />
                  <RegisterField
                    name="password"
                    label="Password"
                    type="password"
                    state={reg}
                    onChange={(v) => regVm.setField('password', v)}
                    autoComplete="new-password"
                    hint={`At least ${businessRules.auth.passwordMinLength} characters, with upper- and lowercase letters and a number.`}
                  />
                  <RegisterField
                    name="confirmPassword"
                    label="Confirm password"
                    type="password"
                    state={reg}
                    onChange={(v) => regVm.setField('confirmPassword', v)}
                    autoComplete="new-password"
                  />
                </>
              )}

              {(verifying || tab === 'login' ? state.formError : reg.formError) && (
                <p className={styles.formError} role="alert">
                  {verifying || tab === 'login' ? state.formError : reg.formError}
                </p>
              )}

              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting
                  ? 'Please wait…'
                  : verifying
                    ? 'Verify'
                    : tab === 'login'
                      ? 'Login'
                      : 'Register'}
              </button>

              {verifying ? (
                <button className={styles.secondary} type="button" onClick={() => vm.backToCredentials()}>
                  {tab === 'register' ? 'Edit registration details' : 'Use a different account'}
                </button>
              ) : (
                tab === 'register' && (
                  <>
                    <div className={styles.divider}>
                      <span>or</span>
                    </div>
                    {/* No Facebook OAuth exists on the API yet — shown, not faked. */}
                    <button
                      className={styles.social}
                      type="button"
                      disabled
                      aria-describedby="facebook-soon"
                    >
                      Continue with Facebook
                    </button>
                    <p id="facebook-soon" className={styles.socialNote}>
                      Facebook sign-up is coming soon.
                    </p>
                  </>
                )
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function OtpStep(props: {
  title: string;
  maskedDestination: string | undefined;
  code: string;
  onCode: (value: string) => void;
  resendIn: number;
  submitting: boolean;
}) {
  return (
    <>
      <h1 className={styles.title}>{props.title}</h1>
      <p className={styles.hint}>
        We sent a {businessRules.auth.otpLength}-digit code to <strong>{props.maskedDestination}</strong>.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>Verification code</span>
        <input
          className={`${styles.input} ${styles.otp}`}
          value={props.code}
          onChange={(e) => props.onCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={businessRules.auth.otpLength}
          autoFocus
          disabled={props.submitting}
        />
      </label>

      <p className={styles.hint}>
        {props.resendIn > 0
          ? `You can request a new code in ${props.resendIn}s.`
          : 'You can request a new code now.'}
      </p>
    </>
  );
}

/** One labelled registration input with its hint and error wiring. */
function RegisterField(props: {
  name: 'identifier' | 'bmdcNumber' | 'fullName' | 'password' | 'confirmPassword';
  label: string;
  state: RegisterState;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  autoComplete: string;
  inputMode?: 'email' | 'text';
  hint?: string;
}) {
  const { name, state } = props;
  const error = state.fieldErrors[name];
  const errorId = `reg-${name}-error`;
  const hintId = `reg-${name}-hint`;
  // The hint gives way to the error, so only one of them is ever described.
  const describedBy = error ? errorId : props.hint ? hintId : undefined;

  // Explicit `htmlFor` rather than a wrapping label, so the hint and error are
  // announced as descriptions instead of being folded into the field's name.
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`reg-${name}`}>
        {props.label}
      </label>
      <input
        id={`reg-${name}`}
        className={styles.input}
        type={props.type ?? 'text'}
        value={state[name]}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={state.submitting}
      />
      {error ? (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      ) : (
        props.hint && (
          <span id={hintId} className={styles.fieldHint}>
            {props.hint}
          </span>
        )
      )}
    </div>
  );
}
