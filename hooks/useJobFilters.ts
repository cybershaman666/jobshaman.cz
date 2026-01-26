import { useState, useMemo } from 'react';
import { Job } from '../types';
import { BENEFIT_KEYWORDS, removeAccents } from '../utils/benefits';

import { UserProfile } from '../types';
import { getCoordinates, calculateDistanceKm } from '../services/commuteService';

export const useJobFilters = (jobs: Job[], userProfile: UserProfile) => {
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);

    // UI State
    const [showFilters, setShowFilters] = useState(false);

    // Filter Sections State
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        contract: true,
        benefits: true
    });

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
    };

    const filteredJobs = useMemo(() => {
        let filtered = jobs;

        // Search filter
        if (searchTerm) {
            const searchLower = removeAccents(searchTerm.toLowerCase());
            filtered = filtered.filter(job => {
                const titleMatch = removeAccents(job.title.toLowerCase()).includes(searchLower);
                const companyMatch = removeAccents(job.company.toLowerCase()).includes(searchLower);
                const locationMatch = removeAccents(job.location.toLowerCase()).includes(searchLower);
                return titleMatch || companyMatch || locationMatch;
            });
        }

        // City filter
        if (filterCity) {
            const cityLower = filterCity.toLowerCase();
            filtered = filtered.filter(job => {
                const jobLocation = job.location.toLowerCase();
                return jobLocation.includes(cityLower);
            });
        }

        // Commute distance filter
        if (enableCommuteFilter && filterMaxDistance && userProfile.coordinates) {
            filtered = filtered.filter(job => {
                const jobCoords = getCoordinates(job.location);
                if (!jobCoords) return true; // Keep jobs where location is unknown (safe fallback)

                const dist = calculateDistanceKm(
                    userProfile.coordinates!.lat,
                    userProfile.coordinates!.lon,
                    jobCoords.lat,
                    jobCoords.lon
                );
                return dist <= filterMaxDistance;
            });
        }

        // Sort by distance if user has coordinates and no search term is active
        // (If search term is active, relevance is more important contextually, but here we can prioritize distance too or keep as is)
        if (userProfile.coordinates && !searchTerm) {
            filtered = filtered.sort((a, b) => {
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


        // Contract type filter (using type property)
        if (filterContractType.length > 0) {
            filtered = filtered.filter(job => {
                const jobType = job.type || '';
                return filterContractType.some(type =>
                    jobType.toLowerCase().includes(type.toLowerCase())
                );
            });
        }

        // Benefits filter (using benefits property)
        if (filterBenefits.length > 0) {
            filtered = filtered.filter(job => {
                const jobDescription = (job.description + ' ' + (job.tags || []).join(' ')).toLowerCase();

                return filterBenefits.every(benefit => {
                    const keywords = BENEFIT_KEYWORDS[benefit] || [];
                    return keywords.some(keyword => jobDescription.includes(keyword));
                });
            });
        }

        return filtered;
    }, [jobs, searchTerm, filterCity, filterMaxDistance, enableCommuteFilter, filterBenefits, filterContractType, userProfile]);

    const totalJobCount = jobs.length;
    const filteredJobCount = filteredJobs.length;

    return {
        // State
        searchTerm,
        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        savedJobIds,
        showFilters,
        expandedSections,

        // Computed
        filteredJobs,
        totalJobCount,
        filteredJobCount,

        // Actions
        setSearchTerm,
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