import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** Titled panel with an optional header action. */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panelBody}>
      <header className={styles.panelHead}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.hint}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
