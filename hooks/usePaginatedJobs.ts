import { useState, useCallback, useEffect, useRef } from 'react';
import { Job } from '../types';
import { fetchJobsPaginated, searchJobs, searchJobsByLocation } from '../services/jobService';
import { UserProfile } from '../types';
import { calculateDistanceKm, getCoordinates } from '../services/commuteService';
import { BENEFIT_KEYWORDS } from '../utils/benefits';

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
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Job[]>([]);

    // Merged pagination state (when we combine spatial + location-text results)
    const [mergedContext, setMergedContext] = useState<{ mode: 'none' | 'city' | 'search', coords?: { lat: number, lon: number }, locationText?: string }>({ mode: 'none' });
    const [spatialPage, setSpatialPage] = useState(0);
    const [locationTextPage, setLocationTextPage] = useState(0);
    const [spatialHasMore, setSpatialHasMore] = useState(true);
    const [locationHasMore, setLocationHasMore] = useState(true);

    // Annotate jobs that reference a region/country/remote so they can be kept
    // even when precise coordinates are unavailable. We geocode the region
    // centroid and check distance to the user coordinates.
    const annotateRegionMatches = async (jobsList: Job[], userCoords?: { lat: number; lon: number }): Promise<Job[]> => {
        if (!jobsList || jobsList.length === 0) return jobsList;
        if (!userCoords) {
            // If we don't have user coords, still mark generic locations like 'celá' or 'remote'
            return jobsList.map(j => {
                const loc = (j.location || '').toLowerCase();
                loc.normalize('NFD').replace(/[ - ]/g, '');
                if (loc.includes('cel') || loc.includes('česk') || loc.includes('remote') || loc.includes('home')) {
                    (j as any).__regionMatch = true;
                }
                return j;
            });
        }

        const { geocodeWithCaching, normalizeAddress } = await import('../services/geocodingService');
        const REGION_RADIUS_KM = 120; // generous radius for matching region centroids

        const out: Job[] = [];
        for (const job of jobsList) {
            (job as any).__regionMatch = false;
            // If job already has precise coords, no need to annotate
            if (job.lat !== undefined && job.lng !== undefined && job.lat !== null && job.lng !== null) {
                out.push(job);
                continue;
            }

            const loc = (job.location || '').toLowerCase();
            const norm = normalizeAddress(loc || '');

            // Generic matches: remote / whole country
            if (loc.includes('remote') || loc.includes('home office') || loc.includes('vzdalen') || loc.includes('cel') || loc.includes('česk') || loc.includes('cr') || loc.includes('republik')) {
                (job as any).__regionMatch = true;
                out.push(job);
                continue;
            }

            // Region mentions often contain 'kraj' (e.g. 'Jihomoravský kraj')
            if (norm.includes('kraj')) {
                try {
                    // Attempt to geocode the region string to a centroid
                    const geo = await geocodeWithCaching(job.location || norm);
                    if (geo) {
                        const dist = calculateDistanceKm(userCoords.lat, userCoords.lon, geo.lat, geo.lon);
                        if (dist <= REGION_RADIUS_KM) {
                            (job as any).__regionMatch = true;
                        }
                    }
                } catch (e) {
                    // ignore failures — leave __regionMatch false
                }
            }

            out.push(job);
        }

        return out;
    };

    // Filter state
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState<string>('all'); // all, 24h, 3d, 7d, 14d
    const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
    const [filterExperience, setFilterExperience] = useState<string[]>([]); // Junior, Medior, Senior, Lead
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
        benefits: true,
        date: true,
        salary: true,
        experience: true
    });

    // Initial load
    const initialLoadRef = useRef(false);

    const loadInitialJobs = useCallback(async () => {
        // Prevent overlapping initial loads — use a ref for a synchronous guard
        if (initialLoadRef.current) {
            console.log('loadInitialJobs: already in progress, skipping duplicate call');
            return;
        }

        initialLoadRef.current = true;
        console.log('loadInitialJobs: start', new Date().toISOString());
        setLoading(true);
        try {
            const effectiveRadius = enableCommuteFilter ? filterMaxDistance : 1000;
            const result = await fetchJobsPaginated(
                0,
                initialPageSize,
                globalSearch ? undefined : userProfile.coordinates?.lat,
                globalSearch ? undefined : userProfile.coordinates?.lon,
                effectiveRadius
            );
            setJobs(dedupeJobs(result.jobs));
            setHasMore(result.hasMore);
            setTotalCount(result.totalCount);
            setCurrentPage(0);
            // Reset merged context when doing normal initial load
            setMergedContext({ mode: 'none' });
            setSpatialPage(0);
            setLocationTextPage(0);
            setSpatialHasMore(Boolean(result.hasMore));
            setLocationHasMore(true);
        } catch (error) {
            console.error('Error loading initial jobs:', error);
        } finally {
            setLoading(false);
            initialLoadRef.current = false;
            console.log('loadInitialJobs: finished', new Date().toISOString());
        }
    }, [initialPageSize, userProfile.coordinates?.lat, userProfile.coordinates?.lon, filterMaxDistance, globalSearch, enableCommuteFilter]);

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
    }, [globalSearch, filterMaxDistance, enableCommuteFilter, userProfile.coordinates?.lat, userProfile.coordinates?.lon, loadInitialJobs]);

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
                        setJobs(dedupeJobs(locationResult.jobs));
                        setHasMore(locationResult.hasMore);
                        setTotalCount(locationResult.totalCount);
                        // Only text-based results — clear merged context
                        setMergedContext({ mode: 'none' });
                        setSpatialPage(0);
                        setLocationTextPage(0);
                        setSpatialHasMore(false);
                        setLocationHasMore(Boolean(locationResult.hasMore));
                    } else {
                        // Also fetch jobs that match the location text but might not be geocoded
                        console.log(`🏙️  Geocoded jobs found (${result.jobs.length}). Also fetching location-text matches to include non-geocoded offers...`);
                        const locationResult = await searchJobsByLocation(filterCity, 0, initialPageSize * 2);

                        // Merge geocoded results first, then append location-text-only jobs (dedup by id)
                        const merged: Job[] = [];
                        const seen = new Set<string>();

                        for (const j of result.jobs) {
                            merged.push(j);
                            seen.add(j.id);
                        }

                        for (const j of locationResult.jobs) {
                            if (!seen.has(j.id)) {
                                merged.push(j);
                                seen.add(j.id);
                            }
                        }

                        const combinedTotal = (result.totalCount || 0) + Math.max(0, (locationResult.totalCount || 0) - (result.totalCount || 0));

                        const mergedAnnotated = await annotateRegionMatches(merged, userProfile.coordinates);
                        setJobs(dedupeJobs(mergedAnnotated));
                        setHasMore(Boolean(result.hasMore || locationResult.hasMore));
                        setTotalCount(combinedTotal);
                        // Set merged pagination context so loadMoreJobs can fetch more from both sources
                        setMergedContext({ mode: 'city', coords: { lat: coords.lat, lon: coords.lon }, locationText: filterCity });
                        setSpatialPage(0);
                        setLocationTextPage(0);
                        setSpatialHasMore(Boolean(result.hasMore));
                        setLocationHasMore(Boolean(locationResult.hasMore));
                    }
                    setCurrentPage(0);
                } else {
                    // Geocoding failed, try location text search as fallback
                    console.log(`🏙️  Could not geocode "${filterCity}", trying location text search...`);
                    setLoading(true);
                    const locationResult = await searchJobsByLocation(filterCity, 0, initialPageSize);
                    const annotated = await annotateRegionMatches(locationResult.jobs, userProfile.coordinates);
                    setJobs(dedupeJobs(annotated));
                    setHasMore(locationResult.hasMore);
                    setTotalCount(locationResult.totalCount);
                    // Only text-based results — clear merged context
                    setMergedContext({ mode: 'none' });
                    setSpatialPage(0);
                    setLocationTextPage(0);
                    setSpatialHasMore(false);
                    setLocationHasMore(Boolean(locationResult.hasMore));
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
            // If we are in merged context (city or search that produced merged results),
            // fetch next pages from both spatial RPC and location-text search until
            // we collect `initialPageSize` new unique jobs to append.
            if (mergedContext.mode !== 'none') {
                const pageSize = initialPageSize;
                const seen = new Set<string>();
                // Mark existing IDs as seen
                const existing = (searchResults.length > 0 && searchTerm.trim()) ? searchResults : jobs;
                for (const j of existing) seen.add(j.id);

                const newBatch: Job[] = [];

                let sPage = spatialPage;
                let lPage = locationTextPage;
                let sHas = spatialHasMore;
                let lHas = locationHasMore;

                // Loop fetching pages until we have enough or no more data
                while (newBatch.length < pageSize && (sHas || lHas)) {
                    // Fetch next spatial page if available
                    if (sHas) {
                        const nextS = sPage + 1;
                        const effectiveRadius = enableCommuteFilter ? filterMaxDistance : 1000;
                        const spatialRes = await fetchJobsPaginated(nextS, pageSize, mergedContext.coords?.lat, mergedContext.coords?.lon, effectiveRadius);
                        sHas = Boolean(spatialRes.hasMore);
                        sPage = nextS;

                        for (const j of spatialRes.jobs) {
                            if (!seen.has(j.id)) {
                                newBatch.push(j);
                                seen.add(j.id);
                                if (newBatch.length >= pageSize) break;
                            }
                        }
                    }

                    // If still need more, fetch location-text page
                    if (newBatch.length < pageSize && lHas) {
                        const nextL = lPage + 1;
                        const locRes = await searchJobsByLocation(mergedContext.locationText || '', nextL, pageSize);
                        lHas = Boolean(locRes.hasMore);
                        lPage = nextL;

                        for (const j of locRes.jobs) {
                            if (!seen.has(j.id)) {
                                newBatch.push(j);
                                seen.add(j.id);
                                if (newBatch.length >= pageSize) break;
                            }
                        }
                    }

                    // If neither had data, break
                    if (!sHas && !lHas) break;
                }

                // Annotate the collected batch for region matches, then append
                const annotatedBatch = await annotateRegionMatches(newBatch, userProfile.coordinates);
                if (searchResults.length > 0 && searchTerm.trim()) {
                    setSearchResults(prev => dedupeJobs(annotatedBatch, prev));
                } else {
                    setJobs(prev => dedupeJobs(annotatedBatch, prev));
                }

                // Update pagination state
                setSpatialPage(sPage);
                setLocationTextPage(lPage);
                setSpatialHasMore(sHas);
                setLocationHasMore(lHas);

                // hasMore should reflect if either source still has more
                setHasMore(Boolean(sHas || lHas));
                setLoadingMore(false);
                return;
            }

            // If we are search mode but not merged (full-text search)
            if (searchTerm.trim() && searchResults.length > 0 && mergedContext.mode === 'none') {
                const nextPage = currentPage + 1;
                const result = await searchJobs(searchTerm, nextPage, initialPageSize);
                if (result.jobs.length > 0) {
                    setSearchResults(prev => dedupeJobs(result.jobs, prev));
                    setHasMore(result.hasMore);
                    setCurrentPage(nextPage);
                } else {
                    setHasMore(false);
                }
                setLoadingMore(false);
                return;
            }

            // Default behavior (non-merged): simple pagination via spatial RPC or fallback
            const nextPage = currentPage + 1;
            const effectiveRadius = enableCommuteFilter ? filterMaxDistance : 1000;
            const result = await fetchJobsPaginated(
                nextPage,
                initialPageSize,
                globalSearch ? undefined : userProfile.coordinates?.lat,
                globalSearch ? undefined : userProfile.coordinates?.lon,
                effectiveRadius
            );

            if (result.jobs.length > 0) {
                setJobs(prev => dedupeJobs(result.jobs, prev));
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
    }, [currentPage, hasMore, loadingMore, initialPageSize, userProfile.coordinates?.lat, userProfile.coordinates?.lon, filterMaxDistance, globalSearch, mergedContext, spatialPage, locationTextPage, spatialHasMore, locationHasMore, searchResults, searchTerm, jobs, enableCommuteFilter]);

    // Search functionality
    const performSearch = useCallback(async (term: string) => {
        console.log(`🔎 performSearch called with term: "${term}"`);
        if (!term.trim()) {
            console.log(`🔎 Term is empty, clearing search results`);
            setSearchResults([]);
            setIsSearching(false);
            setHasMore(true);
            setCurrentPage(0);
            return;
        }

        setIsSearching(true);
        setCurrentPage(0); // Reset page for search results

        try {
            // Try to geocode the term first — if it's an address/city we can use spatial search
            const { geocodeWithCaching } = await import('../services/geocodingService');
            const coords = await geocodeWithCaching(term);

            if (coords) {
                console.log(`🔎 Geocoded search term to: ${coords.lat}, ${coords.lon} — running spatial search first`);
                const effectiveRadius = enableCommuteFilter ? filterMaxDistance : 1000;
                const spatialResult = await fetchJobsPaginated(0, initialPageSize, coords.lat, coords.lon, effectiveRadius);

                if (spatialResult.jobs.length === 0) {
                    console.log(`🔎 Spatial search returned 0 — falling back to location-text search`);
                    const locationRes = await searchJobsByLocation(term, 0, initialPageSize);
                    const annotated = await annotateRegionMatches(locationRes.jobs, userProfile.coordinates);
                    setSearchResults(annotated);
                    setHasMore(Boolean(locationRes.hasMore));
                    // Text-only search results
                    setMergedContext({ mode: 'none' });
                    setSpatialPage(0);
                    setLocationTextPage(0);
                    setSpatialHasMore(false);
                    setLocationHasMore(Boolean(locationRes.hasMore));
                } else {
                    // Also fetch location-text matches to include non-geocoded offers and merge
                    const locationRes = await searchJobsByLocation(term, 0, initialPageSize * 2);
                    const merged: Job[] = [];
                    const seen = new Set<string>();

                    for (const j of spatialResult.jobs) {
                        merged.push(j);
                        seen.add(j.id);
                    }
                    for (const j of locationRes.jobs) {
                        if (!seen.has(j.id)) {
                            merged.push(j);
                            seen.add(j.id);
                        }
                    }

                    const mergedAnnotated = await annotateRegionMatches(merged, userProfile.coordinates);
                    setSearchResults(mergedAnnotated);
                    setHasMore(Boolean(spatialResult.hasMore || locationRes.hasMore));

                    // Set merged context for search so loadMore can fetch more merged pages
                    setMergedContext({ mode: 'search', coords: { lat: coords.lat, lon: coords.lon }, locationText: term });
                    setSpatialPage(0);
                    setLocationTextPage(0);
                    setSpatialHasMore(Boolean(spatialResult.hasMore));
                    setLocationHasMore(Boolean(locationRes.hasMore));
                }
            } else {
                // Not an address / couldn't geocode — use full-text search
                console.log(`🔎 Could not geocode term, using full-text search for: "${term}"`);
                const result = await searchJobs(term, 0, initialPageSize);
                setSearchResults(result.jobs);
                setHasMore(result.hasMore);
                setMergedContext({ mode: 'none' }); // Not merged, just regular search
            }
        } catch (error) {
            console.error('Error searching jobs:', error);
            setSearchResults([]);
            setHasMore(false);
        } finally {
            setIsSearching(false);
        }
    }, [filterMaxDistance, initialPageSize, userProfile.coordinates, enableCommuteFilter]);

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

            if (!jobCoords) return true; // Keep jobs where location is unknown (region-only handled via annotation)

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

            if (dist > filterMaxDistance) {
                // If the job references a broader region that matches the user, keep it
                if ((job as any).__regionMatch) return true;
                return false;
            }
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

        // Date filter
        if (filterDate !== 'all' && job.scrapedAt) {
            try {
                // Handle different date formats (Postgres vs ISO)
                let dateStr = job.scrapedAt;
                if (dateStr.includes(' ') && !dateStr.includes('T')) {
                    dateStr = dateStr.replace(' ', 'T');
                }
                const postedDate = new Date(dateStr);
                const now = new Date();
                const diffMs = now.getTime() - postedDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (filterDate === '24h' && diffDays > 1) return false;
                if (filterDate === '3d' && diffDays > 3) return false;
                if (filterDate === '7d' && diffDays > 7) return false;
                if (filterDate === '14d' && diffDays > 14) return false;
            } catch (e) {
                console.warn('Error parsing date for filter:', e);
            }
        }

        // Salary filter
        if (filterMinSalary > 0) {
            const jobSalary = job.salary_from || 0;
            if (jobSalary < filterMinSalary) return false;
        }

        // Experience filter
        if (filterExperience.length > 0) {
            const content = (job.title + ' ' + job.description).toLowerCase();
            const hasExperienceMatch = filterExperience.some(level => {
                if (level === 'Junior') {
                    return content.includes('junior') || content.includes('absolvent') || content.includes('entry level') || content.includes('juniorní');
                }
                if (level === 'Senior') {
                    return content.includes('senior') || content.includes('seniorní') || content.includes('zkušený') || content.includes('expert');
                }
                if (level === 'Medior') {
                    // For medior, we look for absence of junior/senior or explicit "medior"
                    return content.includes('medior') || (!content.includes('junior') && !content.includes('senior') && !content.includes('absolvent') && !content.includes('expert'));
                }
                if (level === 'Lead') {
                    return content.includes('lead') || content.includes('vedoucí') || content.includes('manager') || content.includes('manažer') || content.includes('team-lead') || content.includes('architekt') || content.includes('architect');
                }
                return false;
            });
            if (!hasExperienceMatch) return false;
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
        filterDate,
        filterMinSalary,
        filterExperience,
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
        setFilterDate,
        setFilterMinSalary,
        setFilterExperience,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        setGlobalSearch,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        clearAllFilters
    };
};