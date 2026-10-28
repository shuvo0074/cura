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

import { EmailBlock } from './output-shared';

export function EmailPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<EmailBlock[]>('/settings/email', { practiceId });
  const practice = useResource<{ name: string; contactNumber: string | null; logoUrl: string | null }>(
    '/settings/practice',
    { practiceId },
  );
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
    <Panel title="Emails" description="The header and footer wrapped around every email sent to a patient.">
      <div className={s.emailLayout}>
        <div>
          <div className={s.filters} role="tablist" aria-label="Email block">
            {(['HEADER', 'FOOTER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={section === t}
                data-active={section === t || undefined}
                onClick={() => {
                  setSection(t);
                  setDraft({});
                }}
              >
                {t === 'HEADER' ? 'Header' : 'Footer'}
              </button>
            ))}
          </div>

          <Field label="Title">
            <input
              className={s.input}
              value={value.title ?? ''}
              onChange={(e) => set('title', e.target.value || null)}
              placeholder={practice.data?.name ?? 'Clinic name'}
            />
          </Field>
          <Field label="Left text">
            <textarea
              className={s.textarea}
              rows={4}
              value={value.leftText ?? ''}
              onChange={(e) => set('leftText', e.target.value || null)}
            />
          </Field>
          <Field label="Right text">
            <textarea
              className={s.textarea}
              rows={4}
              value={value.rightText ?? ''}
              onChange={(e) => set('rightText', e.target.value || null)}
              placeholder={practice.data?.contactNumber ? `Phone: ${practice.data.contactNumber}` : ''}
            />
          </Field>
          <Check
            label="Include the logo from Practice Details"
            description={practice.data?.logoUrl ? undefined : 'No logo is set yet — add one in Practice Details.'}
            checked={value.includeLogo}
            onChange={(v) => set('includeLogo', v)}
          />

          <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />
        </div>

        {/* Live preview: what a patient receives, rendered from the same state
            the form edits, so there is no separate "generate preview" step. */}
        <aside className={s.preview} aria-label="Email preview">
          <span className={s.previewTag}>Preview</span>
          <div className={s.previewSheet}>
            {value.includeLogo && practice.data?.logoUrl && (
              <img className={s.previewLogo} src={practice.data.logoUrl} alt="" />
            )}
            <h4>{value.title || practice.data?.name || 'Clinic name'}</h4>
            <div className={s.previewCols}>
              <p>{value.leftText || <em>Left text</em>}</p>
              <p>{value.rightText || <em>Right text</em>}</p>
            </div>
            <hr />
            <p className={s.previewBody}>
              Dear patient, your invoice from {practice.data?.name ?? 'the clinic'} is attached.
            </p>
          </div>
        </aside>
      </div>
    </Panel>
  );
}
