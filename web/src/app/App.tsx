import { useCallback, useEffect, useState } from 'react';
import { tokenStore, type AuthenticatedUser, type AuthSession } from '@cura/shared';
import { useServices } from './services';
import { LoginView } from '../features/auth/LoginView';
import { CalendarView } from '../features/calendar/CalendarView';
import { OnboardingView } from '../features/onboarding/OnboardingView';
import { PatientDashboardView } from '../features/patient/PatientDashboardView';
import { PatientsView } from '../features/patients/PatientsView';
import { SettingsView } from '../features/settings/SettingsView';
import { ReportsView } from '../features/reports/ReportsView';
import { AppShell } from '../features/shell/AppShell';
import { NAV_ITEMS, type RouteKey } from '../features/shell/navigation';
import styles from './app.module.css';

type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser };

/**
 * A patient record is opened *over* whichever module you were in, and closing
 * it returns you there — so jumping to a chart from the calendar does not lose
 * your place, which is the whole point of the four-pane layout.
 */
interface Location {
  route: RouteKey;
  patient?: { id: string; appointmentId?: string | undefined } | undefined;
}

export function App() {
  const { auth, http } = useServices();
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });
  const [location, setLocation] = useState<Location>({ route: 'calendar' });
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

  const openPatient = useCallback(
    (patientId: string, appointmentId?: string) =>
      setLocation((current) => ({ ...current, patient: { id: patientId, appointmentId } })),
    [],
  );

  const closePatient = useCallback(
    () => setLocation((current) => ({ route: current.route })),
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
      active={location.route}
      onNavigate={navigate}
      onSignOut={handleSignOut}
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
          onClose={closePatient}
        />
      ) : (
        <Module route={location.route} practiceId={practiceId} onOpenPatient={openPatient} />
      )}
    </AppShell>
  );
}

function Module({
  route,
  practiceId,
  onOpenPatient,
}: {
  route: RouteKey;
  practiceId: string;
  onOpenPatient: (patientId: string, appointmentId?: string) => void;
}) {
  switch (route) {
    case 'calendar':
      return <CalendarView practiceId={practiceId} onOpenPatient={onOpenPatient} />;
    case 'patients':
      return <PatientsView practiceId={practiceId} onOpenPatient={onOpenPatient} />;
    case 'settings':
      return <SettingsView practiceId={practiceId} />;
    case 'reports':
      return <ReportsView practiceId={practiceId} />;
    default:
      return <NotBuilt route={route} />;
  }
}

/**
 * Placeholder for modules whose API exists but whose screen does not.
 *
 * It names the endpoints that are live, so the gap is a known quantity rather
 * than a dead menu item.
 */
function NotBuilt({ route }: { route: RouteKey }) {
  const item = NAV_ITEMS.find((i) => i.key === route);

  return (
    <div className={styles.placeholder}>
      <h2>{item?.label}</h2>
      <p>{item?.hint ?? 'This screen is not built yet.'}</p>
      <p className={styles.placeholderNote}>
        The API for this module is implemented and testable — only the browser UI
        is outstanding.
      </p>
    </div>
  );
}
