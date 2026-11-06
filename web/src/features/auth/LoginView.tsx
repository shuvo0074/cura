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
import { DoctorClaimForm } from './DoctorClaimForm';
import { PasswordResetForm } from './PasswordResetForm';
import { HeroIllustration } from './HeroIllustration';
import { LanguageSwitch, useT, type TranslationKey } from '../../i18n';
import styles from './login.module.css';

type WelcomeTab = 'login' | 'register';

const TABS: ReadonlyArray<{ id: WelcomeTab; label: TranslationKey }> = [
  { id: 'login', label: 'auth.tabLogin' },
  { id: 'register', label: 'auth.tabRegister' },
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
export function LoginView({
  onAuthenticated,
  notice = null,
}: {
  onAuthenticated: (s: AuthSession) => void;
  /** Why the person is here, e.g. a link from Cura Website that did not work. */
  notice?: string | null;
}) {
  const { auth } = useServices();
  const { t, tm } = useT();
  // Cura Website links here to send a doctor to sign up.
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [tab, setTab] = useState<WelcomeTab>(params.get('tab') === 'register' ? 'register' : 'login');
  const [claimMobile, setClaimMobile] = useState<string | null>(params.get('claim'));
  const [resetting, setResetting] = useState(false);
  const [state, vm] = useViewModel(() => new LoginViewModel(auth, onAuthenticated, 'en', setClaimMobile));

  // StrictMode may replace the login ViewModel after mount; the ref keeps the
  // registration hand-off pointed at the live instance.
  const loginVmRef = useRef(vm);
  loginVmRef.current = vm;
  const [reg, regVm] = useViewModel(
    () => new RegisterViewModel(auth, (challenge) => loginVmRef.current.beginVerification(challenge), setClaimMobile),
  );

  const verifying = state.phase === 'otp';
  const formError =
    tm(verifying || tab === 'login' ? (state.formError ?? (verifying ? null : notice)) : reg.formError);
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
        <nav className={styles.subBarLinks} aria-label={t('auth.helpAndLegal')}>
          <LanguageSwitch signedIn={false} />
          <a className={styles.subBarLink} href="/help">
            {t('auth.help')}
          </a>
          <a className={styles.subBarLink} href="/privacy">
            {t('auth.privacy')}
          </a>
          <a className={styles.subBarLink} href="/terms">
            {t('auth.terms')}
          </a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-hidden="true">
          <HeroIllustration className={styles.heroArt} />
          <p className={styles.heroCaption}>{t('auth.heroCaption')}</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.card}>
            {claimMobile ? (
              <DoctorClaimForm
                mobile={claimMobile}
                onAuthenticated={onAuthenticated}
                onCancel={() => setClaimMobile(null)}
              />
            ) : resetting ? (
              <PasswordResetForm
                initialIdentifier={state.identifier}
                onAuthenticated={onAuthenticated}
                onDoctorSignupRequired={(mobile) => {
                  setResetting(false);
                  setClaimMobile(mobile);
                }}
                onCancel={() => setResetting(false)}
              />
            ) : (
            <>
            {!verifying && (
              <div className={styles.tabs} role="tablist" aria-label={t('auth.welcome')}>
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
                    {t(label)}
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
                  title={tab === 'register' ? t('auth.confirmAccount') : t('auth.verifyItsYou')}
                  maskedDestination={state.challenge?.maskedDestination}
                  code={state.otpCode}
                  onCode={(value) => vm.setOtpCode(value)}
                  resendIn={state.resendAvailableInSeconds}
                  submitting={state.submitting}
                />
              ) : tab === 'login' ? (
                <>
                  <h1 className={styles.title}>{t('auth.welcomeBack')}</h1>

                  <label className={styles.field}>
                    <span className={styles.label}>{t('auth.identifier')}</span>
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
                        {tm(state.fieldErrors.identifier)}
                      </span>
                    )}
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>{t('auth.password')}</span>
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
                        {tm(state.fieldErrors.password)}
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
                      <span>{t('auth.rememberMe', { days: businessRules.auth.rememberMeDays })}</span>
                    </label>
                    <button
                      className={styles.link}
                      type="button"
                      onClick={() => setResetting(true)}
                      disabled={state.submitting}
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className={styles.title}>{t('auth.createAccount')}</h1>

                  <RegisterField
                    name="identifier"
                    label={t('auth.identifier')}
                    state={reg}
                    onChange={(v) => regVm.setField('identifier', v)}
                    autoComplete="username"
                    inputMode="email"
                    hint={t('auth.identifierHint')}
                  />
                  <RegisterField
                    name="bmdcNumber"
                    label={t('auth.bmdc')}
                    state={reg}
                    onChange={(v) => regVm.setField('bmdcNumber', v)}
                    autoComplete="off"
                  />
                  <RegisterField
                    name="fullName"
                    label={t('auth.fullName')}
                    state={reg}
                    onChange={(v) => regVm.setField('fullName', v)}
                    autoComplete="name"
                  />
                  <RegisterField
                    name="specialty"
                    label={t('auth.specialty')}
                    state={reg}
                    onChange={(v) => regVm.setField('specialty', v)}
                    autoComplete="off"
                    hint={t('auth.specialtyHint')}
                  />
                  <RegisterField
                    name="password"
                    label={t('auth.password')}
                    type="password"
                    state={reg}
                    onChange={(v) => regVm.setField('password', v)}
                    autoComplete="new-password"
                    hint={t('auth.passwordHint', { min: businessRules.auth.passwordMinLength })}
                  />
                  <RegisterField
                    name="confirmPassword"
                    label={t('auth.confirmPassword')}
                    type="password"
                    state={reg}
                    onChange={(v) => regVm.setField('confirmPassword', v)}
                    autoComplete="new-password"
                  />
                </>
              )}

              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}

              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting
                  ? t('auth.pleaseWait')
                  : verifying
                    ? t('auth.verify')
                    : tab === 'login'
                      ? t('auth.login')
                      : t('auth.register')}
              </button>

              {verifying ? (
                <button className={styles.secondary} type="button" onClick={() => vm.backToCredentials()}>
                  {tab === 'register' ? t('auth.editRegistration') : t('auth.differentAccount')}
                </button>
              ) : (
                tab === 'register' && (
                  <>
                    <div className={styles.divider}>
                      <span>{t('auth.or')}</span>
                    </div>
                    {/* No Facebook OAuth exists on the API yet — shown, not faked. */}
                    <button
                      className={styles.social}
                      type="button"
                      disabled
                      aria-describedby="facebook-soon"
                    >
                      {t('auth.facebook')}
                    </button>
                    <p id="facebook-soon" className={styles.socialNote}>
                      {t('auth.facebookSoon')}
                    </p>
                  </>
                )
              )}
            </form>
            </>
            )}
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
  const { t, rich } = useT();
  return (
    <>
      <h1 className={styles.title}>{props.title}</h1>
      <p className={styles.hint}>
        {rich('auth.codeSent', { length: businessRules.auth.otpLength }, {
          to: <strong>{props.maskedDestination}</strong>,
        })}
      </p>

      <label className={styles.field}>
        <span className={styles.label}>{t('auth.verificationCode')}</span>
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
          ? t('auth.resendIn', { seconds: props.resendIn })
          : t('auth.resendNow')}
      </p>
    </>
  );
}

/** One labelled registration input with its hint and error wiring. */
function RegisterField(props: {
  name: 'identifier' | 'bmdcNumber' | 'fullName' | 'specialty' | 'password' | 'confirmPassword';
  label: string;
  state: RegisterState;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  autoComplete: string;
  inputMode?: 'email' | 'text';
  hint?: string;
}) {
  const { name, state } = props;
  const { tm } = useT();
  const error = tm(state.fieldErrors[name]);
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
