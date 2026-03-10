import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Job, UserProfile } from '../types';
import JobCard from './JobCard';
import {
    AlertTriangle,
    ArrowUp,
    Car,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Filter,
    MapPin,
    RefreshCw,
    Search,
    X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterSuggestions } from './FilterSuggestions';
import { SavedFiltersMenu } from './SavedFiltersMenu';

interface JobListSidebarProps {
    fullWidth?: boolean;
    showSearchPanel?: boolean;
    showJobFeed?: boolean;
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
    impressionSessionKey?: string;
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
    fullWidth = false,
    showSearchPanel = true,
    showJobFeed = true,
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
    impressionSessionKey,
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
    const [isCompactMobileRail, setIsCompactMobileRail] = useState(false);
    const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);

    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const seenImpressionsRef = useRef<Set<string>>(new Set());
    const lastRequestIdRef = useRef<string | null>(null);
    const hasNearConstraintMatches = filteredJobs.some((job) => job.constraint_mode === 'near');
    const isFilterRailMode = showSearchPanel && !showJobFeed;
    const hasLocationAnchor = Boolean(userProfile.address || userProfile.coordinates || filterCity);

    useEffect(() => {
        if (!showJobFeed || !onTrackImpression || filteredJobs.length === 0) return;

        const firstJob = filteredJobs[0] as any;
        const currentRequestId = firstJob?.requestId || firstJob?.aiRecommendationRequestId || null;
        const currentSessionKey = impressionSessionKey || currentRequestId || 'no-request';
        if (lastRequestIdRef.current !== currentSessionKey) {
            seenImpressionsRef.current.clear();
            lastRequestIdRef.current = currentSessionKey;
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

                    const dedupeKey = `${currentSessionKey}:${jobId}`;
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
    }, [filteredJobs, impressionSessionKey, jobListRef, onTrackImpression, showJobFeed]);

    useEffect(() => {
        if (sortBy === 'recommended') {
            setSortBy('newest');
        }
    }, [sortBy, setSortBy]);

    useEffect(() => {
        if (!isFilterRailMode) return;

        const syncRailMode = () => {
            const compact = window.innerWidth < 1024;
            setIsCompactMobileRail(compact);
            setIsMobileRailOpen(!compact);
        };

        syncRailMode();
        window.addEventListener('resize', syncRailMode);
        return () => window.removeEventListener('resize', syncRailMode);
    }, [isFilterRailMode]);

    const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = locale === 'cs' || locale === 'sk';

    const activeFilterCount =
        (filterCity ? 1 : 0) +
        (enableCommuteFilter ? 1 : 0) +
        (globalSearch ? 1 : 0) +
        (abroadOnly ? 1 : 0) +
        (filterLanguage ? 1 : 0) +
        (filterDate && filterDate !== 'all' ? 1 : 0) +
        (filterMinSalary > 0 ? 1 : 0) +
        filterContractType.length +
        filterExperience.length +
        filterBenefits.length;

    const activeFilterChips = [
        filterCity ? `${t('filters.location_commute')}: ${filterCity}` : null,
        filterDate && filterDate !== 'all' ? t('filters.date_posted') : null,
        filterLanguage ? `${t('filters.language')}: ${filterLanguage.toUpperCase()}` : null,
        filterMinSalary > 0 ? `${t('filters.min_salary')}: ${filterMinSalary.toLocaleString(i18n.language)}` : null,
        enableCommuteFilter ? t('filters.limit_by_commute') : null,
        globalSearch ? t('filters.cross_border') : null,
        abroadOnly ? t('filters.abroad_only') : null,
        ...filterContractType.map((item) => {
            const labels: Record<string, string> = {
                hpp: t('job.contract_types.hpp'),
                ico: t('job.contract_types.ico'),
                'part-time': t('job.contract_types.part_time'),
                brigada: t('job.contract_types.brigada')
            };
            return labels[item] || item;
        }),
        ...filterExperience
    ].filter(Boolean) as string[];

    const railContentVisible = !isFilterRailMode || !isCompactMobileRail || isMobileRailOpen;
    const detailsVisible = railContentVisible && showFilters;

    const uiCopy = isCsLike
        ? {
            railTitle: 'Filtry role',
            clearAll: 'Reset',
            openFilters: 'Otevřít filtry',
            closeFilters: 'Sbalit filtry',
            clearSearch: 'Vymazat hledání',
            totalRoles: 'Celkem nabídek',
            activeFilters: 'Aktivní filtry',
            querySection: 'Co hledáš',
            whereSection: 'Kde to má fungovat',
            rankingSection: 'Jazyk a řazení',
            toolsSection: 'Rychlé nástroje',
            advancedOpen: 'Zobrazit pokročilé',
            advancedClose: 'Skrýt pokročilé',
            quickRegion: 'Hledat přeshraničně',
            quickAbroad: 'Pouze zahraničí',
            results: 'výsledků'
        }
        : {
            railTitle: 'Role filters',
            clearAll: 'Reset',
            openFilters: 'Open filters',
            closeFilters: 'Collapse filters',
            clearSearch: 'Clear search',
            totalRoles: 'Total',
            activeFilters: 'Active filters',
            querySection: 'What are you looking for',
            whereSection: 'Where it should work',
            rankingSection: 'Language and ranking',
            toolsSection: 'Quick tools',
            advancedOpen: 'Show advanced',
            advancedClose: 'Hide advanced',
            quickRegion: 'Cross-border search',
            quickAbroad: 'Abroad only',
            results: 'results'
        };

    const inputClass =
        'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/65 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 dark:[color-scheme:dark]';
    const sectionTitleClass = 'text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300';
    const rowToggleClass =
        'flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200';
    const optionRowClass = 'flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5';

    const clearAllFilters = () => {
        setFilterCity('');
        setEnableCommuteFilter(false);
        setFilterMaxDistance(30);
        filterContractType.forEach((type) => toggleContractTypeFilter(type));
        setFilterDate('all');
        setFilterMinSalary(0);
        filterExperience.forEach((level) => toggleExperienceFilter(level));
        filterBenefits.forEach((benefit) => toggleBenefitFilter(benefit));
        setFilterLanguage('');
        setSortBy('newest');
        setGlobalSearch(false);
        setAbroadOnly(false);
    };

    const handleScrollToTop = () => {
        jobListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const locationSuggestions = useMemo(() => {
        const lang = (i18n.language || 'cs').split('-')[0];
        const country = (userProfile.preferredCountryCode || '').toUpperCase();
        const byCountry: Record<string, string[]> = {
            CZ: ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec', 'České Budějovice', 'Hradec Králové', 'Pardubice', 'Zlín'],
            SK: ['Bratislava', 'Košice', 'Žilina', 'Prešov', 'Nitra', 'Trnava', 'Banská Bystrica'],
            PL: ['Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź', 'Szczecin'],
            DE: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart'],
            AT: ['Wien', 'Graz', 'Salzburg', 'Linz', 'Innsbruck']
        };
        const byLang: Record<string, string[]> = {
            cs: byCountry.CZ,
            sk: byCountry.SK,
            pl: byCountry.PL,
            de: byCountry.DE,
            at: byCountry.AT,
            en: ['Vienna', 'Warsaw', 'Prague', 'Bratislava', 'Berlin', 'Munich', 'Krakow']
        };
        return byCountry[country] || byLang[lang] || byCountry.CZ;
    }, [i18n.language, userProfile.preferredCountryCode]);

    const visibilityClass = showJobFeed ? (selectedJobId ? 'hidden lg:flex' : 'flex') : 'flex';

    return (
        <section
            className={`${fullWidth ? 'col-span-1 lg:col-span-12' : 'lg:col-span-4 xl:col-span-4'} ${visibilityClass} min-h-0 flex flex-col gap-1.5 ${
                showJobFeed || (isFilterRailMode && !isCompactMobileRail) ? 'h-full' : ''
            }`}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1rem] border border-slate-200/80 dark:border-slate-800 bg-white/86 dark:bg-slate-900/78 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.34)]">
                {showSearchPanel && (
                    <div
                        className={`${
                            showJobFeed ? 'border-b border-slate-200 dark:border-slate-800' : ''
                        } ${isFilterRailMode ? 'flex min-h-0 flex-1 flex-col' : 'flex-none'}`}
                    >
                        {isFilterRailMode && isCompactMobileRail && (
                            <div className="border-b border-slate-200/80 p-2 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileRailOpen((prev) => !prev)}
                                    className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
                                >
                                    <span>
                                        {uiCopy.activeFilters}: {activeFilterCount}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                                        {isMobileRailOpen ? uiCopy.closeFilters : uiCopy.openFilters}
                                        {isMobileRailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </span>
                                </button>
                            </div>
                        )}

                        {railContentVisible && (
                            <>
                                <header className="border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                                                {uiCopy.railTitle}
                                            </div>
                                            <div className="mt-0.5 text-[14px] font-bold text-slate-900 dark:text-white sm:text-[15px]">
                                                {isCsLike ? 'Digitální první kontakt' : t('home.discovery.badge', { defaultValue: 'Digital first contact' })}
                                            </div>
                                        </div>
                                        {activeFilterCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={clearAllFilters}
                                                className="rounded-md border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300"
                                            >
                                                {uiCopy.clearAll}
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-2 hidden grid-cols-2 gap-2 sm:grid">
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/40 px-2.5 py-2">
                                            <div className="text-[10px] uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">{uiCopy.totalRoles}</div>
                                            <div className="mt-0.5 text-[18px] font-bold text-slate-900 dark:text-white leading-none">
                                                {Math.max(totalCount, filteredJobs.length).toLocaleString(i18n.language)}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/40 px-2.5 py-2">
                                            <div className="text-[10px] uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">{uiCopy.activeFilters}</div>
                                            <div className="mt-0.5 text-[18px] font-bold text-slate-900 dark:text-white leading-none">{activeFilterCount}</div>
                                        </div>
                                    </div>
                                </header>

                                <div className={`${isFilterRailMode ? 'custom-scrollbar min-h-0 flex-1 overflow-y-auto' : ''} space-y-3 px-3 py-2.5`}>
                                    <section className="space-y-1.5">
                                        <div className={sectionTitleClass}>{uiCopy.querySection}</div>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Search size={15} className="text-slate-400" />
                                            </div>
                                            <input
                                                id="job-search"
                                                name="job_search"
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    const term = e.target.value;
                                                    setSearchTerm(term);
                                                    performSearch(term);
                                                    if (!term.trim()) loadRealJobs();
                                                }}
                                                placeholder={t('app.search_placeholder')}
                                                className={`${inputClass} pl-9 pr-9`}
                                            />
                                            {searchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchTerm('');
                                                        performSearch('');
                                                        loadRealJobs();
                                                    }}
                                                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                    aria-label={uiCopy.clearSearch}
                                                >
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </section>

                                    <section className="space-y-2">
                                        <div className={sectionTitleClass}>{uiCopy.whereSection}</div>

                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <MapPin size={14} className="text-slate-400" />
                                            </div>
                                            <input
                                                id="toolbar-filter-city"
                                                name="toolbar_filter_city"
                                                type="text"
                                                value={filterCity}
                                                onChange={(e) => setFilterCity(e.target.value)}
                                                placeholder={t('filters.city_placeholder')}
                                                list="toolbar-location-suggestions"
                                                className={`${inputClass} pl-9`}
                                            />
                                            <datalist id="toolbar-location-suggestions">
                                                {locationSuggestions.map((item) => (
                                                    <option key={item} value={item} />
                                                ))}
                                            </datalist>
                                        </div>

                                        {!filterCity && !userProfile.coordinates && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onUseCurrentLocation();
                                                }}
                                                className="w-full rounded-lg border border-cyan-200 dark:border-cyan-700/60 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/30"
                                            >
                                                {t('filters.use_current_location')}
                                            </button>
                                        )}

                                        <label className={rowToggleClass}>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Car size={14} className={enableCommuteFilter ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'} />
                                                <span>{t('filters.limit_by_commute')}</span>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={enableCommuteFilter}
                                                onChange={() => setEnableCommuteFilter(!enableCommuteFilter)}
                                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                            />
                                        </label>

                                        {enableCommuteFilter && (
                                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/45 px-2.5 py-2">
                                                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500 dark:text-slate-400">{t('filters.max_distance')}</span>
                                                    <span className="font-mono text-cyan-700 dark:text-cyan-300">
                                                        {hasLocationAnchor ? `${filterMaxDistance} km` : 'N/A'}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="100"
                                                    step="5"
                                                    value={filterMaxDistance}
                                                    onChange={(e) => setFilterMaxDistance(parseInt(e.target.value, 10))}
                                                    disabled={!hasLocationAnchor}
                                                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-500 disabled:cursor-not-allowed dark:bg-slate-800"
                                                />
                                                {!hasLocationAnchor && (
                                                    <p className="mt-1 text-[10px] italic text-slate-500">{t('filters.radius_hint_no_location')}</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                            <label className={`${optionRowClass} ${globalSearch ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/70 dark:bg-cyan-900/20' : 'bg-white/90 dark:bg-slate-950/45'}`}>
                                                <span className="text-[11px]">{uiCopy.quickRegion}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={globalSearch}
                                                    onChange={() => setGlobalSearch(!globalSearch)}
                                                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                                />
                                            </label>
                                            <label className={`${optionRowClass} ${abroadOnly ? 'border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20' : 'bg-white/90 dark:bg-slate-950/45'}`}>
                                                <span className="text-[11px]">{uiCopy.quickAbroad}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={abroadOnly}
                                                    onChange={() => setAbroadOnly(!abroadOnly)}
                                                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                                />
                                            </label>
                                        </div>
                                    </section>

                                    <section className="space-y-1.5">
                                        <div className={sectionTitleClass}>{uiCopy.rankingSection}</div>
                                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                            <select
                                                id="filter-language"
                                                name="filter_language"
                                                value={filterLanguage}
                                                onChange={(e) => setFilterLanguage(e.target.value)}
                                                aria-label={t('filters.language')}
                                                className={inputClass}
                                            >
                                                <option value="">{t('filters.language_all')}</option>
                                                <option value="cs">{t('filters.language_options.cs')}</option>
                                                <option value="sk">{t('filters.language_options.sk')}</option>
                                                <option value="en">{t('filters.language_options.en')}</option>
                                                <option value="de">{t('filters.language_options.de')}</option>
                                                <option value="pl">{t('filters.language_options.pl')}</option>
                                                <option value="uk">{t('filters.language_options.uk')}</option>
                                            </select>

                                            <div className="relative">
                                                <select
                                                    id="sort-by"
                                                    name="sort_by"
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                    aria-label={t('filters.sort_by')}
                                                    className={inputClass}
                                                >
                                                    <option value="newest">{t('filters.sort_options.newest')}</option>
                                                    <option value="distance">{t('filters.sort_options.distance')}</option>
                                                    <option value="jhi_desc">{t('filters.sort_options.jhi_desc')}</option>
                                                    <option value="salary_desc">{t('filters.sort_options.salary_desc')}</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className={sectionTitleClass}>{uiCopy.toolsSection}</div>
                                            <button
                                                type="button"
                                                onClick={() => setShowFilters(!showFilters)}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                                            >
                                                <Filter size={12} />
                                                {showFilters ? uiCopy.advancedClose : uiCopy.advancedOpen}
                                            </button>
                                        </div>

                                        {activeFilterChips.length > 0 && (
                                            <div className="hidden flex-wrap gap-1 sm:flex">
                                                {activeFilterChips.map((chip) => (
                                                    <span
                                                        key={chip}
                                                        className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/45 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300"
                                                    >
                                                        {chip}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    {detailsVisible && (
                                        <section className="space-y-2 border-t border-slate-200/80 dark:border-slate-800 pt-2">
                                            <div className="space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('contract')}
                                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                                >
                                                    <span>{t('filters.contract_type')}</span>
                                                    {expandedSections.contract ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                                {expandedSections.contract && (
                                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                                        {[
                                                            { value: 'hpp', label: t('job.contract_types.hpp') },
                                                            { value: 'ico', label: t('job.contract_types.ico') },
                                                            { value: 'part-time', label: t('job.contract_types.part_time') },
                                                            { value: 'brigada', label: t('job.contract_types.brigada') }
                                                        ].map(({ value, label }) => (
                                                            <label
                                                                key={value}
                                                                className={`${optionRowClass} ${
                                                                    filterContractType.includes(value)
                                                                        ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/70 dark:bg-cyan-900/20'
                                                                        : 'bg-white/90 dark:bg-slate-950/45'
                                                                }`}
                                                            >
                                                                <span className="text-[11px]">{label}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filterContractType.includes(value)}
                                                                    onChange={() => toggleContractTypeFilter(value)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                                                />
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('date')}
                                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                                >
                                                    <span>{t('filters.date_posted')}</span>
                                                    {expandedSections.date ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                                {expandedSections.date && (
                                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                                        {[
                                                            { id: 'all', label: t('filters.any_time') },
                                                            { id: '24h', label: t('filters.last_24h') },
                                                            { id: '3d', label: t('filters.last_3d') },
                                                            { id: '7d', label: t('filters.last_7d') },
                                                            { id: '14d', label: t('filters.last_14d') }
                                                        ].map((item) => (
                                                            <label
                                                                key={item.id}
                                                                className={`${optionRowClass} ${
                                                                    filterDate === item.id
                                                                        ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/70 dark:bg-cyan-900/20'
                                                                        : 'bg-white/90 dark:bg-slate-950/45'
                                                                }`}
                                                            >
                                                                <span className="text-[11px]">{item.label}</span>
                                                                <input
                                                                    type="radio"
                                                                    name="filter-date"
                                                                    checked={filterDate === item.id}
                                                                    onChange={() => setFilterDate(item.id)}
                                                                    className="h-4 w-4 border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                                                />
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('salary')}
                                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                                >
                                                    <span>{t('filters.min_salary')}</span>
                                                    {expandedSections.salary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                                {expandedSections.salary && (
                                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/45 p-2">
                                                        <div className="relative">
                                                            <input
                                                                id="filter-min-salary"
                                                                name="filter_min_salary"
                                                                type="number"
                                                                value={filterMinSalary || ''}
                                                                onChange={(e) => setFilterMinSalary(parseInt(e.target.value, 10) || 0)}
                                                                placeholder={t('filters.min_salary_placeholder')}
                                                                className={`${inputClass} pr-10`}
                                                            />
                                                            <span className="absolute right-3 top-2.5 text-[11px] text-slate-400">{t('filters.currency_czk')}</span>
                                                        </div>
                                                        <input
                                                            id="filter-min-salary-range"
                                                            name="filter_min_salary_range"
                                                            type="range"
                                                            min="0"
                                                            max="150000"
                                                            step="5000"
                                                            value={filterMinSalary}
                                                            onChange={(e) => setFilterMinSalary(parseInt(e.target.value, 10))}
                                                            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-500 dark:bg-slate-800"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('experience')}
                                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                                >
                                                    <span>{t('filters.experience_level')}</span>
                                                    {expandedSections.experience ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                                {expandedSections.experience && (
                                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                                        {[
                                                            { id: 'Junior', label: t('filters.junior') },
                                                            { id: 'Medior', label: t('filters.medior') },
                                                            { id: 'Senior', label: t('filters.senior') },
                                                            { id: 'Lead', label: t('filters.lead') }
                                                        ].map((item) => (
                                                            <label
                                                                key={item.id}
                                                                className={`${optionRowClass} ${
                                                                    filterExperience.includes(item.id)
                                                                        ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/70 dark:bg-cyan-900/20'
                                                                        : 'bg-white/90 dark:bg-slate-950/45'
                                                                }`}
                                                            >
                                                                <span className="text-[11px]">{item.label}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filterExperience.includes(item.id)}
                                                                    onChange={() => toggleExperienceFilter(item.id)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]"
                                                                />
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('benefits')}
                                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                                >
                                                    <span>{t('filters.key_benefits.title')}</span>
                                                    {expandedSections.benefits ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                                {expandedSections.benefits && (
                                                    <div className="space-y-1.5">
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
                                                        ].map((benefit) => (
                                                            <label
                                                                key={benefit.id}
                                                                className={`${optionRowClass} ${
                                                                    filterBenefits.includes(benefit.value)
                                                                        ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/70 dark:bg-cyan-900/20'
                                                                        : 'bg-white/90 dark:bg-slate-950/45'
                                                                }`}
                                                            >
                                                                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 dark:border-slate-600">
                                                                    {filterBenefits.includes(benefit.value) && (
                                                                        <CheckCircle2 size={10} className="text-cyan-600 dark:text-cyan-300" />
                                                                    )}
                                                                </span>
                                                                <input
                                                                    type="checkbox"
                                                                    className="hidden"
                                                                    checked={filterBenefits.includes(benefit.value)}
                                                                    onChange={() => toggleBenefitFilter(benefit.value)}
                                                                />
                                                                <span className="min-w-0 flex-1 text-[11px] leading-snug text-slate-700 dark:text-slate-300">{benefit.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/50 p-2 sm:block">
                                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                                    {t('saved_filters.saved_searches')}
                                                </div>
                                                <FilterSuggestions
                                                    onApplyFilter={(filters) => {
                                                        if (filters.filterCity) setFilterCity(filters.filterCity);
                                                        if (filters.filterContractTypes) {
                                                            filters.filterContractTypes.forEach((type) => {
                                                                if (!filterContractType.includes(type)) toggleContractTypeFilter(type);
                                                            });
                                                        }
                                                        if (filters.filterBenefits) {
                                                            filters.filterBenefits.forEach((benefit) => {
                                                                if (!filterBenefits.includes(benefit)) toggleBenefitFilter(benefit);
                                                            });
                                                        }
                                                    }}
                                                    hasActiveFilters={Boolean(filterCity || filterContractType.length > 0 || filterBenefits.length > 0)}
                                                    userProfile={userProfile}
                                                />
                                                <SavedFiltersMenu
                                                    onLoadFilter={(filters) => {
                                                        if (filters.filterCity) setFilterCity(filters.filterCity);
                                                        if (filters.filterContractTypes) {
                                                            filters.filterContractTypes.forEach((type) => {
                                                                if (!filterContractType.includes(type)) toggleContractTypeFilter(type);
                                                            });
                                                        }
                                                        if (filters.filterBenefits) {
                                                            filters.filterBenefits.forEach((benefit) => {
                                                                if (!filterBenefits.includes(benefit)) toggleBenefitFilter(benefit);
                                                            });
                                                        }
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
                                                    hasActiveFilters={Boolean(filterCity || filterContractType.length > 0 || filterBenefits.length > 0)}
                                                />
                                            </div>
                                        </section>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {showJobFeed && (
                    <div
                        ref={jobListRef}
                        className="custom-scrollbar flex-1 overflow-y-auto p-2"
                        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="relative">
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                <div className="rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/45 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                    {filteredJobs.length.toLocaleString(i18n.language)} {uiCopy.results}
                                </div>
                                <div className="rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/45 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                    {t('filters.sort_by')}: {t(`filters.sort_options.${sortBy}`, { defaultValue: sortBy })}
                                </div>
                                {backendPolling && (
                                    <div className="rounded-full border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50 dark:bg-cyan-950/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                                        {t('app.backend_wake_waiting')}
                                    </div>
                                )}
                            </div>

                            {hasNearConstraintMatches && !isLoadingJobs && (
                                <div className="mb-2.5 rounded-[0.9rem] border border-cyan-200 bg-cyan-50/80 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-800/70 dark:bg-cyan-950/30 dark:text-cyan-200">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-cyan-700 dark:text-cyan-300" />
                                        <div>
                                            <p className="font-semibold">{t('app.near_matches_banner_title')}</p>
                                            <p className="opacity-90">{t('app.near_matches_banner_desc')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLoadingJobs && filteredJobs.length > 0 && (
                                <div className="absolute right-3 top-2 flex items-center gap-2 px-1 text-xs text-slate-400 dark:text-slate-500">
                                    <span className="job-shaman-loader" aria-hidden="true">
                                        <span className="rain"><span /><span /><span /><span /></span>
                                        <span className="pulse" />
                                        <span className="drum" />
                                        <span className="drumstick" />
                                    </span>
                                    <span>{t('app.searching')}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {isLoadingJobs && filteredJobs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <span className="job-shaman-loader is-lg mb-2" aria-hidden="true">
                                        <span className="rain"><span /><span /><span /><span /></span>
                                        <span className="pulse" />
                                        <span className="drum" />
                                        <span className="drumstick" />
                                    </span>
                                    <p className="text-sm">{t('app.searching')}</p>
                                </div>
                            ) : filteredJobs.length > 0 ? (
                                <>
                                    <div>
                                        {filteredJobs.map((job, index) => (
                                            <div key={job.id} className="pb-2">
                                                <div
                                                    ref={(el) => {
                                                        cardRefs.current[job.id] = el;
                                                    }}
                                                    data-job-id={job.id}
                                                    data-position={String((job as any)?.rankPosition || (job as any)?.aiRecommendationPosition || (index + 1))}
                                                >
                                                    <JobCard
                                                        job={job}
                                                        isSelected={selectedJobId === job.id}
                                                        isSaved={savedJobIds.includes(job.id)}
                                                        onToggleSave={() => handleToggleSave(job.id)}
                                                        onClick={() => handleJobSelect(job.id)}
                                                        variant={theme}
                                                        userProfile={userProfile}
                                                        emphasis={index < 2 ? 'hero' : 'standard'}
                                                        displayMode="progressive_teaser"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!loadingMore && !hasMore && (
                                        <p className="py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                                            {t('app.no_more_results', { defaultValue: 'No more results' })}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                                    <Search size={32} className="mb-4 opacity-50" />
                                    {isSearching ? (
                                        <>
                                            <p className="mb-2 font-bold">{t('app.no_results_for_search', { query: searchTerm })}</p>
                                            <p className="mb-4 max-w-[200px] text-xs opacity-75">{t('app.try_different_keywords')}</p>
                                        </>
                                    ) : backendPolling ? (
                                        <div className="flex flex-col items-center">
                                            <p className="mb-2 font-bold">{t('app.backend_wake_title')}</p>
                                            <p className="mb-4 max-w-[260px] text-xs opacity-75">{t('app.backend_wake_desc')}</p>
                                            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                                <span className="job-shaman-loader" aria-hidden="true">
                                                    <span className="rain"><span /><span /><span /><span /></span>
                                                    <span className="pulse" />
                                                    <span className="drum" />
                                                    <span className="drumstick" />
                                                </span>
                                                <span>{t('app.backend_wake_waiting')}</span>
                                            </div>
                                            <button
                                                onClick={loadRealJobs}
                                                className="mt-4 flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                                <RefreshCw size={14} /> {t('app.try_again')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="mb-2 font-bold">{t('app.no_jobs_found')}</p>
                                            <p className="mb-4 max-w-[200px] text-xs opacity-75">{t('app.try_adjust_filters')}</p>
                                            {totalCount === 0 && (
                                                <button
                                                    onClick={loadRealJobs}
                                                    className="flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                >
                                                    <RefreshCw size={14} /> {t('app.try_again')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {loadingMore && (
                                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                                    <span className="job-shaman-loader mb-2" aria-hidden="true">
                                        <span className="rain"><span /><span /><span /><span /></span>
                                        <span className="pulse" />
                                        <span className="drum" />
                                        <span className="drumstick" />
                                    </span>
                                    <p className="text-xs">{t('app.loading_more_offers')}</p>
                                </div>
                            )}
                        </div>

                        <div className="pointer-events-none sticky bottom-3 mt-6 flex justify-end">
                            <button
                                onClick={handleScrollToTop}
                                aria-label={t('app.back_to_top')}
                                title={t('app.back_to_top')}
                                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50/95 text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/30"
                            >
                                <ArrowUp size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default JobListSidebar;
