import { useState } from 'react';
import { BloodGroup, Gender } from '@cura/shared';
import { Check, Failed, Field, Loading, Panel, Row, SaveBar, uiStyles as s, useMutation, useResource } from '../../ui';
import { ChangePasswordCard } from './ChangePasswordCard';
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

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: 'Administrator',
  DOCTOR: 'Doctor',
  DESK_STAFF: 'Desk staff',
};

const ROLE_SUMMARY: Record<string, string> = {
  ADMINISTRATOR: 'Full access: settings, staff, catalogues, statistics and billing.',
  DOCTOR: 'Patient records and prescriptions. Sessions are booked by the front desk.',
  DESK_STAFF: 'Registration, the diary, the queue and taking payment.',
};

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
      <Panel title="Profile" description="Your own account details and sign-in security.">
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {value.avatarUrl ? <img src={value.avatarUrl} alt="" /> : value.fullName.slice(0, 1)}
          </span>
          <div>
            <h3 className={styles.name}>{value.fullName}</h3>
            <span className={styles.roleBadge}>{ROLE_LABELS[data.role] ?? data.role}</span>
            <p className={styles.roleSummary}>{ROLE_SUMMARY[data.role] ?? ''}</p>
          </div>
        </div>

        <h3 className={s.subtitle}>Sign-in identity</h3>
        <p className={s.hint}>
          These identify you to the system. Changing them requires re-verification, so they are
          managed by an administrator rather than edited here.
        </p>
        <Row>
          <Field label="Mobile number">
            <input className={s.input} value={value.mobile ?? '—'} readOnly />
            <span className={styles.verified} data-ok={data.mobileVerified || undefined}>
              {data.mobileVerified ? 'Verified' : 'Not verified'}
            </span>
          </Field>
          <Field label="Email address">
            <input className={s.input} value={value.email ?? '—'} readOnly />
            <span className={styles.verified} data-ok={data.emailVerified || undefined}>
              {data.emailVerified ? 'Verified' : 'Not verified'}
            </span>
          </Field>
          {data.role === 'DOCTOR' && (
            <Field label="BMDC registration">
              <input className={s.input} value={value.bmdcNumber ?? '—'} readOnly />
            </Field>
          )}
        </Row>

        <h3 className={s.subtitle}>Personal details</h3>
        <Row cols={2}>
          <Field label="Full name" required>
            <input
              className={s.input}
              value={value.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
          </Field>
          <Field label="Secondary phone">
            <input
              className={s.input}
              value={value.secondaryPhone ?? ''}
              onChange={(e) => set('secondaryPhone', e.target.value || null)}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Gender">
            <select
              className={s.input}
              value={value.gender ?? ''}
              onChange={(e) => set('gender', e.target.value || null)}
            >
              <option value="">—</option>
              {Object.values(Gender).map((g) => (
                <option key={g} value={g}>
                  {g.charAt(0) + g.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth">
            <input
              className={s.input}
              type="date"
              value={value.dateOfBirth ?? ''}
              onChange={(e) => set('dateOfBirth', e.target.value || null)}
            />
          </Field>
          <Field label="Blood group">
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
          <Field label="Language">
            <select
              className={s.input}
              value={value.locale ?? 'en'}
              onChange={(e) => set('locale', e.target.value)}
            >
              <option value="en">English</option>
              <option value="bn">বাংলা (Bangla)</option>
            </select>
          </Field>
          <Field label="Profile photo URL">
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

        <h3 className={s.subtitle}>Two-factor authentication</h3>
        <Check
          label="Require a one-time code when signing in from a new device"
          description={
            canEnable2fa
              ? 'A 6-digit code is sent to your verified mobile number or email address.'
              : 'Verify your mobile number or email address first — otherwise this would lock you out.'
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
