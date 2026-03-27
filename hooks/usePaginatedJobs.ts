import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Job, SearchDiagnosticsMeta, UserProfile } from '../types';
import { dedupeJobsList } from '../services/jobService';
import AnalyticsService from '../services/analyticsService';
import {
    annotateJobsForCandidate,
    computeCandidateAnnotations,
    getCandidateIntentDomainSeedKeyword,
    getCandidateIntentDomainLabel,
    getCandidateIntentRoleSeedKeyword,
    resolveCandidateIntentProfile,
} from '../services/candidateIntentService';
import { recordRuntimeSignal } from '../services/runtimeSignals';
import { getDefaultCandidateSearchFilters } from '../services/searchProfilePresets';
import { resolveDiscoveryCoordinates } from '../services/discoveryCoordinates';
import useDiscoveryFilters, {
    normalizeCountryCodes,
    sameCountryCodeSet,
} from './useDiscoveryFilters';
import useJobInteractionState from './useJobInteractionState';
import {
    applyExternalOverlayJobFilters,
    runAsyncExternalOverlay,
    runFilteredFetchPipeline,
    runSimplePaginationPipeline,
} from './discovery/discoveryFetchPipeline';
import {
    calculateDistanceKm,
    createDomesticCountrySafeguard,
    getCountryCodeFromAddress,
    getLogicalCountryCount,
    getSourceMixCounts,
    inferJobCountryCode,
    inferJobLanguageCode,
} from './discovery/discoverySafeguards';
import { markPerf, measurePerf } from '../src/app/perf/perfDebug';

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

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50, enabled = true, microJobsOnly = false, remoteOnly = false }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const localeIdentity = useMemo(
        () => String(i18n.resolvedLanguage || i18n.language || 'en').trim().toLowerCase(),
        [i18n.language, i18n.resolvedLanguage]
    );
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
    const hasProfileLocation = useMemo(
        () => Boolean(
            userProfile.coordinates?.lat
            || userProfile.coordinates?.lon
            || String(userProfile.address || '').trim()
        ),
        [userProfile.address, userProfile.coordinates?.lat, userProfile.coordinates?.lon]
    );
    const profileDiscoveryDefaults = useMemo(
        () => getDefaultCandidateSearchFilters(userProfile, { hasLocation: hasProfileLocation }),
        [hasProfileLocation, userProfile]
    );
    const shouldAnnotateDiscoveryByProfile = useMemo(
        () => Boolean(
            candidateIntent.primaryDomain
            || candidateIntent.targetRole
            || candidateIntent.secondaryDomains.length > 0
            || candidateIntent.avoidDomains.length > 0
        ),
        [
            candidateIntent.avoidDomains,
            candidateIntent.primaryDomain,
            candidateIntent.secondaryDomains,
            candidateIntent.targetRole,
        ]
    );
    const activeFetchControllerRef = useRef<AbortController | null>(null);
    const externalOverlayControllerRef = useRef<AbortController | null>(null);
    const lastExternalOverlaySignatureRef = useRef<string>('');
    const latestRequestIdRef = useRef(0);
    const lastDebouncedLogAtRef = useRef(0);
    const previousLocaleIdentityRef = useRef<string | null>(null);
    const hasHandledInitialSortFetchRef = useRef(false);
    const hasRunFilterEffectRef = useRef(false);
    const lastAppliedProfileDefaultsSignatureRef = useRef<string | null>(null);
    const pendingHardRefreshRef = useRef(false);
    const lastPrimaryFetchSignatureRef = useRef<string | null>(null);
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
    const [impressionSessionKey, setImpressionSessionKey] = useState(() => `impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [backendUnreachable, setBackendUnreachable] = useState(false);
    const [searchDiagnostics, setSearchDiagnostics] = useState<SearchDiagnosticsMeta | null>(null);
    const {
        abroadOnly,
        applyDiscoveryDefaults,
        countryCodes,
        defaultCountryCodes,
        enableAutoLanguageGuard,
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
        marketBaselineCountryCodes,
        normalizedDefaultDomesticCountries,
        resetDiscoveryFilters,
        searchMode,
        searchTerm,
        sortBy,
        setAbroadOnly: setAbroadOnlyTracked,
        setCountryCodes: setCountryCodesSafe,
        setEnableAutoLanguageGuard,
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
        if (previousLocaleIdentityRef.current === localeIdentity) {
            return;
        }

        previousLocaleIdentityRef.current = localeIdentity;
        setFilterLanguageCodesTracked((prev) => (prev.length > 0 ? [] : prev), 'default');
        setEnableAutoLanguageGuard(true);
        setFilterSources((prev) => {
            if (prev.filterLanguageCodes === 'default') return prev;
            return { ...prev, filterLanguageCodes: 'default' };
        });
    }, [localeIdentity]);

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

    const applyProfileDiscoveryOrdering = useCallback((visibleJobs: Job[], currentSearchMode: string) => {
        if (!visibleJobs.length || !shouldAnnotateDiscoveryByProfile) {
            return {
                jobs: visibleJobs,
                reordered: false,
            };
        }
        if (currentSearchMode === 'manual_query') {
            return {
                jobs: computeCandidateAnnotations(visibleJobs, userProfile, i18n.language),
                reordered: false,
            };
        }
        return {
            jobs: annotateJobsForCandidate(visibleJobs, userProfile, i18n.language),
            reordered: true,
        };
    }, [i18n.language, shouldAnnotateDiscoveryByProfile, userProfile]);

    const applyDomesticCountrySafeguard = useMemo(() => createDomesticCountrySafeguard({
        countryCodes,
        marketBaselineCountryCodes,
        enableCommuteFilter,
        globalSearch,
        abroadOnly,
        filterLanguageCodes,
    }), [
        abroadOnly,
        countryCodes,
        enableCommuteFilter,
        filterLanguageCodes,
        globalSearch,
        marketBaselineCountryCodes,
    ]);

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
        isLoadMore: boolean = false,
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
        ++latestRequestIdRef.current;
        const requestId = latestRequestIdRef.current;
        const isStaleRequest = () => requestId !== latestRequestIdRef.current || fetchController.signal.aborted;
        if (!isLoadMore && !options?.force) {
            if (lastPrimaryFetchSignatureRef.current === primaryFetchSignature) {
                return;
            }
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
            const hasUserPinnedCommuteFilter = filterSources.enableCommuteFilter === 'user_toggle';
            const suppressImplicitCommuteForManualQuery =
                searchMode === 'manual_query' && !hasUserPinnedCommuteFilter;
            const effectiveEnableCommuteFilter = suppressImplicitCommuteForManualQuery
                ? false
                : enableCommuteFilter;
            const defaultMaxDistanceKm = Number(profileDiscoveryDefaults.filterMaxDistance || 0) || undefined;
            const hasExplicitLocationFilter = !!(filterCity && filterCity.trim());
            const effectiveImplicitRadiusKm =
                !suppressImplicitCommuteForManualQuery && !effectiveEnableCommuteFilter && !hasExplicitLocationFilter
                    ? defaultMaxDistanceKm
                    : undefined;

            const { lat, lon } = await resolveDiscoveryCoordinates({
                userProfile,
                enableCommuteFilter: effectiveEnableCommuteFilter,
                filterCity,
                allowProfileAddressGeocode: Boolean(effectiveEnableCommuteFilter || effectiveImplicitRadiusKm),
            });

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
                effectiveEnableCommuteFilter ||
                sortBy !== 'newest' ||
                filterLanguageCodes.length > 0 ||
                abroadOnly ||
                remoteOnly ||
                filterWorkArrangement !== 'all' ||
                hasCountryOverride;
            const retrievalLanguageCodes = filterLanguageCodes.length > 0
                ? filterLanguageCodes
                : undefined;
            const requestedPageSize = initialPageSize;
            const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : normalizedDefaultDomesticCountries;
            const isDefaultCountrySelection = sameCountryCodeSet(normalizedCountryCodes, normalizeCountryCodes(marketBaselineCountryCodes));
            const shouldAutoExpandBorderCountries =
                effectiveEnableCommuteFilter &&
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
            const applyExternalRecoveryFilters = (jobs: Job[]): Job[] => applyExternalOverlayJobFilters({
                jobs,
                effectiveCountryCodes,
                excludeCountryCodes,
                retrievalLanguageCodes,
                remoteOnly,
                filterWorkArrangement,
                filterCity,
                enableCommuteFilter: effectiveEnableCommuteFilter,
                filterMaxDistance,
                lat,
                lon,
                inferJobCountryCode,
                inferJobLanguageCode,
                normalizeCountryCodes,
                calculateDistanceKm,
                defaultMaxDistanceKm: effectiveImplicitRadiusKm,
            });

            // Avoid heavy RPC paths when the user effectively wants "show me the newest feed".
            // Supabase PostgREST RPC can hit statement timeouts (57014) on broad queries, while
            // simple pagination over `jobs` stays fast and stable.
            const canUseSimplePagination =
                !hasAnyFilters &&
                (!hasCountryFilter || getLogicalCountryCount(normalizedCountryCodes) === 1);

            if (canUseSimplePagination) {
                const simpleResult = await runSimplePaginationPipeline({
                    page,
                    pageSize: requestedPageSize,
                    hasCountryFilter,
                    normalizedCountryCodes,
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
                if (DEBUG_DISCOVERY) {
                    console.log('📦 Simple pagination result:', {
                        raw: simpleResult.rawCount,
                        visible: simpleResult.visibleJobs.length,
                        hasMore: simpleResult.resolvedHasMore,
                        totalCount: simpleResult.totalCount,
                        countryCodes: hasCountryFilter ? normalizedCountryCodes : [],
                        retrievalLanguageCodes: retrievalLanguageCodes || [],
                    });
                }
                const annotatedSimple = applyProfileDiscoveryOrdering(simpleResult.visibleJobs, searchMode);
                setSearchDiagnostics({
                    ...simpleResult.diagnostics,
                    reordered_by_profile: simpleResult.diagnostics.reordered_by_profile || annotatedSimple.reordered,
                });
                if (isLoadMore) {
                    setJobs(prev => applyProfileDiscoveryOrdering(dedupeJobs(annotatedSimple.jobs, prev), searchMode).jobs);
                } else {
                    setJobs(annotatedSimple.jobs);
                }

                setHasMore(simpleResult.resolvedHasMore);
                setTotalCount(simpleResult.totalCount);

                if (!isLoadMore && page === 0) {
                    externalOverlayControllerRef.current?.abort();
                    runAsyncExternalOverlay({
                        searchTerm,
                        filterCity,
                        externalSearchSeedTerm,
                        effectiveCountryCodes: hasCountryFilter ? normalizedCountryCodes : undefined,
                        excludeCountryCodes: abroadOnly ? normalizedDefaultDomesticCountries : undefined,
                        applyExternalRecoveryFilters,
                        lastSignature: lastExternalOverlaySignatureRef.current,
                        onSignatureChange: (signature) => {
                            lastExternalOverlaySignatureRef.current = signature;
                        },
                        replaceController: (controller) => {
                            externalOverlayControllerRef.current = controller;
                        },
                        setJobs: (updater) => {
                            setJobs((prev) => applyProfileDiscoveryOrdering(updater(prev), searchMode).jobs);
                        },
                    });
                }
                return;
            }

            // Candidate profile defaults now intentionally flow into discovery filters.
            // Keep the payload deduped so we do not accidentally over-constrain the query
            // with repeated benefit aliases.
            const effectiveBenefits = Array.from(new Set(filterBenefits));

            const effectiveRadiusKm = effectiveEnableCommuteFilter
                ? filterMaxDistance
                : effectiveImplicitRadiusKm;

            const filteredResult = await runFilteredFetchPipeline({
                page,
                pageSize: requestedPageSize,
                searchTerm,
                searchMode,
                filterCity,
                sortBy,
                filterContractType,
                filterBenefits: effectiveBenefits,
                filterMinSalary,
                filterDate,
                filterExperience,
                effectiveRadiusKm,
                lat,
                lon,
                effectiveCountryCodes,
                excludeCountryCodes,
                retrievalLanguageCodes,
                remoteOnly,
                filterWorkArrangement,
                externalSearchSeedTerm,
                microJobsOnly,
                abortSignal: fetchController.signal,
                userProfile,
                filterDismissedJobs,
                applyDomesticCountrySafeguard,
                applyExternalRecoveryFilters,
                isStaleRequest,
                getSourceMixCounts,
            });
            if (!filteredResult) return;
            setBackendUnreachable(false);

            if (DEBUG_DISCOVERY) {
                console.log('📦 Filtered fetch result:', {
                    raw: filteredResult.result.jobs.length,
                    visible: filteredResult.visibleJobs.length,
                    hasMore: filteredResult.result.hasMore,
                    totalCount: filteredResult.result.totalCount,
                    searchMode,
                });
            }
            const annotatedFiltered = applyProfileDiscoveryOrdering(filteredResult.visibleJobs, searchMode);
            setSearchDiagnostics({
                ...filteredResult.diagnostics,
                reordered_by_profile: filteredResult.diagnostics.reordered_by_profile || annotatedFiltered.reordered,
            });

            if (isLoadMore) {
                setJobs(prev => applyProfileDiscoveryOrdering(dedupeJobs(annotatedFiltered.jobs, prev), searchMode).jobs);
            } else {
                setJobs(annotatedFiltered.jobs);
            }

            setHasMore(filteredResult.resolvedHasMore);
            setTotalCount(filteredResult.resolvedTotalCount);

            if (DEBUG_DISCOVERY || String(import.meta.env.VITE_SEARCH_DEBUG || '').toLowerCase() === 'true') {
                console.groupCollapsed(
                    `[search-debug] ${filteredResult.diagnostics.search_mode} ${String(searchTerm || '').trim() || '(browse)'}`
                );
                console.table({
                    search_mode: filteredResult.diagnostics.search_mode,
                    backend_count: filteredResult.diagnostics.base_result_count,
                    post_filter_count: filteredResult.diagnostics.post_filter_count,
                    source_mix: JSON.stringify(filteredResult.diagnostics.source_mix || {}),
                    reordered_by_profile: filteredResult.diagnostics.reordered_by_profile,
                    sort_mode: sortBy,
                    remote_only: remoteOnly,
                    work_arrangement: filterWorkArrangement,
                    commute_enabled: effectiveEnableCommuteFilter,
                    implicit_commute_suppressed: suppressImplicitCommuteForManualQuery,
                    radius_km: effectiveRadiusKm ?? null,
                });
                console.table(
                    filteredResult.visibleJobs.slice(0, 10).map((job, index) => ({
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
                const hasExternalInPrimaryFeed = filteredResult.visibleJobs.some(
                    (job) => job.listingKind === 'imported' || Boolean(job.searchDiagnostics?.external)
                );
                if (!hasExternalInPrimaryFeed) {
                    externalOverlayControllerRef.current?.abort();
                    runAsyncExternalOverlay({
                        searchTerm,
                        filterCity,
                        externalSearchSeedTerm,
                        effectiveCountryCodes,
                        excludeCountryCodes,
                        applyExternalRecoveryFilters,
                        lastSignature: lastExternalOverlaySignatureRef.current,
                        onSignatureChange: (signature) => {
                            lastExternalOverlaySignatureRef.current = signature;
                        },
                        replaceController: (controller) => {
                            externalOverlayControllerRef.current = controller;
                        },
                        setJobs: (updater) => {
                            setJobs((prev) => applyProfileDiscoveryOrdering(updater(prev), searchMode).jobs);
                        },
                    });
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
                    resultCount: filteredResult.result.totalCount || 0
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
        applyProfileDiscoveryOrdering,
        countryCodes,
        enableCommuteFilter,
        externalSearchSeedTerm,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterDismissedJobs,
        filterExperience,
        filterLanguageCodes,
        filterMaxDistance,
        filterMinSalary,
        filterSources.enableCommuteFilter,
        filterWorkArrangement,
        globalSearch,
        initialPageSize,
        marketBaselineCountryCodes,
        microJobsOnly,
        normalizedDefaultDomesticCountries,
        primaryFetchSignature,
        profileDiscoveryDefaults.filterMaxDistance,
        remoteOnly,
        searchMode,
        searchTerm,
        sortBy,
        userProfile,
    ]);


    // Debounced reload when filters change
    useEffect(() => {
        if (!enabled) return;
        if (hasRunFilterEffectRef.current) {
            setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
            pendingHardRefreshRef.current = true;
            setLoading(true);
            setLoadingMore(false);
        }
        hasRunFilterEffectRef.current = true;
        hasHandledInitialSortFetchRef.current = true;

        const timeoutId = setTimeout(() => {
            if (DEBUG_DISCOVERY && Date.now() - lastDebouncedLogAtRef.current > 2_000) {
                console.log('⏱️ Debounced filter fetch triggered');
                lastDebouncedLogAtRef.current = Date.now();
            }
            setCurrentPage(0);
            fetchFilteredJobs(0, false, { reason: 'filters' });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [enabled, fetchFilteredJobs, primaryFetchSignature]);

    // Load more jobs
    const loadMoreJobs = useCallback(() => {
        if (!loadingMore && hasMore) {
            const nextPage = currentPage + 1;
            if (DEBUG_DISCOVERY) {
                console.log(`🔄 loadMoreJobs called. Moving to page ${nextPage}`);
            }
            setCurrentPage(nextPage);
            fetchFilteredJobs(nextPage, true);
        } else if (DEBUG_DISCOVERY) {
            console.log('⏭️ loadMoreJobs skipped:', { loadingMore, hasMore });
        }
    }, [loadingMore, hasMore, currentPage, fetchFilteredJobs]);

    const goToPage = useCallback((page: number) => {
        const normalizedPage = Math.max(0, Number(page) || 0);
        if (normalizedPage === currentPage && jobs.length > 0) return;
        setCurrentPage(normalizedPage);
        void fetchFilteredJobs(normalizedPage, false, { force: true, reason: 'page' });
    }, [currentPage, fetchFilteredJobs, jobs.length]);

    // Initial load
    const loadInitialJobs = useCallback(() => {
        setCurrentPage(0);
        return fetchFilteredJobs(0, false, { force: true, reason: 'initial' });
    }, [fetchFilteredJobs]);

    useEffect(() => {
        if (userProfile.isLoggedIn) return;
        lastAppliedProfileDefaultsSignatureRef.current = null;
    }, [userProfile.isLoggedIn]);

    // Initial/synced Profile Defaults application
    useEffect(() => {
        if (!enabled) return;

        const isProfileReady = userProfile.isLoggedIn ? !!userProfile.id : true;
        if (!isProfileReady) return;
        if (DEBUG_DISCOVERY) {
            console.log('🏁 Applying initial profile search defaults...');
        }

        const defaultsSignature = JSON.stringify({
            profileId: userProfile.id || 'guest',
            defaults: profileDiscoveryDefaults,
            hasProfileLocation,
        });
        if (lastAppliedProfileDefaultsSignatureRef.current === defaultsSignature) return;

        lastAppliedProfileDefaultsSignatureRef.current = defaultsSignature;
        applyDiscoveryDefaults(profileDiscoveryDefaults, true);
    }, [
        applyDiscoveryDefaults,
        enabled,
        hasProfileLocation,
        profileDiscoveryDefaults,
        userProfile.id,
        userProfile.isLoggedIn,
    ]);

    useEffect(() => {
        const defaultGlobalSearch = Boolean(profileDiscoveryDefaults.globalSearch) || defaultCountryCodes.length === 0;
        if (filterSources.globalSearch !== 'user_toggle') {
            setGlobalSearchTracked(defaultGlobalSearch, 'default');
        }
        if (filterSources.abroadOnly !== 'user_toggle') {
            setAbroadOnlyTracked(false, 'default');
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
        profileDiscoveryDefaults.globalSearch,
        setAbroadOnlyTracked,
        setCountryCodesSafe,
        setGlobalSearchTracked,
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

    const clearAllFilters = () => {
        resetDiscoveryFilters();
        setSearchDiagnostics(null);
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
        filterWorkArrangement,
        filterExperience,
        filterLanguageCodes,
        hasExplicitLanguageFilter,
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
        setFilterWorkArrangement: setFilterWorkArrangementTracked,
        setFilterExperience: setFilterExperienceTracked,
        setFilterLanguageCodes: setFilterLanguageCodesTracked,
        setEnableAutoLanguageGuard,
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
        clearAllFilters
    };
};
