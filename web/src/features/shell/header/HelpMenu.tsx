import {  useState } from 'react';
import { useT } from '../../../i18n';
import styles from './header.module.css';

import { useDismiss } from './header-shared';

/** Support & Guidance (spec 2.1.5). */
export function HelpMenu() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('shell.help.label')}
        aria-expanded={open}
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={t('shell.help.label')}>
          <header className={styles.popoverHead}>{t('shell.help.title')}</header>
          <ul className={styles.menuList}>
            <li>
              <a href="tel:+8809600000000" className={styles.menuItem}>
                <strong>{t('shell.help.urgent')}</strong>
                <span>{t('shell.help.urgentHint')}</span>
              </a>
            </li>
            <li>
              <a href="mailto:support@cura.health" className={styles.menuItem}>
                <strong>{t('shell.help.chat')}</strong>
                <span>{t('shell.help.chatHint')}</span>
              </a>
            </li>
            <li>
              <a href="mailto:support@cura.health?subject=Schedule%20support%20time" className={styles.menuItem}>
                <strong>{t('shell.help.schedule')}</strong>
                <span>{t('shell.help.scheduleHint')}</span>
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
