import { useState, useCallback, useEffect } from 'react';
import { Job } from '../types';
import { fetchJobsPaginated, searchJobs } from '../services/jobService';
import { UserProfile } from '../types';
import { calculateDistanceKm, getCoordinates } from '../services/commuteService';
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
    const [globalSearch, setGlobalSearch] = useState(false); // Toggle for searching entire database
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
            const result = await fetchJobsPaginated(
                0,
                initialPageSize,
                globalSearch ? undefined : userProfile.coordinates?.lat,
                globalSearch ? undefined : userProfile.coordinates?.lon,
                filterMaxDistance
            );
            setJobs(result.jobs);
            setHasMore(result.hasMore);
            setTotalCount(result.totalCount);
            setCurrentPage(0);
        } catch (error) {
            console.error('Error loading initial jobs:', error);
        } finally {
            setLoading(false);
        }
    }, [initialPageSize, userProfile.coordinates?.lat, userProfile.coordinates?.lon, filterMaxDistance, globalSearch]);

    // Save savedJobIds to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('savedJobIds', JSON.stringify(savedJobIds));
        } catch (error) {
            console.error('Error saving jobs to localStorage:', error);
        }
    }, [savedJobIds]);

    // Reload jobs when globalSearch mode changes
    useEffect(() => {
        loadInitialJobs();
    }, [globalSearch]);

    // Handle city filter changes - geocode city and reload jobs with that location
    useEffect(() => {
        if (!filterCity || !filterCity.trim()) {
            return; // Don't do anything if filter is empty
        }

        console.log(`🏙️  City filter changed to: "${filterCity}", geocoding and reloading jobs...`);
        
        // Debounce to avoid too many requests while typing
        const timeoutId = setTimeout(async () => {
            try {
                const { geocodeWithCaching } = await import('../services/geocodingService');
                const { searchJobsByLocation } = await import('../services/jobService');
                
                const coords = await geocodeWithCaching(filterCity);
                
                if (coords) {
                    console.log(`🏙️  Geocoded "${filterCity}" to: ${coords.lat}, ${coords.lon}`);
                    setLoading(true);
                    const result = await fetchJobsPaginated(
                        0,
                        initialPageSize,
                        coords.lat,
                        coords.lon,
                        100 // Use wider radius for city search (100km)
                    );
                    
                    // If geocoding worked but returned no results, try location text search
                    if (result.jobs.length === 0) {
                        console.log(`🏙️  No geocoded jobs found, trying location text search...`);
                        const locationResult = await searchJobsByLocation(filterCity, 0, initialPageSize);
                        setJobs(locationResult.jobs);
                        setHasMore(locationResult.hasMore);
                        setTotalCount(locationResult.totalCount);
                    } else {
                        setJobs(result.jobs);
                        setHasMore(result.hasMore);
                        setTotalCount(result.totalCount);
                    }
                    setCurrentPage(0);
                } else {
                    // Geocoding failed, try location text search as fallback
                    console.log(`🏙️  Could not geocode "${filterCity}", trying location text search...`);
                    setLoading(true);
                    const locationResult = await searchJobsByLocation(filterCity, 0, initialPageSize);
                    setJobs(locationResult.jobs);
                    setHasMore(locationResult.hasMore);
                    setTotalCount(locationResult.totalCount);
                    setCurrentPage(0);
                }
            } catch (error) {
                console.error('Error with city search:', error);
                // Clear jobs on error
                setJobs([]);
                setHasMore(false);
                setTotalCount(0);
                setCurrentPage(0);
            } finally {
                setLoading(false);
            }
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timeoutId); // Cleanup timeout if filter changes again
    }, [filterCity, initialPageSize]);

    // Load more jobs
    const loadMoreJobs = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const result = await fetchJobsPaginated(
                nextPage,
                initialPageSize,
                globalSearch ? undefined : userProfile.coordinates?.lat,
                globalSearch ? undefined : userProfile.coordinates?.lon,
                filterMaxDistance
            );
            
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
    }, [currentPage, hasMore, loadingMore, initialPageSize, userProfile.coordinates?.lat, userProfile.coordinates?.lon, filterMaxDistance, globalSearch]);

    // Search functionality
    const performSearch = useCallback(async (term: string) => {
        console.log(`🔎 performSearch called with term: "${term}"`);
        if (!term.trim()) {
            console.log(`🔎 Term is empty, clearing search results`);
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            console.log(`🔎 About to call searchJobs with: "${term}"`);
            const results = await searchJobs(term);
            console.log(`🔎 searchJobs returned ${results.length} results for "${term}"`);

            setSearchResults(results);
        } catch (error) {
            console.error('Error searching jobs:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Apply filters to jobs
    let jobCounter = 0; // For debug logging
    
    // Determine which jobs to filter: use searchResults if we have active search, otherwise use main jobs list
    const jobsToFilter = (searchResults.length > 0 && searchTerm.trim()) ? searchResults : jobs;
    console.log(`[Filter] Using ${jobsToFilter.length === searchResults.length ? 'searchResults' : 'jobs'} array. searchTerm: "${searchTerm}", searchResults.length: ${searchResults.length}, filterCity: "${filterCity}"`);
    
    let filteredJobs = jobsToFilter.filter(job => {
        // When we have active search results, bypass all other filters - search results should show everything that matches the query
        if (searchResults.length > 0 && searchTerm.trim()) {
            return true;
        }

        // City filter - only apply when NOT searching
        // Note: If geocoding succeeded, the jobs are already filtered by proximity to the city
        // This is a fallback/refinement for additional safety
        if (filterCity && filterCity.trim() && !enableCommuteFilter && !userProfile.coordinates) {
            const cityLower = filterCity.toLowerCase().trim();
            const jobLocation = job.location.toLowerCase();
            
            // Split location by common delimiters to check each part
            const locationParts = jobLocation.split(/[,\-]/);
            const matchesCity = locationParts.some(part => 
                part.trim().includes(cityLower) || cityLower.includes(part.trim())
            );
            
            if (!matchesCity) {
                return false;
            }
        }

        // Commute distance filter - prefer DB coords when available
        if (enableCommuteFilter && filterMaxDistance && userProfile.coordinates) {
            const jobLat = (job as any).lat;
            const jobLng = (job as any).lng;
            let jobCoords: { lat: number; lon: number } | null = null;

            if (jobLat !== undefined && jobLng !== undefined && jobLat !== null && jobLng !== null) {
                jobCoords = { lat: jobLat, lon: jobLng };
            } else {
                jobCoords = getCoordinates(job.location);
            }

            if (!jobCoords) return true; // Keep jobs where location is unknown

            const dist = calculateDistanceKm(
                userProfile.coordinates!.lat,
                userProfile.coordinates!.lon,
                jobCoords.lat,
                jobCoords.lon
            );
            
            // Debug logging for first few jobs
            if (jobCounter < 3) {
                console.log(`📍 Job "${job.title}" in "${job.location}": ${dist.toFixed(1)}km (max: ${filterMaxDistance}km) - ${dist <= filterMaxDistance ? '✅ KEEP' : '❌ FILTER OUT'}`);
            }
            
            jobCounter++;
            
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

    // NOTE: Proximity sorting would require async geocoding which can't be done in a filter
    // Instead, we'll just return jobs sorted by static cache if available, unsorted otherwise
    // This ensures NO jobs are hidden due to geocoding unavailability


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

    // Apply proximity sorting if user has coordinates and jobs have pre-geocoded coordinates
    let finalJobs = filteredJobs;
    if (userProfile.coordinates && !searchTerm && !isSearching && filteredJobs.length > 0) {
        finalJobs = [...filteredJobs].sort((a, b) => {
            // Use pre-geocoded lat/lng from database
            const hasLngA = a.lng !== undefined && a.lat !== undefined;
            const hasLngB = b.lng !== undefined && b.lat !== undefined;

            // If neither job has coordinates, keep original order
            if (!hasLngA && !hasLngB) return 0;
            
            // Jobs with coordinates come first, sorted by distance
            if (!hasLngA) return 1;
            if (!hasLngB) return -1;

            // Both have coordinates, calculate distance
            const distA = calculateDistanceKm(
                userProfile.coordinates!.lat,
                userProfile.coordinates!.lon,
                a.lat!,
                a.lng!
            );
            const distB = calculateDistanceKm(
                userProfile.coordinates!.lat,
                userProfile.coordinates!.lon,
                b.lat!,
                b.lng!
            );

            return distA - distB;
        });
    }

    console.log('[usePaginatedJobs] Rendering - jobs:', jobs.length, 'filtered:', filteredJobs.length, 'final:', finalJobs.length, 'with DB coords:', finalJobs.filter(j => j.lat && j.lng).length, 'fallback to address:', finalJobs.filter(j => !j.lat || !j.lng).length);

    return {
        // State
        jobs: finalJobs,
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
        globalSearch,

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
        setGlobalSearch,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        clearAllFilters
    };
};