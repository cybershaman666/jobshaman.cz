import React, { RefObject, useEffect, useRef } from 'react';
import { Job, UserProfile } from '../types';
import JobCard from './JobCard';
import {
    Search,
    Filter,
    MapPin,
    Car,
    Activity,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    RefreshCw,
    Globe,
    ArrowUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterSuggestions } from './FilterSuggestions';
import { SavedFiltersMenu } from './SavedFiltersMenu';

interface JobListSidebarProps {
    selectedJobId: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    performSearch: (term: string) => void;
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    expandedSections: Record<string, boolean>;
    toggleSection: (section: string) => void;
    filterCity: string;
    setFilterCity: (city: string) => void;
    enableCommuteFilter: boolean;
    setEnableCommuteFilter: (enabled: boolean) => void;
    filterMaxDistance: number;
    setFilterMaxDistance: (distance: number) => void;
    filterContractType: string[];
    toggleContractTypeFilter: (type: string) => void;
    filterDate: string;
    setFilterDate: (date: string) => void;
    filterMinSalary: number;
    setFilterMinSalary: (salary: number) => void;
    filterExperience: string[];
    toggleExperienceFilter: (level: string) => void;
    filterBenefits: string[];
    toggleBenefitFilter: (benefit: string) => void;
    filterLanguage: string;
    setFilterLanguage: (lang: string) => void;
    sortBy: string;
    setSortBy: (sortBy: string) => void;
    isLoadingJobs: boolean;
    isSearching: boolean;
    filteredJobs: Job[];
    savedJobIds: string[];
    handleToggleSave: (jobId: string) => void;
    handleJobSelect: (jobId: string) => void;
    theme: 'light' | 'dark';
    userProfile: UserProfile;
    jobListRef: RefObject<HTMLDivElement>;
    loadingMore: boolean;
    hasMore: boolean;
    totalCount: number;
    loadRealJobs: () => void;
    backendPolling: boolean;
    globalSearch: boolean;
    setGlobalSearch: (global: boolean) => void;
    abroadOnly: boolean;
    setAbroadOnly: (abroadOnly: boolean) => void;
    onUseCurrentLocation: () => void;
    onTrackImpression?: (job: Job, position: number) => void;
}

const JobListSidebar: React.FC<JobListSidebarProps> = ({
    selectedJobId,
    searchTerm,
    setSearchTerm,
    performSearch,
    showFilters,
    setShowFilters,
    expandedSections,
    toggleSection,
    filterCity,
    setFilterCity,
    enableCommuteFilter,
    setEnableCommuteFilter,
    filterMaxDistance,
    setFilterMaxDistance,
    filterContractType,
    toggleContractTypeFilter,
    filterDate,
    setFilterDate,
    filterMinSalary,
    setFilterMinSalary,
    filterExperience,
    toggleExperienceFilter,
    filterBenefits,
    toggleBenefitFilter,
    filterLanguage,
    setFilterLanguage,
    sortBy,
    setSortBy,
    isLoadingJobs,
    isSearching,
    filteredJobs,
    savedJobIds,
    handleToggleSave,
    handleJobSelect,
    theme,
    userProfile,
    jobListRef,
    loadingMore,
    hasMore,
    totalCount,
    loadRealJobs,
    backendPolling,
    globalSearch,
    setGlobalSearch,
    abroadOnly,
    setAbroadOnly,
    onUseCurrentLocation,
    onTrackImpression
}) => {
    const { t, i18n } = useTranslation();
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const seenImpressionsRef = useRef<Set<string>>(new Set());
    const lastRequestIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!onTrackImpression || filteredJobs.length === 0) return;
        const currentRequestId = (filteredJobs[0] as any)?.requestId || (filteredJobs[0] as any)?.aiRecommendationRequestId || null;
        if (lastRequestIdRef.current !== currentRequestId) {
            seenImpressionsRef.current.clear();
            lastRequestIdRef.current = currentRequestId;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target as HTMLDivElement;
                    const jobId = el.dataset.jobId;
                    const positionRaw = el.dataset.position;
                    const position = positionRaw ? parseInt(positionRaw, 10) : 0;
                    if (!jobId) return;
                    const dedupeKey = `${currentRequestId || 'no-request'}:${jobId}`;
                    if (seenImpressionsRef.current.has(dedupeKey)) return;
                    const job = filteredJobs.find((x) => x.id === jobId);
                    if (!job) return;
                    seenImpressionsRef.current.add(dedupeKey);
                    onTrackImpression(job, position || 0);
                });
            },
            { root: jobListRef.current, threshold: 0.6 }
        );

        filteredJobs.forEach((job, idx) => {
            const node = cardRefs.current[job.id];
            if (!node) return;
            node.dataset.jobId = job.id;
            node.dataset.position = String((job as any)?.rankPosition || (job as any)?.aiRecommendationPosition || (idx + 1));
            observer.observe(node);
        });

        return () => observer.disconnect();
    }, [filteredJobs, jobListRef, onTrackImpression]);

    const handleScrollToTop = () => {
        jobListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const compactFilters = !userProfile?.isLoggedIn;
    const hasLocationAnchor = !!(userProfile.address || userProfile.coordinates || filterCity);

    return (
        <section className={`lg:col-span-4 xl:col-span-3 flex flex-col gap-4 min-h-0 ${selectedJobId ? 'hidden lg:flex' : 'flex'} h-full`}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                {/* Fixed Header Section (Search & Filters) */}
                <div className="flex-none bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800">
                    <div className={compactFilters ? "p-3 sm:p-4" : "p-4"}>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="text-slate-400" size={18} />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    const term = e.target.value;
                                    setSearchTerm(term);
                                    performSearch(term);
                                    if (!term.trim()) {
                                        loadRealJobs();
                                    }
                                }}
                                onFocus={() => setShowFilters(true)}
                                placeholder={t('app.search_placeholder')}
                                className={`w-full pl-10 pr-10 ${compactFilters ? 'py-2 text-[13px]' : 'py-2.5 text-sm'} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-all`}
                            />
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`absolute inset-y-1 right-1 p-1.5 rounded-md transition-all ${showFilters ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400'}`}
                                title={t('app.filters')}
                            >
                                <Filter size={16} className={showFilters ? "fill-current" : ""} />
                            </button>
                        </div>

                        <div className={compactFilters ? "mt-2 grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-2 gap-2"}>
                            <div>
                                <label className="sr-only">
                                    {t('filters.language') || 'Jazyk nabídky'}
                                </label>
                                <select
                                    value={filterLanguage}
                                    onChange={(e) => setFilterLanguage(e.target.value)}
                                    aria-label={t('filters.language') || 'Jazyk nabídky'}
                                    className={`w-full ${compactFilters ? 'px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-1.5 text-[13px]'} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500`}
                                >
                                    <option value="">{t('filters.language_all') || 'Všechny jazyky'}</option>
                                    <option value="cs">Čeština</option>
                                    <option value="sk">Slovenština</option>
                                    <option value="en">English</option>
                                    <option value="de">Deutsch</option>
                                    <option value="pl">Polski</option>
                                    <option value="uk">Українська</option>
                                </select>
                            </div>

                            <div>
                                <label className="sr-only">
                                    {t('filters.sort_by')}
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    aria-label={t('filters.sort_by') || 'Řazení'}
                                    className={`w-full ${compactFilters ? 'px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-1.5 text-[13px]'} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500`}
                                >
                                    <option value="recommended">{t('filters.sort_options.recommended') || 'AI doporučené'}</option>
                                    <option value="default">{t('filters.sort_options.default')}</option>
                                    <option value="newest">{t('filters.sort_options.newest')}</option>
                                    <option value="jhi_desc">{t('filters.sort_options.jhi_desc')}</option>
                                    <option value="jhi_asc">{t('filters.sort_options.jhi_asc')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Filters Container */}
                    {showFilters && (
                        <div className="px-4 pb-4 max-h-[40vh] overflow-y-auto custom-scrollbar border-t border-slate-100 dark:border-slate-800 pt-4 animate-in slide-in-from-top-2">
                            {/* Saved Filters Menu */}
                            <SavedFiltersMenu
                                onLoadFilter={(filters) => {
                                    if (filters.filterCity) setFilterCity(filters.filterCity);
                                    if (filters.filterContractTypes) filters.filterContractTypes.forEach(type => {
                                        if (!filterContractType.includes(type)) toggleContractTypeFilter(type);
                                    });
                                    if (filters.filterBenefits) filters.filterBenefits.forEach(benefit => {
                                        if (!filterBenefits.includes(benefit)) toggleBenefitFilter(benefit);
                                    });
                                    if (filters.filterMaxDistance) setFilterMaxDistance(filters.filterMaxDistance);
                                    if (filters.enableCommuteFilter !== undefined) setEnableCommuteFilter(filters.enableCommuteFilter);
                                }}
                                currentFilters={{
                                    filterCity,
                                    filterContractTypes: filterContractType,
                                    filterBenefits,
                                    filterMaxDistance,
                                    enableCommuteFilter
                                }}
                                hasActiveFilters={!!(filterCity || filterContractType.length > 0 || filterBenefits.length > 0)}
                            />

                            {/* Popular Filter Suggestions */}
                            <FilterSuggestions
                                onApplyFilter={(filters) => {
                                    if (filters.filterCity) setFilterCity(filters.filterCity);
                                    if (filters.filterContractTypes) filters.filterContractTypes.forEach(type => toggleContractTypeFilter(type));
                                    if (filters.filterBenefits) filters.filterBenefits.forEach(benefit => toggleBenefitFilter(benefit));
                                }}
                                hasActiveFilters={!!(filterCity || filterContractType.length > 0 || filterBenefits.length > 0)}
                                userProfile={userProfile}
                            />

                            {/* FILTER: Location & Commute */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('location')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                                    <span>{t('filters.location_commute')}</span>
                                    {expandedSections.location ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.location && (
                                    <div className="space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={16} />
                                            <input
                                                type="text"
                                                value={filterCity}
                                                onChange={(e) => setFilterCity(e.target.value)}
                                                placeholder={t('filters.city_placeholder')}
                                                list="location-suggestions"
                                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                            />
                                            <datalist id="location-suggestions">
                                                {((() => {
                                                    const lang = (i18n.language || 'cs').split('-')[0];
                                                    const country = (userProfile.preferredCountryCode || '').toUpperCase();
                                                    const suggestionsByCountry: Record<string, string[]> = {
                                                        CZ: [
                                                            'Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec', 'České Budějovice', 'Hradec Králové',
                                                            'Pardubice', 'Zlín', 'Středočeský kraj', 'Jihočeský kraj', 'Jihomoravský kraj', 'Moravskoslezský kraj',
                                                            'Plzeňský kraj', 'Olomoucký kraj', 'Ústecký kraj', 'Královéhradecký kraj', 'Pardubický kraj', 'Zlínský kraj'
                                                        ],
                                                        SK: [
                                                            'Bratislava', 'Košice', 'Žilina', 'Prešov', 'Nitra', 'Trnava', 'Banská Bystrica',
                                                            'Bratislavský kraj', 'Košický kraj', 'Žilinský kraj', 'Prešovský kraj', 'Banskobystrický kraj',
                                                            'Trnavský kraj', 'Trenčiansky kraj', 'Nitriansky kraj'
                                                        ],
                                                        PL: [
                                                            'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź', 'Szczecin', 'Bydgoszcz', 'Lublin',
                                                            'Mazowieckie', 'Małopolskie', 'Dolnośląskie', 'Wielkopolskie', 'Pomorskie', 'Łódzkie', 'Śląskie',
                                                            'Zachodniopomorskie', 'Kujawsko-Pomorskie', 'Lubelskie'
                                                        ],
                                                        DE: [
                                                            'Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden',
                                                            'Bayern', 'Nordrhein-Westfalen', 'Baden-Württemberg', 'Hessen', 'Sachsen', 'Berlin', 'Hamburg'
                                                        ],
                                                        AT: [
                                                            'Wien', 'Graz', 'Salzburg', 'Linz', 'Innsbruck', 'Klagenfurt', 'St. Pölten',
                                                            'Wien', 'Steiermark', 'Salzburg', 'Oberösterreich', 'Tirol', 'Kärnten', 'Niederösterreich'
                                                        ]
                                                    };
                                                    const suggestionsByLang: Record<string, string[]> = {
                                                        cs: suggestionsByCountry.CZ,
                                                        sk: suggestionsByCountry.SK,
                                                        pl: suggestionsByCountry.PL,
                                                        de: suggestionsByCountry.DE,
                                                        at: suggestionsByCountry.AT,
                                                        en: [
                                                            'Vienna', 'Warsaw', 'Prague', 'Bratislava', 'Berlin', 'Munich', 'Krakow', 'Wroclaw',
                                                            'Vienna', 'Warsaw', 'Prague', 'Brno', 'Gdansk', 'Hamburg', 'Frankfurt'
                                                        ]
                                                    };
                                                    const list = suggestionsByCountry[country] || suggestionsByLang[lang] || suggestionsByCountry.CZ;
                                                    return list.map((item) => <option key={item} value={item} />);
                                                })())}
                                            </datalist>
                                        </div>
                                        {!filterCity && !userProfile.coordinates && (
                                            <button
                                                onClick={(e) => { e.preventDefault(); onUseCurrentLocation(); }}
                                                className="w-full text-xs font-semibold px-3 py-2 rounded-md border border-cyan-200 dark:border-cyan-700/60 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                                            >
                                                {t('filters.use_current_location', { defaultValue: 'Použít moji polohu' })}
                                            </button>
                                        )}
                                        <label className="flex items-center justify-between cursor-pointer p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Car size={16} className={`transition-colors ${enableCommuteFilter ? 'text-cyan-500' : 'text-slate-400'}`} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('filters.limit_by_commute')}</span>
                                            </div>
                                            <div className={`w-10 h-5 rounded-full relative transition-colors ${enableCommuteFilter ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'}`} onClick={(e) => { e.preventDefault(); setEnableCommuteFilter(!enableCommuteFilter); }}>
                                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${enableCommuteFilter ? 'left-6' : 'left-1'}`}></div>
                                            </div>
                                        </label>

                                        {/* Cross-border Filter Toggle */}
                                        <button
                                            onClick={(e) => { e.preventDefault(); setGlobalSearch(!globalSearch); }}
                                            className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${globalSearch ? 'bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Globe size={16} className={`transition-colors ${globalSearch ? 'text-cyan-500' : 'text-slate-400'}`} />
                                                <div className="text-left">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                                                        {t('filters.cross_border')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
                                                        {globalSearch ? t('filters.search_all_desc') : t('filters.search_current_desc')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${globalSearch ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {globalSearch && <CheckCircle size={10} className="text-white" />}
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); setAbroadOnly(!abroadOnly); }}
                                            className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${abroadOnly ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Globe size={16} className={`transition-colors ${abroadOnly ? 'text-amber-500' : 'text-slate-400'}`} />
                                                <div className="text-left">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                                                        {t('filters.abroad_only', { defaultValue: 'Jen zahraničí' })}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
                                                        {t('filters.abroad_only_desc', { defaultValue: 'Mimo CZ/SK' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${abroadOnly ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {abroadOnly && <CheckCircle size={10} className="text-white" />}
                                            </div>
                                        </button>
                                        {enableCommuteFilter && (
                                            <div className={`p-3 rounded-md border ${hasLocationAnchor ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-100 dark:bg-slate-900/50 border-dashed border-slate-300 dark:border-slate-800 opacity-60'}`}>
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className="font-medium text-slate-500 dark:text-slate-400">{t('filters.max_distance')}</span>
                                                    <span className="font-mono text-cyan-600 dark:text-cyan-400">{hasLocationAnchor ? `${filterMaxDistance} km` : 'N/A'}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="100"
                                                    step="5"
                                                    value={filterMaxDistance}
                                                    onChange={(e) => setFilterMaxDistance(parseInt(e.target.value))}
                                                    disabled={!hasLocationAnchor}
                                                    className="w-full accent-cyan-500 cursor-pointer disabled:cursor-not-allowed bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none"
                                                />
                                                {!hasLocationAnchor && (
                                                    <p className="text-[10px] text-slate-500 mt-2 italic">Pro radius zadejte město nebo použijte aktuální polohu.</p>
                                                )}
                                            </div>
                                        )}

                                        {loadingMore && hasMore && (
                                            <div className="py-6 flex flex-col items-center justify-center text-slate-400">
                                                <Activity className="animate-spin mb-2 text-cyan-500" size={20} />
                                                <p className="text-sm">Načítám další nabídky...</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-3" />

                            {/* FILTER: Contract Type */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('contract')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <span>{t('filters.contract_type')}</span>
                                    {expandedSections.contract ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.contract && (
                                    <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1">
                                        {['HPP', 'IČO', 'Part-time', 'Brigáda'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => toggleContractTypeFilter(type)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${filterContractType.includes(type) ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-3" />

                            {/* FILTER: Date Posted */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('date')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <span>{t('filters.date_posted')}</span>
                                    {expandedSections.date ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.date && (
                                    <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1">
                                        {[
                                            { id: 'all', label: t('filters.any_time') },
                                            { id: '24h', label: t('filters.last_24h') },
                                            { id: '3d', label: t('filters.last_3d') },
                                            { id: '7d', label: t('filters.last_7d') },
                                            { id: '14d', label: t('filters.last_14d') }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setFilterDate(opt.id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterDate === opt.id ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}
                                            >
                                                <div className={`w-3 h-3 rounded-full border-2 border-current flex items-center justify-center`}>
                                                    {filterDate === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                                </div>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-3" />

                            {/* FILTER: Salary */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('salary')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <span>{t('filters.min_salary')}</span>
                                    {expandedSections.salary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.salary && (
                                    <div className="space-y-3 animate-in slide-in-from-top-1">
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    value={filterMinSalary || ''}
                                                    onChange={(e) => setFilterMinSalary(parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                                                />
                                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">Kč</span>
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="150000"
                                            step="5000"
                                            value={filterMinSalary}
                                            onChange={(e) => setFilterMinSalary(parseInt(e.target.value))}
                                            className="w-full accent-cyan-500 cursor-pointer bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                            <span>0 Kč</span>
                                            <span>150k Kč</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-3" />

                            {/* FILTER: Experience Level */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('experience')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <span>{t('filters.experience_level')}</span>
                                    {expandedSections.experience ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.experience && (
                                    <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1">
                                        {[
                                            { id: 'Junior', label: t('filters.junior') },
                                            { id: 'Medior', label: t('filters.medior') },
                                            { id: 'Senior', label: t('filters.senior') },
                                            { id: 'Lead', label: t('filters.lead') }
                                        ].map(level => (
                                            <button
                                                key={level.id}
                                                onClick={() => toggleExperienceFilter(level.id)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${filterExperience.includes(level.id) ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                            >
                                                {level.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-3" />

                            {/* FILTER: Benefits */}
                            <div className="space-y-3">
                                <button onClick={() => toggleSection('benefits')} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <span>{t('filters.key_benefits.title')}</span>
                                    {expandedSections.benefits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSections.benefits && (
                                    <div className="space-y-2 animate-in slide-in-from-top-1">
                                        {[
                                            { id: 'car', value: 'Auto pro osobní použití', label: t('filters.key_benefits.items.car') },
                                            { id: 'kids_friendly', value: 'Přátelské k dětem', label: t('filters.key_benefits.items.kids_friendly') },
                                            { id: 'flex_hours', value: 'Flexibilní hodiny', label: t('filters.key_benefits.items.flex_hours') },
                                            { id: 'education', value: 'Vzdělávací kurzy', label: t('filters.key_benefits.items.education') },
                                            { id: 'multisport', value: 'Multisport karta', label: t('filters.key_benefits.items.multisport') },
                                            { id: 'meal', value: 'Příspěvek na stravu', label: t('filters.key_benefits.items.meal') },
                                            { id: 'home_office', value: 'Home Office', label: t('filters.key_benefits.items.home_office') },
                                            { id: 'vacation_5w', value: '5 týdnů dovolené', label: t('filters.key_benefits.items.vacation_5w') },
                                            { id: 'dog_friendly', value: 'Dog Friendly', label: t('filters.key_benefits.items.dog_friendly') },
                                            { id: 'stock', value: 'Zaměstnanecké akcie', label: t('filters.key_benefits.items.stock') }
                                        ].map(benefit => (
                                            <label key={benefit.id} className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filterBenefits.includes(benefit.value) ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300 dark:border-slate-600 group-hover:border-cyan-400'}`}>
                                                    {filterBenefits.includes(benefit.value) && <CheckCircle size={10} className="text-white" />}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={filterBenefits.includes(benefit.value)} onChange={() => toggleBenefitFilter(benefit.value)} />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{benefit.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Job List Container (Scrolls independently below fixed header) */}
                <div ref={jobListRef} className="flex-1 overflow-y-auto custom-scrollbar p-4" style={{ overscrollBehavior: 'contain' }}>
                    {totalCount > 0 && !isLoadingJobs && (
                        <div className="mb-4 px-1 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {t('app.found_jobs', { count: totalCount })}
                            </span>
                        </div>
                    )}
                    {isLoadingJobs && filteredJobs.length > 0 && (
                        <div className="mb-3 px-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                            <Activity className="animate-spin text-cyan-500" size={14} />
                            <span>{t('app.searching')}</span>
                        </div>
                    )}
                    <div className="space-y-3">
                        {isLoadingJobs && filteredJobs.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <Activity className="animate-spin mb-2 text-cyan-500" size={24} />
                                <p className="text-sm">{t('app.searching')}</p>
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            filteredJobs.map((job) => (
                                <div key={job.id} ref={(el) => { cardRefs.current[job.id] = el; }}>
                                    <JobCard
                                        job={job}
                                        isSelected={selectedJobId === job.id}
                                        isSaved={savedJobIds.includes(job.id)}
                                        onToggleSave={() => handleToggleSave(job.id)}
                                        onClick={() => handleJobSelect(job.id)}
                                        variant={theme}
                                        userProfile={userProfile}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                <Search size={32} className="mb-4 opacity-50" />
                                {isSearching ? (
                                    <>
                                        <p className="font-bold mb-2">Žádné výsledky pro "{searchTerm}"</p>
                                        <p className="text-xs opacity-75 max-w-[200px] mb-4">
                                            Zkuste jiná klíčová slova
                                        </p>
                                    </>
                                ) : backendPolling ? (
                                    <div className="flex flex-col items-center">
                                        <p className="font-bold mb-2">{t('app.backend_wake_title')}</p>
                                        <p className="text-xs opacity-75 max-w-[260px] mb-4">{t('app.backend_wake_desc')}</p>
                                        <div className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                                            <Activity className="animate-spin text-cyan-500" size={18} />
                                            <span>{t('app.backend_wake_waiting')}</span>
                                        </div>
                                        <button onClick={loadRealJobs} className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                                            <RefreshCw size={14} /> {t('app.try_again')}
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-bold mb-2">{t('app.no_jobs_found')}</p>
                                        <p className="text-xs opacity-75 max-w-[200px] mb-4">{t('app.try_adjust_filters')}</p>
                                        {totalCount === 0 && (
                                            <button
                                                onClick={loadRealJobs}
                                                className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <RefreshCw size={14} /> {t('app.try_again')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {loadingMore && (
                            <div className="py-6 flex flex-col items-center justify-center text-slate-400">
                                <Activity className="animate-spin mb-2 text-cyan-500" size={20} />
                                <p className="text-xs">Načítám další nabídky...</p>
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-3 mt-6 flex justify-end">
                        <button
                            onClick={handleScrollToTop}
                            aria-label={t('app.back_to_top') || 'Nahoru'}
                            title={t('app.back_to_top') || 'Nahoru'}
                            className="flex items-center justify-center w-8 h-8 rounded-full border border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 hover:text-cyan-800 dark:border-cyan-500/40 dark:text-cyan-300 dark:bg-cyan-500/20 dark:hover:bg-cyan-500/30 transition-colors"
                        >
                            <ArrowUp size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default JobListSidebar;
