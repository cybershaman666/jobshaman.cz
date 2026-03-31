export type CompanyMapLocale = 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'at';

type Variants = {
  cs: string;
  en: string;
  sk?: string;
  de?: string;
  pl?: string;
  at?: string;
};

export const resolveCompanyMapLocale = (language?: string | null): CompanyMapLocale => {
  const normalized = String(language || 'en').split('-')[0].toLowerCase();
  if (normalized === 'cs') return 'cs';
  if (normalized === 'sk') return 'sk';
  if (normalized === 'de') return 'de';
  if (normalized === 'pl') return 'pl';
  if (normalized === 'at') return 'at';
  return 'en';
};

export const companyMapText = (locale: CompanyMapLocale, variants: Variants): string => {
  if (locale === 'cs') return variants.cs;
  if (locale === 'sk') return variants.sk || variants.cs;
  if (locale === 'de') return variants.de || variants.en;
  if (locale === 'pl') return variants.pl || variants.en;
  if (locale === 'at') return variants.at || variants.de || variants.en;
  return variants.en;
};

export const companyMapIntlLocale = (locale: CompanyMapLocale): string => {
  if (locale === 'cs') return 'cs-CZ';
  if (locale === 'sk') return 'sk-SK';
  if (locale === 'de') return 'de-DE';
  if (locale === 'pl') return 'pl-PL';
  if (locale === 'at') return 'de-AT';
  return 'en-US';
};
