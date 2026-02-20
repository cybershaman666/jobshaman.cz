import { CountryTaxRuleSet } from '../../types';

export const AT_RULES_2026: CountryTaxRuleSet = {
  countryCode: 'AT',
  taxYear: 2026,
  version: 'AT-2026-v1',
  employee: {
    employeeSocialRate: 0.1807,
    employeeHealthRate: 0,
    taxableAllowanceAnnual: 0,
    taxBrackets: [
      { upTo: 13539, rate: 0 },
      { upTo: 21992, rate: 0.2 },
      { upTo: 36458, rate: 0.3 },
      { upTo: 70365, rate: 0.4 },
      { upTo: 104859, rate: 0.48 },
      { upTo: 1000000, rate: 0.5 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.55 },
    ],
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [2000, 2000, 2000],
    singleParentBonusAnnual: 500,
  },
  contractor: {
    taxRate: 0.3,
    expenseLumpSumRate: 0.3,
    socialRate: 0.26,
    healthRate: 0,
    taxableAllowanceAnnual: 0,
    taxpayerCreditAnnual: 0,
    spouseCreditAnnual: 0,
    spouseIncomeLimitAnnual: 0,
    childCreditsAnnual: [2000, 2000, 2000],
    singleParentBonusAnnual: 500,
  },
};
