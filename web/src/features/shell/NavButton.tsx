import { memo } from 'react';
import {  type NavItem, type RouteKey } from './navigation';
import styles from './shell.module.css';

export const NavButton = memo(function NavButton({
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
