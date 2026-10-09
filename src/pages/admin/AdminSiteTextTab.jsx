import { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { BUILT_IN_TEXT } from '../../i18n/index.js';
import { useSiteContent } from '../../context/SiteContentContext';
import { placeholderProblem } from '../../utils/textPlaceholders';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';
const LANGS = [['en', 'English'], ['bn', 'Bangla']];

// Sections by the start of each text's key, in the order a visitor meets them.
const SECTIONS = [
  ['home', 'Home page'], ['faq', 'FAQ'], ['footer', 'Footer'], ['doctor', 'Doctors'], ['hospital', 'Hospitals'],
  ['test', 'Tests & prices'], ['ambulance', 'Ambulances'], ['booking', 'Booking'], ['credits', 'Photo credits'],
];
const sectionOf = key => (SECTIONS.find(([prefix]) => key.startsWith(`${prefix}_`))?.[0] ?? 'other');
const TEXT_KEYS = Object.keys(BUILT_IN_TEXT.en).filter(k => typeof BUILT_IN_TEXT.en[k] === 'string');

function FaqEditor({ lang, items, onChange }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 flex flex-col gap-1.5">
            <input required value={item.q} onChange={e => set(i, { q: e.target.value })} placeholder="Question" aria-label={`${lang} question ${i + 1}`} className={`${INPUT} font-medium`} />
            <textarea required rows={2} value={item.a} onChange={e => set(i, { a: e.target.value })} placeholder="Answer" aria-label={`${lang} answer ${i + 1}`} className={`${INPUT} resize-y`} />
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { q: '', a: '' }])}
        className="self-start flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5">
        <Plus size={14} /> Add question
      </button>
    </div>
  );
}

// Every piece of wording on the site, in English and Bangla. An empty box
// uses the built-in wording (shown greyed); typing replaces it. Placeholders
// like {{count}} are filled in by the site and must stay.
export default function AdminSiteTextTab() {
  const site = useSiteContent();
  const [saved, setSaved] = useState(null);      // edits as stored
  const [draft, setDraft] = useState(null);      // edits with unsaved changes
  const [section, setSection] = useState('home');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/admin/site-content').then(c => { setSaved(c.text); setDraft(structuredClone(c.text)); });
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEXT_KEYS.filter(key => (q
      ? [key, BUILT_IN_TEXT.en[key], BUILT_IN_TEXT.bn[key], draft?.en[key], draft?.bn[key]].some(v => v?.toLowerCase?.().includes(q))
      : sectionOf(key) === section));
  }, [search, section, draft]);

  if (!draft) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;

  const problems = Object.fromEntries(LANGS.flatMap(([lang]) => Object.entries(draft[lang])
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => [`${lang}.${key}`, placeholderProblem(BUILT_IN_TEXT[lang][key] ?? BUILT_IN_TEXT.en[key], value)])
    .filter(([, problem]) => problem)));
  const changed = LANGS.flatMap(([lang]) => [...new Set([...Object.keys(draft[lang]), ...Object.keys(saved[lang])])]
    .filter(key => JSON.stringify(draft[lang][key]) !== JSON.stringify(saved[lang][key])).map(key => [lang, key]));

  function setText(lang, key, value) {
    setMessage(null);
    setDraft(d => {
      const next = { ...d, [lang]: { ...d[lang] } };
      if (value === '' || value === BUILT_IN_TEXT[lang][key]) delete next[lang][key];
      else next[lang][key] = value;
      return next;
    });
  }

  async function save() {
    if (Object.keys(problems).length) { setMessage({ error: true, text: 'Fix the texts marked in red first.' }); return; }
    setSaving(true);
    setMessage(null);
    const patch = { en: {}, bn: {} };
    for (const [lang, key] of changed) patch[lang][key] = draft[lang][key] ?? null;
    try {
      const content = await api.patch('/admin/site-text', patch);
      site.apply(content);
      setSaved(content.text);
      setDraft(structuredClone(content.text));
      setMessage({ text: `Saved ${changed.length} change(s). The site shows them now.` });
    } catch (err) {
      setMessage({ error: true, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const sectionCounts = Object.fromEntries(SECTIONS.concat([['other', 'Other']]).map(([prefix]) =>
    [prefix, LANGS.reduce((n, [lang]) => n + Object.keys(draft[lang]).filter(k => sectionOf(k) === prefix).length, 0)]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">Site text</h2>
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-full sm:w-72">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all text, English or Bangla" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
      </div>

      {!search && (
        <div className="flex flex-wrap gap-2">
          {SECTIONS.concat([['other', 'Other']]).map(([prefix, label]) => (
            <button key={prefix} type="button" onClick={() => setSection(prefix)}
              className={`px-3 py-1.5 rounded-full text-sm border ${section === prefix ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-700'}`}>
              {label}{sectionCounts[prefix] ? ` · ${sectionCounts[prefix]} edited` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="sticky top-16 z-10 bg-white/95 backdrop-blur rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !changed.length}
          className="bg-primary text-white min-h-11 px-6 rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : changed.length ? `Save ${changed.length} change(s)` : 'No changes'}
        </button>
        {changed.length > 0 && <button type="button" onClick={() => { setDraft(structuredClone(saved)); setMessage(null); }} className="text-sm text-gray-600 hover:text-gray-900">Discard changes</button>}
        {message && <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p>}
      </div>

      {!search && section === 'faq' && (
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {LANGS.map(([lang, label]) => (
            <div key={lang}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">Questions · {label}</h3>
                {draft[lang].faq_items && <button type="button" onClick={() => setText(lang, 'faq_items', '')} className="text-xs text-gray-500 flex items-center gap-1"><RotateCcw size={12} /> Built-in questions</button>}
              </div>
              <FaqEditor lang={label} items={draft[lang].faq_items ?? BUILT_IN_TEXT[lang].faq_items}
                onChange={items => setDraft(d => ({ ...d, [lang]: { ...d[lang], faq_items: items } }))} />
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {rows.length === 0 && <p className="p-6 text-sm text-gray-400 text-center">No text matches.</p>}
        {rows.map(key => (
          <div key={key} className="p-3 grid grid-cols-1 lg:grid-cols-[200px_1fr_1fr] gap-2 items-start">
            <code className="text-[11px] text-gray-500 break-all pt-2">{key}</code>
            {LANGS.map(([lang, label]) => {
              const value = draft[lang][key];
              const builtIn = BUILT_IN_TEXT[lang][key] ?? '';
              const problem = problems[`${lang}.${key}`];
              const long = builtIn.length > 70;
              const Field = long ? 'textarea' : 'input';
              return (
                <div key={lang} className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <Field value={value ?? ''} onChange={e => setText(lang, key, e.target.value)} placeholder={builtIn} rows={long ? 2 : undefined}
                      aria-label={`${key} in ${label}`} lang={lang}
                      className={`${INPUT} flex-1 min-w-0 ${value != null ? 'border-primary/50 bg-primary/5' : ''} ${problem ? 'border-red-400' : ''} ${long ? 'resize-y' : ''}`} />
                    {value != null && (
                      <button type="button" onClick={() => setText(lang, key, '')} title="Use the built-in wording" aria-label={`Reset ${key} in ${label}`}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><RotateCcw size={14} /></button>
                    )}
                  </div>
                  {problem && <p className="text-xs text-red-600">{problem}</p>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
