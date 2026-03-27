import { dedupeJobsList, fetchExternalOverlayJobs, fetchJobsPaginated, fetchJobsWithFilters } from '../../services/jobService';
import { isRemoteJob } from '../../services/commuteService';
import { recordRuntimeSignal } from '../../services/runtimeSignals';
import type { Job, JobWorkArrangementFilter, SearchDiagnosticsMeta, SearchLanguageCode, SearchMode, UserProfile } from '../../types';

interface RunSimplePaginationArgs {
    page: number;
    pageSize: number;
    hasCountryFilter: boolean;
    normalizedCountryCodes: string[];
    retrievalLanguageCodes?: SearchLanguageCode[];
    microJobsOnly: boolean;
    searchMode: SearchMode;
    filterDismissedJobs: (jobs: Job[]) => Job[];
    applyDomesticCountrySafeguard: (jobs: Job[]) => Job[];
    isStaleRequest: () => boolean;
    getSourceMixCounts: (jobs: Job[]) => NonNullable<SearchDiagnosticsMeta['source_mix']>;
}

interface RunFilteredFetchArgs {
    page: number;
    pageSize: number;
    searchTerm: string;
    sortBy: string;
    searchMode: SearchMode;
    filterCity: string;
    filterContractType: string[];
    filterBenefits: string[];
    filterMinSalary: number;
    filterDate: string;
    filterExperience: string[];
    effectiveRadiusKm?: number;
    lat?: number;
    lon?: number;
    effectiveCountryCodes?: string[];
    excludeCountryCodes?: string[];
    retrievalLanguageCodes?: SearchLanguageCode[];
    remoteOnly: boolean;
    filterWorkArrangement: JobWorkArrangementFilter;
    externalSearchSeedTerm?: string;
    microJobsOnly: boolean;
    abortSignal: AbortSignal;
    userProfile: UserProfile;
    filterDismissedJobs: (jobs: Job[]) => Job[];
    applyDomesticCountrySafeguard: (jobs: Job[]) => Job[];
    applyExternalRecoveryFilters: (jobs: Job[]) => Job[];
    isStaleRequest: () => boolean;
    getSourceMixCounts: (jobs: Job[]) => NonNullable<SearchDiagnosticsMeta['source_mix']>;
}

interface RunOverlayArgs {
    searchTerm: string;
    filterCity: string;
    externalSearchSeedTerm?: string;
    effectiveCountryCodes?: string[];
    excludeCountryCodes?: string[];
    applyExternalRecoveryFilters: (jobs: Job[]) => Job[];
    lastSignature: string;
    onSignatureChange: (signature: string) => void;
    replaceController: (controller: AbortController) => void;
    setJobs: (updater: (prev: Job[]) => Job[]) => void;
}

export const runSimplePaginationPipeline = async ({
    page,
    pageSize,
    hasCountryFilter,
    normalizedCountryCodes,
    retrievalLanguageCodes,
    microJobsOnly,
    searchMode,
    filterDismissedJobs,
    applyDomesticCountrySafeguard,
    isStaleRequest,
    getSourceMixCounts,
}: RunSimplePaginationArgs) => {
    const aggregatedRawJobs: Job[] = [];
    let nextSimplePage = page;
    let simpleFetchCount = 0;
    let finalHasMore = false;
    let finalTotalCount = 0;
    let visiblePool: Job[] = [];

    while (simpleFetchCount < 4) {
        const basicResult = await fetchJobsPaginated(
            nextSimplePage,
            pageSize,
            undefined,
            undefined,
            50,
            hasCountryFilter ? normalizedCountryCodes : undefined,
            retrievalLanguageCodes,
            false,
            microJobsOnly,
            true
        );
        if (isStaleRequest()) return null;

        aggregatedRawJobs.push(...basicResult.jobs);
        visiblePool = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(aggregatedRawJobs)));
        finalHasMore = basicResult.hasMore;
        finalTotalCount = Math.max(finalTotalCount, Number(basicResult.totalCount || 0));
        simpleFetchCount += 1;

        if (visiblePool.length >= pageSize || !basicResult.hasMore) {
            break;
        }

        nextSimplePage += 1;
    }

    const visibleJobs = visiblePool.slice(0, pageSize);
    const resolvedHasMore = finalHasMore || visiblePool.length > pageSize;

    return {
        diagnostics: {
            search_mode: searchMode,
            base_result_count: aggregatedRawJobs.length,
            post_filter_count: visibleJobs.length,
            source_mix: getSourceMixCounts(visibleJobs),
            reordered_by_profile: false,
        } satisfies SearchDiagnosticsMeta,
        rawCount: aggregatedRawJobs.length,
        resolvedHasMore,
        totalCount: Math.max(0, finalTotalCount),
        visibleJobs,
    };
};

export const runFilteredFetchPipeline = async ({
    page,
    pageSize,
    searchTerm,
    sortBy,
    searchMode,
    filterCity,
    filterContractType,
    filterBenefits,
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
    abortSignal,
    userProfile,
    filterDismissedJobs,
    applyDomesticCountrySafeguard,
    applyExternalRecoveryFilters,
    isStaleRequest,
    getSourceMixCounts,
}: RunFilteredFetchArgs) => {
    const result = await fetchJobsWithFilters({
        page,
        pageSize,
        searchTerm,
        sortMode: sortBy as 'default' | 'newest' | 'jhi_desc' | 'recommended' | 'distance' | 'salary_desc',
        searchMode: searchMode as any,
        filterCity,
        filterContractTypes: filterContractType,
        filterBenefits,
        filterMinSalary,
        filterDatePosted: filterDate,
        filterExperienceLevels: filterExperience,
        radiusKm: effectiveRadiusKm,
        userLat: lat,
        userLng: lon,
        countryCodes: effectiveCountryCodes,
        excludeCountryCodes,
        filterLanguageCodes: retrievalLanguageCodes,
        remoteOnly,
        filterWorkArrangement,
        jhiPreferences: userProfile.jhiPreferences,
        userTaxProfile: userProfile.taxProfile,
        externalSearchSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
        externalOverlayMode: page === 0 ? 'sync' : 'off',
        includeJhi: false,
        microJobsOnly,
        abortSignal,
    });
    if (isStaleRequest()) return null;

    let visibleJobs = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(result.jobs)));
    let resolvedHasMore = result.hasMore;
    let resolvedTotalCount = Math.max(0, Number(result.totalCount || 0) - (result.jobs.length - visibleJobs.length));

    const hasExplicitLookup = !!String(searchTerm || '').trim() || !!String(filterCity || '').trim();
    const shouldRunSparseBrowseRecovery =
        page === 0 &&
        visibleJobs.length < 6 &&
        !hasExplicitLookup &&
        !effectiveRadiusKm &&
        !!String(externalSearchSeedTerm || '').trim();
    const shouldRunExternalRecovery =
        page === 0 &&
        (
            (visibleJobs.length === 0 && hasExplicitLookup)
            || shouldRunSparseBrowseRecovery
        );

    if (visibleJobs.length === 0 && effectiveRadiusKm && result.totalCount > 0) {
        console.warn('⚠️ Spatial filter returned zero visible jobs despite non-zero totalCount; backend path may be inconsistent.', {
            radius_km: effectiveRadiusKm,
            total_count: result.totalCount,
            page,
        });
    }

    if (shouldRunExternalRecovery) {
        try {
            const recoveryJobs = await fetchExternalOverlayJobs({
                searchTerm: searchTerm || undefined,
                externalSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                filterCity,
                countryCodes: effectiveCountryCodes,
                excludeCountryCodes,
                abortSignal,
                includeJhi: false,
                mode: 'recovery',
            });
            if (!isStaleRequest() && recoveryJobs.length > 0) {
                const filteredRecoveryJobs = dedupeJobsList(
                    applyDomesticCountrySafeguard(
                        filterDismissedJobs(applyExternalRecoveryFilters(recoveryJobs))
                    )
                );
                if (filteredRecoveryJobs.length > 0) {
                    if (shouldRunSparseBrowseRecovery) {
                        visibleJobs = dedupeJobsList([...visibleJobs, ...filteredRecoveryJobs]);
                        resolvedTotalCount = Math.max(resolvedTotalCount, visibleJobs.length);
                        recordRuntimeSignal('custom:search_seed_recovery', {
                            result_count: visibleJobs.length,
                            seed_term: externalSearchSeedTerm || null,
                        }, {
                            dedupeKey: JSON.stringify({
                                seedTerm: externalSearchSeedTerm || '',
                                resultCount: visibleJobs.length,
                            }),
                            throttleMs: 20_000,
                        });
                    } else {
                        visibleJobs = filteredRecoveryJobs;
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
                                resultCount: visibleJobs.length,
                            }),
                            throttleMs: 20_000,
                        });
                    }
                }
            }
        } catch (recoveryError) {
            if ((recoveryError as any)?.name !== 'AbortError') {
                console.warn('External recovery search failed:', recoveryError);
            }
        }
    }

    const diagnostics: SearchDiagnosticsMeta = {
        ...(result.meta || {}),
        search_mode: result.meta?.search_mode || searchMode,
        base_result_count: result.meta?.base_result_count ?? result.jobs.length,
        post_filter_count: result.meta?.post_filter_count ?? visibleJobs.length,
        source_mix: result.meta?.source_mix || getSourceMixCounts(visibleJobs),
        reordered_by_profile: result.meta?.reordered_by_profile ?? false,
    };

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

    return {
        diagnostics,
        resolvedHasMore,
        resolvedTotalCount,
        result,
        visibleJobs,
    };
};

export const applyExternalOverlayJobFilters = ({
    jobs,
    effectiveCountryCodes,
    excludeCountryCodes,
    retrievalLanguageCodes,
    remoteOnly,
    filterWorkArrangement,
    filterCity,
    enableCommuteFilter,
    filterMaxDistance,
    lat,
    lon,
    inferJobCountryCode,
    inferJobLanguageCode,
    normalizeCountryCodes,
    calculateDistanceKm,
    defaultMaxDistanceKm,
}: {
    jobs: Job[];
    effectiveCountryCodes?: string[];
    excludeCountryCodes?: string[];
    retrievalLanguageCodes?: SearchLanguageCode[];
    remoteOnly: boolean;
    filterWorkArrangement: JobWorkArrangementFilter;
    filterCity: string;
    enableCommuteFilter: boolean;
    filterMaxDistance: number;
    lat?: number;
    lon?: number;
    inferJobCountryCode: (job: Job) => string | null;
    inferJobLanguageCode: (job: Job) => string | null;
    normalizeCountryCodes: (codes: string[]) => string[];
    calculateDistanceKm: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
    defaultMaxDistanceKm?: number;
}) => jobs.filter((job) => {
    const normalizedWorkArrangement = (() => {
        if (isRemoteJob(job)) return 'remote';
        const haystack = `${job.work_model || ''} ${(job.tags || []).join(' ')} ${job.title || ''} ${job.description || ''}`.toLowerCase();
        if (haystack.includes('hybrid')) return 'hybrid';
        if (haystack.includes('onsite') || haystack.includes('on-site') || haystack.includes('on site') || haystack.includes('presential')) {
            return 'onsite';
        }
        return 'onsite';
    })();
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
    if (!remoteOnly && filterWorkArrangement !== 'all' && normalizedWorkArrangement !== filterWorkArrangement) {
        return false;
    }
    if (filterCity.trim()) {
        const cityHaystack = `${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
        if (!cityHaystack.includes(filterCity.trim().toLowerCase())) {
            return false;
        }
    }

    const hasExplicitLocationFilter = !!filterCity.trim();
    const effectiveRadiusKm = enableCommuteFilter
        ? filterMaxDistance
        : (hasExplicitLocationFilter ? undefined : defaultMaxDistanceKm);

    if (effectiveRadiusKm && effectiveRadiusKm > 0 && !isRemoteJob(job)) {
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
        if (distanceKm == null || distanceKm > effectiveRadiusKm) {
            return false;
        }
        if (distanceKm != null) {
            (job as any).distance_km = distanceKm;
            (job as any).distanceKm = distanceKm;
        }
    }

    return true;
});

export const runAsyncExternalOverlay = ({
    searchTerm,
    filterCity,
    externalSearchSeedTerm,
    effectiveCountryCodes,
    excludeCountryCodes,
    applyExternalRecoveryFilters,
    lastSignature,
    onSignatureChange,
    replaceController,
    setJobs,
}: RunOverlayArgs) => {
    const signature = JSON.stringify({
        searchTerm: String(searchTerm || '').trim(),
        filterCity: String(filterCity || '').trim(),
        countryCodes: effectiveCountryCodes || null,
        excludeCountryCodes: excludeCountryCodes || null,
        seed: String(externalSearchSeedTerm || '').trim(),
    });
    if (signature === lastSignature) return;

    onSignatureChange(signature);
    const overlayController = new AbortController();
    replaceController(overlayController);

    void (async () => {
        const overlayJobs = await fetchExternalOverlayJobs({
            searchTerm: searchTerm || undefined,
            externalSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
            filterCity,
            countryCodes: effectiveCountryCodes,
            excludeCountryCodes,
            abortSignal: overlayController.signal,
            includeJhi: false,
        });
        if (overlayController.signal.aborted || !overlayJobs.length) return;

        const filteredOverlayJobs = applyExternalRecoveryFilters(overlayJobs);
        if (!filteredOverlayJobs.length) return;

        setJobs((prev) => dedupeJobsList([...prev, ...filteredOverlayJobs]));
    })().catch(() => {
        // Overlay is best-effort only.
    });
};
