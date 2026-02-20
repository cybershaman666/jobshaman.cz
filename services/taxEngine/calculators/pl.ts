import { TaxComputationInput, TaxComputationResult } from '../types';
import { PL_RULES_2026 } from '../rules/pl/2026';
import { computeTaxResult } from './shared';

export const computePolishTax = (input: TaxComputationInput): TaxComputationResult =>
  computeTaxResult(input, PL_RULES_2026);
