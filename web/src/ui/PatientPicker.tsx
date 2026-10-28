import { useCallback, useEffect, useState } from 'react';
import type { Patient } from '@cura/shared';
import { useServices } from '../app/services';
import styles from './ui.module.css';

export interface PickedPatient {
  id: string;
  fullName: string;
}

/**
 * Debounced patient search resolving to one selection.
 *
 * Shared by every screen that has to attach something to a patient — billing,
 * documents, intake. They had drifted into three near-identical copies.
 */
export function PatientPicker({
  practiceId,
  value,
  onChange,
  placeholder = 'Search patients…',
}: {
  practiceId: string;
  value: PickedPatient | null;
  onChange: (next: PickedPatient | null) => void;
  placeholder?: string;
}) {
  const { http } = useServices();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Patient[]>([]);

  const search = useCallback(
    async (q: string, signal: AbortSignal) => {
      const result = await http.request<Patient[]>('/patients/search', {
        query: { practiceId, q },
        signal,
      });
      if (!signal.aborted && result.ok) setHits(result.value);
    },
    [http, practiceId],
  );

  useEffect(() => {
    if (value || term.trim().length < 3) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => void search(term.trim(), controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, value, search]);

  if (value) {
    return (
      <div className={styles.chosen}>
        <span>{value.fullName}</span>
        <button type="button" className={styles.linkButton} onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pickerBox}>
      <input
        className={styles.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        aria-label="Search patients"
      />
      {hits.length > 0 && (
        <ul className={styles.pickerResults}>
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={(e) => {
                  // Callers wrap the picker in a <Field>, which is a <label>.
                  // Without this the label's activation re-dispatches the click
                  // to the "Change" button rendered in its place, instantly
                  // clearing the choice.
                  e.preventDefault();
                  onChange({ id: p.id, fullName: p.fullName });
                }}
              >
                <strong>{p.fullName}</strong>
                <span>
                  {p.curaId} · {p.mobile}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
