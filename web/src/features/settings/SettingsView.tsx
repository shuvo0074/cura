import { useState } from 'react';
import { SETTINGS_ITEMS, type SettingsKey } from './settings-nav';
import styles from './settings.module.css';

import { ActivePanel } from './ActivePanel';

/**
 * Settings module (spec: secondary navigation with thirteen sub-modules).
 *
 * Each panel owns its own fetch and save; there is no shared settings store.
 * Thirteen mostly-independent forms would make one store a bag of unrelated
 * slices, and a save in Drug Catalog has no reason to invalidate Printouts.
 */
export function SettingsView({
  practiceId,
  practiceName,
  initial,
}: {
  practiceId: string;
  practiceName?: string;
  initial?: SettingsKey | undefined;
}) {
  const [active, setActive] = useState<SettingsKey>(initial ?? 'practice');

  let previousGroup = SETTINGS_ITEMS[0]!.group;

  return (
    <div className={styles.shell}>
      <nav className={styles.subnav} aria-label="Settings sections">
        <header className={styles.subnavHead}>
          <h1>Settings</h1>
          {practiceName && <p>{practiceName}</p>}
        </header>

        {SETTINGS_ITEMS.map((item) => {
          const startsGroup = item.group !== previousGroup;
          previousGroup = item.group;
          return (
            <button
              key={item.key}
              type="button"
              data-active={active === item.key || undefined}
              data-group-start={startsGroup || undefined}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className={styles.panel}>
        <ActivePanel active={active} practiceId={practiceId} />
      </section>
    </div>
  );
}
