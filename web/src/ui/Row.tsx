import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** Responsive field row; collapses to one column on narrow viewports. */
export function Row({ children, cols = 3 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div className={styles.row} data-cols={cols}>
      {children}
    </div>
  );
}
