import { dedupeJobsList, fetchJobsPaginated, fetchJobsWithFilters } from '../../services/jobService';
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
    previousJobsCount?: number;
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
    microJobsOnly: boolean;
    abortSignal: AbortSignal;
    userProfile: UserProfile;
    filterDismissedJobs: (jobs: Job[]) => Job[];
    applyDomesticCountrySafeguard: (jobs: Job[]) => Job[];
    isStaleRequest: () => boolean;
    getSourceMixCounts: (jobs: Job[]) => NonNullable<SearchDiagnosticsMeta['source_mix']>;
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
    previousJobsCount = 0,
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
    microJobsOnly,
    abortSignal,
    userProfile,
    filterDismissedJobs,
    applyDomesticCountrySafeguard,
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
        includeJhi: false,
        microJobsOnly,
        abortSignal,
    });
    if (isStaleRequest()) return null;

    const jobsAfterDismissFilter = filterDismissedJobs(result.jobs);
    const jobsAfterDomesticSafeguard = applyDomesticCountrySafeguard(jobsAfterDismissFilter);
    let visibleJobs = dedupeJobsList(jobsAfterDomesticSafeguard);
    let resolvedHasMore = result.hasMore;
    let resolvedTotalCount = Math.max(0, Number(result.totalCount || 0) - (result.jobs.length - visibleJobs.length));

    if (visibleJobs.length === 0 && effectiveRadiusKm && result.totalCount > 0) {
        console.warn('⚠️ Spatial filter returned zero visible jobs despite non-zero totalCount; backend path may be inconsistent.', {
            radius_km: effectiveRadiusKm,
            total_count: result.totalCount,
            page,
        });
    }

    const diagnostics: SearchDiagnosticsMeta = {
        ...(result.meta || {}),
        search_mode: result.meta?.search_mode || searchMode,
        base_result_count: result.meta?.base_result_count ?? result.jobs.length,
        post_filter_count: result.meta?.post_filter_count ?? visibleJobs.length,
        source_mix: result.meta?.source_mix || getSourceMixCounts(visibleJobs),
        reordered_by_profile: result.meta?.reordered_by_profile ?? false,
    };

    const shouldEmitEmptyResultSignal =
        visibleJobs.length === 0 && (
            previousJobsCount <= 0 ||
            !!String(searchTerm || '').trim() ||
            !!String(filterCity || '').trim() ||
            String(searchMode || '').trim().toLowerCase() !== 'discovery_default' ||
            !!String(result.meta?.fallback_mode || '').trim() ||
            Array.isArray(result.meta?.degraded_reasons) && result.meta.degraded_reasons.length > 0
        );

    if (shouldEmitEmptyResultSignal) {
        recordRuntimeSignal('custom:search_empty_result', {
            search_term: searchTerm || null,
            filter_city: filterCity || null,
            fallback_mode: result.meta?.fallback_mode || null,
            degraded_reasons: result.meta?.degraded_reasons || [],
            backend_result_count: result.jobs.length,
            after_dismissed_count: jobsAfterDismissFilter.length,
            after_domestic_safeguard_count: jobsAfterDomesticSafeguard.length,
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
