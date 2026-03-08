import { CandidateSearchProfile, JobSearchFilters, SearchLanguageCode, UserProfile } from '../types';
import { createDefaultCandidateSearchProfile } from './profileDefaults';

export interface CandidateSearchPreset {
  id: string;
  name: string;
  description: string;
  filters: JobSearchFilters;
}

const SUPPORTED_LANGUAGE_CODES: SearchLanguageCode[] = ['cs', 'sk', 'en', 'de', 'pl'];

export const normalizeSearchLanguageCodes = (codes: string[] | undefined | null): SearchLanguageCode[] => {
  const next = (codes || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value): value is SearchLanguageCode => SUPPORTED_LANGUAGE_CODES.includes(value as SearchLanguageCode));

  if (next.length === 0) {
    return ['cs'];
  }

  return Array.from(new Set(next));
};

export const resolveCandidateSearchProfile = (profile?: UserProfile | null): CandidateSearchProfile => {
  const source = profile?.preferences?.searchProfile;
  const defaults = createDefaultCandidateSearchProfile();
  return {
    ...defaults,
    ...(source || {}),
    remoteLanguageCodes: normalizeSearchLanguageCodes(source?.remoteLanguageCodes),
    preferredBenefitKeys: Array.from(
      new Set((source?.preferredBenefitKeys || defaults.preferredBenefitKeys || []).map((value) => String(value || '').trim()).filter(Boolean))
    ),
    defaultEnableCommuteFilter: Boolean(source?.defaultEnableCommuteFilter ?? defaults.defaultEnableCommuteFilter),
    defaultMaxDistanceKm: Math.max(5, Number(source?.defaultMaxDistanceKm ?? defaults.defaultMaxDistanceKm) || defaults.defaultMaxDistanceKm),
  };
};

const isCsLikeLocale = (locale: string): boolean => ['cs', 'sk'].includes(locale);

export const buildCandidateSearchPresets = (
  profile: UserProfile,
  locale: string
): CandidateSearchPreset[] => {
  const searchProfile = resolveCandidateSearchProfile(profile);
  const isCsLike = isCsLikeLocale(locale);
  const presets: CandidateSearchPreset[] = [];
  const combinedBenefits = Array.from(
    new Set([
      ...(searchProfile.preferredBenefitKeys || []),
      ...(searchProfile.wantsDogFriendlyOffice ? ['dog_friendly'] : [])
    ])
  );

  const combinedFilters: JobSearchFilters = {
    filterContractTypes: searchProfile.wantsContractorRoles ? ['ico'] : [],
    filterBenefits: combinedBenefits,
    filterLanguageCodes: searchProfile.wantsRemoteRoles ? searchProfile.remoteLanguageCodes : [],
    enableCommuteFilter: searchProfile.defaultEnableCommuteFilter,
    filterMaxDistance: searchProfile.defaultEnableCommuteFilter ? searchProfile.defaultMaxDistanceKm : undefined,
    globalSearch: searchProfile.nearBorder,
    abroadOnly: false,
    remoteOnly: searchProfile.wantsRemoteRoles,
  };

  const hasCombinedSignals =
    combinedFilters.filterContractTypes?.length ||
    combinedFilters.filterBenefits?.length ||
    combinedFilters.filterLanguageCodes?.length ||
    combinedFilters.globalSearch ||
    combinedFilters.remoteOnly;

  if (hasCombinedSignals) {
    presets.push({
      id: 'default',
      name: isCsLike ? 'Moje výchozí hledání' : 'My default search',
      description: isCsLike
        ? 'Spojí IČO, commute realitu, životní benefity, remote a přeshraniční hledání podle profilu.'
        : 'Combines contractor, commute reality, life-context benefits, remote, and cross-border preferences from your profile.',
      filters: combinedFilters,
    });
  }

  if (searchProfile.wantsRemoteRoles) {
    presets.push({
      id: 'remote',
      name: isCsLike ? 'Remote v mých jazycích' : 'Remote in my languages',
      description: isCsLike
        ? 'Ukáže remote role v jazycích, které používáte.'
        : 'Shows remote roles in the languages you can work in.',
      filters: {
        remoteOnly: true,
        filterLanguageCodes: searchProfile.remoteLanguageCodes,
      },
    });
  }

  if (searchProfile.wantsDogFriendlyOffice) {
    presets.push({
      id: 'dog-friendly',
      name: isCsLike ? 'Dog-friendly kanceláře' : 'Dog-friendly offices',
      description: isCsLike
        ? 'Preferuje kanceláře, kam lze bez stresu i se psy.'
        : 'Prefers offices that are friendly to dogs.',
      filters: {
        filterBenefits: ['dog_friendly'],
        remoteOnly: false,
      },
    });
  }

  if (searchProfile.defaultEnableCommuteFilter) {
    presets.push({
      id: 'commute-fit',
      name: isCsLike ? 'Dojezd podle mé reality' : 'Commute fit',
      description: isCsLike
        ? `Použije výchozí dojezd do ${searchProfile.defaultMaxDistanceKm} km a zohlední váš režim dopravy.`
        : `Uses your default commute radius of ${searchProfile.defaultMaxDistanceKm} km and respects your transport mode.`,
      filters: {
        enableCommuteFilter: true,
        filterMaxDistance: searchProfile.defaultMaxDistanceKm,
      },
    });
  }

  if (searchProfile.nearBorder || searchProfile.wantsContractorRoles) {
    presets.push({
      id: 'border-contractor',
      name: isCsLike ? 'Přeshraničně na IČO' : 'Cross-border contractor',
      description: isCsLike
        ? 'Rychlé hledání pro příhraničí a spolupráci na živnost.'
        : 'A quick search for border regions and contractor work.',
      filters: {
        globalSearch: true,
        abroadOnly: false,
        filterContractTypes: searchProfile.wantsContractorRoles ? ['ico'] : [],
      },
    });
  }

  return presets;
};
