import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import bn from './bn.json';

export const BUILT_IN_TEXT = { en, bn };

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    lng: localStorage.getItem('cura-lang') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    // Re-render when admin text edits are applied after load.
    react: { bindI18nStore: 'added' },
  });

// Applies admins' text edits ({ en: { key: text }, bn: { … } }) over the
// built-in wording; an edit removed later falls back to the built-in text.
export function applyTextEdits(edits) {
  for (const lang of ['en', 'bn']) {
    i18n.addResourceBundle(lang, 'translation', { ...BUILT_IN_TEXT[lang], ...edits?.[lang] }, false, true);
  }
}

export default i18n;
