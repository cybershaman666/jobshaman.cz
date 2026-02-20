import { CountryTaxRuleSet } from '../../types';

export const DE_RULES_2026: CountryTaxRuleSet = {
  countryCode: 'DE',
  taxYear: 2026,
  version: 'DE-2026-v1',
  employee: {
    employeeSocialRate: 0.205,
    employeeHealthRate: 0,
    taxableAllowanceAnnual: 12096,
    taxBrackets: [
      { upTo: 17005, rate: 0.14 },
      { upTo: 68480, rate: 0.24 },
      { upTo: 277825, rate: 0.42 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
    ],
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [3000, 3000, 3000],
    singleParentBonusAnnual: 4260,
  },
  contractor: {
    taxRate: 0.28,
    expenseLumpSumRate: 0.3,
    socialRate: 0.2,
    healthRate: 0,
    taxableAllowanceAnnual: 12096,
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [3000, 3000, 3000],
    singleParentBonusAnnual: 4260,
  },
};
