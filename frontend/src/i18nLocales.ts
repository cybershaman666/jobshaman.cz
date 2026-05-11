export const PRODUCTION_LOCALES = [
  { code: 'cs', label: 'Čeština', shortLabel: 'CZ', flag: '🇨🇿' },
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
  { code: 'sk', label: 'Slovenčina', shortLabel: 'SK', flag: '🇸🇰' },
  { code: 'pl', label: 'Polski', shortLabel: 'PL', flag: '🇵🇱' },
  { code: 'de', label: 'Deutsch', shortLabel: 'DE', flag: '🇩🇪' },
  { code: 'at', label: 'Österreich', shortLabel: 'AT', flag: '🇦🇹' },
  { code: 'da', label: 'Dansk', shortLabel: 'DK', flag: '🇩🇰' },
  { code: 'sv', label: 'Svenska', shortLabel: 'SE', flag: '🇸🇪' },
  { code: 'no', label: 'Norsk', shortLabel: 'NO', flag: '🇳🇴' },
  { code: 'fi', label: 'Suomi', shortLabel: 'FI', flag: '🇫🇮' },
] as const;

export const PRODUCTION_LOCALE_CODES = PRODUCTION_LOCALES.map((locale) => locale.code);

export type ProductionLocaleCode = (typeof PRODUCTION_LOCALES)[number]['code'];

export const isProductionLocale = (locale: string): locale is ProductionLocaleCode =>
  PRODUCTION_LOCALE_CODES.includes(locale as ProductionLocaleCode);
