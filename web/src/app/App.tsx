import { useCallback, useEffect, useState } from 'react';
import { Permission, tokenStore, type AuthSession, type AuthenticatedUser } from '@cura/shared';
import { useServices } from './services';
import { LoginView } from '../features/auth/LoginView';
import { OnboardingView } from '../features/onboarding/OnboardingView';
import { PatientDashboardView } from '../features/patient/PatientDashboardView';
import { AppShell } from '../features/shell/AppShell';
import type { RouteKey } from '../features/shell/navigation';
import type { SettingsKey } from '../features/settings/settings-nav';
import { Module } from './Module';
import type { Location, SessionState } from './app-shared';
import styles from './app.module.css';

export function App() {
  const { auth, http } = useServices();
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });
  const [location, setLocation] = useState<Location>({ route: 'calendar' });
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  /** Pre-filled time for the intake modal: a clicked calendar slot, else now. */
  const [intakeAt, setIntakeAt] = useState<Date | undefined>(undefined);

  /**
   * Session restore on boot.
   *
   * The access token lives in memory only, so it is gone after a reload. The
   * refresh token survives in an httpOnly cookie: exchanging it gives a new
   * access token, and `/account/profile` rebuilds the user behind it. Both
   * steps are required — a token with no user leaves the shell with nothing to
   * render, which is why this waits for the profile before declaring a session.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = await auth.restoreSession();
      if (cancelled) return;

      if (restored.ok) {
        const me = await http.request<AuthenticatedUser>('/account/profile');
        if (cancelled) return;

        if (me.ok) {
          setOnboardingDone(me.value.onboardingCompleted);
          setSession({ status: 'authenticated', user: me.value });
          return;
        }
      }

      setSession({ status: 'anonymous' });
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, http]);

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
    setLocation({ route: 'calendar' });
  }, []);

  const handleSignOut = useCallback(() => {
    void auth.logout();
    setSession({ status: 'anonymous' });
  }, [auth]);

  const navigate = useCallback((route: RouteKey) => setLocation({ route }), []);

  const openSettings = useCallback(
    (section: SettingsKey) => setLocation({ route: 'settings', settingsSection: section }),
    [],
  );

  const openPatient = useCallback(
    (patientId: string, appointmentId?: string) =>
      setLocation((current) => ({ ...current, patient: { id: patientId, appointmentId } })),
    [],
  );

  const closePatient = useCallback(
    () => setLocation((current) => ({ route: current.route, settingsSection: current.settingsSection })),
    [],
  );

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
    <AppShell
      user={session.user}
      practiceId={practiceId}
      active={location.route}
      onNavigate={navigate}
      onOpenPatient={openPatient}
      onOpenSettings={openSettings}
      onSignOut={handleSignOut}
      intakeOpen={intakeOpen}
      intakeAt={intakeAt}
      onIntakeOpenChange={(open) => {
        setIntakeOpen(open);
        if (!open) setIntakeAt(undefined);
      }}
    >
      {!practiceId ? (
        <p className={styles.notice}>
          No practice is linked to this account yet.
        </p>
      ) : location.patient ? (
        <PatientDashboardView
          practiceId={practiceId}
          patientId={location.patient.id}
          appointmentId={location.patient.appointmentId}
          canWrite={session.user.permissions.includes(Permission.CLINICAL_WRITE)}
          onClose={closePatient}
        />
      ) : (
        <Module
          route={location.route}
          practiceId={practiceId}
          settingsSection={location.settingsSection}
          permissions={session.user.permissions}
          onOpenPatient={openPatient}
          onAddWalkIn={(at) => {
            setIntakeAt(at);
            setIntakeOpen(true);
          }}
          onOpenSettings={openSettings}
        />
      )}
    </AppShell>
  );
}
