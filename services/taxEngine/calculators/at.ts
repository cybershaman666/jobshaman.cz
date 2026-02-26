import { TaxComputationInput, TaxComputationResult } from '../types';
import { AT_RULES_2026 } from '../rules/at/2026';
import { computeTaxResult } from './shared';

const clampNonNegative = (value: number): number => Math.max(0, value);

const AT_TARIFF_2026 = [
  { upTo: 13539, rate: 0 },
  { upTo: 21992, rate: 0.2 },
  { upTo: 36458, rate: 0.3 },
  { upTo: 70365, rate: 0.4 },
  { upTo: 104859, rate: 0.48 },
  { upTo: 1000000, rate: 0.5 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.55 },
];

const AT_SPECIAL_BANDS = [
  { upTo: 620, rate: 0 },
  { upTo: 24380, rate: 0.06 },
  { upTo: 25000, rate: 0.27 },
  { upTo: 33333, rate: 0.3575 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.5 },
];

const AT_SPECIAL_MIN_SECHSTEL = 2615;

const computeProgressiveTax = (base: number, bands: { upTo: number; rate: number }[]): number => {
  if (base <= 0) return 0;
  let tax = 0;
  let previousCap = 0;
  for (const band of bands) {
    if (base <= previousCap) break;
    const taxable = Math.min(base, band.upTo) - previousCap;
    tax += taxable * band.rate;
    previousCap = band.upTo;
  }
  return clampNonNegative(tax);
};

const computeSpecialTax = (amount: number): number => {
  return computeProgressiveTax(amount, AT_SPECIAL_BANDS);
};

export const computeAustrianTax = (input: TaxComputationInput): TaxComputationResult => {
  if (input.taxProfile.employmentType === 'contractor') {
    return computeTaxResult(input, AT_RULES_2026);
  }

  const grossMonthly = clampNonNegative(input.grossMonthly);
  const has13th14th = input.taxProfile.atHas13th14th ?? true;
  const regularAnnualGross = grossMonthly * 12;
  const specialAnnualGross = has13th14th ? grossMonthly * 2 : 0;
  const totalAnnualGross = regularAnnualGross + specialAnnualGross;

  const employeeSocialAnnual = totalAnnualGross * AT_RULES_2026.employee.employeeSocialRate;
  const taxableBaseAnnual = clampNonNegative(totalAnnualGross - employeeSocialAnnual);

  const regularTaxBase = totalAnnualGross > 0 ? taxableBaseAnnual * (regularAnnualGross / totalAnnualGross) : 0;
  const specialTaxBase = clampNonNegative(taxableBaseAnnual - regularTaxBase);

  let incomeTaxAnnual = 0;
  const details: string[] = [];

  if (!has13th14th || specialTaxBase <= 0) {
    incomeTaxAnnual = computeProgressiveTax(taxableBaseAnnual, AT_TARIFF_2026);
  } else {
    const sechstel = regularTaxBase / 6;
    const eligibleSpecial = sechstel > AT_SPECIAL_MIN_SECHSTEL
      ? Math.min(specialTaxBase, sechstel)
      : 0;
    const excessSpecial = clampNonNegative(specialTaxBase - eligibleSpecial);

    const taxOnRegular = computeProgressiveTax(regularTaxBase, AT_TARIFF_2026);
    const taxOnExcess = excessSpecial > 0
      ? computeProgressiveTax(regularTaxBase + excessSpecial, AT_TARIFF_2026) - taxOnRegular
      : 0;
    const taxOnSpecial = eligibleSpecial > 0 ? computeSpecialTax(eligibleSpecial) : 0;

    incomeTaxAnnual = taxOnRegular + taxOnExcess + taxOnSpecial;

    if (eligibleSpecial > 0) details.push('Sonderzahlungen (13./14.)');
  }

  const totalDeductionsAnnual = incomeTaxAnnual + employeeSocialAnnual;
  const netAnnual = clampNonNegative(totalAnnualGross - totalDeductionsAnnual);

  return {
    countryCode: 'AT',
    taxYear: 2026,
    ruleVersion: 'AT-2026-v2',
    grossMonthly: Math.round(grossMonthly),
    netMonthly: Math.round(netAnnual / 12),
    totalDeductionsMonthly: Math.round(totalDeductionsAnnual / 12),
    effectiveRate: totalAnnualGross > 0 ? totalDeductionsAnnual / totalAnnualGross : 0,
    breakdown: {
      incomeTax: Math.round(incomeTaxAnnual / 12),
      employeeSocial: Math.round(employeeSocialAnnual / 12),
      employeeHealth: 0,
      reliefsApplied: 0,
      details,
    },
  };
};
