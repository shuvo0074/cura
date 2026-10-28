import { useEffect, useMemo, useRef, useState } from 'react';
import { ageFromDateOfBirth, businessRules, initials, type Patient } from '@cura/shared';
import { useServices } from '../../../app/services';
import styles from './header.module.css';

/**
 * Universal search (spec 2.1.1).
 *
 * Recognises a mobile number, a Cura ID, a name or an email — the server sorts
 * that out, so there is no client-side guessing at intent. The placeholder
 * leads with "phone number" deliberately: it is the only strictly unique
 * identifier a patient can recite, and biasing towards it yields the fewest
 * ambiguous hits.
 */
export function UniversalSearch({
  practiceId,
  onOpenPatient,
}: {
  practiceId: string;
  onOpenPatient: (patientId: string) => void;
}) {
  const { http } = useServices();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const minLength = businessRules.search.minQueryLength;
  const ready = term.trim().length >= minLength;

  useEffect(() => {
    if (!ready) {
      setHits([]);
      return;
    }

    const controller = new AbortController();
    // Debounced, and the previous request is aborted on each keystroke so a
    // slow earlier response cannot overwrite a newer one.
    const timer = setTimeout(async () => {
      setBusy(true);
      const result = await http.request<Patient[]>('/patients/search', {
        query: { practiceId, q: term.trim() },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setBusy(false);
      if (result.ok) {
        setHits(result.value);
        setOpen(true);
        setCursor(-1);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, ready, http, practiceId]);

  // Clicking anywhere else dismisses the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (patient: Patient) => {
    setOpen(false);
    setTerm('');
    onOpenPatient(patient.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? hits.length - 1 : c - 1));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      choose(hits[cursor]!);
    }
  };

  const status = useMemo(() => {
    if (!ready) return `Type at least ${minLength} characters.`;
    if (busy) return 'Searching…';
    return hits.length === 0 ? 'No patients found.' : null;
  }, [ready, busy, hits.length, minLength]);

  return (
    <div className={styles.search} ref={boxRef}>
      <span className={styles.searchIcon} aria-hidden="true">
        ⌕
      </span>
      <input
        className={styles.searchInput}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= minLength && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search by Phone Number, Name, or ID…"
        aria-label="Search patients"
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        aria-controls="universal-search-results"
      />

      {open && (
        <ul className={styles.results} id="universal-search-results" role="listbox">
          {status ? (
            <li className={styles.resultEmpty}>{status}</li>
          ) : (
            hits.map((patient, index) => {
              const age = ageFromDateOfBirth(patient.dateOfBirth);
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={cursor === index}
                    data-cursor={cursor === index || undefined}
                    className={styles.result}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => choose(patient)}
                  >
                    <span className={styles.resultAvatar} aria-hidden="true">
                      {initials(patient.fullName)}
                    </span>
                    <span className={styles.resultMain}>
                      <span className={styles.resultName}>{patient.fullName}</span>
                      {/* Name, ID and age/gender together: a shared family
                          number returns several profiles, and this is what the
                          doctor verifies before opening the wrong record. */}
                      <span className={styles.resultMeta}>
                        {[patient.curaId, patient.mobile, age !== null ? `${age} yrs` : null, patient.gender]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
