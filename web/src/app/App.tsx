import { useCallback, useEffect, useState } from 'react';
import { tokenStore, type AuthenticatedUser, type AuthSession } from '@cura/shared';
import { useServices } from './services';
import { LoginView } from '../features/auth/LoginView';
import { CalendarView } from '../features/calendar/CalendarView';
import { OnboardingView } from '../features/onboarding/OnboardingView';
import { PatientDashboardView } from '../features/patient/PatientDashboardView';
import styles from './app.module.css';

type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser };

/** Which workspace screen is in front. Onboarding pre-empts everything. */
type Screen =
  | { name: 'calendar' }
  | { name: 'patient'; patientId: string; appointmentId?: string | undefined };

export function App() {
  const { auth, http } = useServices();
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });
  const [screen, setScreen] = useState<Screen>({ name: 'calendar' });
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await auth.restoreSession();
      if (!cancelled) setSession({ status: 'anonymous' });
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Session expiry is handled once, centrally, rather than per feature.
  useEffect(
    () =>
      http.onSessionExpired(() => {
        tokenStore.clear();
        setSession({ status: 'anonymous' });
      }),
    [http],
  );

  const handleAuthenticated = useCallback((next: AuthSession) => {
    setOnboardingDone(next.user.onboardingCompleted);
    setSession({ status: 'authenticated', user: next.user });
    setScreen({ name: 'calendar' });
  }, []);

  const handleSignOut = useCallback(() => {
    void auth.logout();
    setSession({ status: 'anonymous' });
  }, [auth]);

  const openPatient = useCallback((patientId: string, appointmentId?: string) => {
    setScreen({ name: 'patient', patientId, appointmentId });
  }, []);

  const backToCalendar = useCallback(() => setScreen({ name: 'calendar' }), []);

  if (session.status === 'restoring') {
    return (
      <div className={styles.splash} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  if (session.status === 'anonymous') {
    return <LoginView onAuthenticated={handleAuthenticated} />;
  }

  // Spec 3.2.6(c): the wizard is one-time and blocks the dashboard until done.
  if (!onboardingDone) {
    return <OnboardingView onFinished={() => setOnboardingDone(true)} />;
  }

  const practiceId = session.user.practiceIds[0];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>Cura</span>
        <span className={styles.spacer} />
        <span className={styles.user}>{session.user.fullName}</span>
        <button type="button" className={styles.signOut} onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        {!practiceId ? (
          <p className={styles.notice}>
            No practice is linked to this account yet. Complete onboarding to continue.
          </p>
        ) : screen.name === 'patient' ? (
          <PatientDashboardView
            practiceId={practiceId}
            patientId={screen.patientId}
            appointmentId={screen.appointmentId}
            onClose={backToCalendar}
          />
        ) : (
          <CalendarView practiceId={practiceId} onOpenPatient={openPatient} />
        )}
      </main>
    </div>
  );
}
