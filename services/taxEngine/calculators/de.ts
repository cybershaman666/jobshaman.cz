import { TaxComputationInput, TaxComputationResult } from '../types';
import { DE_RULES_2026 } from '../rules/de/2026';
import { computeTaxResult } from './shared';

export const computeGermanTax = (input: TaxComputationInput): TaxComputationResult =>
  computeTaxResult(input, DE_RULES_2026);
