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

import { PracticeSettings } from './practice-ops-shared';
import { summarise } from './practice-ops-shared';

export function CalendarSettingsPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const staff = useResource<Array<{ userId: string; fullName: string; role: string; isActive: boolean }>>(
    '/settings/staff',
    { practiceId },
  );
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
    <Panel title="Calendar" description="Display defaults and the appointment duration used across the practice.">
      <Check
        label="Always show today as the first day on my calendar"
        checked={value.showTodayFirst}
        onChange={(v) => setDraft((d) => ({ ...d, showTodayFirst: v }))}
      />

      <Row cols={1}>
        <Field label="Default appointment duration">
          <select
            className={s.input}
            value={value.slotMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, slotMinutes: Number(e.target.value) }))}
          >
            {[5, 10, 15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <h3 className={s.subtitle}>Practice and doctors</h3>
      <p className={s.hint}>
        Work timings are pulled from Practice Details. Edit them there and the calendar&rsquo;s slots follow.
      </p>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Practice and doctors</th>
            <th>Work timings</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Practice &mdash; {data.name}</td>
            <td>{summarise(data.sessions)}</td>
          </tr>
          {(staff.data ?? [])
            .filter((member) => member.isActive)
            .map((member) => (
              <tr key={member.userId}>
                <td>{member.fullName}</td>
                <td>{summarise(data.sessions)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />
    </Panel>
  );
}
