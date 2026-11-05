import { useMemo, useRef, useState } from 'react';
import { Failed, Loading, Panel, SaveBar, uiStyles as s, useMutation, useResource } from '../../../ui';
import { placeholderProblem } from './data/site-text-placeholders';
import {
  BUILT_IN_FAQ,
  BUILT_IN_TEXT,
  LANGS,
  type FaqItem,
  type Lang,
  type SiteText,
  type TextEdits,
} from './data/site-text-types';
import styles from './SiteTextPanel.module.css';

/** Sections by the start of each text's key, in the order a visitor meets them. */
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['home', 'Home page'],
  ['faq', 'FAQ'],
  ['footer', 'Footer'],
  ['doctor', 'Doctors'],
  ['hospital', 'Hospitals'],
  ['test', 'Tests & prices'],
  ['ambulance', 'Ambulances'],
  ['booking', 'Booking'],
  ['credits', 'Photo credits'],
  ['other', 'Other'],
];
const sectionOf = (key: string): string =>
  SECTIONS.find(([prefix]) => prefix !== 'other' && key.startsWith(`${prefix}_`))?.[0] ?? 'other';
const TEXT_KEYS = Object.keys(BUILT_IN_TEXT.en);
const FAQ_KEY = 'faq_items';

const textOf = (edits: TextEdits, key: string): string | undefined => {
  const value = edits[key];
  return typeof value === 'string' ? value : undefined;
};
const faqOf = (edits: TextEdits): FaqItem[] | undefined => {
  const value = edits[FAQ_KEY];
  return Array.isArray(value) ? value : undefined;
};

/**
 * Every piece of wording on the Cura Website, in English and Bangla. An empty
 * box uses the built-in wording (shown greyed); typing replaces it.
 * Placeholders like {{count}} are filled in by the site and must stay.
 */
export function SiteTextPanel() {
  const { data, error, loading, reload } = useResource<{ text?: Partial<SiteText> }>(
    '/directory/admin/site-content',
    {},
  );
  const save = useMutation();
  const form = useRef<HTMLFormElement>(null);
  const [edited, setEdited] = useState<SiteText | null>(null);
  const [section, setSection] = useState('home');
  const [search, setSearch] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const saved: SiteText = useMemo(
    () => ({ en: { ...data?.text?.en }, bn: { ...data?.text?.bn } }),
    [data],
  );
  const draft = edited ?? saved;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TEXT_KEYS.filter((key) => sectionOf(key) === section);
    return TEXT_KEYS.filter((key) =>
      [key, BUILT_IN_TEXT.en[key], BUILT_IN_TEXT.bn[key], textOf(draft.en, key), textOf(draft.bn, key)].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [search, section, draft]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const problems = new Map<string, string>();
  for (const [lang] of LANGS) {
    for (const [key, value] of Object.entries(draft[lang])) {
      if (typeof value !== 'string') continue;
      const problem = placeholderProblem(BUILT_IN_TEXT[lang][key] ?? BUILT_IN_TEXT.en[key], value);
      if (problem) problems.set(`${lang}.${key}`, problem);
    }
  }

  const changed: Array<[Lang, string]> = LANGS.flatMap(([lang]) =>
    [...new Set([...Object.keys(draft[lang]), ...Object.keys(saved[lang])])]
      .filter((key) => JSON.stringify(draft[lang][key]) !== JSON.stringify(saved[lang][key]))
      .map((key): [Lang, string] => [lang, key]),
  );

  const update = (change: (d: SiteText) => SiteText) => {
    setLocalError(null);
    setEdited(change(draft));
  };

  const setText = (lang: Lang, key: string, value: string) =>
    update((d) => {
      const next: SiteText = { ...d, [lang]: { ...d[lang] } };
      if (value === '' || value === BUILT_IN_TEXT[lang][key]) delete next[lang][key];
      else next[lang][key] = value;
      return next;
    });

  const setFaq = (lang: Lang, items: FaqItem[] | null) =>
    update((d) => {
      const next: SiteText = { ...d, [lang]: { ...d[lang] } };
      if (items === null) delete next[lang][FAQ_KEY];
      else next[lang][FAQ_KEY] = items;
      return next;
    });

  const submit = async () => {
    if (problems.size) {
      setLocalError('Fix the texts marked in red first.');
      return;
    }
    if (form.current && !form.current.reportValidity()) return;
    const patch: Record<Lang, Record<string, string | FaqItem[] | null>> = { en: {}, bn: {} };
    for (const [lang, key] of changed) patch[lang][key] = draft[lang][key] ?? null;
    if (await save.run('/directory/admin/site-text', { method: 'PATCH', body: patch })) {
      await reload();
      setEdited(null);
    }
  };

  const editedIn = (prefix: string) =>
    LANGS.reduce((n, [lang]) => n + Object.keys(draft[lang]).filter((k) => sectionOf(k) === prefix).length, 0);

  return (
    <Panel
      title="Site text"
      description="Every piece of wording on the Cura Website, in English and Bangla. Leave a box empty to use the built-in wording. Keep placeholders like {{count}}: the site fills them in."
      action={
        <input
          className={`${s.input} ${styles.search}`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all text, English or Bangla"
          aria-label="Search site text"
        />
      }
    >
      {!search && (
        <div className={s.filters} role="group" aria-label="Sections">
          {SECTIONS.map(([prefix, label]) => {
            const count = editedIn(prefix);
            return (
              <button
                key={prefix}
                type="button"
                data-active={section === prefix ? '' : undefined}
                aria-pressed={section === prefix}
                onClick={() => setSection(prefix)}
              >
                {label}
                {count ? ` · ${count} edited` : ''}
              </button>
            );
          })}
        </div>
      )}

      <SaveBar
        onSave={() => void submit()}
        busy={save.busy}
        saved={save.saved}
        error={localError ?? save.error}
        dirty={changed.length > 0}
        label={changed.length ? `Save ${changed.length} change(s)` : 'No changes'}
      >
        {changed.length > 0 && (
          <button
            type="button"
            className={s.linkButton}
            onClick={() => {
              setEdited(null);
              setLocalError(null);
            }}
          >
            Discard changes
          </button>
        )}
      </SaveBar>

      <form ref={form} onSubmit={(e) => e.preventDefault()}>
        {!search && section === 'faq' && (
          <div className={styles.faq}>
            {LANGS.map(([lang, label]) => {
              const own = faqOf(draft[lang]);
              return (
                <div key={lang}>
                  <div className={styles.faqHead}>
                    <h3 className={s.subtitle}>Questions · {label}</h3>
                    {own && (
                      <button type="button" className={s.linkButton} onClick={() => setFaq(lang, null)}>
                        Use built-in questions
                      </button>
                    )}
                  </div>
                  <FaqEditor
                    lang={lang}
                    label={label}
                    items={own ?? BUILT_IN_FAQ[lang]}
                    onChange={(items) => setFaq(lang, items)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {rows.length === 0 ? (
          <p className={s.muted}>No text matches.</p>
        ) : (
          <table className={`${s.table} ${styles.texts}`}>
            <thead>
              <tr>
                <th>Key</th>
                {LANGS.map(([lang, label]) => (
                  <th key={lang}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((key) => (
                <tr key={key}>
                  <td>
                    <code className={styles.key}>{key}</code>
                  </td>
                  {LANGS.map(([lang, label]) => {
                    const value = textOf(draft[lang], key);
                    const builtIn = BUILT_IN_TEXT[lang][key] ?? '';
                    const problem = problems.get(`${lang}.${key}`);
                    const className = [
                      builtIn.length > 70 ? s.textarea : s.input,
                      value !== undefined ? styles.edited : '',
                      problem ? styles.problem : '',
                    ].join(' ');
                    const common = {
                      className,
                      value: value ?? '',
                      placeholder: builtIn,
                      lang,
                      'aria-label': `${key} in ${label}`,
                      'aria-invalid': problem ? true : undefined,
                    };
                    return (
                      <td key={lang}>
                        <div className={styles.cell}>
                          <div className={styles.inputLine}>
                            {builtIn.length > 70 ? (
                              <textarea {...common} rows={2} onChange={(e) => setText(lang, key, e.target.value)} />
                            ) : (
                              <input {...common} onChange={(e) => setText(lang, key, e.target.value)} />
                            )}
                            {value !== undefined && (
                              <button
                                type="button"
                                className={s.linkButton}
                                title="Use the built-in wording"
                                aria-label={`Reset ${key} in ${label}`}
                                onClick={() => setText(lang, key, '')}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          {problem && <span className={s.error}>{problem}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>
    </Panel>
  );
}

function FaqEditor({
  lang,
  label,
  items,
  onChange,
}: {
  lang: Lang;
  label: string;
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
}) {
  const set = (i: number, patch: Partial<FaqItem>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className={styles.faqItem}>
          <div className={styles.faqFields}>
            <input
              className={s.input}
              required
              value={item.q}
              onChange={(e) => set(i, { q: e.target.value })}
              placeholder="Question"
              aria-label={`${label} question ${i + 1}`}
              lang={lang}
            />
            <textarea
              className={s.textarea}
              required
              rows={2}
              value={item.a}
              onChange={(e) => set(i, { a: e.target.value })}
              placeholder="Answer"
              aria-label={`${label} answer ${i + 1}`}
              lang={lang}
            />
          </div>
          <button
            type="button"
            className={s.linkDanger}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={`Remove ${label} question ${i + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={s.secondary}
        disabled={items.length >= 30}
        onClick={() => onChange([...items, { q: '', a: '' }])}
      >
        Add question
      </button>
    </>
  );
}
