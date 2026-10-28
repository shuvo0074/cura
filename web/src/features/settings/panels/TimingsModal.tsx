import { useState } from 'react';
import {
  Check,
  Field,
  Modal,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { DAYS, Session, TIME_OPTIONS, label12h } from './practice-shared';

/**
 * Edit Practice Timings.
 *
 * The reference UI edits one shared set of sessions applied to whichever days
 * are ticked, rather than a per-day grid. That matches how a chamber actually
 * runs — the same morning and evening shift most days — and collapses 7×N
 * pickers into N.
 */
export function TimingsModal({
  practiceId,
  sessions,
  onClose,
  onSaved,
}: {
  practiceId: string;
  sessions: Session[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();

  const [days, setDays] = useState<Set<number>>(() => new Set(sessions.map((x) => x.dayOfWeek)));
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }>>(() => {
    // Seed from the busiest day so an existing schedule round-trips unchanged
    // when the doctor only means to tick one more day.
    const counts = new Map<number, Session[]>();
    for (const x of sessions) counts.set(x.dayOfWeek, [...(counts.get(x.dayOfWeek) ?? []), x]);
    const busiest = [...counts.values()].sort((a, b) => b.length - a.length)[0];
    return busiest && busiest.length > 0
      ? busiest
          .slice()
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((x) => ({ startTime: x.startTime, endTime: x.endTime }))
      : [{ startTime: '09:00', endTime: '13:00' }];
  });

  const [problem, setProblem] = useState<string | null>(null);

  const setSlot = (i: number, patch: Partial<{ startTime: string; endTime: string }>) =>
    setSlots((list) => list.map((slot, index) => (index === i ? { ...slot, ...patch } : slot)));

  const validate = (): string | null => {
    if (days.size === 0) return 'Tick at least one practice day.';
    for (const slot of slots) {
      if (slot.endTime <= slot.startTime) {
        return `Session ${label12h(slot.startTime)} – ${label12h(slot.endTime)} ends before it starts.`;
      }
    }
    const ordered = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i]!.startTime < ordered[i - 1]!.endTime) {
        return 'Two sessions overlap. Adjust the times so they do not intersect.';
      }
    }
    return null;
  };

  const submit = async () => {
    // Checked client-side first so the doctor sees which session is at fault;
    // the server re-checks regardless, since this is a real invariant.
    const fault = validate();
    setProblem(fault);
    if (fault) return;

    const payload = [...days].flatMap((dayOfWeek) => slots.map((slot) => ({ dayOfWeek, ...slot })));
    const ok = await save.run('/settings/practice/sessions', {
      method: 'PUT',
      body: { practiceId, sessions: payload },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title="Edit Practice Timings"
      onClose={onClose}
      wide
      footer={
        <>
          {(problem ?? save.error) && (
            <span className={s.error} role="alert">
              {problem ?? save.error}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={save.busy}>
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className={s.dayRow}>
        {DAYS.map((day, index) => (
          <Check
            key={day}
            label={day}
            checked={days.has(index)}
            onChange={(on) =>
              setDays((set) => {
                const next = new Set(set);
                if (on) next.add(index);
                else next.delete(index);
                return next;
              })
            }
          />
        ))}
      </div>

      <div className={s.slotList}>
        {slots.map((slot, i) => (
          <div key={i} className={s.slotRow}>
            <Field label={`Session ${i + 1}`} required={i === 0}>
              <div className={s.slotTimes}>
                <select
                  className={s.input}
                  value={slot.startTime}
                  onChange={(e) => setSlot(i, { startTime: e.target.value })}
                  aria-label={`Session ${i + 1} start time`}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {label12h(t)}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">–</span>
                <select
                  className={s.input}
                  value={slot.endTime}
                  onChange={(e) => setSlot(i, { endTime: e.target.value })}
                  aria-label={`Session ${i + 1} end time`}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {label12h(t)}
                    </option>
                  ))}
                </select>
                {slots.length > 1 && (
                  <button
                    type="button"
                    className={s.iconButton}
                    onClick={() => setSlots((list) => list.filter((_, index) => index !== i))}
                    aria-label={`Remove session ${i + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </Field>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={s.linkButton}
        onClick={() => setSlots((list) => [...list, { startTime: '17:00', endTime: '21:00' }])}
      >
        add more timings
      </button>

      <p className={s.hint}>
        These sessions apply to every ticked day. Saving rebuilds the calendar&rsquo;s bookable slots immediately.
      </p>
    </Modal>
  );
}
