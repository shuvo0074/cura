import styles from './ui.module.css';

/** Standard Cancel / Save pair for a dialog footer. */
export function ModalActions({
  error,
  busy,
  onCancel,
  onSave,
  saveLabel = 'Save',
}: {
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  return (
    <>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      <button type="button" className={styles.secondary} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className={styles.primary} onClick={onSave} disabled={busy}>
        {busy ? 'Saving…' : saveLabel}
      </button>
    </>
  );
}
