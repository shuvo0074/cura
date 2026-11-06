import { useState } from 'react';
import {
  Check,
  Failed,
  Field,
  Loading,
  Panel,
  Row,
  SaveBar,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { PracticeSettings } from './practice-ops-shared';
import { summarise } from './practice-ops-shared';

export function CalendarSettingsPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const staff = useResource<Array<{ userId: string; fullName: string; role: string; isActive: boolean }>>(
    '/settings/staff',
    { practiceId },
  );
  const { t, locale } = useT();
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<PracticeSettings>>({});

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const value = { ...data, ...draft };
  const dirty = Object.keys(draft).length > 0;

  const submit = async () => {
    const ok = await save.run('/settings/calendar', { method: 'PUT', body: { practiceId, ...draft } });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  return (
    <Panel title={t('settings.nav.calendar')} description={t('settings.calendar.description')}>
      <Check
        label={t('settings.calendar.showToday')}
        checked={value.showTodayFirst}
        onChange={(v) => setDraft((d) => ({ ...d, showTodayFirst: v }))}
      />

      <Row cols={1}>
        <Field label={t('settings.calendar.defaultDuration')}>
          <select
            className={s.input}
            value={value.slotMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, slotMinutes: Number(e.target.value) }))}
          >
            {[5, 10, 15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {t('settings.calendar.minutes', { count: n })}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <h3 className={s.subtitle}>{t('settings.calendar.practiceAndDoctors')}</h3>
      <p className={s.hint}>{t('settings.calendar.timingsHint')}</p>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('settings.calendar.practiceAndDoctors')}</th>
            <th>{t('settings.calendar.workTimings')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('settings.calendar.practiceRow', { name: data.name })}</td>
            <td>{summarise(data.sessions, locale)}</td>
          </tr>
          {(staff.data ?? [])
            .filter((member) => member.isActive)
            .map((member) => (
              <tr key={member.userId}>
                <td>{member.fullName}</td>
                <td>{summarise(data.sessions, locale)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />
    </Panel>
  );
}
