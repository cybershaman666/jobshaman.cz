import { TaxComputationInput, TaxComputationResult } from '../types';
import { AT_RULES_2026 } from '../rules/at/2026';
import { computeTaxResult } from './shared';

export const computeAustrianTax = (input: TaxComputationInput): TaxComputationResult =>
  computeTaxResult(input, AT_RULES_2026);
