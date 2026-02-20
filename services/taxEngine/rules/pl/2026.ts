import { CountryTaxRuleSet } from '../../types';

export const PL_RULES_2026: CountryTaxRuleSet = {
  countryCode: 'PL',
  taxYear: 2026,
  version: 'PL-2026-v1',
  employee: {
    employeeSocialRate: 0.1371,
    employeeHealthRate: 0.09,
    taxableAllowanceAnnual: 30000,
    taxBrackets: [
      { upTo: 120000, rate: 0.12 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.32 },
    ],
    taxpayerCreditAnnual: 3600,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [1112.04, 1112.04, 2000],
    singleParentBonusAnnual: 1500,
  },
  contractor: {
    taxRate: 0.19,
    expenseLumpSumRate: 0.5,
    socialRate: 0.31,
    healthRate: 0.09,
    taxableAllowanceAnnual: 30000,
    taxpayerCreditAnnual: 3600,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [1112.04, 1112.04, 2000],
    singleParentBonusAnnual: 1500,
  },
};
