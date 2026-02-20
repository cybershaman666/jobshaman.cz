export interface ExchangeRateSnapshot {
  asOf: string;
  base: 'EUR';
  rates: Record<string, number>;
}

// Snapshot rates (base EUR). Update through operational yearly checklist.
const SNAPSHOT: ExchangeRateSnapshot = {
  asOf: '2026-01-02',
  base: 'EUR',
  rates: {
    EUR: 1,
    CZK: 25.1,
    PLN: 4.35,
    CHF: 0.95,
    USD: 1.07,
    GBP: 0.84,
  },
};

const normalizeCurrency = (currency: string): string => currency.toUpperCase();

export const getExchangeRateSnapshot = (): ExchangeRateSnapshot => SNAPSHOT;

export const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (!amount || from === to) return amount;

  const fromRate = SNAPSHOT.rates[from];
  const toRate = SNAPSHOT.rates[to];
  if (!fromRate || !toRate) return amount;

  // Convert via EUR base.
  const amountInEur = amount / fromRate;
  return amountInEur * toRate;
};
