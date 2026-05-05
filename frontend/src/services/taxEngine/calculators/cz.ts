import { TaxComputationInput, TaxComputationResult } from '../types';
import { CZ_RULES_2026 } from '../rules/cz/2026';
import { computeTaxResult } from './shared';

export const computeCzechTax = (input: TaxComputationInput): TaxComputationResult =>
  computeTaxResult(input, CZ_RULES_2026);
