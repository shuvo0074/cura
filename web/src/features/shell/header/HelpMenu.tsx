import {  useState } from 'react';
import styles from './header.module.css';

import { useDismiss } from './header-shared';

/** Support & Guidance (spec 2.1.5). */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setOpen((o) => !o)}
        aria-label="Help and support"
        aria-expanded={open}
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Help and support">
          <header className={styles.popoverHead}>Support &amp; guidance</header>
          <ul className={styles.menuList}>
            <li>
              <a href="tel:+8809600000000" className={styles.menuItem}>
                <strong>Urgent support</strong>
                <span>Hotline for system failures — bypasses the queue.</span>
              </a>
            </li>
            <li>
              <a href="mailto:support@cura.health" className={styles.menuItem}>
                <strong>Live chat &amp; tickets</strong>
                <span>General questions while you work.</span>
              </a>
            </li>
            <li>
              <a href="mailto:support@cura.health?subject=Schedule%20support%20time" className={styles.menuItem}>
                <strong>Schedule support time</strong>
                <span>Book a 15-minute walkthrough.</span>
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
