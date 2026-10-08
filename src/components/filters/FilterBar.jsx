import { FilterX, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ClearButton({ onClick, className = '' }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-full text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-primary hover:text-primary active:bg-gray-50 transition-colors ${className}`}>
      <FilterX size={16} />
      {t('clear')}
    </button>
  );
}

// Active filters as removable chips in a horizontal scroller that fades out on
// the right, so a trailing pinned button never covers a chip.
function ChipScroller({ chips, onRemove, className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`relative min-w-0 ${className}`}>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {chips.map(({ key, value, label = value }) => (
          <button
            key={`${key}:${value}`}
            type="button"
            onClick={() => onRemove(key, value)}
            aria-label={t('remove_filter', { name: label })}
            className="flex-shrink-0 flex items-center gap-1 h-10 pl-3.5 pr-2.5 rounded-full text-sm bg-white border border-primary/30 text-primary font-medium active:bg-primary/5">
            {label}
            <X size={15} />
          </button>
        ))}
        <span className="flex-shrink-0 w-4" aria-hidden="true" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-secondary to-transparent" aria-hidden="true" />
    </div>
  );
}

// Sticky toolbar under the global header for list pages. Packs what used to
// be separate rows (search box, filter button, active filters) into the
// least vertical space, and keeps them reachable while scrolling:
//
//   phones:  [ search ………………… ][⚙ n]       ← one row
//            [ chip × ][ chip × ] … [Clear]   ← only while filters are active
//   md+:     [ leading ][Filters n][ chip × ] … [Clear]
//
// Props (all optional):
//   search      element shown on phones only (desktop shows it in the PageHeader)
//   leading     element shown from md up, e.g. result-type tabs
//   onOpen      opens the filter sheet; omit for a bar without filters
//   chips       [{ key, value, label? }] active filters
//   onRemove    (key, value) => void
//   onClearAll  () => void
//   mobileOnly  hide from md up (pages with a desktop filter sidebar)
export default function FilterBar({ search, leading, onOpen, chips = [], onRemove, onClearAll, mobileOnly = false }) {
  const { t } = useTranslation();
  const active = chips.length > 0;
  // With nothing to show from md up, hide the bar there entirely.
  const hideOnDesktop = mobileOnly || (!leading && !onOpen);

  return (
    <div className={`sticky top-[var(--header-h)] z-30 -mx-6 px-6 py-2 mb-3 sm:mb-4 glass-bar border-b border-black/5 ${hideOnDesktop ? 'md:hidden' : ''}`}>
      <div className="flex items-center gap-2">
        {leading && <div className="hidden md:flex items-center gap-2 flex-shrink-0">{leading}</div>}
        {leading && onOpen && <span className="hidden md:block w-px h-6 bg-gray-300 mx-1 flex-shrink-0" aria-hidden="true" />}
        {search && <div className="flex-1 min-w-0 md:hidden">{search}</div>}

        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={search ? `${t('filters')}${active ? ` (${chips.length})` : ''}` : undefined}
            className={`relative flex-shrink-0 flex items-center justify-center gap-2 rounded-full text-sm font-medium border transition-colors
              ${search ? 'w-11 h-11 md:w-auto md:h-10 md:pl-3.5 md:pr-3' : 'h-10 pl-3.5 pr-3'}
              ${active ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'}`}>
            <SlidersHorizontal size={16} />
            <span className={search ? 'hidden md:inline' : ''}>{t('filters')}</span>
            {active && (
              <span className={`text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center
                ${search ? 'absolute -top-1 -right-1 bg-accent text-gray-900 md:static md:bg-white md:text-primary' : 'bg-white text-primary'}`}>
                {chips.length}
              </span>
            )}
          </button>
        )}

        {/* Chips share the main row on desktop, or on phones when there's no search box. */}
        {active && <ChipScroller chips={chips} onRemove={onRemove} className={`flex-1 ${search ? 'hidden md:block' : ''}`} />}
        {active && <ClearButton onClick={onClearAll} className={search ? 'hidden md:flex' : ''} />}
        {!active && !search && <span className="flex-1" />}
      </div>

      {/* Phones with a search box: chips get their own row, only while filters are active. */}
      {search && active && (
        <div className="flex items-center gap-2 mt-2 md:hidden">
          <ChipScroller chips={chips} onRemove={onRemove} className="flex-1" />
          <ClearButton onClick={onClearAll} />
        </div>
      )}
    </div>
  );
}
