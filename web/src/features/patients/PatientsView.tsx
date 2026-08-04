import { useCallback, useEffect, useMemo, useState } from 'react';
import { ageFromDateOfBirth, initials, type Patient } from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './patients.module.css';

type Filter = 'all' | 'recent';

/**
 * Patient directory (spec: Patient Module).
 *
 * Search runs server-side once past the minimum query length, so the list is
 * never filtered client-side over a partial page — with thousands of patients
 * that would show the wrong answer confidently.
 */
export function PatientsView({
  practiceId,
  onOpenPatient,
}: {
  practiceId: string;
  onOpenPatient: (patientId: string) => void;
}) {
  const { http } = useServices();
  const [rows, setRows] = useState<Patient[]>([]);
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (search: string, signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      const trimmed = search.trim();
      const result =
        trimmed.length >= 3
          ? await http.request<Patient[]>('/patients/search', {
              query: { practiceId, q: trimmed },
              signal,
            })
          : await http.request<{ items: Patient[] }>('/patients', {
              query: { practiceId, limit: 50 },
              signal,
            });

      if (signal.aborted) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRows(Array.isArray(result.value) ? result.value : result.value.items);
    },
    [http, practiceId],
  );

  // Debounced so typing does not fire a request per keystroke; the controller
  // is aborted on the next keystroke so a slow earlier response cannot land
  // after a newer one.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(term, controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, load]);

  const visible = useMemo(() => {
    if (filter !== 'recent') return rows;
    const cutoff = Date.now() - 7 * 86_400_000;
    return rows.filter((r) => r.lastVisitAt && new Date(r.lastVisitAt).getTime() >= cutoff);
  }, [rows, filter]);

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <input
          className={styles.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by phone number, name, or ID…"
          aria-label="Search patients"
        />
        <div className={styles.filters} role="tablist" aria-label="Filter">
          {(['all', 'recent'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              data-active={filter === f || undefined}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : 'Recent (7d)'}
            </button>
          ))}
        </div>
        <span className={styles.count}>{visible.length} patients</span>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className={styles.muted}>Loading…</p>
      ) : visible.length === 0 ? (
        <p className={styles.muted}>
          {term.trim().length >= 3 ? 'No patients match that search.' : 'No patients yet.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onOpenPatient(patient.id)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {initials(patient.fullName)}
                </span>
                <span className={styles.main}>
                  <span className={styles.name}>{patient.fullName}</span>
                  <span className={styles.meta}>
                    {patient.curaId} · {patient.mobile}
                  </span>
                </span>
                <span className={styles.demo}>
                  {[
                    ageFromDateOfBirth(patient.dateOfBirth) !== null
                      ? `${ageFromDateOfBirth(patient.dateOfBirth)} yrs`
                      : null,
                    patient.gender
                      ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()
                      : null,
                    patient.bloodGroup,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {!patient.profileComplete && (
                  <span className={styles.incomplete} title="Profile incomplete">
                    incomplete
                  </span>
                )}
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
