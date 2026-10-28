import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Permission, type AuthenticatedUser } from '@cura/shared';
import { useTheme } from '../../design/theme-provider';
import { NAV_ITEMS, visibleNavItems, type RouteKey } from './navigation';
import { UniversalSearch } from './header/UniversalSearch';
import { PatientIntakeModal } from './header/PatientIntakeModal';
import { HelpMenu, NotificationBell, ProfileMenu, type WorkspaceToggles } from './header/HeaderMenus';
import styles from './shell.module.css';

import { NavButton } from './NavButton';
import { SignOutDialog } from './SignOutDialog';

/**
 * Dashboard shell: global header, collapsible sidebar, content area.
 *
 * The sidebar is the app's map. Every module the API exposes appears here, and
 * items whose UI is incomplete say so on their own screen rather than being
 * hidden — a menu that quietly omits half the product is worse than one that is
 * honest about what is finished.
 *
 * The header carries the four global controls the spec pins there (search,
 * patient intake, notifications, profile), so they stay reachable from every
 * module rather than being duplicated into each screen.
 */
export function AppShell({
  user,
  practiceId,
  active,
  onNavigate,
  onOpenPatient,
  onOpenSettings,
  onSignOut,
  intakeOpen,
  intakeAt,
  onIntakeOpenChange,
  children,
}: {
  user: AuthenticatedUser;
  practiceId: string | undefined;
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  onOpenPatient: (patientId: string) => void;
  /** Deep-links from the profile menu into a specific settings sub-module. */
  onOpenSettings: (section: 'staff' | 'security' | 'practice') => void;
  onSignOut: () => void;
  /** Lifted so the calendar's walk-in button can open the same modal. */
  intakeOpen: boolean;
  /** Slot time when opened from an empty calendar slot; otherwise now. */
  intakeAt?: Date | undefined;
  onIntakeOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Spec: logout "terminates the session with a confirmation prompt" — both
  // the sidebar entry and the profile menu route through this one dialog.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const requestSignOut = useCallback(() => setConfirmingSignOut(true), []);
  const { mode, setMode } = useTheme();

  const [toggles, setToggles] = useState<WorkspaceToggles>({
    available: true,
    // Spec: "All notification sounds shall be muted by default on first login."
    soundOn: false,
    staffAccess: true,
    assistantDoctorAccess: true,
  });

  const items = useMemo(() => visibleNavItems(user.permissions), [user.permissions]);
  const activeLabel = NAV_ITEMS.find((i) => i.key === active)?.label ?? '';
  const canAddPatient = user.permissions.includes(Permission.APPOINTMENT_WRITE);

  const setToggle = useCallback(
    (key: keyof WorkspaceToggles, value: boolean) => setToggles((t) => ({ ...t, [key]: value })),
    [],
  );

  const fromProfileMenu = useCallback(
    (target: 'profile' | 'staff' | 'security') => {
      if (target === 'profile') onNavigate('profile');
      else onOpenSettings(target);
    },
    [onNavigate, onOpenSettings],
  );

  return (
    <div className={styles.shell} data-collapsed={collapsed || undefined}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          ☰
        </button>
        <span className={styles.brand}>Cura</span>
        <span className={styles.crumb}>{activeLabel}</span>

        {practiceId && <UniversalSearch practiceId={practiceId} onOpenPatient={onOpenPatient} />}

        <span className={styles.spacer} />

        {practiceId && canAddPatient && (
          <button type="button" className={styles.cta} onClick={() => onIntakeOpenChange(true)}>
            + Add Patient
          </button>
        )}

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle colour theme"
          title="Toggle light / dark"
        >
          {mode === 'dark' ? '☀' : '☾'}
        </button>

        <HelpMenu />
        {practiceId && <NotificationBell practiceId={practiceId} />}

        <ProfileMenu
          user={user}
          toggles={toggles}
          onToggle={setToggle}
          onNavigate={fromProfileMenu}
          onSignOut={requestSignOut}
        />
      </header>

      {intakeOpen && practiceId && (
        <PatientIntakeModal
          practiceId={practiceId}
          doctorId={user.id}
          {...(intakeAt ? { defaultAt: intakeAt } : {})}
          onClose={() => onIntakeOpenChange(false)}
          onCreated={(patientId) => {
            onIntakeOpenChange(false);
            onOpenPatient(patientId);
          }}
        />
      )}

      <nav className={styles.sidebar} aria-label="Modules">
        <ul className={styles.navList}>
          {items.map((item, i) => (
            <Fragment key={item.key}>
              {item.group === 'network' && items[i - 1]?.group !== 'network' && (
                <li className={styles.navDivider} role="separator" />
              )}
              <NavButton
                item={item}
                active={item.key === active}
                collapsed={collapsed}
                onSelect={onNavigate}
              />
            </Fragment>
          ))}
          <li className={styles.navDivider} role="separator" />
          <li>
            <button
              type="button"
              className={styles.navItem}
              onClick={requestSignOut}
              title={collapsed ? 'Log out' : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                ⏻
              </span>
              {!collapsed && <span className={styles.navLabel}>Log out</span>}
            </button>
          </li>
        </ul>
      </nav>

      {confirmingSignOut && (
        <SignOutDialog onCancel={() => setConfirmingSignOut(false)} onConfirm={onSignOut} />
      )}

      <main className={styles.content}>{children}</main>
    </div>
  );
}
