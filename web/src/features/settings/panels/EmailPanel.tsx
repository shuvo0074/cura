import { useState } from 'react';
import {
  Check,
  Failed,
  Field,
  Loading,
  Panel,
  SaveBar,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { EmailBlock } from './output-shared';

export function EmailPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<EmailBlock[]>('/settings/email', { practiceId });
  const practice = useResource<{ name: string; contactNumber: string | null; logoUrl: string | null }>(
    '/settings/practice',
    { practiceId },
  );
  const { t } = useT();
  const save = useMutation();
  const [section, setSection] = useState<'HEADER' | 'FOOTER'>('HEADER');
  const [draft, setDraft] = useState<Partial<EmailBlock>>({});

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const stored = (data ?? []).find((b) => b.section === section);
  const value: EmailBlock = {
    section,
    title: null,
    leftText: null,
    rightText: null,
    includeLogo: true,
    ...stored,
    ...draft,
  };
  const dirty = Object.keys(draft).length > 0;
  const set = <K extends keyof EmailBlock>(k: K, v: EmailBlock[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    const ok = await save.run('/settings/email', { method: 'PUT', body: { practiceId, ...value } });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  return (
    <Panel title={t('settings.nav.email')} description={t('settings.emails.description')}>
      <div className={s.emailLayout}>
        <div>
          <div className={s.filters} role="tablist" aria-label={t('settings.emails.block')}>
            {(['HEADER', 'FOOTER'] as const).map((block) => (
              <button
                key={block}
                type="button"
                role="tab"
                aria-selected={section === block}
                data-active={section === block || undefined}
                onClick={() => {
                  setSection(block);
                  setDraft({});
                }}
              >
                {block === 'HEADER' ? t('settings.emails.header') : t('settings.emails.footer')}
              </button>
            ))}
          </div>

          <Field label={t('settings.titleField')}>
            <input
              className={s.input}
              value={value.title ?? ''}
              onChange={(e) => set('title', e.target.value || null)}
              placeholder={practice.data?.name ?? t('settings.emails.clinicName')}
            />
          </Field>
          <Field label={t('settings.emails.leftText')}>
            <textarea
              className={s.textarea}
              rows={4}
              value={value.leftText ?? ''}
              onChange={(e) => set('leftText', e.target.value || null)}
            />
          </Field>
          <Field label={t('settings.emails.rightText')}>
            <textarea
              className={s.textarea}
              rows={4}
              value={value.rightText ?? ''}
              onChange={(e) => set('rightText', e.target.value || null)}
              placeholder={
                practice.data?.contactNumber
                  ? t('settings.emails.phone', { number: practice.data.contactNumber })
                  : ''
              }
            />
          </Field>
          <Check
            label={t('settings.emails.includeLogo')}
            description={practice.data?.logoUrl ? undefined : t('settings.emails.noLogo')}
            checked={value.includeLogo}
            onChange={(v) => set('includeLogo', v)}
          />

          <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />
        </div>

        {/* Live preview: what a patient receives, rendered from the same state
            the form edits, so there is no separate "generate preview" step. */}
        <aside className={s.preview} aria-label={t('settings.emails.previewLabel')}>
          <span className={s.previewTag}>{t('settings.emails.preview')}</span>
          <div className={s.previewSheet}>
            {value.includeLogo && practice.data?.logoUrl && (
              <img className={s.previewLogo} src={practice.data.logoUrl} alt="" />
            )}
            <h4>{value.title || practice.data?.name || t('settings.emails.clinicName')}</h4>
            <div className={s.previewCols}>
              <p>{value.leftText || <em>{t('settings.emails.leftText')}</em>}</p>
              <p>{value.rightText || <em>{t('settings.emails.rightText')}</em>}</p>
            </div>
            <hr />
            <p className={s.previewBody}>
              {t('settings.emails.previewBody', { clinic: practice.data?.name ?? t('settings.emails.theClinic') })}
            </p>
          </div>
        </aside>
      </div>
    </Panel>
  );
}
