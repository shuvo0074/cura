/** Cura Dashboard in English and Bangla. How to use it: README.md in this folder. */
export { I18nProvider, useT, useLanguage, type UseT } from './I18nProvider';
export { LanguageSwitch } from './LanguageSwitch';
export { defineArea, LOCALES, type Locale, type TParams } from './define-area';
export { translate, translateMessage, type TranslationKey } from './translate';
export {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatMoney,
  formatMoneyMinor,
  formatNumber,
  formatTime,
  intlLocale,
  type Formatters,
} from './format';
