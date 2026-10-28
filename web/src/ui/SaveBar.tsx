import type { ReactNode } from 'react';
import styles from './ui.module.css';

export function SaveBar({
  onSave,
  busy,
  saved,
  error,
  dirty,
  label = 'Save',
  children,
}: {
  onSave: () => void;
  busy: boolean;
  saved: boolean;
  error: string | null;
  dirty: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <footer className={styles.saveBar}>
      {children}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      {saved && !error && (
        <span className={styles.saved} role="status">
          Saved
        </span>
      )}
      <button
        type="button"
        className={styles.primary}
        onClick={onSave}
        // Disabling on a clean form is what makes "Saved" meaningful — without
        // it, re-clicking Save flashes the same confirmation for a no-op write.
        disabled={busy || !dirty}
      >
        {busy ? 'Saving…' : label}
      </button>
    </footer>
  );
}
