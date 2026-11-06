import { useCallback, useRef, useState } from 'react';
import { businessRules, fromDateKey, type CalendarView as CalendarViewMode } from '@cura/shared';
import { Check } from '../../ui';
import { useT } from '../../i18n';
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
  const { t } = useT();
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
        {t('calendar.title')}
        {clinicName && <span className={styles.clinic}>{clinicName}</span>}
      </h1>

      <span className={styles.toolbarSpacer} />

      <div className={styles.navGroup}>
        <button type="button" onClick={() => onShift(-1)} aria-label={t('calendar.previousPeriod')}>
          ‹
        </button>
        <span className={styles.rangeWrap}>
          <button type="button" className={styles.anchor} onClick={openPicker} title={t('calendar.jumpToDateTitle')}>
            <svg className={styles.anchorIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.75" y="3" width="12.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M1.75 6.5h12.5M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {label}
          </button>
          <input
            ref={picker}
            type="date"
            className={styles.hiddenPicker}
            value={anchorDate}
            tabIndex={-1}
            aria-label={t('calendar.jumpToDate')}
            onChange={(e) => e.target.value && onJump(fromDateKey(e.target.value))}
          />
        </span>
        <button type="button" onClick={() => onShift(1)} aria-label={t('calendar.nextPeriod')}>
          ›
        </button>
      </div>

      <button type="button" className={styles.todayButton} onClick={onToday}>
        {t('calendar.today')}
      </button>

      <div className={styles.viewGroup} role="tablist" aria-label={t('calendar.viewLabel')}>
        {(businessRules.calendar.views as readonly CalendarViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            data-active={view === mode || undefined}
            onClick={() => onView(mode)}
          >
            {t(VIEW_LABELS[mode])}
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
          {t('calendar.settingsMenu')}
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <Check
              label={t('calendar.showCancelled')}
              description={t('calendar.showCancelledHint')}
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
                {t('calendar.calendarSettings')}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
