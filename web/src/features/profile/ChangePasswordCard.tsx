import { useState } from 'react';
import { Field, Panel, Row, SaveBar, uiStyles as s, useMutation } from '../../ui';

/**
 * Password change.
 *
 * A successful change invalidates every issued token, including this tab's —
 * so the outcome is stated plainly rather than letting the user discover it as
 * a surprise logout on their next click.
 */
export function ChangePasswordCard() {
  const mutate = useMutation();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    setNote(null);
    if (form.next !== form.confirm) {
      setNote('The two new passwords do not match.');
      return;
    }
    const ok = await mutate.run('/account/password', {
      method: 'POST',
      body: { currentPassword: form.current, newPassword: form.next },
    });
    if (ok) {
      setForm({ current: '', next: '', confirm: '' });
      setNote('Password changed. Every other signed-in session has been ended.');
    }
  };

  return (
    <Panel title="Change password" description="At least 10 characters with a letter, a digit and a symbol.">
      <Row>
        <Field label="Current password">
          <input
            className={s.input}
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
          />
        </Field>
        <Field label="New password">
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
        </Field>
      </Row>

      <SaveBar
        onSave={() => void submit()}
        busy={mutate.busy}
        saved={false}
        error={mutate.error ?? note}
        dirty={form.current !== '' && form.next !== ''}
        label="Change password"
      />
    </Panel>
  );
}
