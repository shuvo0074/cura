import { useMemo } from 'react';
import {
  uiStyles as s,
} from '../../../ui';

import { DAYS, Session, label12h } from './practice-shared';
import { useT } from '../../../i18n';

export function SessionSummary({ sessions }: { sessions: Session[] }) {
  const { t, locale } = useT();
  const byDay = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const session of sessions) {
      map.set(session.dayOfWeek, [...(map.get(session.dayOfWeek) ?? []), session]);
    }
    return map;
  }, [sessions]);

  if (sessions.length === 0) {
    return <p className={s.muted}>{t('settings.practice.noDays')}</p>;
  }

  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>{t('settings.practice.day')}</th>
          <th>{t('settings.practice.sessions')}</th>
        </tr>
      </thead>
      <tbody>
        {DAYS.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <tr key={day}>
              <td>{t(`settings.day.${day}`)}</td>
              <td className={list.length === 0 ? s.mutedCell : undefined}>
                {list.length === 0
                  ? t('settings.practice.closed')
                  : list
                      .slice()
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((x) => `${label12h(x.startTime, locale)} – ${label12h(x.endTime, locale)}`)
                      .join(',  ')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
