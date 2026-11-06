import { useState } from 'react';
import {
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

import { SessionSummary } from './SessionSummary';
import { TimingsModal } from './TimingsModal';
import { Practice, SPECIALIZATIONS } from './practice-shared';

export function PracticePanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<Practice>('/settings/practice', { practiceId });
  const { t } = useT();
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<Practice>>({});
  const [timingsOpen, setTimingsOpen] = useState(false);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const value = { ...data, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const set = <K extends keyof Practice>(k: K, v: Practice[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    const ok = await save.run('/settings/practice', {
      method: 'PUT',
      body: { practiceId, ...draft },
    });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  return (
    <Panel title={t('settings.nav.practice')} description={t('settings.practice.description')}>
      <div className={s.logoRow}>
        <div className={s.logo} aria-hidden="true">
          {value.logoUrl ? <img src={value.logoUrl} alt="" /> : <span>{t('settings.practice.addLogo')}</span>}
        </div>
        <Field label={t('settings.practice.logoUrl')} hint={t('settings.practice.logoHint')}>
          <input
            className={s.input}
            value={value.logoUrl ?? ''}
            onChange={(e) => set('logoUrl', e.target.value || null)}
            placeholder="https://…/logo.png"
          />
        </Field>
      </div>

      <Row>
        <Field label={t('settings.practice.clinicName')} required>
          <input className={s.input} value={value.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('settings.practice.specialization')} required>
          <select
            className={s.input}
            value={value.specialization ?? ''}
            onChange={(e) => set('specialization', e.target.value || null)}
          >
            <option value="">{t('settings.select')}</option>
            {SPECIALIZATIONS.map((x) => (
              <option key={x} value={x}>
                {t(`settings.spec.${x}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.practice.bin')} hint={t('settings.practice.binHint')}>
          <input
            className={s.input}
            value={value.binNumber ?? ''}
            onChange={(e) => set('binNumber', e.target.value || null)}
          />
        </Field>
      </Row>

      <Row>
        <Field label={t('settings.practice.contactNumber')} required>
          <input
            className={s.input}
            value={value.contactNumber ?? ''}
            onChange={(e) => set('contactNumber', e.target.value || null)}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label={t('settings.email')}>
          <input
            className={s.input}
            type="email"
            value={value.email ?? ''}
            onChange={(e) => set('email', e.target.value || null)}
          />
        </Field>
        <Field label={t('settings.practice.website')}>
          <input
            className={s.input}
            value={value.website ?? ''}
            onChange={(e) => set('website', e.target.value || null)}
            placeholder="https://"
          />
        </Field>
      </Row>

      <h3 className={s.subtitle}>{t('settings.practice.address')}</h3>
      <Row cols={2}>
        <Field label={t('settings.practice.addressLine1')} required>
          <input
            className={s.input}
            value={value.addressLine1 ?? ''}
            onChange={(e) => set('addressLine1', e.target.value || null)}
          />
        </Field>
        <Field label={t('settings.practice.locality')}>
          <input
            className={s.input}
            value={value.locality ?? ''}
            onChange={(e) => set('locality', e.target.value || null)}
          />
        </Field>
      </Row>
      <Row>
        <Field label={t('settings.practice.city')}>
          <input className={s.input} value={value.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
        </Field>
        <Field label={t('settings.practice.country')}>
          <input className={s.input} value={value.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label={t('settings.practice.postCode')}>
          <input
            className={s.input}
            value={value.postCode ?? ''}
            onChange={(e) => set('postCode', e.target.value || null)}
          />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('settings.practice.mapsLink')} hint={t('settings.practice.mapsHint')}>
          <input
            className={s.input}
            value={value.mapsUrl ?? ''}
            onChange={(e) => set('mapsUrl', e.target.value || null)}
            placeholder="https://maps.app.goo.gl/…"
          />
        </Field>
        <Field label={t('settings.practice.roomNumber')}>
          <input
            className={s.input}
            value={value.roomNumber ?? ''}
            onChange={(e) => set('roomNumber', e.target.value || null)}
          />
        </Field>
      </Row>

      <div className={s.sectionHead}>
        <h3 className={s.subtitle}>{t('settings.practice.timings')}</h3>
        <button type="button" className={s.secondary} onClick={() => setTimingsOpen(true)}>
          {t('settings.practice.editTimings')}
        </button>
      </div>
      <SessionSummary sessions={data.sessions} />

      <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />

      {timingsOpen && (
        <TimingsModal
          practiceId={practiceId}
          sessions={data.sessions}
          onClose={() => setTimingsOpen(false)}
          onSaved={() => {
            setTimingsOpen(false);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}
