import { useState, useMemo, useEffect } from 'react';
import { Job, ViewState, UserProfile } from '../types';
import { fetchRealJobs, fetchJobsWithFilters } from '../services/jobService';
import AnalyticsService from '../services/analyticsService';
import { calculateCommuteReality } from '../services/commuteService';
import { matchesIcoKeywords } from '../utils/contractType';

const removeAccents = (str: any) => {
    if (!str) return '';
    if (typeof str !== 'string') return String(str).toLowerCase();
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const BENEFIT_KEYWORDS: Record<string, string[]> = {
    'Remote First': ['remote', 'home office', 'home-office', 'z domova', 'práce na dálku'],
    'Flexibilní doba': ['flexibilní', 'pružná', 'volná pracovní doba', 'flexibilita'],
    '5 týdnů dovolené': ['5 týdnů', '25 dnů', 'týden dovolené navíc', 'dovolená 5 týdnů', '25 dní'],
    'Dog Friendly': ['dog', 'pes', 'psa', 'pet friendly'],
    'Auto pro osobní použití': ['auto', 'firemní auto', 'služební auto', 'firemní vůz', 'company car', 'car benefit'],
    'Přátelské k dětem': ['děti', 'dětmi', 'child friendly', 'kids', 'rodina s dětmi', 'family'],
    'Flexibilní hodiny': ['flexibilní hodiny', 'pružná doba', 'flextime', 'flexi čas', 'svobodná pracovní doba'],
    'Vzdělávací kurzy': ['školení', 'kurzy', 'vzdělávání', 'training', 'education', 'courses'],
    'Multisport karta': ['multisport', 'sport', 'fitko', 'posilovna', 'gym', 'fitness'],
    'Příspěvek na stravu': ['stravenky', 'stravování', 'jídlo', 'meal voucher', 'příspěvek jídlo'],
    'Home Office': ['home office', 'home-office', 'z domova', 'práce na dálku', 'remote'],
    'Zaměstnanecké akcie': ['esop', 'akcie', 'podíl', 'equity', 'stock', 'zaměstnanecké akcie']
};

export const useJobs = (viewState: ViewState, userProfile: UserProfile) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);

    // Database-backed filtered jobs
    const [dbFilteredJobs, setDbFilteredJobs] = useState<Job[]>([]);
    const [isFilteringDb, setIsFilteringDb] = useState(false);

    // Load initial jobs (for saved view and fallback)
    const loadRealJobs = async () => {
        setIsLoadingJobs(true);
        try {
            const realJobs = await fetchRealJobs();
            setJobs(realJobs);
        } catch (e) {
            console.error("Failed to load jobs", e);
        } finally {
            setIsLoadingJobs(false);
        }
    };

    const handleToggleSave = (jobId: string) => {
        setSavedJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
    };

    // Debounced database filtering effect
    useEffect(() => {
        // Skip database filtering if:
        // 1. User is viewing saved jobs (use client-side filtering)
        // 2. No filters are active
        const hasActiveFilters =
            filterCity.trim().length > 0 ||
            enableCommuteFilter ||
            filterBenefits.length > 0 ||
            filterContractType.length > 0;

        if (viewState === ViewState.SAVED || !hasActiveFilters) {
            setDbFilteredJobs([]);
            return;
        }

        // Debounce database queries
        const timeoutId = setTimeout(async () => {
            setIsFilteringDb(true);
            try {
                const filterOptions = {
                    userLat: userProfile.coordinates?.lat,
                    userLng: userProfile.coordinates?.lon,
                    radiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
                    filterCity: filterCity.trim() || undefined,
                    filterContractTypes: filterContractType.length > 0 ? filterContractType : undefined,
                    filterBenefits: filterBenefits.length > 0 ? filterBenefits : undefined,
                    page: 0,
                    pageSize: 200, // Backend hybrid endpoints enforce max 200
                    countryCode: undefined // UserProfile doesn't have country_code
                };

                console.log('🔍 Triggering database filter query with options:', filterOptions);
                const { jobs: filteredJobs, totalCount } = await fetchJobsWithFilters(filterOptions);
                setDbFilteredJobs(filteredJobs);

                // Track filter usage analytics (non-blocking)
                if (hasActiveFilters && totalCount !== undefined) {
                    AnalyticsService.trackFilterUsage({
                        filterCity: filterCity.trim() || undefined,
                        filterContractTypes: filterContractType.length > 0 ? filterContractType : undefined,
                        filterBenefits: filterBenefits.length > 0 ? filterBenefits : undefined,
                        radiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
                        hasDistanceFilter: enableCommuteFilter,
                        resultCount: totalCount
                    }).catch(err => console.warn('Analytics tracking failed:', err));
                }
            } catch (error) {
                console.error('Error filtering jobs from database:', error);
                setDbFilteredJobs([]);
            } finally {
                setIsFilteringDb(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [
        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        userProfile.coordinates,
        viewState
    ]);

    // Client-side filtering for instant feedback and saved jobs view
    const filteredJobs = useMemo(() => {
        // If we have database-filtered results and filters are active, use those
        const hasActiveFilters =
            filterCity.trim().length > 0 ||
            enableCommuteFilter ||
            filterBenefits.length > 0 ||
            filterContractType.length > 0;

        if (hasActiveFilters && dbFilteredJobs.length > 0 && viewState !== ViewState.SAVED) {
            console.log(`✅ Using database-filtered results: ${dbFilteredJobs.length} jobs`);
            return dbFilteredJobs;
        }

        // Fall back to client-side filtering (for saved view or when db results not ready)
        let sourceJobs = jobs;
        if (viewState === ViewState.SAVED) {
            sourceJobs = jobs.filter(job => savedJobIds.includes(job.id));
        }

        const filtered = sourceJobs.filter(job => {
            const searchNormalized = removeAccents(searchTerm.trim());
            if (searchNormalized) {
                const matchesText =
                    removeAccents(job.title).includes(searchNormalized) ||
                    removeAccents(job.company).includes(searchNormalized) ||
                    removeAccents(job.location).includes(searchNormalized) ||
                    (job.description && removeAccents(job.description).includes(searchNormalized)) ||
                    (job.benefits && job.benefits.some(b => removeAccents(b).includes(searchNormalized))) ||
                    job.tags.some(t => removeAccents(t).includes(searchNormalized));

                if (!matchesText) return false;
            }

            const isManualLocationSearch = filterCity.trim().length > 0;
            if (isManualLocationSearch) {
                const cityNormalized = removeAccents(filterCity.trim());
                const locMatch = removeAccents(job.location).includes(cityNormalized);
                const tagMatch = job.tags.some(t => removeAccents(t).includes(cityNormalized));
                if (!locMatch && !tagMatch) return false;
            }

            if (filterBenefits.length > 0) {
                const hasAllBenefits = filterBenefits.every(filterBenefit => {
                    const keywords = BENEFIT_KEYWORDS[filterBenefit] || [removeAccents(filterBenefit)];
                    return job.benefits.some(jobBenefit => {
                        const benefitNormalized = removeAccents(jobBenefit);
                        return keywords.some(kw => benefitNormalized.includes(kw));
                    }) || job.tags.some(tag => {
                        const tagNormalized = removeAccents(tag);
                        return keywords.some(kw => tagNormalized.includes(kw));
                    });
                });
                if (!hasAllBenefits) return false;
            }

            if (filterContractType.length > 0) {
                const isIco = matchesIcoKeywords(job.title, job.description, ...job.tags);
                const isPartTime = job.tags.some(t => ['Part-time', 'Zkrácený', 'Brigáda'].includes(t));
                const isHpp = !isIco && !isPartTime;

                const matchesType = filterContractType.some(type => {
                    if (type === 'IČO') return isIco;
                    if (type === 'HPP') return isHpp;
                    if (type === 'Part-time') return isPartTime;
                    return false;
                });
                if (!matchesType) return false;
            }

            if (!isManualLocationSearch && enableCommuteFilter && userProfile.isLoggedIn && userProfile.address) {
                const commute = calculateCommuteReality(job, userProfile);
                if (commute && commute.distanceKm !== -1 && !commute.isRelocation && commute.distanceKm > filterMaxDistance) return false;
            }

            return true;
        });

        if (userProfile.isLoggedIn && userProfile.address && !searchTerm && !filterCity) {
            return filtered.sort((a, b) => {
                const commuteA = calculateCommuteReality(a, userProfile);
                const commuteB = calculateCommuteReality(b, userProfile);

                const getSortDist = (c: any) => {
                    if (!c) return 99999;
                    if (c.isRelocation) return 88888;
                    if (c.distanceKm === -1) return 99999;
                    return c.distanceKm;
                };

                const distA = getSortDist(commuteA);
                const distB = getSortDist(commuteB);
                return distA - distB;
            });
        }
        return filtered;
    }, [searchTerm, filterCity, filterMaxDistance, enableCommuteFilter, filterBenefits, filterContractType, userProfile, viewState, savedJobIds, jobs, dbFilteredJobs]);

    useEffect(() => {
        loadRealJobs();
    }, []);

    return {
        jobs,
        setJobs,
        selectedJobId,
        setSelectedJobId,
        isLoadingJobs: isLoadingJobs || isFilteringDb,
        savedJobIds,
        handleToggleSave,
        filteredJobs,
        searchTerm,
        setSearchTerm,
        filterCity,
        setFilterCity,
        filterMaxDistance,
        setFilterMaxDistance,
        enableCommuteFilter,
        setEnableCommuteFilter,
        filterBenefits,
        setFilterBenefits,
        filterContractType,
        setFilterContractType
    };
};
