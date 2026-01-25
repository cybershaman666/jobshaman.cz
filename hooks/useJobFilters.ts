import { useState, useMemo } from 'react';
import { Job } from '../types';
import { BENEFIT_KEYWORDS, removeAccents } from '../utils/benefits';

export const useJobFilters = (jobs: Job[]) => {
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
        if (enableCommuteFilter && filterMaxDistance) {
            filtered = filtered.filter(job => {
                // This would be calculated based on user's address and job location
                // For now, assume all jobs pass the distance filter
                return true;
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
    }, [jobs, searchTerm, filterCity, filterMaxDistance, enableCommuteFilter, filterBenefits, filterContractType]);

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