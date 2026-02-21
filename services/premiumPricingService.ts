import { convertCurrency } from './exchangeRatesService';

const PREMIUM_PRICE_EUR = 14.99;

export interface PremiumPriceDisplay {
  eurMonthlyValue: number;
  czkMonthlyValue: number;
  plnMonthlyValue: number;
  eurMonthlyLabel: string;
  czkMonthlyLabel: string;
  plnMonthlyLabel: string;
}

export const getPremiumPriceDisplay = (locale: string): PremiumPriceDisplay => {
  const czkMonthly = Math.round(convertCurrency(PREMIUM_PRICE_EUR, 'EUR', 'CZK'));
  const plnMonthly = Math.round(convertCurrency(PREMIUM_PRICE_EUR, 'EUR', 'PLN'));

  const eurMonthlyLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(PREMIUM_PRICE_EUR);

  const czkMonthlyLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(czkMonthly);

  const plnMonthlyLabel = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(plnMonthly);

  return {
    eurMonthlyValue: PREMIUM_PRICE_EUR,
    czkMonthlyValue: czkMonthly,
    plnMonthlyValue: plnMonthly,
    eurMonthlyLabel,
    czkMonthlyLabel,
    plnMonthlyLabel,
  };
};

