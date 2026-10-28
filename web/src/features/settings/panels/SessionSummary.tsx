import { useMemo } from 'react';
import {
  uiStyles as s,
} from '../../../ui';

import { DAYS, Session, label12h } from './practice-shared';

export function SessionSummary({ sessions }: { sessions: Session[] }) {
  const byDay = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const session of sessions) {
      map.set(session.dayOfWeek, [...(map.get(session.dayOfWeek) ?? []), session]);
    }
    return map;
  }, [sessions]);

  if (sessions.length === 0) {
    return <p className={s.muted}>No practice days configured — the calendar will show no bookable slots.</p>;
  }

  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>Day</th>
          <th>Sessions</th>
        </tr>
      </thead>
      <tbody>
        {DAYS.map((day, index) => {
          const list = byDay.get(index) ?? [];
          return (
            <tr key={day}>
              <td>{day}</td>
              <td className={list.length === 0 ? s.mutedCell : undefined}>
                {list.length === 0
                  ? 'Closed'
                  : list
                      .slice()
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((x) => `${label12h(x.startTime)} – ${label12h(x.endTime)}`)
                      .join(',  ')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
