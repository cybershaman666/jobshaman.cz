import type { DiscoveryFilterSourceMap, JobWorkArrangementFilter, SearchLanguageCode, SearchMode } from '../types';

const normalizeCountryCodes = (codes: string[]): string[] => {
  if (!codes || codes.length === 0) return [];
  const uppered = codes.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean);
  const hasCs = uppered.includes('CS');
  const hasCz = uppered.includes('CZ');
  return hasCs || hasCz
    ? Array.from(new Set([...uppered.filter((code) => code !== 'CS' && code !== 'CZ'), 'CZ', 'CS']))
    : uppered;
};

const sameCountryCodeSet = (left: string[], right: string[]): boolean => {
  const a = normalizeCountryCodes(left).sort();
  const b = normalizeCountryCodes(right).sort();
  if (a.length !== b.length) return false;
  return a.every((code, index) => code === b[index]);
};

export type ResolveSearchModeInput = {
  searchTerm: string;
  filterSources: DiscoveryFilterSourceMap;
  filterCity: string;
  filterContractType: string[];
  filterBenefits: string[];
  filterMinSalary: number;
  filterDate: string;
  filterExperience: string[];
  enableCommuteFilter: boolean;
  filterLanguageCodes: SearchLanguageCode[];
  globalSearch: boolean;
  abroadOnly: boolean;
  remoteOnly: boolean;
  filterWorkArrangement?: JobWorkArrangementFilter;
  countryCodes: string[];
  defaultCountryCodes: string[];
};

export const resolveSearchMode = ({
  searchTerm,
  filterSources,
  filterCity,
  filterContractType,
  filterBenefits,
  filterMinSalary,
  filterDate,
  filterExperience,
  enableCommuteFilter,
  filterLanguageCodes,
  globalSearch,
  abroadOnly,
  remoteOnly,
  filterWorkArrangement = 'all',
  countryCodes,
  defaultCountryCodes,
}: ResolveSearchModeInput): SearchMode => {
  if (String(searchTerm || '').trim()) {
    return 'manual_query';
  }

  const hasCountryOverride =
    !globalSearch &&
    !abroadOnly &&
    !sameCountryCodeSet(countryCodes, defaultCountryCodes);
  const hasManualFilters =
    remoteOnly ||
    (filterSources.filterWorkArrangement === 'user_toggle' && filterWorkArrangement !== 'all') ||
    hasCountryOverride ||
    (filterSources.filterCity === 'user_toggle' && Boolean(String(filterCity || '').trim())) ||
    (filterSources.filterContractTypes === 'user_toggle' && filterContractType.length > 0) ||
    (filterSources.filterBenefits === 'user_toggle' && filterBenefits.length > 0) ||
    (filterSources.filterMinSalary === 'user_toggle' && Number(filterMinSalary || 0) > 0) ||
    (filterSources.filterDatePosted === 'user_toggle' && filterDate !== 'all') ||
    (filterSources.filterExperienceLevels === 'user_toggle' && filterExperience.length > 0) ||
    (filterSources.enableCommuteFilter === 'user_toggle' && enableCommuteFilter) ||
    (filterSources.filterLanguageCodes === 'user_toggle' && filterLanguageCodes.length > 0) ||
    (filterSources.globalSearch === 'user_toggle' && globalSearch) ||
    (filterSources.abroadOnly === 'user_toggle' && abroadOnly);

  return hasManualFilters ? 'manual_filters' : 'discovery_default';
};
