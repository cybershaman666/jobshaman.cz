import { CountryTaxRuleSet } from '../../types';

export const SK_RULES_2026: CountryTaxRuleSet = {
  countryCode: 'SK',
  taxYear: 2026,
  version: 'SK-2026-v1',
  employee: {
    employeeSocialRate: 0.094,
    employeeHealthRate: 0.04,
    taxableAllowanceAnnual: 5966.76,
    taxBrackets: [
      { upTo: 47937.12, rate: 0.19 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.25 },
    ],
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 5000,
    spouseIncomeLimitAnnual: 5000,
    childCreditsAnnual: [1680, 1680, 1680],
    singleParentBonusAnnual: 600,
  },
  contractor: {
    taxRate: 0.19,
    expenseLumpSumRate: 0.6,
    socialRate: 0.3315,
    healthRate: 0.14,
    taxableAllowanceAnnual: 5966.76,
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 5000,
    spouseIncomeLimitAnnual: 5000,
    childCreditsAnnual: [1680, 1680, 1680],
    singleParentBonusAnnual: 600,
  },
};
