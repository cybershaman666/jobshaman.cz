import { CountryTaxRuleSet } from '../../types';

export const CZ_RULES_2026: CountryTaxRuleSet = {
  countryCode: 'CZ',
  taxYear: 2026,
  version: 'CZ-2026-v1',
  employee: {
    employeeSocialRate: 0.071,
    employeeHealthRate: 0.045,
    taxableAllowanceAnnual: 0,
    taxBrackets: [
      { upTo: 1582812, rate: 0.15 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.23 },
    ],
    taxpayerCreditAnnual: 30840,
    spouseCreditAnnual: 24840,
    spouseIncomeLimitAnnual: 68000,
    childCreditsAnnual: [15204, 22320, 27840],
    singleParentBonusAnnual: 0,
  },
  contractor: {
    taxRate: 0.15,
    expenseLumpSumRate: 0.6,
    socialRate: 0.292,
    healthRate: 0.135,
    taxableAllowanceAnnual: 0,
    taxpayerCreditAnnual: 30840,
    spouseCreditAnnual: 24840,
    spouseIncomeLimitAnnual: 68000,
    childCreditsAnnual: [15204, 22320, 27840],
    singleParentBonusAnnual: 0,
  },
};
