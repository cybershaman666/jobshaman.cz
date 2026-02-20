import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Job } from '../types';
import { UserProfile } from '../types';
import { fetchJobsPaginated, fetchJobsWithFilters, fetchRecommendedJobs } from '../services/jobService';
import { geocodeWithCaching, getStaticCoordinates } from '../services/geocodingService';
import AnalyticsService from '../services/analyticsService';
import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';

// Infer country code from address text (best-effort)
const getCountryCodeFromAddress = (address: string): string | null => {
    if (!address) return null;
    const loc = address.toLowerCase();
    if (loc.includes('slovak') || loc.includes('slovensk') || loc.includes('slovensko') || loc.includes('bratislava') || loc.includes('kosice')) return 'sk';
    if (loc.includes('polsk') || loc.includes('poland') || loc.includes('warszawa') || loc.includes('krakow') || loc.includes('wroclaw') || loc.includes('gda')) return 'pl';
    if (loc.includes('deutsch') || loc.includes('germany') || loc.includes('berlin') || loc.includes('münchen') || loc.includes('hamburg')) return 'de';
    if (loc.includes('österreich') || loc.includes('austria') || loc.includes('wien') || loc.includes('vienna')) return 'at';
    if (loc.includes('česk') || loc.includes('czech') || loc.includes('praha') || loc.includes('brno') || loc.includes('ostrava')) return 'cs';
    return null;
};

// Infer country code from language (best-effort)
const getCountryCodeFromLanguage = (lng?: string): string | null => {
    if (!lng) return null;
    const code = lng.split('-')[0].toLowerCase();
    if (code === 'cs') return 'cs';
    if (code === 'sk') return 'sk';
    if (code === 'de') return 'de';
    if (code === 'pl') return 'pl';
    if (code === 'at') return 'at';
    return null;
};

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
}

const JOBS_FEED_CACHE_KEY = 'jobs_feed_cache_v1';
const JOBS_FEED_CACHE_MAX = 80;

const normalizeCountryCodes = (codes: string[]): string[] => {
    if (!codes || codes.length === 0) return [];
    const lowered = codes.map(c => c.toLowerCase());
    const hasCs = lowered.includes('cs');
    const hasCz = lowered.includes('cz');
    const expanded = (hasCs || hasCz)
        ? Array.from(new Set([...lowered.filter(c => c !== 'cs' && c !== 'cz'), 'cs', 'cz']))
        : lowered;
    return expanded;
};

const normalizeOrigin = (value: string): string => {
    try {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(withProtocol).origin;
    } catch {
        return '';
    }
};

const hasDedicatedSearchRuntime = (): boolean => {
    const searchOrigin = normalizeOrigin(SEARCH_BACKEND_URL || '');
    const coreOrigin = normalizeOrigin(BACKEND_URL || '');
    return !!searchOrigin && !!coreOrigin && searchOrigin !== coreOrigin;
};

// Global deduper helper to prevent "duplicate key" React warnings
const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => {
    const seen = new Set(existingJobs.map(j => j.id));
    return [...existingJobs, ...newJobs.filter(j => !seen.has(j.id))];
};

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50 }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const dedicatedSearchRuntime = hasDedicatedSearchRuntime();
    const activeFetchControllerRef = useRef<AbortController | null>(null);
    const latestRequestIdRef = useRef(0);
    const hasHandledInitialSortFetchRef = useRef(false);
    const defaultDomesticCountries = ['cs', 'cz', 'sk'];
    const initialCountry = getCountryCodeFromAddress(userProfile.address) || getCountryCodeFromLanguage(i18n.language);
    const [countryCodes, setCountryCodes] = useState<string[]>(() => (initialCountry ? [initialCountry] : []));

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

    // Filter state
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState<string>('all'); // all, 24h, 3d, 7d, 14d
    const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
    const [filterExperience, setFilterExperience] = useState<string[]>([]); // Junior, Medior, Senior, Lead
    const [filterLanguage, setFilterLanguage] = useState<string>(''); // ISO code or empty for all
    const [globalSearch, setGlobalSearch] = useState(() => !initialCountry); // Toggle for searching entire database
    const [abroadOnly, setAbroadOnly] = useState(false);
    const [sortBy, setSortBy] = useState<string>('default'); // default | recommended | jhi_desc | jhi_asc | personalized_jhi_desc | newest
    const hasAutoSortAppliedRef = useRef(false);

    // Load saved job IDs from localStorage on mount
    const [savedJobIds, setSavedJobIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('savedJobIds');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading saved jobs from localStorage:', error);
            return [];
        }
    });

    // Save savedJobIds to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('savedJobIds', JSON.stringify(savedJobIds));
        } catch (error) {
            console.error('Error saving jobs to localStorage:', error);
        }
    }, [savedJobIds]);

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
        return () => {
            latestRequestIdRef.current += 1;
            if (activeFetchControllerRef.current) {
                activeFetchControllerRef.current.abort();
                activeFetchControllerRef.current = null;
            }
        };
    }, []);

    // Auto-switch to recommended sorting when we have a parsed CV or skills signal.
    useEffect(() => {
        if (hasAutoSortAppliedRef.current) return;
        const hasCvSignal =
            !!userProfile.cvText ||
            !!userProfile.cvAiText ||
            !!(userProfile.skills && userProfile.skills.length > 0);
        if (userProfile.isLoggedIn && hasCvSignal && sortBy === 'default') {
            setSortBy('recommended');
            hasAutoSortAppliedRef.current = true;
        }
    }, [userProfile.isLoggedIn, userProfile.cvText, userProfile.cvAiText, userProfile.skills, sortBy]);


    // UI state
    const [showFilters, setShowFilters] = useState(false);
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
        if (!isLoadMore && activeFetchControllerRef.current) {
            activeFetchControllerRef.current.abort();
        }
        const fetchController = new AbortController();
        const requestId = ++latestRequestIdRef.current;
        const isStaleRequest = () => requestId !== latestRequestIdRef.current || fetchController.signal.aborted;
        activeFetchControllerRef.current = fetchController;

        setLoading(true);
        if (isLoadMore) setLoadingMore(true);

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
            const hasAnyFilters =
                !!searchTerm ||
                !!filterCity ||
                filterContractType.length > 0 ||
                filterBenefits.length > 0 ||
                !!filterMinSalary ||
                filterDate !== 'all' ||
                filterExperience.length > 0 ||
                enableCommuteFilter ||
                sortBy !== 'default' ||
                !!filterLanguage ||
                abroadOnly;

            const canUseRecommendations =
                sortBy === 'recommended' &&
                !searchTerm &&
                !filterCity &&
                filterContractType.length === 0 &&
                filterBenefits.length === 0 &&
                !filterMinSalary &&
                filterDate === 'all' &&
                filterExperience.length === 0 &&
                !enableCommuteFilter &&
                !filterLanguage &&
                !abroadOnly;

            const canUseSimplePagination =
                !dedicatedSearchRuntime &&
                !hasAnyFilters &&
                (!hasCountryFilter || normalizedCountryCodes.length === 1);

            if (canUseRecommendations) {
                const recs = await fetchRecommendedJobs(initialPageSize);
                if (isStaleRequest()) return;
                setJobs(recs);
                setHasMore(false);
                setTotalCount(recs.length);
                return;
            }

            if (canUseSimplePagination) {
                const singleCountry = hasCountryFilter ? normalizedCountryCodes[0] : undefined;
                const basicResult = await fetchJobsPaginated(
                    page,
                    initialPageSize,
                    undefined,
                    undefined,
                    50,
                    singleCountry
                );
                if (isStaleRequest()) return;

                if (isLoadMore) {
                    setJobs(prev => dedupeJobs(basicResult.jobs, prev));
                } else {
                    setJobs(basicResult.jobs);
                }

                setHasMore(basicResult.hasMore);
                setTotalCount(basicResult.totalCount || 0);
                return;
            }

            const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : defaultDomesticCountries;
            const effectiveCountryCodes = globalSearch ? undefined : normalizedCountryCodes;
            const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;

            const result = await fetchJobsWithFilters({
                page,
                pageSize: initialPageSize,
                searchTerm,
                sortMode: (sortBy === 'personalized_jhi_desc' ? 'default' : sortBy) as 'default' | 'newest' | 'jhi_desc' | 'jhi_asc' | 'recommended',
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
                filterLanguageCodes: filterLanguage ? [filterLanguage] : undefined,
                jhiPreferences: userProfile.jhiPreferences,
                userTaxProfile: userProfile.taxProfile,
                abortSignal: fetchController.signal
            });
            if (isStaleRequest()) return;

            if (isLoadMore) {
                setJobs(prev => dedupeJobs(result.jobs, prev));
            } else {
                setJobs(result.jobs);
            }

            setHasMore(result.hasMore);
            setTotalCount(result.totalCount || 0);

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
        initialPageSize, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, userProfile.coordinates, userProfile.id, countryCodes, globalSearch, filterLanguage, abroadOnly, sortBy, userProfile.isLoggedIn, userProfile.jhiPreferences, userProfile.taxProfile
    ]);


    // Debounced reload when filters change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            console.log('⏱️ Debounced filter fetch triggered');
            setCurrentPage(0);
            fetchFilteredJobs(0, false);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, countryCodes, globalSearch, filterLanguage, abroadOnly
    ]); // Excluded fetchFilteredJobs to avoid re-triggering when it's just redefined

    // Re-apply sorting when sort option changes
    useEffect(() => {
        if (!hasHandledInitialSortFetchRef.current) {
            hasHandledInitialSortFetchRef.current = true;
            return;
        }
        setCurrentPage(0);
        fetchFilteredJobs(0, false);
    }, [sortBy, fetchFilteredJobs]);

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

    // Initial load
    const loadInitialJobs = useCallback(() => {
        setCurrentPage(0);
        return fetchFilteredJobs(0, false);
    }, [fetchFilteredJobs]);

    // If user has address and we are still in global search with no country, narrow to their country
    useEffect(() => {
        if (globalSearch && countryCodes.length === 0) {
            const inferred = getCountryCodeFromAddress(userProfile.address);
            if (inferred) {
                setCountryCodes([inferred]);
                setGlobalSearch(false);
            }
        }
    }, [globalSearch, countryCodes.length, userProfile.address]);

    useEffect(() => {
        if (abroadOnly && !globalSearch) {
            setGlobalSearch(true);
            return;
        }
        if (!globalSearch && abroadOnly) {
            setAbroadOnly(false);
        }
    }, [abroadOnly, globalSearch]);

    // When UI language changes, default to that country's jobs
    useEffect(() => {
        const langCountry = getCountryCodeFromLanguage(i18n.language);
        if (!langCountry) return;
        if (!globalSearch && !abroadOnly) {
            if (countryCodes.length !== 1 || countryCodes[0] !== langCountry) {
                setCountryCodes([langCountry]);
            }
        }
    }, [i18n.language, countryCodes, globalSearch, abroadOnly]);

    // Perform search is now just setting the search term
    const performSearch = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    // --- HELPERS REINSTATED ---

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefits(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractTypeFilter = (type: string) => {
        setFilterContractType(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    const toggleExperienceFilter = (level: string) => {
        setFilterExperience(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterCity('');
        setFilterBenefits([]);
        setFilterContractType([]);
        setFilterDate('all');
        setFilterMinSalary(0);
        setFilterExperience([]);
        setFilterMaxDistance(50);
        setFilterLanguage('');
        setAbroadOnly(false);
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

        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        filterDate,
        filterMinSalary,
        filterExperience,
        filterLanguage,
        savedJobIds,
        showFilters,
        expandedSections,
        globalSearch,
        abroadOnly,
        countryCodes,
        sortBy,

        loadInitialJobs,
        loadMoreJobs,
        performSearch,
        setSearchTerm,
        setFilterCity,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterBenefits,
        setFilterContractType,
        setFilterDate,
        setFilterMinSalary,
        setFilterExperience,
        setFilterLanguage,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        setGlobalSearch,
        setAbroadOnly,
        setCountryCodes,
        setSortBy,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        clearAllFilters
    };
};
