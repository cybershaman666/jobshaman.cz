import { convertCurrency } from './exchangeRatesService';

const PREMIUM_PRICE_EUR = 14.99;

export interface PremiumPriceDisplay {
  eurValue: number;
  czkValue: number;
  plnValue: number;
  eurLabel: string;
  czkLabel: string;
  plnLabel: string;
  billingLabel: string;
}

export const getPremiumPriceDisplay = (locale: string): PremiumPriceDisplay => {
  const normalizedLocale = String(locale || 'en').toLowerCase();
  const isCs = normalizedLocale.startsWith('cs');
  const isSk = normalizedLocale.startsWith('sk');
  const isDe = normalizedLocale.startsWith('de') || normalizedLocale.startsWith('at');
  const isPl = normalizedLocale.startsWith('pl');
  const czkValue = Math.round(convertCurrency(PREMIUM_PRICE_EUR, 'EUR', 'CZK'));
  const plnValue = Math.round(convertCurrency(PREMIUM_PRICE_EUR, 'EUR', 'PLN'));

  const eurLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(PREMIUM_PRICE_EUR);

  const czkLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(czkValue);

  const plnLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(plnValue);

  const billingLabel = isCs
    ? 'jednorázově na 2 měsíce'
    : isSk
      ? 'jednorazovo na 2 mesiace'
      : isDe
        ? 'einmalig für 2 Monate'
        : isPl
          ? 'jednorazowo na 2 miesiące'
          : 'one-time for 2 months';

  return {
    eurValue: PREMIUM_PRICE_EUR,
    czkValue,
    plnValue,
    eurLabel,
    czkLabel,
    plnLabel,
    billingLabel,
  };
};
