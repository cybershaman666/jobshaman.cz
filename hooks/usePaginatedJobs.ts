import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Job } from '../types';
import { UserProfile } from '../types';

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

// Global deduper helper to prevent "duplicate key" React warnings
const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => {
    const seen = new Set(existingJobs.map(j => j.id));
    return [...existingJobs, ...newJobs.filter(j => !seen.has(j.id))];
};

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50 }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const defaultDomesticCountries = ['cs', 'cz', 'sk'];
    const initialCountry = getCountryCodeFromAddress(userProfile.address) || getCountryCodeFromLanguage(i18n.language);
    const [countryCodes, setCountryCodes] = useState<string[]>(() => (initialCountry ? [initialCountry] : []));

    const [jobs, setJobs] = useState<Job[]>([]);
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
    const [sortBy, setSortBy] = useState<string>('default'); // default | jhi_desc | jhi_asc | newest

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
    const sortJobs = useCallback((items: Job[]): Job[] => {
        if (sortBy === 'jhi_desc') {
            return [...items].sort((a, b) => (b.jhi?.score || 0) - (a.jhi?.score || 0));
        }
        if (sortBy === 'jhi_asc') {
            return [...items].sort((a, b) => (a.jhi?.score || 0) - (b.jhi?.score || 0));
        }
        if (sortBy === 'newest') {
            return [...items].sort((a, b) => {
                const aTime = a.scrapedAt ? new Date(a.scrapedAt).getTime() : 0;
                const bTime = b.scrapedAt ? new Date(b.scrapedAt).getTime() : 0;
                return bTime - aTime;
            });
        }
        return items;
    }, [sortBy]);

    const fetchFilteredJobs = useCallback(async (page: number, isLoadMore: boolean = false) => {
        setLoading(true);
        if (isLoadMore) setLoadingMore(true);

        try {
            const { fetchJobsWithFilters, fetchJobsPaginated } = await import('../services/jobService');

            // Only use coordinates if we are doing a commute filter or proximity sort
            let lat = userProfile.coordinates?.lat;
            let lon = userProfile.coordinates?.lon;

            // If user has an address but no coordinates yet, try to resolve it for radius filtering.
            if ((lat == null || lon == null) && enableCommuteFilter && userProfile.address) {
                const { getStaticCoordinates, geocodeWithCaching } = await import('../services/geocodingService');
                const addrCoords = getStaticCoordinates(userProfile.address) || await geocodeWithCaching(userProfile.address);
                if (addrCoords) {
                    lat = addrCoords.lat;
                    lon = addrCoords.lon;
                }
            }

            // If no user coordinates but we have a city and commute filter is requested,
            // try to get coordinates for the city to allow radius search.
            if ((lat == null || lon == null) && filterCity && enableCommuteFilter) {
                const { getStaticCoordinates } = await import('../services/geocodingService');
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

            const canUseSimplePagination = !hasAnyFilters && (!hasCountryFilter || normalizedCountryCodes.length === 1);

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

                if (isLoadMore) {
                    setJobs(prev => sortJobs(dedupeJobs(basicResult.jobs, prev)));
                } else {
                    setJobs(sortJobs(basicResult.jobs));
                }

                setHasMore(basicResult.hasMore);
                setTotalCount(basicResult.totalCount || 0);
                return;
            }

            const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : defaultDomesticCountries;
            const effectiveCountryCodes = filterLanguage
                ? undefined
                : (globalSearch ? undefined : normalizedCountryCodes);
            const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;

            const result = await fetchJobsWithFilters({
                page,
                pageSize: initialPageSize,
                searchTerm,
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
                filterLanguageCodes: filterLanguage ? [filterLanguage] : undefined
            });

            if (isLoadMore) {
                setJobs(prev => sortJobs(dedupeJobs(result.jobs, prev)));
            } else {
                setJobs(sortJobs(result.jobs));
            }

            setHasMore(result.hasMore);
            setTotalCount(result.totalCount || 0);

            // Track analytics
            if ((filterCity || filterContractType.length > 0 || filterBenefits.length > 0)) {
                const { default: AnalyticsService } = await import('../services/analyticsService');
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
            console.error('Error fetching filtered jobs:', error);
            if (!isLoadMore) setJobs([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [
        initialPageSize, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, userProfile.coordinates, userProfile.id, countryCodes, globalSearch, sortJobs, filterLanguage, abroadOnly
    ]);


    // Debounced reload when filters change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            console.log('⏱️ Debounced filter fetch triggered');
            setCurrentPage(0);
            fetchFilteredJobs(0, false);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [
        searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, countryCodes, globalSearch, filterLanguage, abroadOnly
    ]); // Excluded fetchFilteredJobs to avoid re-triggering when it's just redefined

    // Re-apply sorting when sort option changes
    useEffect(() => {
        if (sortBy === 'default') {
            setCurrentPage(0);
            fetchFilteredJobs(0, false);
            return;
        }
        setJobs(prev => sortJobs([...prev]));
    }, [sortBy, fetchFilteredJobs, sortJobs]);

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
        fetchFilteredJobs(0, false);
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

    // If language filter is set, search across all countries
    useEffect(() => {
        if (filterLanguage && !globalSearch) {
            setGlobalSearch(true);
        }
    }, [filterLanguage, globalSearch]);

    useEffect(() => {
        if (abroadOnly && !globalSearch) {
            setGlobalSearch(true);
            return;
        }
        if (!globalSearch && abroadOnly) {
            setAbroadOnly(false);
        }
    }, [abroadOnly, globalSearch]);

    // When language changes, default to that country's jobs (unless cross-border is enabled)
    useEffect(() => {
        if (globalSearch) return;
        const langCountry = getCountryCodeFromLanguage(i18n.language);
        if (langCountry && (countryCodes.length !== 1 || countryCodes[0] !== langCountry)) {
            setCountryCodes([langCountry]);
        }
    }, [i18n.language, globalSearch, countryCodes]);

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
