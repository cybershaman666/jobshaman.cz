import { resolveSearchMode } from './searchModeResolver';
import type { DiscoveryFilterSourceMap } from '../types';

const defaultSources: DiscoveryFilterSourceMap = {
  searchTerm: 'default',
  filterCity: 'default',
  filterContractTypes: 'default',
  filterBenefits: 'default',
  filterMinSalary: 'default',
  filterDatePosted: 'default',
  filterExperienceLevels: 'default',
  filterMaxDistance: 'default',
  enableCommuteFilter: 'default',
  filterLanguageCodes: 'default',
  globalSearch: 'default',
  abroadOnly: 'default',
  remoteOnly: 'default',
};

describe('resolveSearchMode', () => {
  test('returns manual_query when a query is present', () => {
    expect(resolveSearchMode({
      searchTerm: 'react developer',
      filterSources: defaultSources,
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      enableCommuteFilter: false,
      filterLanguageCodes: [],
      globalSearch: false,
      abroadOnly: false,
      remoteOnly: false,
      countryCodes: ['CZ'],
      defaultCountryCodes: ['CZ'],
    })).toBe('manual_query');
  });

  test('returns manual_filters for active user-driven filters without query', () => {
    expect(resolveSearchMode({
      searchTerm: '',
      filterSources: {
        ...defaultSources,
        enableCommuteFilter: 'user_toggle',
      },
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      enableCommuteFilter: true,
      filterLanguageCodes: [],
      globalSearch: false,
      abroadOnly: false,
      remoteOnly: false,
      countryCodes: ['CZ'],
      defaultCountryCodes: ['CZ'],
    })).toBe('manual_filters');
  });

  test('returns manual_filters when retrieval country scope differs from baseline', () => {
    expect(resolveSearchMode({
      searchTerm: '',
      filterSources: defaultSources,
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      enableCommuteFilter: false,
      filterLanguageCodes: [],
      globalSearch: false,
      abroadOnly: false,
      remoteOnly: false,
      countryCodes: ['DE', 'AT'],
      defaultCountryCodes: ['CZ'],
    })).toBe('manual_filters');
  });

  test('returns discovery_default when only defaults are active', () => {
    expect(resolveSearchMode({
      searchTerm: '',
      filterSources: defaultSources,
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      enableCommuteFilter: false,
      filterLanguageCodes: [],
      globalSearch: false,
      abroadOnly: false,
      remoteOnly: false,
      countryCodes: ['CZ'],
      defaultCountryCodes: ['CZ'],
    })).toBe('discovery_default');
  });
});
