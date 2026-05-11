export const PRODUCTION_LOCALES = [
  { code: 'cs', label: 'Čeština', shortLabel: 'CZ', flag: '🇨🇿' },
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
] as const;

export const PRODUCTION_LOCALE_CODES = PRODUCTION_LOCALES.map((locale) => locale.code);

export type ProductionLocaleCode = (typeof PRODUCTION_LOCALES)[number]['code'];

export const isProductionLocale = (locale: string): locale is ProductionLocaleCode =>
  PRODUCTION_LOCALE_CODES.includes(locale as ProductionLocaleCode);
