import { TaxComputationInput, TaxComputationResult } from '../types';
import { computeTaxResult } from './shared';
import { DE_RULES_2026 } from '../rules/de/2026';

const clampNonNegative = (value: number): number => Math.max(0, value);
const floorEuro = (value: number): number => Math.floor(value);

const DE_PAP_2026 = {
  GFB: 12348,
  W1STKL5: 14071,
  W2STKL5: 34939,
  W3STKL5: 222260,
  SOLZFREI: 20350,
  SOLZMIN_RATE: 0.119,
  SOLZ_RATE: 0.055,
  BBGRVALV: 101400,
  BBGKVPV: 69750,
  RVSATZAN: 0.0930,
  AVSATZAN: 0.0130,
  KVSATZAN_BASE: 0.07,
  PVSATZAN_BASE: 0.018,
  PV_CHILDLESS_SURCHARGE: 0.006,
  PV_CHILD_REDUCTION_PER_CHILD: 0.0025,
  ANP: 1230,
  SAP: 36,
  EFA: 4260,
  KFB_SINGLE: 9756,
  KFB_SPLIT: 4878,
};

const resolveTaxClass = (input: TaxComputationInput): string => {
  if (input.taxProfile.deTaxClass) return input.taxProfile.deTaxClass;
  return input.taxProfile.maritalStatus === 'married' ? 'IV' : 'I';
};

const resolveZkf = (input: TaxComputationInput): number => {
  const children = input.taxProfile.childrenCount || 0;
  if (children <= 0) return 0;
  if (input.taxProfile.isSingleParent) return children;
  return children * 0.5;
};

const computeKvRate = (kvzRate: number): number => {
  return DE_PAP_2026.KVSATZAN_BASE + kvzRate / 2 / 100;
};

const computePvRate = (childrenCount: number): number => {
  let rate = DE_PAP_2026.PVSATZAN_BASE;
  if (childrenCount <= 0) {
    rate += DE_PAP_2026.PV_CHILDLESS_SURCHARGE;
    return rate;
  }
  const reductionSteps = Math.min(Math.max(childrenCount - 1, 0), 4);
  rate -= reductionSteps * DE_PAP_2026.PV_CHILD_REDUCTION_PER_CHILD;
  return Math.max(rate, 0);
};

const computeUpTab26 = (x: number, kztab: number): number => {
  if (x <= 0) return 0;
  let st = 0;
  if (x < DE_PAP_2026.GFB + 1) {
    st = 0;
  } else if (x < 17800) {
    const y = (x - DE_PAP_2026.GFB) / 10000;
    st = (y * 914.51 + 1400) * y;
  } else if (x < 69879) {
    const y = (x - 17799) / 10000;
    st = (y * 173.1 + 2397) * y + 1034.87;
  } else if (x < 277826) {
    st = x * 0.42 - 11135.63;
  } else {
    st = x * 0.45 - 19470.38;
  }
  st = st * kztab;
  return floorEuro(st);
};

const computeTaxClassFiveSix = (x: number): number => {
  const zx = Math.max(0, x);
  const st1 = computeUpTab26(zx * 1.25, 1);
  const st2 = computeUpTab26(zx * 0.75, 1);
  const diff = (st1 - st2) * 2;
  const mist = zx * 0.14;
  let st = Math.max(diff, mist);

  if (zx > DE_PAP_2026.W1STKL5) {
    const vergl = computeUpTab26(DE_PAP_2026.W1STKL5, 1);
    const hoch = st + (zx - DE_PAP_2026.W1STKL5) * 0.42;
    st = Math.max(hoch, vergl);
  }

  if (zx > DE_PAP_2026.W2STKL5) {
    const midCap = Math.min(zx, DE_PAP_2026.W3STKL5);
    st += (midCap - DE_PAP_2026.W2STKL5) * 0.42;
    if (zx > DE_PAP_2026.W3STKL5) {
      st += (zx - DE_PAP_2026.W3STKL5) * 0.45;
    }
  }

  return floorEuro(st);
};

const computeSolz = (incomeTaxAnnual: number): number => {
  if (incomeTaxAnnual <= DE_PAP_2026.SOLZFREI) return 0;
  const solzMin = (incomeTaxAnnual - DE_PAP_2026.SOLZFREI) * DE_PAP_2026.SOLZMIN_RATE;
  const solzPct = incomeTaxAnnual * DE_PAP_2026.SOLZ_RATE;
  return floorEuro(Math.min(solzMin, solzPct));
};

export const computeGermanTax = (input: TaxComputationInput): TaxComputationResult => {
  if (input.taxProfile.employmentType === 'contractor') {
    return computeTaxResult(input, DE_RULES_2026);
  }

  const grossMonthly = clampNonNegative(input.grossMonthly);
  const grossAnnual = grossMonthly * 12;
  const details: string[] = [];
  const taxClass = resolveTaxClass(input);
  const childrenCount = input.taxProfile.childrenCount || 0;

  const pensionBase = Math.min(grossAnnual, DE_PAP_2026.BBGRVALV);
  const healthBase = Math.min(grossAnnual, DE_PAP_2026.BBGKVPV);

  const employeeSocialAnnual = pensionBase * (DE_PAP_2026.RVSATZAN + DE_PAP_2026.AVSATZAN);
  const kvzRate = input.taxProfile.deKvzRate ?? 2.9;
  const employeeHealthAnnual = healthBase * (computeKvRate(kvzRate) + computePvRate(childrenCount));

  const anp = Math.min(DE_PAP_2026.ANP, grossAnnual);
  const efa = taxClass === 'II' ? DE_PAP_2026.EFA : 0;
  const sap = DE_PAP_2026.SAP;

  const taxableIncomeAnnual = clampNonNegative(grossAnnual - employeeSocialAnnual - employeeHealthAnnual - anp - efa - sap);
  const kztab = taxClass === 'III' ? 2 : 1;

  let incomeTaxAnnual = 0;
  if (taxClass === 'V' || taxClass === 'VI') {
    incomeTaxAnnual = computeTaxClassFiveSix(taxableIncomeAnnual);
  } else {
    incomeTaxAnnual = computeUpTab26(taxableIncomeAnnual / kztab, kztab);
  }

  const solzAnnual = computeSolz(incomeTaxAnnual);
  if (solzAnnual > 0) details.push('Solidaritätszuschlag');

  const churchTaxRate = input.taxProfile.deChurchTaxRate || 0;
  const churchTaxAnnual = incomeTaxAnnual * churchTaxRate;
  if (churchTaxAnnual > 0) details.push(`Kirchensteuer (${Math.round(churchTaxRate * 100)}%)`);
  details.push(`KVZ ${kvzRate.toFixed(1)}%`);

  const totalTaxAnnual = incomeTaxAnnual + solzAnnual + churchTaxAnnual;
  const totalDeductionsAnnual = totalTaxAnnual + employeeSocialAnnual + employeeHealthAnnual;
  const netAnnual = clampNonNegative(grossAnnual - totalDeductionsAnnual);

  const zkf = resolveZkf(input);
  const kfbPerChild = taxClass === 'III' ? DE_PAP_2026.KFB_SPLIT : DE_PAP_2026.KFB_SINGLE;
  if (zkf > 0) details.push(`Kinderfreibetrag-Faktor ${zkf.toFixed(1)} (Basis ${kfbPerChild} EUR)`);

  return {
    countryCode: 'DE',
    taxYear: 2026,
    ruleVersion: 'DE-PAP-2026-v1',
    grossMonthly: Math.round(grossMonthly),
    netMonthly: Math.round(netAnnual / 12),
    totalDeductionsMonthly: Math.round(totalDeductionsAnnual / 12),
    effectiveRate: grossAnnual > 0 ? totalDeductionsAnnual / grossAnnual : 0,
    breakdown: {
      incomeTax: Math.round(totalTaxAnnual / 12),
      employeeSocial: Math.round(employeeSocialAnnual / 12),
      employeeHealth: Math.round(employeeHealthAnnual / 12),
      reliefsApplied: 0,
      details,
    },
  };
};
