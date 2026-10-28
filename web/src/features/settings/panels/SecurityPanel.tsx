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

import { AccountProfile, PracticeSettings } from './practice-ops-shared';

export function SecurityPanel({ practiceId }: { practiceId: string }) {
  const practice = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const account = useResource<AccountProfile>('/account/profile', {});
  const mutate = useMutation();
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [passwordNote, setPasswordNote] = useState<string | null>(null);

  if (practice.loading && !practice.data) return <Loading />;
  if (practice.error && !practice.data) return <Failed message={practice.error} />;
  if (!practice.data) return null;

  const setFlag = async (key: 'hideCancelledInvoices' | 'hideCancelledPayments', value: boolean) => {
    await mutate.run('/settings/security', { method: 'PUT', body: { practiceId, [key]: value } });
    await practice.reload();
  };

  const setTwoFactor = async (enabled: boolean) => {
    await mutate.run('/account/two-factor', { method: 'PUT', body: { enabled } });
    await account.reload();
  };

  const changePassword = async () => {
    setPasswordNote(null);
    if (password.next !== password.confirm) {
      setPasswordNote('The two new passwords do not match.');
      return;
    }
    const ok = await mutate.run('/account/password', {
      method: 'POST',
      body: { currentPassword: password.current, newPassword: password.next },
    });
    if (ok) {
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordNote('Password changed. Every other signed-in session has been ended.');
    }
  };

  const canEnable2fa = (account.data?.mobileVerified ?? false) || (account.data?.emailVerified ?? false);

  return (
    <Panel title="Data Security" description="Account protection and record visibility.">
      <h3 className={s.subtitle}>Two-factor authentication</h3>
      <Check
        label="Require a one-time code when signing in from a new device"
        description={
          canEnable2fa
            ? 'A 6-digit code is sent to your verified mobile number or email address.'
            : 'Verify your mobile number or email address first — otherwise this would lock you out.'
        }
        checked={account.data?.twoFactorEnabled ?? false}
        disabled={!canEnable2fa}
        onChange={(v) => void setTwoFactor(v)}
      />

      <h3 className={s.subtitle}>Record visibility</h3>
      <Check
        label="Hide cancelled invoices"
        description="Voided invoices stay in the audit trail but drop out of listings and reports."
        checked={practice.data.hideCancelledInvoices}
        onChange={(v) => void setFlag('hideCancelledInvoices', v)}
      />
      <Check
        label="Hide cancelled payments"
        checked={practice.data.hideCancelledPayments}
        onChange={(v) => void setFlag('hideCancelledPayments', v)}
      />

      <h3 className={s.subtitle}>Change password</h3>
      <Row>
        <Field label="Current password">
          <input
            className={s.input}
            type="password"
            autoComplete="current-password"
            value={password.current}
            onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
          />
        </Field>
        <Field label="New password" hint="At least 10 characters with a letter, a digit and a symbol.">
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={password.next}
            onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={password.confirm}
            onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
          />
        </Field>
      </Row>

      <SaveBar
        onSave={() => void changePassword()}
        busy={mutate.busy}
        saved={false}
        error={mutate.error ?? passwordNote}
        dirty={password.current !== '' && password.next !== ''}
        label="Change password"
      />
    </Panel>
  );
}
