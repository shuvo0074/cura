import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Page numbers to show: always first and last, plus a window around the
// current page; gaps are collapsed into '…'.
function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, onChange }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  function go(p) {
    onChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const btn = 'h-9 min-w-9 px-3 flex items-center justify-center rounded-lg text-sm border transition-colors';
  const idle = 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary';
  const disabled = 'disabled:opacity-40 disabled:pointer-events-none';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
      <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label={t('previous')} className={`${btn} ${idle} ${disabled} gap-1`}>
        <ChevronLeft size={16} />
        <span className="hidden sm:inline">{t('previous')}</span>
      </button>

      {pageList(page, totalPages).map(p =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-gray-400">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${p === page ? 'bg-primary border-primary text-white font-semibold' : idle}`}
          >
            {p}
          </button>
        )
      )}

      <button type="button" onClick={() => go(page + 1)} disabled={page === totalPages} aria-label={t('next')} className={`${btn} ${idle} ${disabled} gap-1`}>
        <span className="hidden sm:inline">{t('next')}</span>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
