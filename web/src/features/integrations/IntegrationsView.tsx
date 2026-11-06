import { uiStyles as s } from '../../ui';
import styles from './integrations.module.css';
import { useT } from '../../i18n';

/**
 * Each one has `settings.integrations.<key>.name`, `.summary` and `.effect`
 * (what switching it on would do inside Cura).
 */
const INTEGRATIONS = ['practo', 'sms', 'payments', 'calendar', 'lab'] as const;

/**
 * Integrations (spec 2.2: Integration, Practo Integration).
 *
 * None of these connectors exists in the API yet, so every card says "Not
 * connected" and offers no switch — a toggle that silently does nothing would
 * be worse than an honest catalogue of what is planned.
 */
export function IntegrationsView() {
  const { t } = useT();
  return (
    <div className={styles.shell}>
      <header>
        <h1 className={s.title}>{t('settings.integrations.title')}</h1>
        <p className={s.hint}>{t('settings.integrations.intro')}</p>
      </header>

      <ul className={styles.grid}>
        {INTEGRATIONS.map((key) => (
          <li key={key} className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.logo} aria-hidden="true">
                {t(`settings.integrations.${key}.name`).charAt(0)}
              </span>
              <h2 className={styles.name}>{t(`settings.integrations.${key}.name`)}</h2>
              <span className={styles.status}>{t('settings.integrations.notConnected')}</span>
            </header>
            <p className={styles.summary}>{t(`settings.integrations.${key}.summary`)}</p>
            <p className={s.muted}>{t(`settings.integrations.${key}.effect`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
