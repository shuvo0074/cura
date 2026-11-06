import type { ReactNode } from 'react';
import { useT } from '../i18n';
import styles from './ui.module.css';

export function SaveBar({
  onSave,
  busy,
  saved,
  error,
  dirty,
  label,
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
  const { t, tm } = useT();
  return (
    <footer className={styles.saveBar}>
      {children}
      {error && (
        <span className={styles.error} role="alert">
          {tm(error)}
        </span>
      )}
      {saved && !error && (
        <span className={styles.saved} role="status">
          {t('common.saved')}
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
        {busy ? t('common.saving') : (label ?? t('common.save'))}
      </button>
    </footer>
  );
}
