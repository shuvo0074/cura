import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../ui';
import { useT } from '../../i18n';
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
  const { t, tm, fmt } = useT();

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
      setError(t('calendar.block.needReason'));
      return;
    }

    // All-day blocks run to the end of the last selected day, so a single-date
    // block is a full day rather than a zero-length range.
    const startsAt = allDay ? new Date(`${from}T00:00:00`) : new Date(`${from}T${startTime}:00`);
    const endsAt = allDay
      ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000)
      : new Date(`${from}T${endTime}:00`);

    if (endsAt <= startsAt) {
      setError(t('calendar.block.endAfterStart'));
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
      title={t('calendar.block.title')}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.close')}
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? t('calendar.block.blocking') : t('calendar.block.block')}
          </button>
        </>
      }
    >
      <p className={s.hint}>
        {t('calendar.block.intro')}
      </p>

      <Field label={t('calendar.block.details')} required>
        <input
          className={s.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('calendar.block.placeholder')}
        />
      </Field>

      <div className={styles.blockModes} role="radiogroup" aria-label={t('calendar.block.type')}>
        <label>
          <input type="radio" checked={allDay} onChange={() => setAllDay(true)} />
          {t('calendar.block.allDay')}
        </label>
        <label>
          <input type="radio" checked={!allDay} onChange={() => setAllDay(false)} />
          {t('calendar.block.timeSlot')}
        </label>
      </div>

      {allDay ? (
        <Row cols={2}>
          <Field label={t('calendar.block.from')} required>
            <input className={s.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('calendar.block.to')} required>
            <input className={s.input} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </Row>
      ) : (
        <Row>
          <Field label={t('calendar.block.date')} required>
            <input className={s.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('calendar.block.start')} required>
            <input className={s.input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label={t('calendar.block.end')} required>
            <input className={s.input} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </Row>
      )}

      <h4 className={s.subtitle}>{t('calendar.block.existing')}</h4>
      {closures.length === 0 ? (
        <p className={s.muted}>{t('calendar.block.none')}</p>
      ) : (
        <ul className={styles.blockList}>
          {closures.map((c) => (
            <li key={c.id}>
              <span>{c.reason ?? t('calendar.blocked')}</span>
              <span className={styles.blockDates}>
                {fmt.dateTime(c.startsAt)} → {fmt.dateTime(c.endsAt)}
              </span>
              <button type="button" className={s.linkDanger} onClick={() => void remove(c.id)}>
                {t('calendar.block.unblock')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
