import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useServices } from '../../app/services';
import styles from './settings.module.css';

/**
 * Shared plumbing for the thirteen settings panels.
 *
 * Each panel is a form over one endpoint, so the fetch/dirty/save/error cycle
 * is identical everywhere. Factoring it here keeps the panels themselves as
 * markup, which is the only part that actually differs between them.
 */

/** Loads once, exposes the row and a reload. Aborts in flight on unmount. */
export function useResource<T>(path: string, query: Record<string, string | undefined>) {
  const { http } = useServices();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // The query object is a fresh literal on every render; serialising it is what
  // keeps `load` stable and stops the effect from looping forever.
  const key = JSON.stringify(query);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const result = await http.request<T>(path, {
        query: JSON.parse(key) as Record<string, string>,
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;
      setLoading(false);
      if (result.ok) {
        setData(result.value);
        setError(null);
      } else {
        setError(result.error.message);
      }
    },
    [http, path, key],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

/** Wraps a mutation with pending/error/"Saved" state for the panel footer. */
export function useMutation() {
  const { http } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(
    async (
      path: string,
      init: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string> },
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const result = await http.request(path, { ...init, retry: false });
      setBusy(false);

      if (!result.ok) {
        setError(result.error.message);
        return false;
      }

      setSavedAt(Date.now());
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSavedAt(0), 2500);
      return true;
    },
    [http],
  );

  return { run, busy, error, saved: savedAt !== 0 };
}

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

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function Row({ children, cols = 3 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div className={styles.row} data-cols={cols}>
      {children}
    </div>
  );
}

export function Check({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled ?? false}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className={styles.checkLabel}>{label}</span>
        {description && <span className={styles.checkHint}>{description}</span>}
      </span>
    </label>
  );
}

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

/** Modal dialog. Escape closes; focus moves in on open and back out on close. */
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

export function Loading() {
  return <p className={styles.muted}>Loading…</p>;
}

export function Failed({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}

export { styles as panelStyles };
