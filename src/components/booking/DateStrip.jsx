import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getDhakaNow } from '../../utils/dhakaTime';
import { toYmd } from '../../utils/dates';

const DAYS_AHEAD = 14;
const FRIDAY = 5;

// Horizontal strip of the next two weeks (Dhaka calendar). Serials are booked
// for the coming days, so this replaces a month grid: no past dates, and
// Fridays — when chambers are closed — are shown as off and can't be picked.
export default function DateStrip({ selectedDate, onSelectDate }) {
  const { t, i18n } = useTranslation();
  const scrollerRef = useRef(null);
  const locale = i18n.language === 'bn' ? 'bn-BD' : 'en-GB';
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const dayNum = new Intl.DateTimeFormat(locale, { day: 'numeric' });
  const month = new Intl.DateTimeFormat(locale, { month: 'short' });

  const today = getDhakaNow().date;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const selectedYmd = selectedDate ? toYmd(selectedDate) : null;

  // Bring the selected day into view (e.g. arriving with ?date= a week out),
  // scrolling only the strip so the page itself doesn't jump.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector('[aria-checked="true"]');
    if (!el) return;
    const overflow = el.offsetLeft + el.offsetWidth - (scroller.scrollLeft + scroller.clientWidth);
    if (overflow > 0) scroller.scrollLeft += overflow + 16;
  }, [selectedYmd]);

  return (
    <div className="relative -mx-5 sm:-mx-6">
      <div ref={scrollerRef} role="radiogroup" aria-label={t('choose_day')}
        className="flex gap-2 overflow-x-auto no-scrollbar px-5 sm:px-6 pb-1 snap-x scroll-px-5 sm:scroll-px-6">
        {days.map((d, i) => {
          const off = d.getDay() === FRIDAY;
          const active = toYmd(d) === selectedYmd;
          const label = i === 0 ? t('today') : i === 1 ? t('tomorrow') : weekday.format(d);
          return (
            <button
              key={toYmd(d)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={off}
              onClick={() => onSelectDate(d)}
              className={`snap-start flex-shrink-0 w-[4.5rem] flex flex-col items-center rounded-xl border py-2 transition-colors
                ${active
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : off
                    ? 'border-dashed border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-primary'}`}>
              <span className={`text-[11px] font-medium truncate max-w-full px-1 ${active ? 'text-white/80' : off ? '' : 'text-gray-500'}`}>{label}</span>
              <span className="text-lg font-bold leading-tight">{dayNum.format(d)}</span>
              <span className={`text-[11px] ${active ? 'text-white/80' : off ? '' : 'text-gray-400'}`}>{off ? t('day_off') : month.format(d)}</span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
    </div>
  );
}
