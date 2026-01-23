import { useState, useMemo, useEffect } from 'react';
import { Job, ViewState, UserProfile } from '../types';
import { fetchRealJobs } from '../services/jobService';
import { calculateCommuteReality } from '../services/commuteService';

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

    const filteredJobs = useMemo(() => {
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
                const isIco = job.tags.some(t => ['Kontraktor', 'IČO', 'Freelance', 'Gig Economy'].includes(t)) || job.title.includes('IČO') || job.description.includes('fakturace');
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
    }, [searchTerm, filterCity, filterMaxDistance, enableCommuteFilter, filterBenefits, filterContractType, userProfile, viewState, savedJobIds, jobs]);

    useEffect(() => {
        loadRealJobs();
    }, []);

    return {
        jobs,
        setJobs,
        selectedJobId,
        setSelectedJobId,
        isLoadingJobs,
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
