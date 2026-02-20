import { TaxComputationInput, TaxComputationResult } from '../types';
import { SK_RULES_2026 } from '../rules/sk/2026';
import { computeTaxResult } from './shared';

export const computeSlovakTax = (input: TaxComputationInput): TaxComputationResult =>
  computeTaxResult(input, SK_RULES_2026);
