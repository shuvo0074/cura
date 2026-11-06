import { useLanguage, useT } from './I18nProvider';
import { LOCALES, type Locale } from './define-area';
import styles from './language-switch.module.css';

/** Each language is named in itself, so someone who reads only one can find it. */
const NAMES: Record<Locale, string> = { en: 'English', bn: 'বাংলা' };

/** English / বাংলা. Signed in, the choice is saved to the account. */
export function LanguageSwitch({ signedIn }: { signedIn: boolean }) {
  const { t } = useT();
  const { locale, chooseLanguage } = useLanguage();

  return (
    <div className={styles.switch} role="group" aria-label={t('common.language')}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={styles.option}
          aria-pressed={locale === code}
          onClick={() => chooseLanguage(code, signedIn)}
        >
          {NAMES[code]}
        </button>
      ))}
    </div>
  );
}
