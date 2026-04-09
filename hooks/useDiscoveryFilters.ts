import { useCallback, useMemo, useState } from 'react';

import type {
    DiscoveryFilterSource,
    DiscoveryFilterSourceMap,
    JobWorkArrangementFilter,
    JobSearchFilters,
    SearchLanguageCode,
    UserProfile,
} from '../types';
import { resolveSearchMode } from '../services/searchModeResolver';

export const expandCountryAliases = (countryCode?: string | null): string[] => {
    const normalized = String(countryCode || '').trim().toUpperCase();
    if (!normalized) return [];
    if (normalized === 'CZ' || normalized === 'CS') return ['CZ', 'CS'];
    if (normalized === 'SK') return ['SK'];
    if (normalized === 'PL') return ['PL'];
    if (normalized === 'DE') return ['DE'];
    if (normalized === 'AT') return ['AT'];
    return [];
};

export const normalizeCountryCodes = (codes: string[]): string[] => {
    if (!codes || codes.length === 0) return [];
    const uppered = codes.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean);
    const hasCs = uppered.includes('CS');
    const hasCz = uppered.includes('CZ');
    const expanded = (hasCs || hasCz)
        ? Array.from(new Set([...uppered.filter((code) => code !== 'CS' && code !== 'CZ'), 'CZ', 'CS']))
        : uppered;
    return expanded;
};

export const sameCountryCodeSet = (left: string[], right: string[]): boolean => {
    const canon = (values: string[]) =>
        (values || []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean).sort();
    const a = canon(left);
    const b = canon(right);
    if (a.length !== b.length) return false;
    return a.every((code, idx) => code === b[idx]);
};

export const sameStringArray = (left: string[], right: string[]): boolean => {
    const normalize = (values: string[]) =>
        (values || []).map((value) => String(value || '').trim()).filter(Boolean);
    const a = normalize(left);
    const b = normalize(right);
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
};

export const getCountryCodeFromLanguage = (lng?: string): string | null => {
    if (!lng) return null;
    const normalized = String(lng || '').trim().toLowerCase().replace(/_/g, '-');
    if (normalized === 'at' || normalized.endsWith('-at')) return 'AT';
    const code = normalized.split('-')[0];
    if (code === 'cs') return 'CZ';
    if (code === 'sk') return 'SK';
    if (code === 'de') return 'DE';
    if (code === 'pl') return 'PL';
    if (code === 'at') return 'AT';
    return null;
};

export const getDefaultLanguageCodesFromLocale = (lng?: string): SearchLanguageCode[] => {
    const code = String(lng || '').split('-')[0].toLowerCase();
    if (code === 'cs') return ['cs'];
    if (code === 'sk') return ['sk'];
    if (code === 'de' || code === 'at') return ['de'];
    if (code === 'pl') return ['pl'];
    if (code === 'en') return ['en'];
    return [];
};

export const getDefaultLanguageCodesFromCountryCodes = (codes: string[]): SearchLanguageCode[] => {
    const normalized = normalizeCountryCodes(codes);
    const primary = normalized[0];
    if (!primary) return [];
    if (primary === 'CZ' || primary === 'CS') return ['cs'];
    if (primary === 'SK') return ['sk'];
    if (primary === 'PL') return ['pl'];
    if (primary === 'DE' || primary === 'AT') return ['de'];
    return [];
};

export const DEFAULT_FILTER_SOURCES: DiscoveryFilterSourceMap = {
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
    filterWorkArrangement: 'default',
};

type DiscoveryFilterField = keyof DiscoveryFilterSourceMap;

interface UseDiscoveryFiltersProps {
    userProfile: UserProfile;
    locale: string;
    remoteOnly: boolean;
    getCountryCodeFromAddress: (address: string) => string | null;
}

export const useDiscoveryFilters = ({
    userProfile,
    locale,
    remoteOnly,
    getCountryCodeFromAddress,
}: UseDiscoveryFiltersProps) => {
    const defaultCountryCodes = useMemo(() => {
        const fromPreference = expandCountryAliases(userProfile.preferredCountryCode);
        if (fromPreference.length > 0) return fromPreference;

        const fromAddress = expandCountryAliases(getCountryCodeFromAddress(userProfile.address));
        if (fromAddress.length > 0) return fromAddress;

        return expandCountryAliases(getCountryCodeFromLanguage(locale));
    }, [getCountryCodeFromAddress, locale, userProfile.address, userProfile.preferredCountryCode]);

    const [countryCodes, setCountryCodes] = useState<string[]>(() => defaultCountryCodes);
    const defaultLanguageCodes = useMemo(() => {
        const fromActiveDomesticMarket = getDefaultLanguageCodesFromCountryCodes(countryCodes);
        if (fromActiveDomesticMarket.length > 0) return fromActiveDomesticMarket;

        const fromPreferredDomesticMarket = getDefaultLanguageCodesFromCountryCodes(defaultCountryCodes);
        if (fromPreferredDomesticMarket.length > 0) return fromPreferredDomesticMarket;

        return getDefaultLanguageCodesFromLocale(locale);
    }, [countryCodes, defaultCountryCodes, locale]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(() => userProfile.preferences?.searchProfile?.defaultMaxDistanceKm ?? 50);
    // Start from a neutral state, then let the synced profile-default effect decide
    // whether commute filtering should turn on once we know the candidate defaults.
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState<string>('all');
    // Keep profile salary as a recommendation signal and preset value, not a hidden hard filter
    // on the default discovery feed. Users can still opt into it explicitly from the UI.
    const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
    const [filterExperience, setFilterExperience] = useState<string[]>([]);
    const [filterLanguageCodes, setFilterLanguageCodes] = useState<SearchLanguageCode[]>([]);
    const [globalSearch, setGlobalSearch] = useState(false);
    const [abroadOnly, setAbroadOnly] = useState(false);
    const [filterWorkArrangement, setFilterWorkArrangement] = useState<JobWorkArrangementFilter>('all');
    const [sortBy, setSortBy] = useState<string>('newest');
    const [filterSources, setFilterSources] = useState<DiscoveryFilterSourceMap>(DEFAULT_FILTER_SOURCES);

    const setCountryCodesSafe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setCountryCodes((prev) => {
            const nextRaw = typeof value === 'function' ? value(prev) : value;
            const next = normalizeCountryCodes(nextRaw || []);
            const prevNorm = normalizeCountryCodes(prev || []);
            if (sameCountryCodeSet(prevNorm, next)) return prev;
            return next;
        });
    }, []);

    const implicitLanguageCodesApplied = useMemo(() => [], []);

    const hasExplicitLanguageFilter = filterSources.filterLanguageCodes === 'user_toggle' && filterLanguageCodes.length > 0;

    const searchMode = useMemo(
        () => resolveSearchMode({
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
            filterWorkArrangement,
            countryCodes,
            defaultCountryCodes,
        }),
        [
            abroadOnly,
            countryCodes,
            enableCommuteFilter,
            filterBenefits,
            filterCity,
            filterContractType,
            filterDate,
            filterExperience,
            filterLanguageCodes,
            filterMinSalary,
            filterWorkArrangement,
            filterSources,
            globalSearch,
            defaultCountryCodes,
            remoteOnly,
            searchTerm,
        ]
    );

    const updateFilterSource = useCallback((field: DiscoveryFilterField, source: DiscoveryFilterSource) => {
        setFilterSources((prev) => {
            if (prev[field] === source) return prev;
            return { ...prev, [field]: source };
        });
    }, []);

    const setSearchTermTracked = useCallback((value: string, source: DiscoveryFilterSource = 'user_toggle') => {
        setSearchTerm((prev) => (prev === value ? prev : value));
        updateFilterSource('searchTerm', source);
    }, [updateFilterSource]);

    const setFilterCityTracked = useCallback((value: string, source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterCity((prev) => (prev === value ? prev : value));
        updateFilterSource('filterCity', source);
    }, [updateFilterSource]);

    const setFilterMaxDistanceTracked = useCallback((value: number, source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterMaxDistance((prev) => (prev === value ? prev : value));
        updateFilterSource('filterMaxDistance', source);
    }, [updateFilterSource]);

    const setEnableCommuteFilterTracked = useCallback((value: boolean, source: DiscoveryFilterSource = 'user_toggle') => {
        setEnableCommuteFilter((prev) => (prev === value ? prev : value));
        updateFilterSource('enableCommuteFilter', source);
    }, [updateFilterSource]);

    const setFilterBenefitsTracked = useCallback((value: string[] | ((prev: string[]) => string[]), source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterBenefits((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return sameStringArray(prev, next) ? prev : next;
        });
        updateFilterSource('filterBenefits', source);
    }, [updateFilterSource]);

    const setFilterContractTypeTracked = useCallback((value: string[] | ((prev: string[]) => string[]), source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterContractType((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return sameStringArray(prev, next) ? prev : next;
        });
        updateFilterSource('filterContractTypes', source);
    }, [updateFilterSource]);

    const setFilterDateTracked = useCallback((value: string, source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterDate((prev) => (prev === value ? prev : value));
        updateFilterSource('filterDatePosted', source);
    }, [updateFilterSource]);

    const setFilterMinSalaryTracked = useCallback((value: number, source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterMinSalary((prev) => (prev === value ? prev : value));
        updateFilterSource('filterMinSalary', source);
    }, [updateFilterSource]);

    const setFilterExperienceTracked = useCallback((value: string[] | ((prev: string[]) => string[]), source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterExperience((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return sameStringArray(prev, next) ? prev : next;
        });
        updateFilterSource('filterExperienceLevels', source);
    }, [updateFilterSource]);

    const setFilterLanguageCodesTracked = useCallback((value: SearchLanguageCode[] | ((prev: SearchLanguageCode[]) => SearchLanguageCode[]), source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterLanguageCodes((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return sameStringArray(prev, next) ? prev : next;
        });
        updateFilterSource('filterLanguageCodes', source);
    }, [updateFilterSource]);

    const setGlobalSearchTracked = useCallback((value: boolean, source: DiscoveryFilterSource = 'user_toggle') => {
        setGlobalSearch((prev) => (prev === value ? prev : value));
        updateFilterSource('globalSearch', source);
    }, [updateFilterSource]);

    const setAbroadOnlyTracked = useCallback((value: boolean, source: DiscoveryFilterSource = 'user_toggle') => {
        setAbroadOnly((prev) => (prev === value ? prev : value));
        updateFilterSource('abroadOnly', source);
    }, [updateFilterSource]);

    const setFilterWorkArrangementTracked = useCallback((value: JobWorkArrangementFilter, source: DiscoveryFilterSource = 'user_toggle') => {
        setFilterWorkArrangement((prev) => (prev === value ? prev : value));
        updateFilterSource('filterWorkArrangement', source);
    }, [updateFilterSource]);

    const applyDiscoveryDefaults = useCallback((filters: JobSearchFilters, force = false) => {
        if ((force || filterSources.searchTerm !== 'user_toggle') && filters.searchTerm !== undefined) {
            setSearchTermTracked(filters.searchTerm || '', 'default');
        }
        if ((force || filterSources.filterCity !== 'user_toggle') && filters.filterCity !== undefined) {
            setFilterCityTracked(filters.filterCity || '', 'default');
        }
        if ((force || filterSources.filterMinSalary !== 'user_toggle') && filters.filterMinSalary !== undefined) {
            setFilterMinSalaryTracked(filters.filterMinSalary || 0, 'default');
        }
        if ((force || filterSources.filterBenefits !== 'user_toggle') && filters.filterBenefits !== undefined) {
            setFilterBenefitsTracked(Array.isArray(filters.filterBenefits) ? filters.filterBenefits : [], 'default');
        }
        if ((force || filterSources.filterContractTypes !== 'user_toggle') && filters.filterContractTypes !== undefined) {
            setFilterContractTypeTracked(Array.isArray(filters.filterContractTypes) ? filters.filterContractTypes : [], 'default');
        }
        if ((force || filterSources.filterDatePosted !== 'user_toggle') && filters.filterDatePosted !== undefined) {
            setFilterDateTracked(filters.filterDatePosted || 'all', 'default');
        }
        if ((force || filterSources.filterExperienceLevels !== 'user_toggle') && filters.filterExperienceLevels !== undefined) {
            setFilterExperienceTracked(Array.isArray(filters.filterExperienceLevels) ? filters.filterExperienceLevels : [], 'default');
        }
        if ((force || filterSources.filterLanguageCodes !== 'user_toggle') && filters.filterLanguageCodes !== undefined) {
            setFilterLanguageCodesTracked(Array.isArray(filters.filterLanguageCodes) ? filters.filterLanguageCodes : [], 'default');
        }
        if ((force || filterSources.enableCommuteFilter !== 'user_toggle') && filters.enableCommuteFilter !== undefined) {
            setEnableCommuteFilterTracked(Boolean(filters.enableCommuteFilter), 'default');
        }
        if ((force || filterSources.filterMaxDistance !== 'user_toggle') && filters.filterMaxDistance !== undefined) {
            setFilterMaxDistanceTracked(filters.filterMaxDistance || 50, 'default');
        }
        if ((force || filterSources.globalSearch !== 'user_toggle') && filters.globalSearch !== undefined) {
            setGlobalSearchTracked(Boolean(filters.globalSearch), 'default');
        }
        if ((force || filterSources.abroadOnly !== 'user_toggle') && filters.abroadOnly !== undefined) {
            setAbroadOnlyTracked(Boolean(filters.abroadOnly), 'default');
        }
        if ((force || filterSources.filterWorkArrangement !== 'user_toggle') && filters.filterWorkArrangement !== undefined) {
            setFilterWorkArrangementTracked(filters.filterWorkArrangement || 'all', 'default');
        }
    }, [
        filterSources,
        setAbroadOnlyTracked,
        setEnableCommuteFilterTracked,
        setFilterBenefitsTracked,
        setFilterCityTracked,
        setFilterContractTypeTracked,
        setFilterDateTracked,
        setFilterExperienceTracked,
        setFilterLanguageCodesTracked,
        setFilterMaxDistanceTracked,
        setFilterMinSalaryTracked,
        setFilterWorkArrangementTracked,
        setGlobalSearchTracked,
        setSearchTermTracked,
    ]);

    const resetDiscoveryFilters = useCallback(() => {
        setSearchTermTracked('', 'default');
        setFilterCityTracked('', 'default');
        setFilterBenefitsTracked([], 'default');
        setFilterContractTypeTracked([], 'default');
        setFilterDateTracked('all', 'default');
        setFilterMinSalaryTracked(0, 'default');
        setFilterExperienceTracked([], 'default');
        setFilterMaxDistanceTracked(50, 'default');
        setFilterLanguageCodesTracked([], 'default');
        setEnableCommuteFilterTracked(false, 'default');
        setAbroadOnlyTracked(false, 'default');
        setFilterWorkArrangementTracked('all', 'default');
        setCountryCodesSafe(defaultCountryCodes);
        setGlobalSearchTracked(false, 'default');
        setFilterSources(DEFAULT_FILTER_SOURCES);
    }, [
        setAbroadOnlyTracked,
        setCountryCodesSafe,
        defaultCountryCodes,
        setEnableCommuteFilterTracked,
        setFilterBenefitsTracked,
        setFilterCityTracked,
        setFilterContractTypeTracked,
        setFilterDateTracked,
        setFilterExperienceTracked,
        setFilterLanguageCodesTracked,
        setFilterMaxDistanceTracked,
        setFilterMinSalaryTracked,
        setFilterWorkArrangementTracked,
        setGlobalSearchTracked,
        setSearchTermTracked,
    ]);

    return {
        abroadOnly,
        applyDiscoveryDefaults,
        countryCodes,
        defaultCountryCodes,
        defaultLanguageCodes,
        enableCommuteFilter,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        filterMaxDistance,
        filterMinSalary,
        filterWorkArrangement,
        filterSources,
        globalSearch,
        hasExplicitLanguageFilter,
        implicitLanguageCodesApplied,
        resetDiscoveryFilters,
        searchMode,
        searchTerm,
        sortBy,
        setAbroadOnly: setAbroadOnlyTracked,
        setCountryCodes: setCountryCodesSafe,
        setEnableCommuteFilter: setEnableCommuteFilterTracked,
        setFilterBenefits: setFilterBenefitsTracked,
        setFilterCity: setFilterCityTracked,
        setFilterContractType: setFilterContractTypeTracked,
        setFilterDate: setFilterDateTracked,
        setFilterExperience: setFilterExperienceTracked,
        setFilterLanguageCodes: setFilterLanguageCodesTracked,
        setFilterMaxDistance: setFilterMaxDistanceTracked,
        setFilterMinSalary: setFilterMinSalaryTracked,
        setFilterWorkArrangement: setFilterWorkArrangementTracked,
        setFilterSources,
        setGlobalSearch: setGlobalSearchTracked,
        setSearchTerm: setSearchTermTracked,
        setSortBy,
    };
};

export default useDiscoveryFilters;
