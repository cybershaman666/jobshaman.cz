import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscoveryFilterSource, DiscoveryFilterSourceMap, Job, JobSearchFilters, SearchDiagnosticsMeta, SearchLanguageCode, UserProfile } from '../types';
import { dedupeJobsList, fetchExternalOverlayJobs, fetchJobsPaginated, fetchJobsWithFilters } from '../services/jobService';
import { geocodeWithCaching, getStaticCoordinates } from '../services/geocodingService';
import AnalyticsService from '../services/analyticsService';
import { fetchJobInteractionState, flushInteractionStateSyncQueue, syncJobInteractionState, updateInteractionStateCache } from '../services/jobInteractionService';
import { getCandidateIntentDomainSeedKeyword, getCandidateIntentDomainLabel, getCandidateIntentRoleSeedKeyword, resolveCandidateIntentProfile } from '../services/candidateIntentService';
import { recordRuntimeSignal } from '../services/runtimeSignals';
import { isRemoteJob } from '../services/commuteService';
import { resolveSearchMode } from '../services/searchModeResolver';

// Infer country code from address text (best-effort)
const getCountryCodeFromAddress = (address: string): string | null => {
    if (!address) return null;
    const loc = address.toLowerCase();
    if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') || loc.includes('montreal')) return 'CA';
    if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('california') || loc.includes('texas')) return 'US';
    if (loc.includes('united kingdom') || loc.includes('uk') || loc.includes('london') || loc.includes('manchester')) return 'GB';
    if (loc.includes('netherlands') || loc.includes('nederland') || loc.includes('amsterdam') || loc.includes('rotterdam')) return 'NL';
    if (loc.includes('france') || loc.includes('franc') || loc.includes('paris') || loc.includes('lyon')) return 'FR';
    if (loc.includes('spain') || loc.includes('espa') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
    if (loc.includes('italy') || loc.includes('italia') || loc.includes('rome') || loc.includes('milan')) return 'IT';
    if (loc.includes('romania') || loc.includes('bucharest') || loc.includes('bucure')) return 'RO';
    if (loc.includes('hungary') || loc.includes('budapest')) return 'HU';
    if (loc.includes('slovak') || loc.includes('slovensk') || loc.includes('slovensko') || loc.includes('bratislava') || loc.includes('kosice')) return 'SK';
    if (loc.includes('polsk') || loc.includes('poland') || loc.includes('warszawa') || loc.includes('krakow') || loc.includes('wroclaw') || loc.includes('gda')) return 'PL';
    if (loc.includes('deutsch') || loc.includes('germany') || loc.includes('berlin') || loc.includes('münchen') || loc.includes('hamburg')) return 'DE';
    if (loc.includes('österreich') || loc.includes('austria') || loc.includes('wien') || loc.includes('vienna')) return 'AT';
    if (loc.includes('česk') || loc.includes('czech') || loc.includes('praha') || loc.includes('brno') || loc.includes('ostrava')) return 'CZ';
    return null;
};

const getCountryCodeFromJobSource = (job: Job): string | null => {
    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (!haystack.trim()) return null;
    if (haystack.includes('karriere.at')) return 'AT';
    if (haystack.includes('germantechjobs')) return 'DE';
    if (haystack.includes('stepstone.de')) return 'DE';
    if (haystack.includes('stepstone.at')) return 'AT';
    if (haystack.includes('pracuj.pl')) return 'PL';
    if (haystack.includes('profesia.sk')) return 'SK';
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) return 'CZ';
    return null;
};

// Infer country code from language (best-effort)
const getCountryCodeFromLanguage = (lng?: string): string | null => {
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

const getDefaultLanguageCodesFromLocale = (lng?: string): SearchLanguageCode[] => {
    const code = String(lng || '').split('-')[0].toLowerCase();
    if (code === 'cs') return ['cs'];
    if (code === 'sk') return ['sk'];
    if (code === 'de' || code === 'at') return ['de'];
    if (code === 'pl') return ['pl'];
    if (code === 'en') return ['en'];
    return [];
};

const expandCountryAliases = (countryCode?: string | null): string[] => {
    const normalized = String(countryCode || '').trim().toUpperCase();
    if (!normalized) return [];
    if (normalized === 'CZ' || normalized === 'CS') return ['CZ', 'CS'];
    if (normalized === 'SK') return ['SK'];
    if (normalized === 'PL') return ['PL'];
    if (normalized === 'DE') return ['DE'];
    if (normalized === 'AT') return ['AT'];
    return [];
};

const sameCountryCodeSet = (left: string[], right: string[]): boolean => {
    const canon = (values: string[]) =>
        (values || []).map((v) => String(v || '').trim().toUpperCase()).filter(Boolean).sort();
    const a = canon(left);
    const b = canon(right);
    if (a.length !== b.length) return false;
    return a.every((code, idx) => code === b[idx]);
};

const sameStringArray = (left: string[], right: string[]): boolean => {
    const normalize = (values: string[]) =>
        (values || []).map((value) => String(value || '').trim()).filter(Boolean);
    const a = normalize(left);
    const b = normalize(right);
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
};

const getLogicalCountryCount = (codes: string[]): number => {
    const canonical = new Set(
        normalizeCountryCodes(codes).map((code) => (code === 'CS' ? 'CZ' : code))
    );
    return canonical.size;
};

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
    enabled?: boolean;
    microJobsOnly?: boolean;
    remoteOnly?: boolean;
}

const JOBS_FEED_CACHE_KEY = 'jobs_feed_cache_v1';
const JOBS_FEED_CACHE_MAX = 80;
const LEGACY_SAVED_JOBS_KEY = 'savedJobIds';
const SAVED_JOBS_CACHE_PREFIX = 'jobshaman_saved_jobs_cache';
const SAVED_JOB_IDS_PREFIX = 'savedJobIds';
const DISMISSED_JOB_IDS_PREFIX = 'dismissedJobIds';

const normalizeCountryCodes = (codes: string[]): string[] => {
    if (!codes || codes.length === 0) return [];
    const uppered = codes.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
    const hasCs = uppered.includes('CS');
    const hasCz = uppered.includes('CZ');
    const expanded = (hasCs || hasCz)
        ? Array.from(new Set([...uppered.filter(c => c !== 'CS' && c !== 'CZ'), 'CZ', 'CS']))
        : uppered;
    return expanded;
};

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (degrees: number) => degrees * (Math.PI / 180);
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};

const inferJobCountryCode = (job: Job): string | null => {
    const explicit = expandCountryAliases(job.country_code)[0];
    if (explicit) return explicit;

    const fromLocation = getCountryCodeFromAddress(job.location || '');
    if (fromLocation) return fromLocation;

    return getCountryCodeFromJobSource(job);
};

const inferJobLanguageCode = (job: Job): string | null => {
    const explicit = String(job.language_code || '').trim().toLowerCase();
    const scores = new Map<string, number>();
    const addScore = (code: string, score: number) => {
        if (!code || score <= 0) return;
        scores.set(code, (scores.get(code) || 0) + score);
    };

    if (explicit) {
        addScore(explicit, 1);
    }

    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) addScore('cs', 4);
    if (haystack.includes('profesia.sk')) addScore('sk', 4);
    if (haystack.includes('pracuj.pl')) addScore('pl', 4);
    if (haystack.includes('karriere.at') || haystack.includes('stepstone.de') || haystack.includes('germantechjobs')) addScore('de', 4);

    const inferredCountry = inferJobCountryCode(job);
    if (inferredCountry === 'CZ') addScore('cs', 1);
    if (inferredCountry === 'SK') addScore('sk', 1);
    if (inferredCountry === 'PL') addScore('pl', 1);
    if (inferredCountry === 'DE' || inferredCountry === 'AT') addScore('de', 1);
    if (inferredCountry === 'US' || inferredCountry === 'GB') addScore('en', 1);

    const textHaystack = `${job.title || ''} ${job.description || ''} ${job.location || ''}`.toLowerCase();
    const scoreLanguage = (patterns: RegExp[]): number =>
        patterns.reduce((score, pattern) => score + (pattern.test(textHaystack) ? 1 : 0), 0);

    const csScore = scoreLanguage([
        /\b(práce|pozice|nástup|nabízíme|požadujeme|benefity|mzda|úvazek|praxe|kancelář|domova)\b/i,
        /[ěščřžýáíéúůťďň]/i,
        /\b(brno|praha|ostrava|plzeň|olomouc|pardubice|hradec králové|české budějovice)\b/i,
    ]);
    const skScore = scoreLanguage([
        /\b(práca|pozícia|nástup|ponúkame|požadujeme|benefity|mzda|úväzok|prax|kancelária|domu)\b/i,
        /\b(bratislava|košice|žilina|trnava|nitra|prešov|banská bystrica)\b/i,
    ]);
    const plScore = scoreLanguage([
        /\b(praca|stanowisko|oferujemy|wymagamy|benefity|wynagrodzenie|etat|biuro)\b/i,
        /[ąćęłńóśźż]/i,
        /\b(warszawa|kraków|wrocław|gdańsk|poznań|łódź)\b/i,
    ]);
    const deScore = scoreLanguage([
        /\b(stelle|wir bieten|anforderungen|gehalt|vollzeit|teilzeit|büro|homeoffice)\b/i,
        /[äöüß]/i,
        /\b(wien|vienna|berlin|münchen|hamburg|graz|linz|salzburg)\b/i,
    ]);
    const enScore = scoreLanguage([
        /\b(we offer|requirements|salary|benefits|full-time|part-time|remote|office)\b/i,
        /\b(london|new york|united states|united kingdom|usa|uk)\b/i,
    ]);

    addScore('cs', csScore);
    addScore('sk', skScore);
    addScore('pl', plScore);
    addScore('de', deScore);
    addScore('en', enScore);

    const ranked = Array.from(scores.entries())
        .map(([code, score]) => ({ code, score }))
        .sort((left, right) => right.score - left.score);

    if (ranked[0]?.score && ranked[0].score >= 2) {
        if (ranked[1] && ranked[0].score === ranked[1].score) {
            return null;
        }
        return ranked[0].code;
    }

    return null;
};

// Global deduper helper to prevent repeated logical listings in feed and React key warnings.
const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => {
    return dedupeJobsList([...existingJobs, ...newJobs]);
};

const normalizeContractTypeFilter = (value: string): string => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!normalized) return '';
    if (normalized === 'ico' || normalized === 'osvc' || normalized === 'szco' || normalized === 'zivnost') return 'ico';
    if (normalized === 'hpp' || normalized === 'full-time' || normalized === 'full_time' || normalized === 'full time') return 'hpp';
    if (normalized === 'part-time' || normalized === 'part_time' || normalized === 'part time') return 'part-time';
    if (normalized === 'brigada' || normalized === 'temporary' || normalized === 'temp' || normalized === 'casual') return 'brigada';
    if (normalized === 'dpp') return 'dpp';
    if (normalized === 'dpc') return 'dpc';
    return normalized;
};

type DiscoveryFilterField = keyof DiscoveryFilterSourceMap;

const DEFAULT_FILTER_SOURCES: DiscoveryFilterSourceMap = {
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

const getSourceMixCounts = (jobs: Job[]): NonNullable<SearchDiagnosticsMeta['source_mix']> => {
    return jobs.reduce<NonNullable<SearchDiagnosticsMeta['source_mix']>>((acc, job) => {
        const source = job.searchDiagnostics?.source || (job.listingKind === 'imported' ? 'cached_external' : 'native');
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {});
};

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50, enabled = true, microJobsOnly = false, remoteOnly = false }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const candidateIntent = useMemo(() => resolveCandidateIntentProfile(userProfile), [userProfile]);
    const externalSearchSeedTerm = useMemo(() => {
        const explicitRole = getCandidateIntentRoleSeedKeyword(candidateIntent.targetRole);
        if (explicitRole) return explicitRole;
        const keyword = getCandidateIntentDomainSeedKeyword(candidateIntent.primaryDomain);
        if (keyword) return keyword;
        // Last resort: localized label, but this tends to be worse for English-only sources.
        const label = getCandidateIntentDomainLabel(candidateIntent.primaryDomain, i18n.language);
        return String(label || '').trim();
    }, [candidateIntent.primaryDomain, candidateIntent.targetRole, i18n.language]);
    const activeFetchControllerRef = useRef<AbortController | null>(null);
    const externalOverlayControllerRef = useRef<AbortController | null>(null);
    const lastExternalOverlaySignatureRef = useRef<string>('');
    const latestRequestIdRef = useRef(0);
    const lastDebouncedLogAtRef = useRef(0);
    const hasHandledInitialSortFetchRef = useRef(false);
    const hasRunFilterEffectRef = useRef(false);
    const pendingHardRefreshRef = useRef(false);
    const defaultCountryCodes = useMemo(() => {
        const fromPreference = expandCountryAliases(userProfile.preferredCountryCode);
        if (fromPreference.length > 0) return fromPreference;

        const fromAddress = expandCountryAliases(getCountryCodeFromAddress(userProfile.address));
        if (fromAddress.length > 0) return fromAddress;

        return expandCountryAliases(getCountryCodeFromLanguage(i18n.language));
    }, [i18n.language, userProfile.address, userProfile.preferredCountryCode]);
    const normalizedDefaultDomesticCountries = useMemo(
        () => normalizeCountryCodes(defaultCountryCodes),
        [defaultCountryCodes]
    );
    const defaultLanguageCodes = useMemo(
        () => getDefaultLanguageCodesFromLocale(i18n.language),
        [i18n.language]
    );
    const [countryCodes, setCountryCodes] = useState<string[]>(() => defaultCountryCodes);

    const [jobs, setJobs] = useState<Job[]>(() => {
        try {
            const cached = localStorage.getItem(JOBS_FEED_CACHE_KEY);
            if (!cached) return [];
            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) return [];
            return parsed.slice(0, JOBS_FEED_CACHE_MAX) as Job[];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [impressionSessionKey, setImpressionSessionKey] = useState(() => `impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [backendUnreachable, setBackendUnreachable] = useState(false);
    const [searchDiagnostics, setSearchDiagnostics] = useState<SearchDiagnosticsMeta | null>(null);

    // Filter state
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState<string>('all'); // all, 24h, 3d, 7d, 14d
    const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
    const [filterExperience, setFilterExperience] = useState<string[]>([]); // Junior, Medior, Senior, Lead
    const [filterLanguageCodes, setFilterLanguageCodes] = useState<SearchLanguageCode[]>([]);
    const [enableAutoLanguageGuard, setEnableAutoLanguageGuard] = useState(true);
    const [globalSearch, setGlobalSearch] = useState(true); // Baseline browse should not hide results behind implicit country scope
    const [abroadOnly, setAbroadOnly] = useState(false);
    const [sortBy, setSortBy] = useState<string>('newest'); // newest | distance | jhi_desc | salary_desc
    const [filterSources, setFilterSources] = useState<DiscoveryFilterSourceMap>(DEFAULT_FILTER_SOURCES);

    // Prevent state churn when callers keep re-setting equivalent country arrays.
    const setCountryCodesSafe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setCountryCodes(prev => {
            const nextRaw = typeof value === 'function' ? value(prev) : value;
            const next = normalizeCountryCodes(nextRaw || []);
            const prevNorm = normalizeCountryCodes(prev || []);
            if (sameCountryCodeSet(prevNorm, next)) return prev;
            return next;
        });
    }, []);

    const implicitLanguageCodesApplied = useMemo(() => {
        const hasCountryOverride = !sameCountryCodeSet(
            normalizeCountryCodes(countryCodes),
            normalizeCountryCodes(defaultCountryCodes)
        );
        if (!enableAutoLanguageGuard) return [];
        const hasAnyFilters =
            !!searchTerm ||
            !!filterCity ||
            filterContractType.length > 0 ||
            filterBenefits.length > 0 ||
            !!filterMinSalary ||
            filterDate !== 'all' ||
            filterExperience.length > 0 ||
            enableCommuteFilter ||
            sortBy !== 'newest' ||
            filterLanguageCodes.length > 0 ||
            abroadOnly ||
            remoteOnly ||
            hasCountryOverride;
        if (globalSearch) return [];
        if (hasAnyFilters) return [];
        if (defaultLanguageCodes.length === 0) return [];
        return defaultLanguageCodes;
    }, [
        abroadOnly,
        defaultLanguageCodes,
        enableAutoLanguageGuard,
        enableCommuteFilter,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        filterMinSalary,
        globalSearch,
        remoteOnly,
        searchTerm,
        sortBy,
        countryCodes,
        defaultCountryCodes,
    ]);

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
            countryCodes,
            defaultCountryCodes,
        }),
        [
            abroadOnly,
            countryCodes,
            defaultCountryCodes,
            enableCommuteFilter,
            filterBenefits,
            filterCity,
            filterContractType,
            filterDate,
            filterExperience,
            filterLanguageCodes,
            filterMinSalary,
            filterSources,
            globalSearch,
            remoteOnly,
            searchTerm,
        ]
    );

    useEffect(() => {
        if (!enableAutoLanguageGuard) return;
        if (filterSources.filterLanguageCodes === 'user_toggle') return;
        setFilterLanguageCodes((prev) => (prev.length > 0 ? [] : prev));
    }, [
        defaultLanguageCodes,
        enableAutoLanguageGuard,
        filterSources.filterLanguageCodes,
    ]);

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

    const applyDiscoveryDefaults = useCallback((filters: JobSearchFilters) => {
        if (filterSources.searchTerm !== 'user_toggle' && filters.searchTerm !== undefined) {
            setSearchTermTracked(filters.searchTerm || '', 'default');
        }
        if (filterSources.filterCity !== 'user_toggle' && filters.filterCity !== undefined) {
            setFilterCityTracked(filters.filterCity || '', 'default');
        }
        if (filterSources.filterMinSalary !== 'user_toggle' && filters.filterMinSalary !== undefined) {
            setFilterMinSalaryTracked(filters.filterMinSalary || 0, 'default');
        }
        if (filterSources.filterBenefits !== 'user_toggle' && filters.filterBenefits !== undefined) {
            setFilterBenefitsTracked(Array.isArray(filters.filterBenefits) ? filters.filterBenefits : [], 'default');
        }
        if (filterSources.filterContractTypes !== 'user_toggle' && filters.filterContractTypes !== undefined) {
            setFilterContractTypeTracked(Array.isArray(filters.filterContractTypes) ? filters.filterContractTypes : [], 'default');
        }
        if (filterSources.filterDatePosted !== 'user_toggle' && filters.filterDatePosted !== undefined) {
            setFilterDateTracked(filters.filterDatePosted || 'all', 'default');
        }
        if (filterSources.filterExperienceLevels !== 'user_toggle' && filters.filterExperienceLevels !== undefined) {
            setFilterExperienceTracked(Array.isArray(filters.filterExperienceLevels) ? filters.filterExperienceLevels : [], 'default');
        }
        if (filterSources.filterLanguageCodes !== 'user_toggle' && filters.filterLanguageCodes !== undefined) {
            setFilterLanguageCodesTracked(Array.isArray(filters.filterLanguageCodes) ? filters.filterLanguageCodes : [], 'default');
        }
        if (filterSources.enableCommuteFilter !== 'user_toggle' && filters.enableCommuteFilter !== undefined) {
            setEnableCommuteFilterTracked(Boolean(filters.enableCommuteFilter), 'default');
        }
        if (filterSources.filterMaxDistance !== 'user_toggle' && filters.filterMaxDistance !== undefined) {
            setFilterMaxDistanceTracked(filters.filterMaxDistance || 50, 'default');
        }
        if (filterSources.globalSearch !== 'user_toggle' && filters.globalSearch !== undefined) {
            setGlobalSearchTracked(Boolean(filters.globalSearch), 'default');
        }
        if (filterSources.abroadOnly !== 'user_toggle' && filters.abroadOnly !== undefined) {
            setAbroadOnlyTracked(Boolean(filters.abroadOnly), 'default');
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
        setGlobalSearchTracked,
        setSearchTermTracked,
    ]);

    const savedJobStorageKey = `${SAVED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;
    const dismissedJobStorageKey = `${DISMISSED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;

    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
    const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);
    const savedJobIdsRef = useRef<Set<string>>(new Set());
    const dismissedJobIdsRef = useRef<Set<string>>(new Set());
    const interactionStateHydratedRef = useRef(false);
    const lastInteractionSyncSignatureRef = useRef<string>('');
    const interactionSyncTimerRef = useRef<number | null>(null);

    useEffect(() => {
        savedJobIdsRef.current = new Set(savedJobIds);
    }, [savedJobIds]);

    useEffect(() => {
        dismissedJobIdsRef.current = new Set(dismissedJobIds);
    }, [dismissedJobIds]);

    const filterDismissedJobs = useCallback((list: Job[]) => {
        const dismissed = dismissedJobIdsRef.current;
        if (!dismissed.size || !list.length) return list;
        const filtered = list.filter((job) => !dismissed.has(job.id));
        if (filtered.length === 0 && list.length > 0) {
            recordRuntimeSignal('custom:dismissed_feed_fail_open', {
                original_count: list.length,
                dismissed_count: dismissed.size,
            }, {
                dedupeKey: `dismissed-feed-fail-open:${list.length}:${dismissed.size}`,
                throttleMs: 30_000,
            });
            return list;
        }
        return filtered;
    }, []);

    const applyDomesticCountrySafeguard = useCallback((list: Job[]) => {
        if (list.length === 0) {
            return list;
        }

        const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
        const isDefaultCountrySelection = sameCountryCodeSet(
            normalizedCountryCodes,
            normalizeCountryCodes(defaultCountryCodes)
        );

        // If the user is using a commute radius and didn't explicitly narrow countries,
        // don't drop cross-border jobs that are still inside the circle.
        const shouldAllowCrossBorderRadius =
            enableCommuteFilter &&
            !globalSearch &&
            !abroadOnly &&
            isDefaultCountrySelection;

        const hasExplicitGeographicFilter =
            filterSources.globalSearch === 'user_toggle' ||
            filterSources.abroadOnly === 'user_toggle' ||
            !isDefaultCountrySelection;

        const allowedCountryCodes = (!globalSearch && hasExplicitGeographicFilter && !shouldAllowCrossBorderRadius && normalizedCountryCodes.length > 0)
            ? new Set(normalizedCountryCodes)
            : null;
        const allowedLanguageCodes = filterLanguageCodes.length > 0
            ? new Set(filterLanguageCodes.map((code) => String(code).trim().toLowerCase()))
            : null;
        const hasExplicitLanguageFilter = allowedLanguageCodes !== null;

        const safeguarded = list.filter((job) => {
            if (allowedCountryCodes) {
                const inferredCountry = inferJobCountryCode(job);
                if (!inferredCountry || !allowedCountryCodes.has(inferredCountry)) {
                    return false;
                }
            }

            if (allowedLanguageCodes) {
                const explicitLanguage = String(job.language_code || '').trim().toLowerCase();
                const resolvedLanguage = explicitLanguage || inferJobLanguageCode(job);
                if (!resolvedLanguage || !allowedLanguageCodes.has(resolvedLanguage)) {
                    return false;
                }
            }

            return true;
        });
        if (safeguarded.length === 0 && list.length > 0 && !hasExplicitLanguageFilter) {
            recordRuntimeSignal('custom:domestic_safeguard_fail_open', {
                original_count: list.length,
                allowed_country_codes: allowedCountryCodes ? Array.from(allowedCountryCodes) : [],
                allowed_language_codes: allowedLanguageCodes ? Array.from(allowedLanguageCodes) : [],
            }, {
                dedupeKey: JSON.stringify({
                    originalCount: list.length,
                    countries: allowedCountryCodes ? Array.from(allowedCountryCodes) : [],
                    languages: allowedLanguageCodes ? Array.from(allowedLanguageCodes) : [],
                }),
                throttleMs: 30_000,
            });
            return list;
        }
        return safeguarded;
    }, [
        abroadOnly,
        countryCodes,
        defaultCountryCodes,
        defaultLanguageCodes,
        enableAutoLanguageGuard,
        enableCommuteFilter,
        filterSources.abroadOnly,
        filterSources.globalSearch,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        filterMinSalary,
        globalSearch,
        searchTerm,
    ]);

    useEffect(() => {
        const readIds = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return [];
                return parsed.map((id: unknown) => String(id));
            } catch {
                return [];
            }
        };
        const readSavedJobIdsFromCache = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return [];
                return Object.keys(parsed).map((id) => String(id)).filter(Boolean);
            } catch {
                return [];
            }
        };

        const saved = readIds(savedJobStorageKey);
        const dismissed = readIds(dismissedJobStorageKey);
        const cachedSaved = readSavedJobIdsFromCache(`${SAVED_JOBS_CACHE_PREFIX}:${userProfile.id || 'guest'}`);
        const mergedSaved = saved.length > 0 ? saved : cachedSaved;
        if (!userProfile.id && saved.length === 0) {
            const legacy = readIds(LEGACY_SAVED_JOBS_KEY);
            const legacyMerged = legacy.length > 0 ? legacy : cachedSaved;
            setSavedJobIds(Array.from(new Set(legacyMerged)).filter((id) => !dismissed.includes(id)));
        } else {
            setSavedJobIds(Array.from(new Set(mergedSaved)).filter((id) => !dismissed.includes(id)));
        }
        setDismissedJobIds(Array.from(new Set(dismissed)));
    }, [savedJobStorageKey, dismissedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(savedJobStorageKey, JSON.stringify(savedJobIds));
            if (!userProfile.id) {
                localStorage.setItem(LEGACY_SAVED_JOBS_KEY, JSON.stringify(savedJobIds));
            }
        } catch (error) {
            console.error('Error saving jobs to localStorage:', error);
        }
    }, [savedJobIds, savedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(dismissedJobStorageKey, JSON.stringify(dismissedJobIds));
        } catch (error) {
            console.error('Error saving dismissed jobs to localStorage:', error);
        }
    }, [dismissedJobIds, dismissedJobStorageKey]);

    useEffect(() => {
        updateInteractionStateCache({
            savedJobIds,
            dismissedJobIds,
        });
    }, [savedJobIds, dismissedJobIds]);

    useEffect(() => {
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;
        if (!interactionStateHydratedRef.current) return;

        const normalizeIds = (list: string[]) => Array.from(new Set(list.map((id) => String(id)))).sort();
        const nextSaved = normalizeIds(savedJobIds);
        const nextDismissed = normalizeIds(dismissedJobIds).filter((id) => !nextSaved.includes(id));
        const signature = JSON.stringify({ saved: nextSaved, dismissed: nextDismissed });
        if (signature === lastInteractionSyncSignatureRef.current) return;

        if (interactionSyncTimerRef.current) {
            window.clearTimeout(interactionSyncTimerRef.current);
        }

        interactionSyncTimerRef.current = window.setTimeout(() => {
            void (async () => {
                const payload = {
                    savedJobIds: nextSaved,
                    dismissedJobIds: nextDismissed,
                    clientUpdatedAt: new Date().toISOString(),
                    source: 'client_state_sync'
                };
                const result = await syncJobInteractionState(payload);
                if (result) {
                    const canonicalSaved = normalizeIds(result.savedJobIds || []);
                    const canonicalDismissed = normalizeIds(result.dismissedJobIds || []).filter((id) => !canonicalSaved.includes(id));
                    const canonicalSignature = JSON.stringify({ saved: canonicalSaved, dismissed: canonicalDismissed });
                    lastInteractionSyncSignatureRef.current = canonicalSignature;
                    if (canonicalSignature !== signature) {
                        setSavedJobIds(canonicalSaved);
                        setDismissedJobIds(canonicalDismissed);
                    }
                } else {
                    lastInteractionSyncSignatureRef.current = signature;
                }
            })();
        }, 800);

        return () => {
            if (interactionSyncTimerRef.current) {
                window.clearTimeout(interactionSyncTimerRef.current);
            }
        };
    }, [savedJobIds, dismissedJobIds, userProfile.isLoggedIn, userProfile.id, enabled]);

    useEffect(() => {
        let cancelled = false;
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;

        (async () => {
            try {
                const state = await fetchJobInteractionState(20000);
                if (cancelled) return;

                // Merge backend state with local cache so historical saved items
                // are not dropped when backend interaction history is partial.
                const mergedSavedSet = new Set<string>([
                    ...Array.from(savedJobIdsRef.current),
                    ...state.savedJobIds.map((id) => String(id)),
                ]);
                const mergedDismissedSet = new Set<string>([
                    ...Array.from(dismissedJobIdsRef.current),
                    ...state.dismissedJobIds.map((id) => String(id)),
                ]);

                const nextSaved = Array.from(mergedSavedSet);
                const nextDismissed = Array.from(mergedDismissedSet).filter((id) => !mergedSavedSet.has(id));

                setSavedJobIds(nextSaved);
                setDismissedJobIds(nextDismissed);
            } catch (error) {
                if (!cancelled) {
                    console.warn('Failed to hydrate interaction state from backend:', error);
                }
            } finally {
                if (!cancelled) {
                    interactionStateHydratedRef.current = true;
                    void flushInteractionStateSyncQueue();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userProfile.isLoggedIn, userProfile.id, enabled]);

    // Persist a warm cache so first paint is never empty when backend wakes up.
    useEffect(() => {
        if (!jobs || jobs.length === 0) return;
        try {
            localStorage.setItem(JOBS_FEED_CACHE_KEY, JSON.stringify(jobs.slice(0, JOBS_FEED_CACHE_MAX)));
        } catch {
            // Ignore storage failures.
        }
    }, [jobs]);

    useEffect(() => {
        if (!dismissedJobIds.length) return;
        setJobs(prev => prev.filter(job => !dismissedJobIds.includes(job.id)));
    }, [dismissedJobIds]);

    useEffect(() => {
        return () => {
            latestRequestIdRef.current += 1;
            if (activeFetchControllerRef.current) {
                activeFetchControllerRef.current.abort();
                activeFetchControllerRef.current = null;
            }
        };
    }, []);

    // UI state
    const [showFilters, setShowFilters] = useState(true);
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        contract: true,
        benefits: true,
        date: true,
        salary: true,
        experience: true
    });



    // --- DATABASE FILTERING LOGIC ---

    // Use the RPC-based filtering function
    const fetchFilteredJobs = useCallback(async (page: number, isLoadMore: boolean = false) => {
        if (!enabled) {
            if (!isLoadMore) {
                setLoading(false);
                setLoadingMore(false);
                setJobs([]);
                setHasMore(false);
                setTotalCount(0);
            }
            return;
        }
        if (!isLoadMore && activeFetchControllerRef.current) {
            activeFetchControllerRef.current.abort();
        }
        const fetchController = new AbortController();
        ++latestRequestIdRef.current;
        const requestId = latestRequestIdRef.current;
        const isStaleRequest = () => requestId !== latestRequestIdRef.current || fetchController.signal.aborted;
        activeFetchControllerRef.current = fetchController;

        setLoading(true);
        if (isLoadMore) setLoadingMore(true);
        if (!isLoadMore && pendingHardRefreshRef.current) {
            pendingHardRefreshRef.current = false;
            setJobs([]);
            setHasMore(false);
            setTotalCount(0);
        }

        try {
            // Only use coordinates if we are doing a commute filter or proximity sort
            let lat = userProfile.coordinates?.lat;
            let lon = userProfile.coordinates?.lon;

            // If user has an address but no coordinates yet, try to resolve it for radius filtering.
            if ((lat == null || lon == null) && enableCommuteFilter && userProfile.address) {
                const addrCoords = getStaticCoordinates(userProfile.address) || await geocodeWithCaching(userProfile.address);
                if (addrCoords) {
                    lat = addrCoords.lat;
                    lon = addrCoords.lon;
                }
            }

            // If no user coordinates but we have a city and commute filter is requested,
            // try to get coordinates for the city to allow radius search.
            if ((lat == null || lon == null) && filterCity && enableCommuteFilter) {
                const cityCoords = getStaticCoordinates(filterCity);
                if (cityCoords) {
                    lat = cityCoords.lat;
                    lon = cityCoords.lon;
                }
            }

            const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
            const hasCountryFilter = !globalSearch && normalizedCountryCodes.length > 0;
            const hasCountryOverride = !sameCountryCodeSet(normalizedCountryCodes, normalizedDefaultDomesticCountries);
            const hasAnyFilters =
                !!searchTerm ||
                !!filterCity ||
                filterContractType.length > 0 ||
                filterBenefits.length > 0 ||
                !!filterMinSalary ||
                filterDate !== 'all' ||
                filterExperience.length > 0 ||
                enableCommuteFilter ||
                sortBy !== 'newest' ||
                filterLanguageCodes.length > 0 ||
                abroadOnly ||
                remoteOnly ||
                hasCountryOverride;
            const retrievalLanguageCodes = filterLanguageCodes.length > 0
                ? filterLanguageCodes
                : undefined;
            const requestedPageSize = initialPageSize;

            // Avoid heavy RPC paths when the user effectively wants "show me the newest feed".
            // Supabase PostgREST RPC can hit statement timeouts (57014) on broad queries, while
            // simple pagination over `jobs` stays fast and stable.
            const canUseSimplePagination =
                !hasAnyFilters &&
                (!hasCountryFilter || getLogicalCountryCount(normalizedCountryCodes) === 1);

            if (canUseSimplePagination) {
                const basicResult = await fetchJobsPaginated(
                    page,
                    requestedPageSize,
                    undefined,
                    undefined,
                    50,
                    undefined,
                    retrievalLanguageCodes,
                    false,
                    microJobsOnly,
                    true
                );
                if (isStaleRequest()) return;
                setBackendUnreachable(false);

                const visibleJobs = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(basicResult.jobs)));
                console.log('📦 Simple pagination result:', {
                    raw: basicResult.jobs.length,
                    visible: visibleJobs.length,
                    hasMore: basicResult.hasMore,
                    totalCount: basicResult.totalCount,
                    countryCodes: hasCountryFilter ? normalizedCountryCodes : [],
                    retrievalLanguageCodes: retrievalLanguageCodes || [],
                });
                setSearchDiagnostics({
                    search_mode: searchMode,
                    base_result_count: basicResult.jobs.length,
                    post_filter_count: visibleJobs.length,
                    source_mix: getSourceMixCounts(visibleJobs),
                    reordered_by_profile: false,
                });
                if (isLoadMore) {
                    setJobs(prev => dedupeJobs(visibleJobs, prev));
                } else {
                    setJobs(visibleJobs);
                }

                setHasMore(basicResult.hasMore);
                setTotalCount(Math.max(0, Number(basicResult.totalCount || 0) - (basicResult.jobs.length - visibleJobs.length)));
                return;
            }

            const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : normalizedDefaultDomesticCountries;
            const isDefaultCountrySelection = sameCountryCodeSet(normalizedCountryCodes, normalizeCountryCodes(defaultCountryCodes));
            const shouldAutoExpandBorderCountries =
                enableCommuteFilter &&
                lat != null &&
                lon != null &&
                !globalSearch &&
                !abroadOnly &&
                isDefaultCountrySelection &&
                normalizedCountryCodes.length > 0;

            // When radius filtering is enabled and the user didn't explicitly narrow countries,
            // don't block cross-border jobs (AT/SK/DE/PL...) that are still within the commute circle.
            const effectiveCountryCodes = (globalSearch || shouldAutoExpandBorderCountries) ? undefined : normalizedCountryCodes;
            const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;
            const applyExternalRecoveryFilters = (jobs: Job[]): Job[] => jobs.filter((job) => {
                const normalizedJobCountry = inferJobCountryCode(job);
                if (effectiveCountryCodes && effectiveCountryCodes.length > 0) {
                    const allowed = normalizeCountryCodes(effectiveCountryCodes);
                    if (!normalizedJobCountry || !allowed.includes(normalizedJobCountry)) {
                        return false;
                    }
                }
                if (excludeCountryCodes && excludeCountryCodes.length > 0) {
                    const excluded = normalizeCountryCodes(excludeCountryCodes);
                    if (normalizedJobCountry && excluded.includes(normalizedJobCountry)) {
                        return false;
                    }
                }
                if (retrievalLanguageCodes && retrievalLanguageCodes.length > 0) {
                    const explicitLanguage = String(job.language_code || '').trim().toLowerCase();
                    const jobLanguage = explicitLanguage || inferJobLanguageCode(job);
                    if (!jobLanguage || !retrievalLanguageCodes.includes(jobLanguage as SearchLanguageCode)) {
                        return false;
                    }
                }
                if (remoteOnly && !isRemoteJob(job)) {
                    return false;
                }
                if (filterCity.trim()) {
                    const cityHaystack = `${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
                    if (!cityHaystack.includes(filterCity.trim().toLowerCase())) {
                        return false;
                    }
                }
                if (enableCommuteFilter && filterMaxDistance > 0) {
                    if (lat == null || lon == null) {
                        return false;
                    }
                    const explicitDistance = Number((job as any).distance_km ?? (job as any).distanceKm ?? job.distanceKm);
                    const computedDistance = (
                        typeof job.lat === 'number' &&
                        typeof job.lng === 'number'
                    ) ? calculateDistanceKm(lat, lon, job.lat, job.lng) : null;
                    const distanceKm = Number.isFinite(explicitDistance) && explicitDistance >= 0
                        ? explicitDistance
                        : computedDistance;
                    if (distanceKm == null || distanceKm > filterMaxDistance) {
                        return false;
                    }
                    (job as any).distance_km = distanceKm;
                    (job as any).distanceKm = distanceKm;
                }
                return true;
            });

            const result = await fetchJobsWithFilters({
                page,
                pageSize: requestedPageSize,
                searchTerm,
                sortMode: sortBy as 'default' | 'newest' | 'jhi_desc' | 'recommended' | 'distance' | 'salary_desc',
                searchMode,
                filterCity,
                filterContractTypes: filterContractType,
                filterBenefits,
                filterMinSalary,
                filterDatePosted: filterDate,
                filterExperienceLevels: filterExperience,
                radiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
                userLat: lat,
                userLng: lon,
                countryCodes: effectiveCountryCodes,
                excludeCountryCodes,
                filterLanguageCodes: retrievalLanguageCodes,
                remoteOnly,
                jhiPreferences: userProfile.jhiPreferences,
                userTaxProfile: userProfile.taxProfile,
                externalSearchSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                externalOverlayMode: 'async',
                includeJhi: false,
                microJobsOnly,
                abortSignal: fetchController.signal
            });
            if (isStaleRequest()) return;
            setBackendUnreachable(false);

            let visibleJobs = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(result.jobs)));
            console.log('📦 Filtered fetch result:', {
                raw: result.jobs.length,
                visible: visibleJobs.length,
                hasMore: result.hasMore,
                totalCount: result.totalCount,
                searchMode,
            });
            const nextDiagnostics: SearchDiagnosticsMeta = {
                ...(result.meta || {}),
                search_mode: result.meta?.search_mode || searchMode,
                base_result_count: result.meta?.base_result_count ?? result.jobs.length,
                post_filter_count: result.meta?.post_filter_count ?? visibleJobs.length,
                source_mix: result.meta?.source_mix || getSourceMixCounts(visibleJobs),
                reordered_by_profile: result.meta?.reordered_by_profile ?? false,
            };
            setSearchDiagnostics(nextDiagnostics);
            let resolvedHasMore = result.hasMore;
            let resolvedTotalCount = Math.max(0, Number(result.totalCount || 0) - (result.jobs.length - visibleJobs.length));

            const shouldRunExternalRecovery =
                !isLoadMore &&
                page === 0 &&
                visibleJobs.length === 0 &&
                (!!String(searchTerm || '').trim() || !!String(filterCity || '').trim());

            if (shouldRunExternalRecovery) {
                try {
                    const recoveryJobs = await fetchExternalOverlayJobs({
                        searchTerm: searchTerm || undefined,
                        externalSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                        filterCity,
                        countryCodes: effectiveCountryCodes,
                        excludeCountryCodes,
                        abortSignal: fetchController.signal,
                        includeJhi: false,
                        mode: 'recovery'
                    });
                    if (!isStaleRequest() && recoveryJobs.length > 0) {
                        visibleJobs = dedupeJobsList(
                            applyDomesticCountrySafeguard(
                                filterDismissedJobs(applyExternalRecoveryFilters(recoveryJobs))
                            )
                        );
                        resolvedHasMore = false;
                        resolvedTotalCount = visibleJobs.length;
                        recordRuntimeSignal('custom:search_external_recovery', {
                            result_count: visibleJobs.length,
                            search_term: searchTerm || null,
                            filter_city: filterCity || null,
                        }, {
                            dedupeKey: JSON.stringify({
                                searchTerm: searchTerm || '',
                                filterCity: filterCity || '',
                                resultCount: visibleJobs.length
                            }),
                            throttleMs: 20_000,
                        });
                    }
                } catch (recoveryError) {
                    if ((recoveryError as any)?.name !== 'AbortError') {
                        console.warn('External recovery search failed:', recoveryError);
                    }
                }
            }

            if (isLoadMore) {
                setJobs(prev => dedupeJobs(visibleJobs, prev));
            } else {
                setJobs(visibleJobs);
            }

            setHasMore(resolvedHasMore);
            setTotalCount(resolvedTotalCount);
            if (visibleJobs.length === 0) {
                recordRuntimeSignal('custom:search_empty_result', {
                    search_term: searchTerm || null,
                    filter_city: filterCity || null,
                    fallback_mode: result.meta?.fallback_mode || null,
                    degraded_reasons: result.meta?.degraded_reasons || [],
                }, {
                    dedupeKey: JSON.stringify({
                        searchTerm: searchTerm || '',
                        filterCity: filterCity || '',
                        fallbackMode: result.meta?.fallback_mode || 'none',
                    }),
                    throttleMs: 20_000,
                });
            }

            if (import.meta.env.DEV || String(import.meta.env.VITE_SEARCH_DEBUG || '').toLowerCase() === 'true') {
                console.groupCollapsed(
                    `[search-debug] ${nextDiagnostics.search_mode} ${String(searchTerm || '').trim() || '(browse)'}`
                );
                console.table({
                    search_mode: nextDiagnostics.search_mode,
                    backend_count: nextDiagnostics.base_result_count,
                    post_filter_count: nextDiagnostics.post_filter_count,
                    source_mix: JSON.stringify(nextDiagnostics.source_mix || {}),
                    reordered_by_profile: nextDiagnostics.reordered_by_profile,
                    sort_mode: sortBy,
                    remote_only: remoteOnly,
                });
                console.table(
                    visibleJobs.slice(0, 10).map((job, index) => ({
                        rank: index + 1,
                        title: job.title,
                        company: job.company,
                        source: job.searchDiagnostics?.source || 'native',
                        title_match_score: job.searchDiagnostics?.titleMatchScore ?? null,
                        backend_score: job.searchDiagnostics?.backendScore ?? null,
                        profile_boost: job.searchDiagnostics?.profileBoost ?? null,
                        external: job.searchDiagnostics?.external ?? false,
                        filtered_out_by: (job.searchDiagnostics?.filteredOutBy || []).join(', '),
                    }))
                );
                console.groupEnd();
            }

            // Async external overlay: never block the main feed. Fetch extras in the background
            // and merge them into the already-rendered list (page 0 only).
            if (!isLoadMore && page === 0) {
                try {
                    const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
                    const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : normalizedDefaultDomesticCountries;
                    const effectiveCountryCodes = globalSearch ? undefined : normalizedCountryCodes;
                    const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;

                    const signature = JSON.stringify({
                        searchTerm: String(searchTerm || '').trim(),
                        filterCity: String(filterCity || '').trim(),
                        countryCodes: effectiveCountryCodes || null,
                        excludeCountryCodes: excludeCountryCodes || null,
                        seed: String(externalSearchSeedTerm || '').trim()
                    });
                    if (signature !== lastExternalOverlaySignatureRef.current) {
                        lastExternalOverlaySignatureRef.current = signature;
                        externalOverlayControllerRef.current?.abort();
                        const overlayController = new AbortController();
                        externalOverlayControllerRef.current = overlayController;

                        void (async () => {
                            const overlayJobs = await fetchExternalOverlayJobs({
                                searchTerm: searchTerm || undefined,
                                externalSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                                filterCity,
                                countryCodes: effectiveCountryCodes,
                                excludeCountryCodes,
                                abortSignal: overlayController.signal,
                                includeJhi: false
                            });
                            if (overlayController.signal.aborted) return;
                            if (!overlayJobs.length) return;

                            const filteredOverlayJobs = applyExternalRecoveryFilters(overlayJobs);
                            if (!filteredOverlayJobs.length) return;

                            setJobs((prev) => dedupeJobsList([...prev, ...filteredOverlayJobs]));
                        })();
                    }
                } catch {
                    // No-op: overlay is best-effort only.
                }
            }

            // Track analytics
            if ((filterCity || filterContractType.length > 0 || filterBenefits.length > 0)) {
                AnalyticsService.trackFilterUsage({
                    filterCity,
                    filterContractTypes: filterContractType,
                    filterBenefits,
                    filterMinSalary,
                    filterDatePosted: filterDate,
                    filterExperienceLevels: filterExperience,
                    radiusKm: filterMaxDistance,
                    hasDistanceFilter: enableCommuteFilter,
                    resultCount: result.totalCount || 0
                }).catch(err => console.warn('Analytics tracking failed:', err));
            }

        } catch (error) {
            if ((error as any)?.name === 'AbortError') {
                return;
            }
            if (isStaleRequest()) {
                return;
            }
            console.error('Error fetching filtered jobs:', error);
            // Only mark backend unreachable for network/timeout-type failures.
            const msg = String((error as any)?.message || error || '').toLowerCase();
            const code = String((error as any)?.code || '').toLowerCase();
            const looksLikeNetwork =
                msg.includes('failed to fetch') ||
                msg.includes('networkerror') ||
                msg.includes('network error') ||
                msg.includes('ecconnreset') ||
                msg.includes('econnrefused') ||
                msg.includes('etimedout') ||
                msg.includes('timeout') ||
                code.includes('timeout');
            setBackendUnreachable(looksLikeNetwork);
            // Keep previous results on transient errors to avoid "flash then disappear" behavior.
        } finally {
            if (activeFetchControllerRef.current === fetchController) {
                activeFetchControllerRef.current = null;
            }
            if (requestId === latestRequestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [
        enabled, initialPageSize, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, userProfile.coordinates?.lat, userProfile.coordinates?.lon, userProfile.id, countryCodes, globalSearch, filterLanguageCodes, abroadOnly, sortBy, microJobsOnly, JSON.stringify(userProfile.jhiPreferences), JSON.stringify(userProfile.taxProfile), filterDismissedJobs, normalizedDefaultDomesticCountries, candidateIntent.primaryDomain, candidateIntent.targetRole, defaultLanguageCodes, remoteOnly, searchMode
    ]);


    // Debounced reload when filters change
    useEffect(() => {
        if (!enabled) return;
        if (hasRunFilterEffectRef.current) {
            setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        }
        if (hasRunFilterEffectRef.current) {
            pendingHardRefreshRef.current = true;
            setLoading(true);
            setLoadingMore(false);
            setJobs([]);
            setHasMore(false);
            setTotalCount(0);
        }
        hasRunFilterEffectRef.current = true;

        const timeoutId = setTimeout(() => {
            if (Date.now() - lastDebouncedLogAtRef.current > 2_000) {
                console.log('⏱️ Debounced filter fetch triggered');
                lastDebouncedLogAtRef.current = Date.now();
            }
            setCurrentPage(0);
            fetchFilteredJobs(0, false);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        enabled, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, countryCodes, globalSearch, filterLanguageCodes, abroadOnly, microJobsOnly, remoteOnly
    ]); // Excluded fetchFilteredJobs to avoid re-triggering when it's just redefined

    // Re-apply sorting when sort option changes
    useEffect(() => {
        if (!enabled) return;
        if (!hasHandledInitialSortFetchRef.current) {
            hasHandledInitialSortFetchRef.current = true;
            return;
        }
        setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        pendingHardRefreshRef.current = true;
        setLoading(true);
        setLoadingMore(false);
        setJobs([]);
        setHasMore(false);
        setTotalCount(0);
        setCurrentPage(0);
        fetchFilteredJobs(0, false);
    }, [sortBy, fetchFilteredJobs, enabled]);

    // Load more jobs
    const loadMoreJobs = useCallback(() => {
        if (!loadingMore && hasMore) {
            const nextPage = currentPage + 1;
            console.log(`🔄 loadMoreJobs called. Moving to page ${nextPage}`);
            setCurrentPage(nextPage);
            fetchFilteredJobs(nextPage, true);
        } else {
            console.log('⏭️ loadMoreJobs skipped:', { loadingMore, hasMore });
        }
    }, [loadingMore, hasMore, currentPage, fetchFilteredJobs]);

    const goToPage = useCallback((page: number) => {
        const normalizedPage = Math.max(0, Number(page) || 0);
        if (normalizedPage === currentPage && jobs.length > 0) return;
        setCurrentPage(normalizedPage);
        void fetchFilteredJobs(normalizedPage, false);
    }, [currentPage, fetchFilteredJobs, jobs.length]);

    // Initial load
    const loadInitialJobs = useCallback(() => {
        setCurrentPage(0);
        return fetchFilteredJobs(0, false);
    }, [fetchFilteredJobs]);

    useEffect(() => {
        if (filterSources.globalSearch !== 'user_toggle') {
            setGlobalSearch(true);
        }
        if (filterSources.abroadOnly !== 'user_toggle') {
            setAbroadOnly(false);
        }
        if (defaultCountryCodes.length === 0) return;
        if (globalSearch || abroadOnly) return;
        if (!sameCountryCodeSet(countryCodes, defaultCountryCodes)) {
            setCountryCodesSafe(defaultCountryCodes);
        }
    }, [
        defaultCountryCodes,
        countryCodes,
        globalSearch,
        abroadOnly,
        filterSources.globalSearch,
        filterSources.abroadOnly,
        setCountryCodesSafe,
    ]);

    useEffect(() => {
        if (abroadOnly && globalSearch) {
            setGlobalSearchTracked(false, 'default');
            recordRuntimeSignal('custom:filter_conflict_auto_resolved', {
                conflict: 'abroad_only_vs_global_search',
                winner: 'abroad_only',
            }, {
                dedupeKey: 'abroad_only_vs_global_search',
                throttleMs: 20_000,
            });
            return;
        }
        if (globalSearch && abroadOnly) {
            setAbroadOnlyTracked(false, 'default');
            recordRuntimeSignal('custom:filter_conflict_auto_resolved', {
                conflict: 'global_search_vs_abroad_only',
                winner: 'global_search',
            }, {
                dedupeKey: 'global_search_vs_abroad_only',
                throttleMs: 20_000,
            });
        }
    }, [abroadOnly, globalSearch, setAbroadOnlyTracked, setGlobalSearchTracked]);

    // Perform search is now just setting the search term
    const performSearch = useCallback((term: string) => {
        setSearchTermTracked(term);
    }, [setSearchTermTracked]);

    // --- HELPERS REINSTATED ---

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefitsTracked(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractTypeFilter = (type: string) => {
        const canonicalType = normalizeContractTypeFilter(type);
        if (!canonicalType) return;
        setFilterContractTypeTracked(prev =>
            prev.includes(canonicalType)
                ? prev.filter(t => t !== canonicalType)
                : [...prev, canonicalType]
        );
    };

    const toggleExperienceFilter = (level: string) => {
        setFilterExperienceTracked(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
    };

    const applyInteractionState = useCallback((
        jobId: string,
        eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave'
    ) => {
        const normalizedId = String(jobId);
        if (!normalizedId) return;

        if (eventType === 'save' || eventType === 'swipe_right') {
            setSavedJobIds(prev => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
            setDismissedJobIds(prev => prev.filter(id => id !== normalizedId));
            return;
        }

        setSavedJobIds(prev => prev.filter(id => id !== normalizedId));
        if (eventType === 'swipe_left') {
            setDismissedJobIds(prev => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
            setJobs(prev => prev.filter(job => job.id !== normalizedId));
        }
    }, []);

    const setSavedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setSavedJobIds(prev => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    const setDismissedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setDismissedJobIds(prev => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    const clearAllFilters = () => {
        setSearchTermTracked('', 'default');
        setFilterCityTracked('', 'default');
        setFilterBenefitsTracked([], 'default');
        setFilterContractTypeTracked([], 'default');
        setFilterDateTracked('all', 'default');
        setFilterMinSalaryTracked(0, 'default');
        setFilterExperienceTracked([], 'default');
        setFilterMaxDistanceTracked(50, 'default');
        setFilterLanguageCodesTracked([], 'default');
        setEnableAutoLanguageGuard(true);
        setEnableCommuteFilterTracked(false, 'default');
        setAbroadOnlyTracked(false, 'default');
        setCountryCodesSafe([]);
        setGlobalSearchTracked(true, 'default');
        setFilterSources(DEFAULT_FILTER_SOURCES);
        setSearchDiagnostics(null);
        // Reset page
        setCurrentPage(0);
    };

    // Return structure matching the original hook
    return {
        jobs, // calculated directly from DB
        loading,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching: !!searchTerm,
        impressionSessionKey,
        backendUnreachable,

        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        filterDate,
        filterMinSalary,
        filterExperience,
        filterLanguageCodes,
        enableAutoLanguageGuard,
        implicitLanguageCodesApplied,
        savedJobIds,
        dismissedJobIds,
        showFilters,
        expandedSections,
        globalSearch,
        abroadOnly,
        countryCodes,
        sortBy,
        currentPage,
        pageSize: initialPageSize,
        filterSources,
        searchMode,
        searchDiagnostics,

        loadInitialJobs,
        loadMoreJobs,
        goToPage,
        performSearch,
        setSearchTerm: setSearchTermTracked,
        setFilterCity: setFilterCityTracked,
        setFilterMaxDistance: setFilterMaxDistanceTracked,
        setEnableCommuteFilter: setEnableCommuteFilterTracked,
        setFilterBenefits: setFilterBenefitsTracked,
        setFilterContractType: setFilterContractTypeTracked,
        setFilterDate: setFilterDateTracked,
        setFilterMinSalary: setFilterMinSalaryTracked,
        setFilterExperience: setFilterExperienceTracked,
        setFilterLanguageCodes: setFilterLanguageCodesTracked,
        setEnableAutoLanguageGuard,
        setSavedJobIds: setSavedJobIdsWithDedupe,
        setDismissedJobIds: setDismissedJobIdsWithDedupe,
        setShowFilters,
        setExpandedSections,
        setGlobalSearch: setGlobalSearchTracked,
        setAbroadOnly: setAbroadOnlyTracked,
        setCountryCodes: setCountryCodesSafe,
        setSortBy,
        applyInteractionState,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        applyDiscoveryDefaults,
        clearAllFilters
    };
};
