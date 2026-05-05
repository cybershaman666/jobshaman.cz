import { SupportedCountryCode, TaxProfile } from '../../types';

export interface ProgressiveBracket {
  upTo: number;
  rate: number;
}

export interface CountryEmployeeRules {
  employeeSocialRate: number;
  employeeHealthRate: number;
  taxableAllowanceAnnual: number;
  taxBrackets: ProgressiveBracket[];
  taxpayerCreditAnnual: number;
  spouseCreditAnnual: number;
  spouseIncomeLimitAnnual: number;
  childCreditsAnnual: number[];
  singleParentBonusAnnual: number;
}

export interface CountryContractorRules {
  taxRate: number;
  expenseLumpSumRate: number;
  socialRate: number;
  healthRate: number;
  taxableAllowanceAnnual: number;
  taxpayerCreditAnnual: number;
  spouseCreditAnnual: number;
  spouseIncomeLimitAnnual: number;
  childCreditsAnnual: number[];
  singleParentBonusAnnual: number;
}

export interface CountryTaxRuleSet {
  countryCode: SupportedCountryCode;
  taxYear: number;
  version: string;
  employee: CountryEmployeeRules;
  contractor: CountryContractorRules;
}

export interface TaxComputationInput {
  grossMonthly: number;
  taxProfile: TaxProfile;
}

export interface TaxComputationResult {
  countryCode: SupportedCountryCode;
  taxYear: number;
  ruleVersion: string;
  grossMonthly: number;
  netMonthly: number;
  totalDeductionsMonthly: number;
  effectiveRate: number;
  breakdown: {
    incomeTax: number;
    employeeSocial: number;
    employeeHealth: number;
    reliefsApplied: number;
    details: string[];
  };
}
