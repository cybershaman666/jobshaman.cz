import { CountryTaxRuleSet, ProgressiveBracket, TaxComputationInput, TaxComputationResult } from '../types';

const clampNonNegative = (value: number): number => Math.max(0, value);

const computeProgressiveTax = (taxableBase: number, brackets: ProgressiveBracket[]): number => {
  if (taxableBase <= 0) return 0;
  let previousCap = 0;
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableBase <= previousCap) break;
    const taxableInBracket = Math.min(taxableBase, bracket.upTo) - previousCap;
    tax += taxableInBracket * bracket.rate;
    previousCap = bracket.upTo;
  }

  return clampNonNegative(tax);
};

const computeChildCredit = (childrenCount: number, childCreditsAnnual: number[]): number => {
  if (childrenCount <= 0) return 0;
  let total = 0;
  for (let i = 0; i < childrenCount; i += 1) {
    total += childCreditsAnnual[i] ?? childCreditsAnnual[childCreditsAnnual.length - 1] ?? 0;
  }
  return total;
};

const roundCurrency = (value: number): number => Math.round(value);

export const computeTaxResult = (
  input: TaxComputationInput,
  rules: CountryTaxRuleSet
): TaxComputationResult => {
  const grossMonthly = clampNonNegative(input.grossMonthly);
  const grossAnnual = grossMonthly * 12;
  const details: string[] = [];

  if (input.taxProfile.employmentType === 'contractor') {
    const c = rules.contractor;
    const taxableBaseAnnual = clampNonNegative(grossAnnual * (1 - c.expenseLumpSumRate) - c.taxableAllowanceAnnual);
    const employeeSocialAnnual = clampNonNegative(taxableBaseAnnual * c.socialRate);
    const employeeHealthAnnual = clampNonNegative(taxableBaseAnnual * c.healthRate);
    const rawIncomeTaxAnnual = clampNonNegative(taxableBaseAnnual * c.taxRate);

    let reliefsAnnual = c.taxpayerCreditAnnual;
    details.push('Taxpayer credit');

    if (
      input.taxProfile.maritalStatus === 'married' &&
      (input.taxProfile.spouseAnnualIncome ?? 0) <= c.spouseIncomeLimitAnnual
    ) {
      reliefsAnnual += c.spouseCreditAnnual;
      details.push('Spouse credit');
    }

    if (input.taxProfile.childrenCount > 0) {
      reliefsAnnual += computeChildCredit(input.taxProfile.childrenCount, c.childCreditsAnnual);
      details.push(`Children credit (${input.taxProfile.childrenCount})`);
    }

    if (input.taxProfile.isSingleParent) {
      reliefsAnnual += c.singleParentBonusAnnual;
      details.push('Single parent bonus');
    }

    const incomeTaxAnnual = clampNonNegative(rawIncomeTaxAnnual - reliefsAnnual);
    const totalDeductionsAnnual = incomeTaxAnnual + employeeSocialAnnual + employeeHealthAnnual;
    const netAnnual = clampNonNegative(grossAnnual - totalDeductionsAnnual);

    return {
      countryCode: rules.countryCode,
      taxYear: rules.taxYear,
      ruleVersion: rules.version,
      grossMonthly: roundCurrency(grossMonthly),
      netMonthly: roundCurrency(netAnnual / 12),
      totalDeductionsMonthly: roundCurrency(totalDeductionsAnnual / 12),
      effectiveRate: grossAnnual > 0 ? totalDeductionsAnnual / grossAnnual : 0,
      breakdown: {
        incomeTax: roundCurrency(incomeTaxAnnual / 12),
        employeeSocial: roundCurrency(employeeSocialAnnual / 12),
        employeeHealth: roundCurrency(employeeHealthAnnual / 12),
        reliefsApplied: roundCurrency(reliefsAnnual / 12),
        details,
      },
    };
  }

  const e = rules.employee;
  const employeeSocialAnnual = clampNonNegative(grossAnnual * e.employeeSocialRate);
  const employeeHealthAnnual = clampNonNegative(grossAnnual * e.employeeHealthRate);
  const taxableBaseAnnual = clampNonNegative(grossAnnual - employeeSocialAnnual - employeeHealthAnnual - e.taxableAllowanceAnnual);
  const rawIncomeTaxAnnual = computeProgressiveTax(taxableBaseAnnual, e.taxBrackets);

  let reliefsAnnual = e.taxpayerCreditAnnual;
  details.push('Taxpayer credit');

  if (
    input.taxProfile.maritalStatus === 'married' &&
    (input.taxProfile.spouseAnnualIncome ?? 0) <= e.spouseIncomeLimitAnnual
  ) {
    reliefsAnnual += e.spouseCreditAnnual;
    details.push('Spouse credit');
  }

  if (input.taxProfile.childrenCount > 0) {
    reliefsAnnual += computeChildCredit(input.taxProfile.childrenCount, e.childCreditsAnnual);
    details.push(`Children credit (${input.taxProfile.childrenCount})`);
  }

  if (input.taxProfile.isSingleParent) {
    reliefsAnnual += e.singleParentBonusAnnual;
    details.push('Single parent bonus');
  }

  const incomeTaxAnnual = clampNonNegative(rawIncomeTaxAnnual - reliefsAnnual);
  const totalDeductionsAnnual = incomeTaxAnnual + employeeSocialAnnual + employeeHealthAnnual;
  const netAnnual = clampNonNegative(grossAnnual - totalDeductionsAnnual);

  return {
    countryCode: rules.countryCode,
    taxYear: rules.taxYear,
    ruleVersion: rules.version,
    grossMonthly: roundCurrency(grossMonthly),
    netMonthly: roundCurrency(netAnnual / 12),
    totalDeductionsMonthly: roundCurrency(totalDeductionsAnnual / 12),
    effectiveRate: grossAnnual > 0 ? totalDeductionsAnnual / grossAnnual : 0,
    breakdown: {
      incomeTax: roundCurrency(incomeTaxAnnual / 12),
      employeeSocial: roundCurrency(employeeSocialAnnual / 12),
      employeeHealth: roundCurrency(employeeHealthAnnual / 12),
      reliefsApplied: roundCurrency(reliefsAnnual / 12),
      details,
    },
  };
};
