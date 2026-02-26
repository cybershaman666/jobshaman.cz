import { SupportedCountryCode, TaxProfile } from '../../types';
import { computeAustrianTax } from './calculators/at';
import { computeCzechTax } from './calculators/cz';
import { computeGermanTax } from './calculators/de';
import { computePolishTax } from './calculators/pl';
import { computeSlovakTax } from './calculators/sk';
import { TaxComputationInput, TaxComputationResult } from './types';

export const DEFAULT_TAX_YEAR = 2026;

export const createDefaultTaxProfile = (
  countryCode: SupportedCountryCode = 'CZ',
  taxYear: number = DEFAULT_TAX_YEAR
): TaxProfile => {
  const base: TaxProfile = {
    countryCode,
    taxYear,
    employmentType: 'employee',
    maritalStatus: 'single',
    spouseAnnualIncome: 0,
    childrenCount: 0,
    isSingleParent: false,
    specialReliefs: [],
  };

  if (countryCode === 'DE') {
    return {
      ...base,
      deTaxClass: base.maritalStatus === 'married' ? 'IV' : 'I',
      deChurchTaxRate: 0,
      deKvzRate: 2.9,
    };
  }

  if (countryCode === 'AT') {
    return {
      ...base,
      atHas13th14th: true,
    };
  }

  return base;
};

export const computeTaxByProfile = (input: TaxComputationInput): TaxComputationResult => {
  switch (input.taxProfile.countryCode) {
    case 'CZ':
      return computeCzechTax(input);
    case 'SK':
      return computeSlovakTax(input);
    case 'PL':
      return computePolishTax(input);
    case 'DE':
      return computeGermanTax(input);
    case 'AT':
      return computeAustrianTax(input);
    default:
      return computeCzechTax({ ...input, taxProfile: createDefaultTaxProfile('CZ', input.taxProfile.taxYear) });
  }
};
