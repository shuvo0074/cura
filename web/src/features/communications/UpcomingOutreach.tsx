import { useState } from 'react';
import { Failed, Loading, uiStyles as s, useResource } from '../../ui';
import styles from './communications.module.css';

interface OutreachPatient {
  id: string;
  curaId: string;
  fullName: string;
  mobile: string;
  email: string | null;
}

interface UpcomingResponse {
  days: number;
  recallDays: number;
  /** Each list is capped at this many rows; `totals` is the full count. */
  limit: number;
  totals: { followUps: number; birthdays: number };
  followUps: Array<{ patient: OutreachPatient; dueDate: string; source: 'PRESCRIPTION' | 'RECALL' }>;
  birthdays: Array<{ patient: OutreachPatient; date: string; turning: number }>;
}

const WINDOWS = [7, 14, 30, 60, 90] as const;

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Follow-ups and birthdays falling inside the chosen window. */
export function UpcomingOutreach({
  practiceId,
  onOpenPatient,
}: {
  practiceId: string;
  onOpenPatient: (patientId: string) => void;
}) {
  const [days, setDays] = useState<number>(30);
  const { data, error, loading } = useResource<UpcomingResponse>('/engagement/upcoming', {
    practiceId,
    days: String(days),
  });

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  return (
    <>
      <label className={styles.window}>
        Next
        <select className={s.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {WINDOWS.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </label>

      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="followups-head">
          <h2 id="followups-head" className={styles.columnHead}>
            Follow-ups <span className={styles.count}>{data.totals.followUps}</span>
          </h2>
          <p className={s.muted}>
            Follow-up dates written on prescriptions, plus the {data.recallDays}-day preventive recall for patients
            not yet booked back in.
          </p>
          <Truncated shown={data.followUps.length} total={data.totals.followUps} />
          {data.followUps.length === 0 ? (
            <p className={styles.empty}>No follow-ups due in the next {data.days} days.</p>
          ) : (
            <ul className={styles.list}>
              {data.followUps.map((f) => (
                <OutreachRow
                  key={f.patient.id}
                  patient={f.patient}
                  date={f.dueDate}
                  tag={f.source === 'PRESCRIPTION' ? 'Prescribed' : `${data.recallDays}-day recall`}
                  tone={f.source === 'PRESCRIPTION' ? 'brand' : 'muted'}
                  onOpen={onOpenPatient}
                />
              ))}
            </ul>
          )}
        </section>

        <section className={styles.column} aria-labelledby="birthdays-head">
          <h2 id="birthdays-head" className={styles.columnHead}>
            Birthday wishes <span className={styles.count}>{data.totals.birthdays}</span>
          </h2>
          <p className={s.muted}>Patients with a date of birth on file whose birthday falls in this window.</p>
          <Truncated shown={data.birthdays.length} total={data.totals.birthdays} />
          {data.birthdays.length === 0 ? (
            <p className={styles.empty}>No birthdays in the next {data.days} days.</p>
          ) : (
            <ul className={styles.list}>
              {data.birthdays.map((b) => (
                <OutreachRow
                  key={b.patient.id}
                  patient={b.patient}
                  date={b.date}
                  tag={`Turns ${b.turning}`}
                  tone="warm"
                  onOpen={onOpenPatient}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** Says when a list is the first page of a longer one, soonest first. */
function Truncated({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return (
    <p className={s.muted}>
      Showing the {shown} soonest of {total.toLocaleString()}. Narrow the window to see the rest.
    </p>
  );
}

function OutreachRow({
  patient,
  date,
  tag,
  tone,
  onOpen,
}: {
  patient: OutreachPatient;
  date: string;
  tag: string;
  tone: 'brand' | 'muted' | 'warm';
  onOpen: (patientId: string) => void;
}) {
  return (
    <li className={styles.row}>
      <span className={styles.date}>{day(date)}</span>
      <button type="button" className={styles.who} onClick={() => onOpen(patient.id)}>
        <span className={styles.name}>{patient.fullName}</span>
        <span className={s.muted}>
          {patient.curaId} · {patient.mobile}
        </span>
      </button>
      <span className={styles.tag} data-tone={tone}>
        {tag}
      </span>
      <a className={s.linkButton} href={`tel:${patient.mobile}`}>
        Call
      </a>
    </li>
  );
}
