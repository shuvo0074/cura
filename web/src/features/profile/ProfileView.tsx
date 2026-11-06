import { useState } from 'react';
import { BloodGroup, Gender } from '@cura/shared';
import { Check, Failed, Field, Loading, Panel, Row, SaveBar, uiStyles as s, useMutation, useResource } from '../../ui';
import { ChangePasswordCard } from './ChangePasswordCard';
import { LanguageSwitch, useT } from '../../i18n';
import styles from './profile.module.css';

export interface AccountProfile {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  bmdcNumber: string | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  mobileVerified: boolean;
  permissions: readonly string[];
  gender?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  secondaryPhone?: string | null;
  locale?: string;
}

const ROLES = ['ADMINISTRATOR', 'DOCTOR', 'DESK_STAFF', 'PUBLIC_USER'] as const;
const isKnownRole = (role: string): role is (typeof ROLES)[number] => (ROLES as readonly string[]).includes(role);

/**
 * Profile Management (spec: Profile Management / Account Settings).
 *
 * Everyone reaches this screen — it is the one module with no permission gate,
 * because every account holder administers their own details. Identity fields
 * that authenticate you (mobile, email, BMDC) are shown but not editable here:
 * changing them re-opens verification, which is a different flow.
 */
export function ProfileView() {
  const { data, error, loading, reload } = useResource<AccountProfile>('/account/profile', {});
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<AccountProfile>>({});
  const { t } = useT();

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const value = { ...data, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const set = <K extends keyof AccountProfile>(k: K, v: AccountProfile[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    const ok = await save.run('/account/profile', { method: 'PATCH', body: draft });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  const setTwoFactor = async (enabled: boolean) => {
    await save.run('/account/two-factor', { method: 'PUT', body: { enabled } });
    await reload();
  };

  const canEnable2fa = data.mobileVerified || data.emailVerified;

  return (
    <div className={styles.shell}>
      <Panel title={t('profile.title')} description={t('profile.description')}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {value.avatarUrl ? <img src={value.avatarUrl} alt="" /> : value.fullName.slice(0, 1)}
          </span>
          <div>
            <h3 className={styles.name}>{value.fullName}</h3>
            <span className={styles.roleBadge}>
              {isKnownRole(data.role) ? t(`profile.role.${data.role}`) : data.role}
            </span>
            <p className={styles.roleSummary}>
              {isKnownRole(data.role) ? t(`profile.roleSummary.${data.role}`) : ''}
            </p>
          </div>
        </div>

        <h3 className={s.subtitle}>{t('profile.identity')}</h3>
        <p className={s.hint}>{t('profile.identityHint')}</p>
        <Row>
          <Field label={t('profile.mobile')}>
            <input className={s.input} value={value.mobile ?? '—'} readOnly />
            <span className={styles.verified} data-ok={data.mobileVerified || undefined}>
              {data.mobileVerified ? t('profile.verified') : t('profile.notVerified')}
            </span>
          </Field>
          <Field label={t('profile.email')}>
            <input className={s.input} value={value.email ?? '—'} readOnly />
            <span className={styles.verified} data-ok={data.emailVerified || undefined}>
              {data.emailVerified ? t('profile.verified') : t('profile.notVerified')}
            </span>
          </Field>
          {data.role === 'DOCTOR' && (
            <Field label={t('profile.bmdc')}>
              <input className={s.input} value={value.bmdcNumber ?? '—'} readOnly />
            </Field>
          )}
        </Row>

        <h3 className={s.subtitle}>{t('profile.personal')}</h3>
        <Row cols={2}>
          <Field label={t('profile.fullName')} required>
            <input
              className={s.input}
              value={value.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
          </Field>
          <Field label={t('profile.secondaryPhone')}>
            <input
              className={s.input}
              value={value.secondaryPhone ?? ''}
              onChange={(e) => set('secondaryPhone', e.target.value || null)}
            />
          </Field>
        </Row>
        <Row>
          <Field label={t('profile.gender')}>
            <select
              className={s.input}
              value={value.gender ?? ''}
              onChange={(e) => set('gender', e.target.value || null)}
            >
              <option value="">—</option>
              {Object.values(Gender).map((g) => (
                <option key={g} value={g}>
                  {t(`common.gender.${g}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('profile.dateOfBirth')}>
            <input
              className={s.input}
              type="date"
              value={value.dateOfBirth ?? ''}
              onChange={(e) => set('dateOfBirth', e.target.value || null)}
            />
          </Field>
          <Field label={t('profile.bloodGroup')}>
            <select
              className={s.input}
              value={value.bloodGroup ?? ''}
              onChange={(e) => set('bloodGroup', e.target.value || null)}
            >
              <option value="">—</option>
              {Object.values(BloodGroup).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        </Row>
        <Row cols={2}>
          {/* Not a <Field>: that is a <label>, and clicking its text would press the first button. */}
          <div className={s.field}>
            <span className={s.fieldLabel}>{t('profile.language')}</span>
            <LanguageSwitch signedIn />
            <span className={s.fieldHint}>{t('profile.languageHint')}</span>
          </div>
          <Field label={t('profile.photo')}>
            <input
              className={s.input}
              value={value.avatarUrl ?? ''}
              onChange={(e) => set('avatarUrl', e.target.value || null)}
              placeholder="https://…"
            />
          </Field>
        </Row>

        <SaveBar
          onSave={() => void submit()}
          busy={save.busy}
          saved={save.saved}
          error={save.error}
          dirty={dirty}
        />

        <h3 className={s.subtitle}>{t('profile.twoFactor')}</h3>
        <Check
          label={t('profile.twoFactorLabel')}
          description={
            canEnable2fa
              ? t('profile.twoFactorOn')
              : t('profile.twoFactorBlocked')
          }
          checked={data.twoFactorEnabled}
          disabled={!canEnable2fa}
          onChange={(v) => void setTwoFactor(v)}
        />
      </Panel>

      <ChangePasswordCard />
    </div>
  );
}
