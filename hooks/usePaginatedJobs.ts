import { useState, useCallback } from 'react';
import { Job } from '../types';
import { fetchJobsPaginated, searchJobs } from '../services/jobService';
import { UserProfile } from '../types';
import { getCoordinates, calculateDistanceKm } from '../services/commuteService';
import { BENEFIT_KEYWORDS } from '../utils/benefits';

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
}

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50 }: UsePaginatedJobsProps) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Job[]>([]);

    // Filter state
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);

    // UI state
    const [showFilters, setShowFilters] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        contract: true,
        benefits: true
    });

    // Initial load
    const loadInitialJobs = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJobsPaginated(0, initialPageSize);
            setJobs(result.jobs);
            setHasMore(result.hasMore);
            setTotalCount(result.totalCount);
            setCurrentPage(0);
        } catch (error) {
            console.error('Error loading initial jobs:', error);
        } finally {
            setLoading(false);
        }
    }, [initialPageSize]);

    // Load more jobs
    const loadMoreJobs = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const result = await fetchJobsPaginated(nextPage, initialPageSize);
            
            if (result.jobs.length > 0) {
                setJobs(prev => [...prev, ...result.jobs]);
                setHasMore(result.hasMore);
                setCurrentPage(nextPage);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more jobs:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [currentPage, hasMore, loadingMore, initialPageSize]);

    // Search functionality
    const performSearch = useCallback(async (term: string) => {
        if (!term.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchJobs(term);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching jobs:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Apply filters to jobs
    let filteredJobs = (isSearching ? searchResults : jobs).filter(job => {
        // City filter
        if (filterCity) {
            const cityLower = filterCity.toLowerCase();
            const jobLocation = job.location.toLowerCase();
            if (!jobLocation.includes(cityLower)) return false;
        }

        // Commute distance filter
        if (enableCommuteFilter && filterMaxDistance && userProfile.coordinates) {
            const jobCoords = getCoordinates(job.location);
            if (!jobCoords) return true; // Keep jobs where location is unknown

            const dist = calculateDistanceKm(
                userProfile.coordinates!.lat,
                userProfile.coordinates!.lon,
                jobCoords.lat,
                jobCoords.lon
            );
            if (dist > filterMaxDistance) return false;
        }

        // Contract type filter
        if (filterContractType.length > 0) {
            const jobType = job.type || '';
            if (!filterContractType.some(type => jobType.toLowerCase().includes(type.toLowerCase()))) {
                return false;
            }
        }

        // Benefits filter
        if (filterBenefits.length > 0) {
            const jobDescription = (job.description + ' ' + (job.tags || []).join(' ')).toLowerCase();
            if (!filterBenefits.every(benefit => {
                const keywords = BENEFIT_KEYWORDS[benefit] || [];
                return keywords.some(keyword => jobDescription.includes(keyword));
            })) {
                return false;
            }
        }

        return true;
    });

    // Sort by distance if user has coordinates and no search term is active
    if (userProfile.coordinates && !searchTerm && !isSearching) {
        filteredJobs = [...filteredJobs].sort((a, b) => {
            const coordsA = getCoordinates(a.location);
            const coordsB = getCoordinates(b.location);

            if (!coordsA && !coordsB) return 0;
            if (!coordsA) return 1;
            if (!coordsB) return -1;

            const distA = calculateDistanceKm(userProfile.coordinates!.lat, userProfile.coordinates!.lon, coordsA.lat, coordsA.lon);
            const distB = calculateDistanceKm(userProfile.coordinates!.lat, userProfile.coordinates!.lon, coordsB.lat, coordsB.lon);

            return distA - distB;
        });
    }

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefits(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractTypeFilter = (type: string) => {
        setFilterContractType(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterCity('');
        setFilterBenefits([]);
        setFilterContractType([]);
        setFilterMaxDistance(50);
        setSearchResults([]);
        setIsSearching(false);
    };

    return {
        // State
        jobs: filteredJobs,
        loading,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching,
        searchResults,
        
        // Filter state
        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        savedJobIds,
        showFilters,
        expandedSections,

        // Actions
        loadInitialJobs,
        loadMoreJobs,
        performSearch,
        setSearchTerm,
        setSearchResults,
        setFilterCity,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterBenefits,
        setFilterContractType,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        clearAllFilters
    };
};