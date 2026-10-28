import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ui.module.css';

/** Dialog. Escape closes; focus enters on open and returns to the opener. */
export function Modal({
  title,
  onClose,
  footer,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={styles.modal}
        data-wide={wide || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHead}>
          <h3>{title}</h3>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
        {footer && <footer className={styles.modalFoot}>{footer}</footer>}
      </div>
    </div>
  );
}
