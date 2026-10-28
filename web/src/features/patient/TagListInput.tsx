import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../app/services';
import styles from './patient.module.css';

/**
 * Chip list backed by a clinical-note catalog.
 *
 * Enter commits the typed text; the dropdown offers matches from the catalog
 * for this field only. Free text is always allowed — a doctor mid-consultation
 * must never be blocked because a term is not yet catalogued.
 */
export function TagListInput({
  label,
  practiceId,
  catalogKind,
  placeholder,
  values,
  disabled,
  onChange,
}: {
  label: string;
  practiceId: string;
  catalogKind: string;
  placeholder?: string;
  values: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const { http } = useServices();
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string, signal: AbortSignal) => {
      const result = await http.request<Array<{ id: string; value: string }>>('/settings/catalog', {
        query: { practiceId, kind: catalogKind, q },
        signal,
      });
      if (signal.aborted || !result.ok) return;
      // Already-chosen entries are filtered out so the list never offers a duplicate.
      setSuggestions(result.value.map((r) => r.value).filter((v) => !values.includes(v)));
      setOpen(true);
    },
    [http, practiceId, catalogKind, values],
  );

  useEffect(() => {
    if (term.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => void search(term.trim(), controller.signal), 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setTerm('');
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className={styles.field} ref={box}>
      <span className={styles.label}>{label}</span>

      {values.length > 0 && (
        <ul className={styles.chips}>
          {values.map((value) => (
            <li key={value} className={styles.chip}>
              {value}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.suggestBox}>
        <input
          className={styles.input}
          disabled={disabled}
          value={term}
          placeholder={placeholder ?? ''}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(term);
            }
          }}
        />
        {open && suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.slice(0, 8).map((s) => (
              <li key={s}>
                <button type="button" onClick={() => commit(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
