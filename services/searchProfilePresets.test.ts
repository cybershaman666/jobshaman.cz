import { jest } from '@jest/globals';

jest.mock('../shared/candidate_intent_taxonomy.json', () => ({
  default: {
    version: 'candidate-intent-v1',
    domains: {
      operations: {
        labels: { cs: 'Operations', sk: 'Operations', en: 'Operations', de: 'Operations', pl: 'Operations' },
        keywords: ['operations', 'office manager'],
        related: ['product_management', 'customer_support'],
      },
      product_management: {
        labels: { cs: 'Product management', sk: 'Product management', en: 'Product management', de: 'Produktmanagement', pl: 'Product management' },
        keywords: ['product manager', 'product owner'],
        related: ['operations', 'marketing'],
      },
      customer_support: {
        labels: { cs: 'Customer support', sk: 'Customer support', en: 'Customer support', de: 'Kundenservice', pl: 'Obsługa klienta' },
        keywords: ['customer support', 'support specialist'],
        related: ['operations', 'sales'],
      },
      marketing: {
        labels: { cs: 'Marketing', sk: 'Marketing', en: 'Marketing', de: 'Marketing', pl: 'Marketing' },
        keywords: ['marketing'],
        related: ['product_management', 'sales'],
      },
      sales: {
        labels: { cs: 'Sales', sk: 'Sales', en: 'Sales', de: 'Vertrieb', pl: 'Sprzedaż' },
        keywords: ['sales'],
        related: ['customer_support', 'operations'],
      },
    },
  },
}));

import { getDefaultCandidateSearchFilters } from './searchProfilePresets';
import type { UserProfile } from '../types';

const makeProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  id: 'candidate-1',
  isLoggedIn: true,
  name: 'Candidate',
  email: 'candidate@example.com',
  role: 'candidate',
  address: 'Brno',
  coordinates: { lat: 49.1951, lon: 16.6068 },
  preferences: {
    workLifeBalance: 50,
    financialGoals: 50,
    commuteTolerance: 45,
    priorities: [],
    searchProfile: {
      nearBorder: false,
      dogCount: 0,
      wantsContractorRoles: false,
      wantsDogFriendlyOffice: false,
      wantsRemoteRoles: false,
      preferredWorkArrangement: null,
      remoteLanguageCodes: ['cs'],
      preferredBenefitKeys: [],
      defaultEnableCommuteFilter: false,
      defaultMaxDistanceKm: 30,
      primaryDomain: null,
      secondaryDomains: [],
      avoidDomains: [],
      targetRole: '',
      seniority: null,
      includeAdjacentDomains: true,
      inferredPrimaryDomain: null,
      inferredTargetRole: '',
      inferenceSource: 'none',
      inferenceConfidence: null,
    },
  },
  ...overrides,
}) as UserProfile;

describe('getDefaultCandidateSearchFilters', () => {
  test('uses profile commute, border, benefit and contractor defaults when location is available', () => {
    const profile = makeProfile({
      preferences: {
        ...makeProfile().preferences,
        searchProfile: {
          ...makeProfile().preferences.searchProfile!,
          nearBorder: true,
          wantsContractorRoles: true,
          wantsDogFriendlyOffice: true,
          preferredBenefitKeys: ['meal_allowance'],
          defaultEnableCommuteFilter: true,
          defaultMaxDistanceKm: 50,
          preferredWorkArrangement: 'hybrid',
        },
      },
    });

    expect(getDefaultCandidateSearchFilters(profile)).toEqual({
      filterContractTypes: ['ico'],
      filterBenefits: ['meal_allowance', 'dog_friendly'],
      filterLanguageCodes: [],
      enableCommuteFilter: true,
      filterMaxDistance: 50,
      globalSearch: true,
      abroadOnly: false,
      remoteOnly: false,
      filterWorkArrangement: 'hybrid',
    });
  });

  test('falls back to remote-first defaults when commute filtering is not enabled', () => {
    const profile = makeProfile({
      preferences: {
        ...makeProfile().preferences,
        searchProfile: {
          ...makeProfile().preferences.searchProfile!,
          wantsRemoteRoles: true,
          remoteLanguageCodes: ['en', 'de'],
          defaultEnableCommuteFilter: false,
          preferredWorkArrangement: null,
        },
      },
    });

    expect(getDefaultCandidateSearchFilters(profile)).toEqual({
      filterContractTypes: [],
      filterBenefits: [],
      filterLanguageCodes: ['en', 'de'],
      enableCommuteFilter: false,
      filterMaxDistance: 30,
      globalSearch: false,
      abroadOnly: false,
      remoteOnly: true,
      filterWorkArrangement: 'remote',
    });
  });

  test('does not auto-enable commute filtering without a usable profile location', () => {
    const profile = makeProfile({
      address: '',
      coordinates: undefined,
      preferences: {
        ...makeProfile().preferences,
        searchProfile: {
          ...makeProfile().preferences.searchProfile!,
          defaultEnableCommuteFilter: true,
          defaultMaxDistanceKm: 45,
        },
      },
    });

    const filters = getDefaultCandidateSearchFilters(profile, { hasLocation: false });
    expect(filters.enableCommuteFilter).toBe(false);
    expect(filters.filterMaxDistance).toBe(45);
  });
});
