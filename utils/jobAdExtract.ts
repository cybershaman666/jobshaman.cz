type Timeframe = 'month' | 'year' | 'hour' | 'day' | 'week';

export type SalaryHint = {
  salaryFrom?: number;
  salaryTo?: number;
  currency?: string;
  timeframe?: Timeframe;
};

const clampPositiveInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

const normalizeText = (text: string): string =>
  String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const detectCurrency = (text: string): string | undefined => {
  const t = text.toLowerCase();
  if (/(kč|kc|czk)\b/.test(t)) return 'CZK';
  if (/(€|\beur\b)/.test(t)) return 'EUR';
  if (/(zł|\bpln\b)/.test(t)) return 'PLN';
  if (/(\$|\busd\b)/.test(t)) return 'USD';
  if (/(£|\bgbp\b)/.test(t)) return 'GBP';
  if (/(chf|\bfr\.\b|\bfranken\b)/.test(t)) return 'CHF';
  return undefined;
};

const detectTimeframe = (text: string): Timeframe | undefined => {
  const t = text.toLowerCase();
  if (/(\/\s*rok|\brok\b|ročn|rocni|\byear\b|annual|annually|\bjahr\b|jährlich|jaehrlich|p\.a\.)/i.test(t)) return 'year';
  if (/(\/\s*m[eě]s|měs|mesi|\bmonth\b|monthly|\bmonat\b|miesi[ąa]c)/i.test(t)) return 'month';
  if (/(\/\s*h|\/\s*hod|hodin|\bhour\b|hourly)/i.test(t)) return 'hour';
  if (/(\/\s*den|\bday\b|daily)/i.test(t)) return 'day';
  if (/(\/\s*t[ýy]d|\bweek\b|weekly)/i.test(t)) return 'week';
  return undefined;
};

const parseAmount = (raw: string, hasK: boolean): number => {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  let value = parseInt(cleaned, 10);
  if (!Number.isFinite(value)) return 0;
  if (hasK && value < 1000) value *= 1000;
  return value;
};

const toMonthly = (value: number, timeframe: Timeframe): number => {
  if (!value) return 0;
  if (timeframe === 'month') return value;
  if (timeframe === 'year') return value / 12;
  // Conservative conversions aligned with other parts of the app
  if (timeframe === 'hour') return value * 22 * 8;
  if (timeframe === 'day') return value * 22;
  return value * 4.345;
};

export const extractSalaryHint = (text: string): SalaryHint => {
  const normalized = normalizeText(text);
  if (!normalized) return {};

  const currency = detectCurrency(normalized);
  const timeframeDetected = detectTimeframe(normalized) || 'month';

  // Range: "70 000 - 90 000", "70k–90k"
  const rangeMatch = normalized.match(
    /(\d[\d\s.,]{1,12})\s*(k)?\s*(?:-|–|—|to|až)\s*(\d[\d\s.,]{1,12})\s*(k)?/i
  );
  if (rangeMatch) {
    const fromRaw = rangeMatch[1];
    const fromK = Boolean(rangeMatch[2]);
    const toRaw = rangeMatch[3];
    const toK = Boolean(rangeMatch[4]);
    const from = parseAmount(fromRaw, fromK);
    const to = parseAmount(toRaw, toK);
    if (from > 0 && to > 0) {
      return {
        salaryFrom: clampPositiveInt(toMonthly(Math.min(from, to), timeframeDetected)),
        salaryTo: clampPositiveInt(toMonthly(Math.max(from, to), timeframeDetected)),
        currency,
        timeframe: 'month'
      };
    }
  }

  // Single value: "80k", "120 000 Kč"
  const singleMatch = normalized.match(/(\d[\d\s.,]{1,12})\s*(k)?/i);
  if (singleMatch) {
    const val = parseAmount(singleMatch[1], Boolean(singleMatch[2]));
    if (val > 0) {
      return {
        salaryFrom: clampPositiveInt(toMonthly(val, timeframeDetected)),
        currency,
        timeframe: 'month'
      };
    }
  }

  return { currency, timeframe: 'month' };
};

