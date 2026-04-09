import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Job, SearchDiagnosticsMeta, UserProfile } from '../types';
import AnalyticsService from '../services/analyticsService';
import { dedupeJobsList } from '../services/jobService';
import { resolveDiscoveryCoordinates } from '../services/discoveryCoordinates';
import { markPerf, measurePerf } from '../src/app/perf/perfDebug';
import useDiscoveryFilters, { normalizeCountryCodes, sameCountryCodeSet } from './useDiscoveryFilters';
import useJobInteractionState from './useJobInteractionState';
import { runFilteredFetchPipeline, runSimplePaginationPipeline } from './discovery/discoveryFetchPipeline';
import {
    createDomesticCountrySafeguard,
    getCountryCodeFromAddress,
    getLogicalCountryCount,
    getSourceMixCounts,
} from './discovery/discoverySafeguards';

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
    enabled?: boolean;
    microJobsOnly?: boolean;
    remoteOnly?: boolean;
}

const JOBS_FEED_CACHE_KEY = 'jobs_feed_cache_v1';
const JOBS_FEED_CACHE_MAX = 80;
const DEBUG_DISCOVERY =
    String(import.meta.env.VITE_DEBUG_DISCOVERY || '').toLowerCase() === 'true';

const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => dedupeJobsList([...existingJobs, ...newJobs]);

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

export const usePaginatedJobs = ({
    userProfile,
    initialPageSize = 50,
    enabled = true,
    microJobsOnly = false,
    remoteOnly = false,
}: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const localeIdentity = useMemo(
        () => String(i18n.resolvedLanguage || i18n.language || 'en').trim().toLowerCase(),
        [i18n.language, i18n.resolvedLanguage]
    );

    const activeFetchControllerRef = useRef<AbortController | null>(null);
    const latestRequestIdRef = useRef(0);
    const lastDebouncedLogAtRef = useRef(0);
    const previousLocaleIdentityRef = useRef<string | null>(null);
    const hasRunFilterEffectRef = useRef(false);
    const pendingHardRefreshRef = useRef(false);
    const lastPrimaryFetchSignatureRef = useRef<string | null>(null);

    const [jobs, setJobs] = useState<Job[]>(() => {
        try {
            const cached = localStorage.getItem(JOBS_FEED_CACHE_KEY);
            if (!cached) return [];
            const parsed = JSON.parse(cached);
            return Array.isArray(parsed) ? (parsed.slice(0, JOBS_FEED_CACHE_MAX) as Job[]) : [];
        } catch {
            return [];
        }
    });
    const jobsRef = useRef<Job[]>(jobs);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [impressionSessionKey, setImpressionSessionKey] = useState(() => `impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [backendUnreachable, setBackendUnreachable] = useState(false);
    const [searchDiagnostics, setSearchDiagnostics] = useState<SearchDiagnosticsMeta | null>(null);
    const [showFilters, setShowFilters] = useState(true);
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        contract: true,
        benefits: true,
        date: true,
        salary: true,
        experience: true,
    });

    const {
        abroadOnly,
        applyDiscoveryDefaults,
        countryCodes,
        defaultCountryCodes,
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
    } = useDiscoveryFilters({
        userProfile,
        locale: i18n.language,
        remoteOnly,
        getCountryCodeFromAddress,
    });

    useEffect(() => {
        if (previousLocaleIdentityRef.current === null) {
            previousLocaleIdentityRef.current = localeIdentity;
            return;
        }
        if (previousLocaleIdentityRef.current === localeIdentity) return;
        previousLocaleIdentityRef.current = localeIdentity;
        setFilterLanguageCodesTracked([], 'default');
        setFilterSources((prev) => (prev.filterLanguageCodes === 'default' ? prev : { ...prev, filterLanguageCodes: 'default' }));
    }, [localeIdentity, setFilterLanguageCodesTracked, setFilterSources]);

    const {
        applyInteractionState,
        dismissedJobIds,
        filterDismissedJobs,
        savedJobIds,
        setDismissedJobIds,
        setSavedJobIds,
    } = useJobInteractionState({
        enabled,
        userProfile,
    });

    const applyDomesticCountrySafeguard = useMemo(() => createDomesticCountrySafeguard({
        countryCodes,
        domesticCountryCodes: defaultCountryCodes,
        enableCommuteFilter,
        globalSearch,
        abroadOnly,
        filterLanguageCodes,
    }), [
        abroadOnly,
        countryCodes,
        defaultCountryCodes,
        enableCommuteFilter,
        filterLanguageCodes,
        globalSearch,
    ]);

    useEffect(() => {
        jobsRef.current = jobs;
    }, [jobs]);

    useEffect(() => {
        if (!jobs.length) return;
        try {
            localStorage.setItem(JOBS_FEED_CACHE_KEY, JSON.stringify(jobs.slice(0, JOBS_FEED_CACHE_MAX)));
        } catch {
            // ignore
        }
    }, [jobs]);

    useEffect(() => {
        if (!dismissedJobIds.length) return;
        setJobs((prev) => filterDismissedJobs(prev));
    }, [dismissedJobIds, filterDismissedJobs]);

    useEffect(() => {
        return () => {
            latestRequestIdRef.current += 1;
            activeFetchControllerRef.current?.abort();
            activeFetchControllerRef.current = null;
        };
    }, []);

    const primaryFetchSignature = useMemo(() => JSON.stringify({
        enabled,
        searchTerm,
        filterCity,
        filterContractType,
        filterBenefits,
        filterMinSalary,
        filterDate,
        filterExperience,
        enableCommuteFilter,
        filterMaxDistance,
        remoteOnly,
        filterWorkArrangement,
        globalSearch,
        abroadOnly,
        countryCodes,
        filterLanguageCodes,
        sortBy,
        searchMode,
        discoveryMode: microJobsOnly ? 'micro_jobs' : 'all',
    }), [
        abroadOnly,
        countryCodes,
        enabled,
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
        globalSearch,
        microJobsOnly,
        remoteOnly,
        searchMode,
        searchTerm,
        sortBy,
    ]);

    const fetchFilteredJobs = useCallback(async (
        page: number,
        isLoadMore = false,
        options?: { force?: boolean; reason?: string }
    ) => {
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
        latestRequestIdRef.current += 1;
        const requestId = latestRequestIdRef.current;
        const isStaleRequest = () => requestId !== latestRequestIdRef.current || fetchController.signal.aborted;

        if (!isLoadMore && !options?.force) {
            if (lastPrimaryFetchSignatureRef.current === primaryFetchSignature) return;
            lastPrimaryFetchSignatureRef.current = primaryFetchSignature;
        }

        activeFetchControllerRef.current = fetchController;
        const perfSuffix = isLoadMore ? `load-more:${page}` : (options?.reason || 'primary');
        const perfStartMark = `discovery:fetch:start:${requestId}:${perfSuffix}`;
        const perfEndMark = `discovery:fetch:end:${requestId}:${perfSuffix}`;
        markPerf(perfStartMark);

        setLoading(true);
        if (isLoadMore) setLoadingMore(true);
        if (!isLoadMore && pendingHardRefreshRef.current) {
            pendingHardRefreshRef.current = false;
        }

        try {
            const { lat, lon } = await resolveDiscoveryCoordinates({
                userProfile,
                enableCommuteFilter,
                filterCity,
                allowProfileAddressGeocode: Boolean(enableCommuteFilter),
            });

            const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
            const domesticCountryCodes = normalizeCountryCodes(defaultCountryCodes);
            const effectiveDomesticCountries = domesticCountryCodes.length > 0 ? domesticCountryCodes : normalizedCountryCodes;
            const effectiveCountryCodes = globalSearch
                ? undefined
                : (normalizedCountryCodes.length > 0 ? normalizedCountryCodes : effectiveDomesticCountries);
            const excludeCountryCodes = abroadOnly ? effectiveDomesticCountries : undefined;
            const hasCountryFilter = !globalSearch && (effectiveCountryCodes?.length || 0) > 0;
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
                filterWorkArrangement !== 'all';
            const retrievalLanguageCodes = filterLanguageCodes.length > 0 ? filterLanguageCodes : undefined;
            const requestedPageSize = initialPageSize;

            const canUseSimplePagination =
                !hasAnyFilters &&
                (!hasCountryFilter || getLogicalCountryCount(effectiveCountryCodes || []) === 1);

            if (canUseSimplePagination) {
                const simpleResult = await runSimplePaginationPipeline({
                    page,
                    pageSize: requestedPageSize,
                    hasCountryFilter,
                    normalizedCountryCodes: effectiveCountryCodes || [],
                    retrievalLanguageCodes,
                    microJobsOnly,
                    searchMode,
                    filterDismissedJobs,
                    applyDomesticCountrySafeguard,
                    isStaleRequest,
                    getSourceMixCounts,
                });
                if (!simpleResult) return;

                setBackendUnreachable(false);
                setSearchDiagnostics({
                    ...simpleResult.diagnostics,
                    reordered_by_profile: false,
                });
                if (isLoadMore) {
                    setJobs((prev) => dedupeJobs(simpleResult.visibleJobs, prev));
                } else {
                    setJobs(simpleResult.visibleJobs);
                }
                setHasMore(simpleResult.resolvedHasMore);
                setTotalCount(simpleResult.totalCount);
                return;
            }

            const filteredResult = await runFilteredFetchPipeline({
                page,
                pageSize: requestedPageSize,
                previousJobsCount: jobsRef.current.length,
                searchTerm,
                searchMode,
                filterCity,
                sortBy,
                filterContractType,
                filterBenefits: Array.from(new Set(filterBenefits)),
                filterMinSalary,
                filterDate,
                filterExperience,
                effectiveRadiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
                lat,
                lon,
                effectiveCountryCodes,
                excludeCountryCodes,
                retrievalLanguageCodes,
                remoteOnly,
                filterWorkArrangement,
                microJobsOnly,
                abortSignal: fetchController.signal,
                userProfile,
                filterDismissedJobs,
                applyDomesticCountrySafeguard,
                isStaleRequest,
                getSourceMixCounts,
            });
            if (!filteredResult) return;

            setBackendUnreachable(false);
            setSearchDiagnostics({
                ...filteredResult.diagnostics,
                reordered_by_profile: false,
            });

            if (isLoadMore) {
                setJobs((prev) => dedupeJobs(filteredResult.visibleJobs, prev));
            } else {
                setJobs(filteredResult.visibleJobs);
            }

            setHasMore(filteredResult.resolvedHasMore);
            setTotalCount(filteredResult.resolvedTotalCount);

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
                    resultCount: filteredResult.result.totalCount || 0,
                }).catch(() => undefined);
            }
        } catch (error) {
            if ((error as any)?.name === 'AbortError') return;
            if (isStaleRequest()) return;
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
            console.error('Error fetching filtered jobs:', error);
        } finally {
            markPerf(perfEndMark);
            measurePerf(`discovery:fetch:${perfSuffix}`, perfStartMark, perfEndMark);
            if (activeFetchControllerRef.current === fetchController) {
                activeFetchControllerRef.current = null;
            }
            if (requestId === latestRequestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [
        abroadOnly,
        applyDomesticCountrySafeguard,
        countryCodes,
        defaultCountryCodes,
        enableCommuteFilter,
        enabled,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterDismissedJobs,
        filterExperience,
        filterLanguageCodes,
        filterMaxDistance,
        filterMinSalary,
        filterWorkArrangement,
        globalSearch,
        initialPageSize,
        microJobsOnly,
        primaryFetchSignature,
        remoteOnly,
        searchMode,
        searchTerm,
        sortBy,
        userProfile,
    ]);

    useEffect(() => {
        if (!enabled) return;
        if (hasRunFilterEffectRef.current) {
            setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
            pendingHardRefreshRef.current = true;
            setLoading(true);
            setLoadingMore(false);
        }
        hasRunFilterEffectRef.current = true;

        const timeoutId = setTimeout(() => {
            if (DEBUG_DISCOVERY && Date.now() - lastDebouncedLogAtRef.current > 2_000) {
                lastDebouncedLogAtRef.current = Date.now();
            }
            setCurrentPage(0);
            fetchFilteredJobs(0, false, { reason: 'filters' });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [enabled, fetchFilteredJobs, primaryFetchSignature]);

    useEffect(() => {
        if (defaultCountryCodes.length === 0) return;
        if (globalSearch || abroadOnly) return;
        if (!sameCountryCodeSet(countryCodes, defaultCountryCodes)) {
            setCountryCodesSafe(defaultCountryCodes);
        }
    }, [abroadOnly, countryCodes, defaultCountryCodes, globalSearch, setCountryCodesSafe]);

    useEffect(() => {
        if (abroadOnly && globalSearch) {
            setGlobalSearchTracked(false, 'default');
            return;
        }
        if (globalSearch && abroadOnly) {
            setAbroadOnlyTracked(false, 'default');
        }
    }, [abroadOnly, globalSearch, setAbroadOnlyTracked, setGlobalSearchTracked]);

    const loadMoreJobs = useCallback(() => {
        if (!loadingMore && hasMore) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            fetchFilteredJobs(nextPage, true);
        }
    }, [currentPage, fetchFilteredJobs, hasMore, loadingMore]);

    const goToPage = useCallback((page: number) => {
        const normalizedPage = Math.max(0, Number(page) || 0);
        if (normalizedPage === currentPage && jobs.length > 0) return;
        setCurrentPage(normalizedPage);
        void fetchFilteredJobs(normalizedPage, false, { force: true, reason: 'page' });
    }, [currentPage, fetchFilteredJobs, jobs.length]);

    const loadInitialJobs = useCallback(() => {
        setCurrentPage(0);
        return fetchFilteredJobs(0, false, { force: true, reason: 'initial' });
    }, [fetchFilteredJobs]);

    const performSearch = useCallback((term: string) => {
        setSearchTermTracked(term);
    }, [setSearchTermTracked]);

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefitsTracked((prev) => prev.includes(benefit) ? prev.filter((b) => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractTypeFilter = (type: string) => {
        const canonicalType = normalizeContractTypeFilter(type);
        if (!canonicalType) return;
        setFilterContractTypeTracked((prev) => prev.includes(canonicalType)
            ? prev.filter((value) => value !== canonicalType)
            : [...prev, canonicalType]);
    };

    const toggleExperienceFilter = (level: string) => {
        setFilterExperienceTracked((prev) => prev.includes(level) ? prev.filter((value) => value !== level) : [...prev, level]);
    };

    const clearAllFilters = () => {
        resetDiscoveryFilters();
        setSearchDiagnostics(null);
        setCurrentPage(0);
    };

    return {
        jobs,
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
        filterWorkArrangement,
        filterExperience,
        filterLanguageCodes,
        hasExplicitLanguageFilter,
        enableAutoLanguageGuard: false,
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
        setFilterWorkArrangement: setFilterWorkArrangementTracked,
        setFilterExperience: setFilterExperienceTracked,
        setFilterLanguageCodes: setFilterLanguageCodesTracked,
        setEnableAutoLanguageGuard: () => undefined,
        setSavedJobIds,
        setDismissedJobIds,
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
        clearAllFilters,
    };
};

export default usePaginatedJobs;
