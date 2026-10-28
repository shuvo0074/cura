import { NAV_ITEMS, type RouteKey } from '../features/shell/navigation';
import styles from './app.module.css';

/**
 * Placeholder for modules whose API exists but whose screen does not.
 *
 * It names the endpoints that are live, so the gap is a known quantity rather
 * than a dead menu item.
 */
export function NotBuilt({ route }: { route: RouteKey }) {
  const item = NAV_ITEMS.find((i) => i.key === route);

  return (
    <div className={styles.placeholder}>
      <h2>{item?.label}</h2>
      <p>{item?.hint ?? 'This screen is not built yet.'}</p>
      {/* An item with its own hint explains its state; the generic note is
          only true for modules whose API exists. */}
      {!item?.hint && (
        <p className={styles.placeholderNote}>
          The API for this module is implemented and testable — only the browser UI
          is outstanding.
        </p>
      )}
    </div>
  );
}
