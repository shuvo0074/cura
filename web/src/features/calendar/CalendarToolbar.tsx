import { useCallback, useRef, useState } from 'react';
import { businessRules, fromDateKey, type CalendarView as CalendarViewMode } from '@cura/shared';
import { Check } from '../../ui';
import { VIEW_LABELS, useDismiss } from './calendar-shared';
import styles from './calendar.module.css';

/**
 * Calendar header (spec: "Calendar Header").
 *
 * ‹ range › with a date picker behind the range label, Today, the view
 * toggle and the quick-settings menu. Sticky, so navigation stays reachable
 * while a long day scrolls.
 */
export function CalendarToolbar({
  clinicName,
  view,
  anchorDate,
  label,
  showCancelled,
  onShift,
  onToday,
  onJump,
  onView,
  onShowCancelled,
  onOpenCalendarSettings,
}: {
  clinicName: string | null;
  view: CalendarViewMode;
  anchorDate: string;
  label: string;
  showCancelled: boolean;
  onShift: (direction: -1 | 1) => void;
  onToday: () => void;
  onJump: (date: Date) => void;
  onView: (view: CalendarViewMode) => void;
  onShowCancelled: (show: boolean) => void;
  onOpenCalendarSettings?: (() => void) | undefined;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismiss(menuOpen, closeMenu);

  const openPicker = () => {
    const input = picker.current;
    if (!input) return;
    // showPicker is the only way to open the native calendar programmatically;
    // older engines fall back to focusing the (visually hidden) field.
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>
        Calendar
        {clinicName && <span className={styles.clinic}>{clinicName}</span>}
      </h1>

      <span className={styles.toolbarSpacer} />

      <div className={styles.navGroup}>
        <button type="button" onClick={() => onShift(-1)} aria-label="Previous period">
          ‹
        </button>
        <span className={styles.rangeWrap}>
          <button type="button" className={styles.anchor} onClick={openPicker} title="Jump to a date">
            {label}
          </button>
          <input
            ref={picker}
            type="date"
            className={styles.hiddenPicker}
            value={anchorDate}
            tabIndex={-1}
            aria-label="Jump to date"
            onChange={(e) => e.target.value && onJump(fromDateKey(e.target.value))}
          />
        </span>
        <button type="button" onClick={() => onShift(1)} aria-label="Next period">
          ›
        </button>
      </div>

      <button type="button" className={styles.today} onClick={onToday}>
        Today
      </button>

      <div className={styles.viewGroup} role="tablist" aria-label="Calendar view">
        {(businessRules.calendar.views as readonly CalendarViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            data-active={view === mode || undefined}
            onClick={() => onView(mode)}
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.today}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          Settings ▾
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <Check
              label="Show cancelled appointments"
              description="Struck through, so the free slot is easy to spot for a walk-in."
              checked={showCancelled}
              onChange={onShowCancelled}
            />
            {onOpenCalendarSettings && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuLink}
                onClick={() => {
                  closeMenu();
                  onOpenCalendarSettings();
                }}
              >
                Calendar settings…
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
