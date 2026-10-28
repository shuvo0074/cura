import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../ui';
import styles from './calendar.module.css';

interface Closure {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

const isoDate = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/**
 * Block Calendar (spec 6.6.c.1.4.4 — Off-Day & Leave Management).
 *
 * A block overrides the weekly session grid for its span, so no slot is
 * bookable on those days. All-day blocks cover whole dates; a slot block takes
 * a time range out of a single day.
 */
export function BlockCalendarDialog({
  practiceId,
  onClose,
  onChanged,
}: {
  practiceId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { http } = useServices();

  const [closures, setClosures] = useState<Closure[]>([]);
  const [allDay, setAllDay] = useState(true);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState(() => isoDate(new Date()));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    // A year either side: enough to show existing leave without paging.
    const now = new Date();
    const result = await http.request<Closure[]>('/settings/practice/closures', {
      query: {
        practiceId,
        from: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString(),
        to: new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString(),
      },
    });
    if (result.ok) setClosures(result.value);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  const submit = async () => {
    if (!reason.trim()) {
      setError('Enter a reason — it appears on the blocked slot.');
      return;
    }

    // All-day blocks run to the end of the last selected day, so a single-date
    // block is a full day rather than a zero-length range.
    const startsAt = allDay ? new Date(`${from}T00:00:00`) : new Date(`${from}T${startTime}:00`);
    const endsAt = allDay
      ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000)
      : new Date(`${from}T${endTime}:00`);

    if (endsAt <= startsAt) {
      setError('The block must end after it starts.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await http.request('/settings/practice/closures', {
      method: 'POST',
      body: {
        practiceId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allDay,
        reason: reason.trim(),
      },
      retry: false,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setReason('');
    await load();
    onChanged();
  };

  const remove = async (id: string) => {
    const result = await http.request(`/settings/practice/closures/${id}`, {
      method: 'DELETE',
      query: { practiceId },
      retry: false,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await load();
    onChanged();
  };

  return (
    <Modal
      title="Block Calendar"
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Close
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? 'Blocking…' : 'Block'}
          </button>
        </>
      }
    >
      <p className={s.hint}>
        Block the calendar for leave or personal reasons. Patients cannot be booked into a blocked
        period, and existing appointments are left untouched so nothing disappears silently.
      </p>

      <Field label="Leave details" required>
        <input
          className={s.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Eid holiday, conference, personal leave"
        />
      </Field>

      <div className={styles.blockModes} role="radiogroup" aria-label="Block type">
        <label>
          <input type="radio" checked={allDay} onChange={() => setAllDay(true)} />
          All day
        </label>
        <label>
          <input type="radio" checked={!allDay} onChange={() => setAllDay(false)} />
          Time slot
        </label>
      </div>

      {allDay ? (
        <Row cols={2}>
          <Field label="From" required>
            <input className={s.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" required>
            <input className={s.input} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </Row>
      ) : (
        <Row>
          <Field label="Date" required>
            <input className={s.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Start" required>
            <input className={s.input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End" required>
            <input className={s.input} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </Row>
      )}

      <h4 className={s.subtitle}>Existing blocks</h4>
      {closures.length === 0 ? (
        <p className={s.muted}>Nothing blocked.</p>
      ) : (
        <ul className={styles.blockList}>
          {closures.map((c) => (
            <li key={c.id}>
              <span>{c.reason ?? 'Blocked'}</span>
              <span className={styles.blockDates}>
                {new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}
              </span>
              <button type="button" className={s.linkDanger} onClick={() => void remove(c.id)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
