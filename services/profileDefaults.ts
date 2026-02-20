import { JHIPreferences, SupportedCountryCode, TaxProfile } from '../types';
import { createDefaultTaxProfile, DEFAULT_TAX_YEAR } from './taxEngine';

export const createDefaultJHIPreferences = (): JHIPreferences => ({
  pillarWeights: {
    financial: 0.3,
    timeCost: 0.25,
    mentalLoad: 0.2,
    growth: 0.15,
    values: 0.1,
  },
  hardConstraints: {
    mustRemote: false,
    maxCommuteMinutes: null,
    minNetMonthly: null,
    excludeShift: false,
    growthRequired: false,
  },
  workStyle: {
    peopleIntensity: 50,
    careerGrowthPreference: 50,
    homeOfficePreference: 50,
  },
});

export const createDefaultTaxProfileByCountry = (
  countryCode: SupportedCountryCode = 'CZ',
  year: number = DEFAULT_TAX_YEAR
): TaxProfile => createDefaultTaxProfile(countryCode, year);
