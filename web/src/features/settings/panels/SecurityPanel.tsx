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

import { AccountProfile, PracticeSettings } from './practice-ops-shared';

export function SecurityPanel({ practiceId }: { practiceId: string }) {
  const practice = useResource<PracticeSettings>('/settings/practice', { practiceId });
  const account = useResource<AccountProfile>('/account/profile', {});
  const mutate = useMutation();
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const { t } = useT();
  // A key, not a sentence, so the note follows a language switch.
  const [passwordNote, setPasswordNote] = useState<'mismatch' | 'changed' | null>(null);

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
      setPasswordNote('mismatch');
      return;
    }
    const ok = await mutate.run('/account/password', {
      method: 'POST',
      body: { currentPassword: password.current, newPassword: password.next },
    });
    if (ok) {
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordNote('changed');
    }
  };

  const canEnable2fa = (account.data?.mobileVerified ?? false) || (account.data?.emailVerified ?? false);

  return (
    <Panel title={t('settings.nav.security')} description={t('settings.security.description')}>
      <h3 className={s.subtitle}>{t('settings.security.twoFactor')}</h3>
      <Check
        label={t('settings.security.twoFactorLabel')}
        description={
          canEnable2fa
            ? t('settings.security.twoFactorOn')
            : t('settings.security.twoFactorOff')
        }
        checked={account.data?.twoFactorEnabled ?? false}
        disabled={!canEnable2fa}
        onChange={(v) => void setTwoFactor(v)}
      />

      <h3 className={s.subtitle}>{t('settings.security.recordVisibility')}</h3>
      <Check
        label={t('settings.security.hideInvoices')}
        description={t('settings.security.hideInvoicesHint')}
        checked={practice.data.hideCancelledInvoices}
        onChange={(v) => void setFlag('hideCancelledInvoices', v)}
      />
      <Check
        label={t('settings.security.hidePayments')}
        checked={practice.data.hideCancelledPayments}
        onChange={(v) => void setFlag('hideCancelledPayments', v)}
      />

      <h3 className={s.subtitle}>{t('settings.security.changePassword')}</h3>
      <Row>
        <Field label={t('settings.security.currentPassword')}>
          <input
            className={s.input}
            type="password"
            autoComplete="current-password"
            value={password.current}
            onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
          />
        </Field>
        <Field label={t('settings.security.newPassword')} hint={t('settings.security.newPasswordHint')}>
          <input
            className={s.input}
            type="password"
            autoComplete="new-password"
            value={password.next}
            onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
          />
        </Field>
        <Field label={t('settings.security.confirmPassword')}>
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
        error={mutate.error ?? (passwordNote && t(`settings.security.${passwordNote}`))}
        dirty={password.current !== '' && password.next !== ''}
        label={t('settings.security.changePassword')}
      />
    </Panel>
  );
}
