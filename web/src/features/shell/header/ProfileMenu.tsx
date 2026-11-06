import { useEffect, useState } from 'react';
import {  type AuthenticatedUser } from '@cura/shared';
import { useServices } from '../../../app/services';
import { openWebsite } from '../../../app/handoff';
import { LanguageSwitch, useT } from '../../../i18n';
import styles from './header.module.css';

import { Switch } from './ToggleSwitch';
import { WorkspaceToggles, useDismiss } from './header-shared';

/**
 * Doctor profile dropdown (spec 2.1.4 / "Doctor Profile Identification").
 *
 * The four quick-toggles are workspace-local preferences held in the shell.
 * Staff and assistant access are shown here as the spec describes, but flipping
 * them is a real revocation — so they route to Practice Staff rather than
 * pretending a header switch has already applied it.
 */
export function ProfileMenu({
  user,
  toggles,
  onToggle,
  onNavigate,
  onSignOut,
  onShowSetupChecklist,
}: {
  user: AuthenticatedUser;
  toggles: WorkspaceToggles;
  onToggle: (key: keyof WorkspaceToggles, value: boolean) => void;
  onNavigate: (target: 'profile' | 'staff' | 'security') => void;
  onSignOut: () => void;
  /** Clinic owners only: brings back the "Get your clinic ready" card. */
  onShowSetupChecklist?: () => void;
}) {
  const { auth } = useServices();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  // Coming back with the browser's Back button restores this page as it was left.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => event.persisted && setLeaving(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const go = (target: 'profile' | 'staff' | 'security') => {
    setOpen(false);
    onNavigate(target);
  };

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.profileButton}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('shell.menu.accountMenu')}
      >
        <span className={styles.avatar} aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.fullName.slice(0, 1)}
          <span className={styles.presence} data-on={toggles.available || undefined} />
        </span>
        <span className={styles.userName}>{user.fullName}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={styles.popover} data-wide role="dialog" aria-label={t('shell.menu.account')}>
          <header className={styles.popoverHead}>
            {user.fullName}
            <span>{user.email ?? user.mobile ?? ''}</span>
          </header>

          <div className={styles.switches}>
            <Switch
              label={t('shell.menu.available')}
              hint={t('shell.menu.availableHint')}
              checked={toggles.available}
              onChange={(v) => onToggle('available', v)}
            />
            <Switch
              label={t('shell.menu.sound')}
              checked={toggles.soundOn}
              onChange={(v) => onToggle('soundOn', v)}
            />
          </div>

          <div className={styles.languageRow}>
            <span>{t('shell.menu.language')}</span>
            <LanguageSwitch signedIn />
          </div>

          <ul className={styles.menuList}>
            <li>
              <button type="button" className={styles.menuItem} onClick={() => go('profile')}>
                <strong>{t('shell.menu.profile')}</strong>
                <span>{t('shell.menu.profileHint')}</span>
              </button>
            </li>
            <li>
              <button type="button" className={styles.menuItem} onClick={() => go('staff')}>
                <strong>{t('shell.menu.staff')}</strong>
                <span>{toggles.staffAccess ? t('shell.menu.staffEnabled') : t('shell.menu.staffRestricted')}</span>
              </button>
            </li>
            {onShowSetupChecklist && (
              <li>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setOpen(false);
                    onShowSetupChecklist();
                  }}
                >
                  <strong>{t('shell.menu.setup')}</strong>
                  <span>{t('shell.menu.setupHint')}</span>
                </button>
              </li>
            )}
            <li>
              <button type="button" className={styles.menuItem} onClick={() => go('security')}>
                <strong>{t('shell.menu.security')}</strong>
                <span>{t('shell.menu.securityHint')}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.menuItem}
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void openWebsite(auth);
                }}
              >
                <strong>{leaving ? t('shell.menu.websiteOpening') : t('shell.menu.website')}</strong>
                <span>{t('shell.menu.websiteHint')}</span>
              </button>
            </li>
            <li>
              <button type="button" className={styles.menuItem} data-danger onClick={onSignOut}>
                <strong>{t('shell.menu.logOut')}</strong>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
