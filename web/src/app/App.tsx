import { useCallback, useEffect, useState } from 'react';
import {
  CLINIC_READ_PERMISSIONS,
  OwnerRole,
  Permission,
  canUseDashboard,
  permissionsForRole,
  tokenStore, type AuthSession, type AuthenticatedUser } from '@cura/shared';
import { useServices } from './services';
import { redeemHandoffFromAddress } from './handoff';
import { LoginView } from '../features/auth/LoginView';
import { AdminView } from '../features/admin/AdminView';
import type { ViewedClinic } from '../features/admin/sections/admin-types';
import { AmbulanceOwnerView } from '../features/owner/AmbulanceOwnerView';
import { PharmacyOwnerView } from '../features/owner/PharmacyOwnerView';
import { ProfileView } from '../features/profile/ProfileView';
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
  /** Shown on the login screen, e.g. when a link from Cura Website did not work. */
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  /** A clinic a super admin opened from Super Admin → Clinics, read-only. */
  const [viewedClinic, setViewedClinic] = useState<ViewedClinic | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  /** Pre-filled time for the intake modal: a clicked calendar slot, else now. */
  const [intakeAt, setIntakeAt] = useState<Date | undefined>(undefined);
  /** Doctor the calendar is showing when booking from it; else the form picks. */
  const [intakeDoctorId, setIntakeDoctorId] = useState<string | undefined>(undefined);

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
      // Opened from Cura Website with a handoff code: that becomes the session.
      const handoff = redeemHandoffFromAddress(auth);
      if (handoff) {
        const redeemed = await handoff;
        if (cancelled) return;
        if (redeemed.ok && canUseDashboard(redeemed.value)) {
          setOnboardingDone(redeemed.value.user.onboardingCompleted);
          setSession({ status: 'authenticated', user: redeemed.value.user });
          return;
        }
        if (redeemed.ok) {
          // Patients use Cura Website only, as at login.
          await auth.logout();
          if (cancelled) return;
          setLoginNotice('This account is for Cura Website. Please log in there.');
          setSession({ status: 'anonymous' });
          return;
        }
        setLoginNotice(redeemed.error.message);
      }

      const restored = await auth.restoreSession();
      if (cancelled) return;

      if (restored.ok) {
        const me = await http.request<AuthenticatedUser>('/account/profile');
        if (cancelled) return;

        if (me.ok) {
          setLoginNotice(null);
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
    setLoginNotice(null);
    setOnboardingDone(next.user.onboardingCompleted);
    setSession({ status: 'authenticated', user: next.user });
    setLocation({ route: 'calendar' });
  }, []);

  const handleSignOut = useCallback(() => {
    setViewedClinic(null);
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
    return <LoginView onAuthenticated={handleAuthenticated} notice={loginNotice} />;
  }

  const user = session.user;
  const ownPracticeIds = user.practiceIds;
  const practiceId = viewedClinic?.id ?? ownPracticeIds[0];
  // A super admin looking at a clinic they do not belong to can only read it.
  const readOnlyView = Boolean(viewedClinic && !ownPracticeIds.includes(viewedClinic.id));
  const effectivePermissions = readOnlyView
    ? CLINIC_READ_PERMISSIONS
    : practiceId
      ? user.permissions
      : permissionsForRole(user.role);
  const shownUser = { ...user, permissions: effectivePermissions };
  const hasClinicAccess = effectivePermissions.includes(Permission.CLINIC_ACCESS);
  const ownsClinicAccess = permissionsForRole(user.role).includes(Permission.CLINIC_ACCESS);

  // Spec 3.2.6(c): the wizard is one-time and blocks the dashboard until done.
  // It sets up a doctor's practice, so it does not apply to a business owner.
  if (!onboardingDone && ownsClinicAccess) {
    return <OnboardingView onFinished={() => setOnboardingDone(true)} />;
  }

  // An owner with no clinic has no calendar to land on.
  // An API deployed before owner roles existed does not send them.
  const ownerHome: RouteKey = user.isSuperAdmin
    ? 'admin'
    : (user.ownerRoles ?? []).includes(OwnerRole.AMBULANCE_OWNER)
      ? 'ambulances'
      : 'pharmacy';
  const route: RouteKey =
    hasClinicAccess || ['ambulances', 'pharmacy', 'profile', 'admin'].includes(location.route) ? location.route : ownerHome;

  return (
    <AppShell
      user={shownUser}
      practiceId={practiceId}
      active={route}
      onNavigate={navigate}
      onOpenPatient={openPatient}
      onOpenSettings={openSettings}
      onSignOut={handleSignOut}
      intakeOpen={intakeOpen}
      intakeAt={intakeAt}
      intakeDoctorId={intakeDoctorId}
      onIntakeOpenChange={(open) => {
        setIntakeOpen(open);
        if (!open) {
          setIntakeAt(undefined);
          setIntakeDoctorId(undefined);
        }
      }}
    >
      {viewedClinic && (
        <p className={styles.notice} role="status">
          Viewing {viewedClinic.name}
          {readOnlyView ? ', read-only. Each view is recorded.' : '.'}{' '}
          <button
            type="button"
            onClick={() => {
              setViewedClinic(null);
              setLocation({ route: 'admin' });
            }}
          >
            Stop viewing
          </button>
        </p>
      )}
      {route === 'admin' && user.isSuperAdmin && !location.patient ? (
        <AdminView
          onViewClinic={(clinic) => {
            setViewedClinic(clinic);
            setLocation({ route: 'calendar' });
          }}
        />
      ) : route === 'ambulances' && !location.patient ? (
        <AmbulanceOwnerView />
      ) : route === 'pharmacy' && !location.patient ? (
        <PharmacyOwnerView />
      ) : route === 'profile' && !practiceId ? (
        <ProfileView />
      ) : !practiceId ? (
        <p className={styles.notice}>
          No practice is linked to this account yet.
        </p>
      ) : location.patient ? (
        <PatientDashboardView
          practiceId={practiceId}
          patientId={location.patient.id}
          appointmentId={location.patient.appointmentId}
          canWrite={effectivePermissions.includes(Permission.CLINICAL_WRITE)}
          canReadHistory={effectivePermissions.includes(Permission.PATIENT_HISTORY_READ)}
          onClose={closePatient}
        />
      ) : (
        <Module
          route={route}
          practiceId={practiceId}
          settingsSection={location.settingsSection}
          permissions={effectivePermissions}
          onOpenPatient={openPatient}
          onAddWalkIn={(at, doctorId) => {
            setIntakeAt(at);
            setIntakeDoctorId(doctorId);
            setIntakeOpen(true);
          }}
          onOpenSettings={openSettings}
        />
      )}
    </AppShell>
  );
}
