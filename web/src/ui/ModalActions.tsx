import { useT } from '../i18n';
import styles from './ui.module.css';

/** Standard Cancel / Save pair for a dialog footer. */
export function ModalActions({
  error,
  busy,
  onCancel,
  onSave,
  saveLabel,
}: {
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  const { t, tm } = useT();
  return (
    <>
      {error && (
        <span className={styles.error} role="alert">
          {tm(error)}
        </span>
      )}
      <button type="button" className={styles.secondary} onClick={onCancel}>
        {t('common.cancel')}
      </button>
      <button type="button" className={styles.primary} onClick={onSave} disabled={busy}>
        {busy ? t('common.saving') : (saveLabel ?? t('common.save'))}
      </button>
    </>
  );
}
