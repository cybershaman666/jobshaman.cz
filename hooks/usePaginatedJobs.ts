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

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
}

// Global deduper helper to prevent "duplicate key" React warnings
const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => {
    const seen = new Set(existingJobs.map(j => j.id));
    return [...existingJobs, ...newJobs.filter(j => !seen.has(j.id))];
};

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50 }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const initialCountry = getCountryCodeFromAddress(userProfile.address);
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
    const [globalSearch, setGlobalSearch] = useState(() => !initialCountry); // Toggle for searching entire database

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
    const fetchFilteredJobs = useCallback(async (page: number, isLoadMore: boolean = false) => {
        setLoading(true);
        if (isLoadMore) setLoadingMore(true);

        try {
            const { fetchJobsWithFilters } = await import('../services/jobService');

            // Only use coordinates if we are doing a commute filter or proximity sort
            let lat = userProfile.coordinates?.lat;
            let lon = userProfile.coordinates?.lon;

            // If no user coordinates but we have a city and commute filter is requested,
            // try to get coordinates for the city to allow radius search.
            if (!lat && !lon && filterCity && enableCommuteFilter) {
                const { getStaticCoordinates } = await import('../services/geocodingService');
                const cityCoords = getStaticCoordinates(filterCity);
                if (cityCoords) {
                    lat = cityCoords.lat;
                    lon = cityCoords.lon;
                }
            }

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
                countryCodes: globalSearch ? undefined : countryCodes
            });

            if (isLoadMore) {
                setJobs(prev => dedupeJobs(result.jobs, prev));
            } else {
                setJobs(result.jobs);
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
        filterMaxDistance, userProfile.coordinates, userProfile.id, countryCodes, globalSearch
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
        filterMaxDistance, countryCodes, globalSearch
    ]); // Excluded fetchFilteredJobs to avoid re-triggering when it's just redefined

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

    // If user is logged out and has no address, always stay in global search
    useEffect(() => {
        if (!userProfile.isLoggedIn && !userProfile.address) {
            if (countryCodes.length > 0) setCountryCodes([]);
            if (!globalSearch) setGlobalSearch(true);
        }
    }, [userProfile.isLoggedIn, userProfile.address, countryCodes.length, globalSearch]);

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
        savedJobIds,
        showFilters,
        expandedSections,
        globalSearch,
        countryCodes,

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
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        setGlobalSearch,
        setCountryCodes,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        clearAllFilters
    };
};
