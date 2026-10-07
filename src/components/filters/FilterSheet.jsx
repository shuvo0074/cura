import { useEffect, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COLLAPSED_COUNT = 12;

// One section of chips. Long lists collapse to the first few options (plus
// anything already selected) behind a "Show all" toggle; searchable sections
// get an inline search box. A single scroll area for the whole sheet avoids
// the scroll-inside-scroll trap of fixed-height lists on phones.
function ChipSection({ section, selected, onToggle }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const q = query.trim().toLowerCase();

  const matches = section.options.filter(o => o.toLowerCase().includes(q));
  const collapsible = !q && matches.length > COLLAPSED_COUNT;
  const visible = collapsible && !expanded
    ? matches.filter((o, i) => i < COLLAPSED_COUNT || selected.includes(o))
    : matches;

  return (
    <section className="py-5 border-b border-gray-100 last:border-0">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{section.title}</h3>
        {selected.length > 0 && (
          <span className="text-xs font-medium text-primary">{t('n_selected', { count: selected.length })}</span>
        )}
      </div>

      {section.searchable && section.options.length > COLLAPSED_COUNT && (
        <div className="field flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={section.searchPlaceholder}
            aria-label={section.searchPlaceholder}
            className="flex-1 min-w-0 text-sm outline-none bg-transparent"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('clear_search')} className="text-gray-400 p-1 -m-1">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {section.hint && <p className="text-xs text-gray-500 mb-3">{section.hint}</p>}

      <div className="flex flex-wrap gap-2">
        {visible.map(option => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={`flex items-center gap-1.5 min-h-10 px-3.5 rounded-full text-sm border transition-colors
                ${on ? 'bg-primary border-primary text-white font-medium' : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'}`}>
              {on && <Check size={14} />}
              {option}
            </button>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-gray-400">{t('no_matches')}</p>}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-sm font-medium text-primary py-1">
          {expanded ? t('show_less') : t('show_all', { count: matches.length })}
        </button>
      )}
    </section>
  );
}

// Filter panel: a bottom sheet on phones, a right-hand panel from `md` up.
// Edits are staged in a draft and only applied with the footer button, which
// shows how many results the draft would give — so users can explore without
// the list jumping around behind the sheet, and closing discards changes.
//
// Props:
//   value        current applied filters, e.g. { specialty: [], division: [] }
//   onApply      (nextValue) => void
//   getSections  (draft) => [{ key, title, options, searchable?, searchPlaceholder?, hint? }]
//   toggle       optional (draft, key, option) => nextDraft, for linked fields
//   countFor     (draft) => number of results the draft would produce
//   emptyValue   value "Clear all" resets to (a page's own scope, or no filters)
//   resultLabel  (count) => button text, e.g. "Show 18 doctors"
export default function FilterSheet({ open, ...props }) {
  // Mounting the body only while open means each opening starts a fresh
  // draft from the applied filters.
  return open ? <SheetBody {...props} /> : null;
}

function SheetBody({ onClose, title, value, onApply, getSections, toggle, countFor, emptyValue, resultLabel }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Lock the page behind, close on Escape, and move focus into the dialog —
  // once per opening (onClose is read through a ref so an inline callback
  // from the parent doesn't re-run this and steal focus on every render).
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = e => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const sections = getSections(draft);
  const count = countFor(draft);
  const atBaseline = JSON.stringify(draft) === JSON.stringify(emptyValue);
  const handleToggle = (key, option) => setDraft(d => (toggle
    ? toggle(d, key, option)
    : { ...d, [key]: d[key].includes(option) ? d[key].filter(o => o !== option) : [...d[key], option] }));

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title">
      <div className="absolute inset-0 bg-black/40 animate-[fadeIn_150ms_ease-out]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:max-h-none md:rounded-none
        bg-white shadow-xl flex flex-col animate-[sheetUp_200ms_ease-out] md:animate-[panelIn_200ms_ease-out]">
        <div className="flex justify-center pt-2.5 pb-1 md:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('close')} className="text-gray-500 p-2 -ml-2 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
          <h2 id="filter-sheet-title" className="font-semibold text-gray-900 text-base">{title}</h2>
          <button
            type="button"
            onClick={() => setDraft(emptyValue)}
            disabled={atBaseline}
            className="text-sm font-medium text-primary px-2 py-2 -mr-2 rounded-lg disabled:text-gray-300">
            {t('clear_all')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          {sections.map(section => (
            <ChipSection
              key={section.key}
              section={section}
              selected={draft[section.key]}
              onToggle={option => handleToggle(section.key, option)}
            />
          ))}
        </div>

        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100">
          <button
            type="button"
            disabled={count === 0}
            onClick={() => { onApply(draft); onClose(); }}
            className="w-full bg-primary text-white rounded-xl py-3.5 text-sm font-semibold transition-colors hover:bg-primary/90 disabled:bg-gray-200 disabled:text-gray-500">
            {count === 0 ? t('no_results_adjust') : resultLabel(count)}
          </button>
        </div>
      </div>
    </div>
  );
}
