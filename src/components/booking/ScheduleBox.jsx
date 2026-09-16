import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDhakaNow } from '../../utils/dhakaTime';

const WEEK_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function monthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const start = startOfWeek(firstDay);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  // Trim trailing weeks that fall entirely in the next month, keep full weeks only.
  while (cells.length > 35 && cells[cells.length - 7].getMonth() !== month) {
    cells.splice(cells.length - 7, 7);
  }
  return cells;
}

export default function ScheduleBox({ selectedDate, onSelectDate }) {
  const { t } = useTranslation();
  const today = getDhakaNow().date;
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  function stepDate(deltaDays) {
    const base = selectedDate || today;
    const next = new Date(base);
    next.setDate(next.getDate() + deltaDays);
    onSelectDate(next);
    if (next.getMonth() !== monthCursor.getMonth() || next.getFullYear() !== monthCursor.getFullYear()) {
      setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  const shownDate = selectedDate || today;

  function goToToday() {
    onSelectDate(today);
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function goToCurrentMonth() {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="grid grid-cols-3 items-center mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('scheduling')}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => stepDate(-1)} className="text-gray-400 hover:text-primary p-0.5 flex-shrink-0" aria-label="Previous day">
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-medium text-gray-700 whitespace-nowrap w-24 text-center">
            {shownDate.getDate()}/{shownDate.getMonth() + 1}/{shownDate.getFullYear()}
          </p>
          <button onClick={() => stepDate(1)} className="text-gray-400 hover:text-primary p-0.5 flex-shrink-0" aria-label="Next day">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={goToToday}
            className="text-[11px] font-medium text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:border-primary hover:text-primary transition-colors">
            Today
          </button>
          <button onClick={goToCurrentMonth}
            className="text-[11px] font-medium text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:border-primary hover:text-primary transition-colors">
            Month
          </button>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mb-2">
        <button onClick={() => setMonthCursor(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="text-gray-400 hover:text-primary p-1 flex-shrink-0" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-medium text-gray-700 whitespace-nowrap w-36 text-center">
          {MONTH_NAMES[monthCursor.getMonth()]}
        </p>
        <button onClick={() => setMonthCursor(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="text-gray-400 hover:text-primary p-1 flex-shrink-0" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-1">
        {WEEK_LABELS.map((l, i) => (
          <span key={l} className={i === today.getDay() ? 'text-primary font-semibold' : 'text-gray-400'}>{l}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(monthCursor.getFullYear(), monthCursor.getMonth()).map((d, i) => {
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const active = selectedDate && isSameDate(d, selectedDate);
          const isToday = isSameDate(d, today);
          return (
            <button key={i} onClick={() => onSelectDate(d)}
              className={`h-9 rounded-lg text-xs font-medium transition-all
                ${active ? 'bg-primary text-white shadow-sm' : inMonth ? 'text-gray-700 hover:bg-primary/10' : 'text-gray-300 hover:bg-gray-50'}
                ${isToday && !active ? 'ring-1 ring-primary text-primary' : ''}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
