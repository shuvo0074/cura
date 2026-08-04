import { memo, useMemo, useState, type ReactNode } from 'react';
import type { AuthenticatedUser } from '@cura/shared';
import { useTheme } from '../../design/theme-provider';
import { NAV_ITEMS, visibleNavItems, type NavItem, type RouteKey } from './navigation';
import styles from './shell.module.css';

/**
 * Dashboard shell: fixed header, collapsible sidebar, content area.
 *
 * The sidebar is the app's map. Every module the API exposes appears here, and
 * items whose UI is incomplete say so on their own screen rather than being
 * hidden — a menu that quietly omits half the product is worse than one that is
 * honest about what is finished.
 */
export function AppShell({
  user,
  active,
  onNavigate,
  onSignOut,
  children,
}: {
  user: AuthenticatedUser;
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { mode, setMode } = useTheme();

  const items = useMemo(() => visibleNavItems(user.permissions), [user.permissions]);
  const activeLabel = NAV_ITEMS.find((i) => i.key === active)?.label ?? '';

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

        <span className={styles.spacer} />

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle colour theme"
          title="Toggle light / dark"
        >
          {mode === 'dark' ? '☀' : '☾'}
        </button>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {user.fullName.slice(0, 1)}
          </span>
          <span className={styles.userName}>{user.fullName}</span>
        </div>

        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <nav className={styles.sidebar} aria-label="Modules">
        <ul className={styles.navList}>
          {items.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={item.key === active}
              collapsed={collapsed}
              onSelect={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}

const NavButton = memo(function NavButton({
  item,
  active,
  collapsed,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onSelect: (key: RouteKey) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.navItem}
        data-active={active || undefined}
        onClick={() => onSelect(item.key)}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span className={styles.navIcon} aria-hidden="true">
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className={styles.navLabel}>{item.label}</span>
            {item.status !== 'ready' && (
              <span className={styles.navBadge} data-status={item.status}>
                {item.status === 'partial' ? 'part' : 'soon'}
              </span>
            )}
          </>
        )}
      </button>
    </li>
  );
});
