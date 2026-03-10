import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Job, SearchLanguageCode, UserProfile } from '../types';
import { dedupeJobsList, fetchExternalOverlayJobs, fetchJobsPaginated, fetchJobsWithFilters } from '../services/jobService';
import { geocodeWithCaching, getStaticCoordinates } from '../services/geocodingService';
import AnalyticsService from '../services/analyticsService';
import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { fetchJobInteractionState, flushInteractionStateSyncQueue, syncJobInteractionState, updateInteractionStateCache } from '../services/jobInteractionService';
import { getCandidateIntentDomainSeedKeyword, getCandidateIntentDomainLabel, getCandidateIntentRoleSeedKeyword, resolveCandidateIntentProfile } from '../services/candidateIntentService';

// Infer country code from address text (best-effort)
const getCountryCodeFromAddress = (address: string): string | null => {
    if (!address) return null;
    const loc = address.toLowerCase();
    if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') || loc.includes('montreal')) return 'CA';
    if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('california') || loc.includes('texas')) return 'US';
    if (loc.includes('united kingdom') || loc.includes('uk') || loc.includes('london') || loc.includes('manchester')) return 'GB';
    if (loc.includes('netherlands') || loc.includes('nederland') || loc.includes('amsterdam') || loc.includes('rotterdam')) return 'NL';
    if (loc.includes('france') || loc.includes('franc') || loc.includes('paris') || loc.includes('lyon')) return 'FR';
    if (loc.includes('spain') || loc.includes('espa') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
    if (loc.includes('italy') || loc.includes('italia') || loc.includes('rome') || loc.includes('milan')) return 'IT';
    if (loc.includes('romania') || loc.includes('bucharest') || loc.includes('bucure')) return 'RO';
    if (loc.includes('hungary') || loc.includes('budapest')) return 'HU';
    if (loc.includes('slovak') || loc.includes('slovensk') || loc.includes('slovensko') || loc.includes('bratislava') || loc.includes('kosice')) return 'SK';
    if (loc.includes('polsk') || loc.includes('poland') || loc.includes('warszawa') || loc.includes('krakow') || loc.includes('wroclaw') || loc.includes('gda')) return 'PL';
    if (loc.includes('deutsch') || loc.includes('germany') || loc.includes('berlin') || loc.includes('münchen') || loc.includes('hamburg')) return 'DE';
    if (loc.includes('österreich') || loc.includes('austria') || loc.includes('wien') || loc.includes('vienna')) return 'AT';
    if (loc.includes('česk') || loc.includes('czech') || loc.includes('praha') || loc.includes('brno') || loc.includes('ostrava')) return 'CZ';
    return null;
};

const getCountryCodeFromJobSource = (job: Job): string | null => {
    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (!haystack.trim()) return null;
    if (haystack.includes('karriere.at')) return 'AT';
    if (haystack.includes('germantechjobs')) return 'DE';
    if (haystack.includes('stepstone.de')) return 'DE';
    if (haystack.includes('stepstone.at')) return 'AT';
    if (haystack.includes('pracuj.pl')) return 'PL';
    if (haystack.includes('profesia.sk')) return 'SK';
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) return 'CZ';
    return null;
};

// Infer country code from language (best-effort)
const getCountryCodeFromLanguage = (lng?: string): string | null => {
    if (!lng) return null;
    const code = lng.split('-')[0].toLowerCase();
    if (code === 'cs') return 'CZ';
    if (code === 'sk') return 'SK';
    if (code === 'de') return 'DE';
    if (code === 'pl') return 'PL';
    if (code === 'at') return 'AT';
    return null;
};

const getDefaultLanguageCodesFromLocale = (lng?: string): SearchLanguageCode[] => {
    const code = String(lng || '').split('-')[0].toLowerCase();
    if (code === 'cs') return ['cs'];
    if (code === 'sk') return ['sk'];
    if (code === 'de' || code === 'at') return ['de'];
    if (code === 'pl') return ['pl'];
    if (code === 'en') return ['en'];
    return [];
};

const expandCountryAliases = (countryCode?: string | null): string[] => {
    const normalized = String(countryCode || '').trim().toUpperCase();
    if (!normalized) return [];
    if (normalized === 'CZ' || normalized === 'CS') return ['CZ', 'CS'];
    if (normalized === 'SK') return ['SK'];
    if (normalized === 'PL') return ['PL'];
    if (normalized === 'DE') return ['DE'];
    if (normalized === 'AT') return ['AT'];
    return [];
};

const sameCountryCodeSet = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) return false;
    return left.every((code, index) => code === right[index]);
};

interface UsePaginatedJobsProps {
    userProfile: UserProfile;
    initialPageSize?: number;
    enabled?: boolean;
}

const JOBS_FEED_CACHE_KEY = 'jobs_feed_cache_v1';
const JOBS_FEED_CACHE_MAX = 80;
const LEGACY_SAVED_JOBS_KEY = 'savedJobIds';
const SAVED_JOBS_CACHE_PREFIX = 'jobshaman_saved_jobs_cache';
const SAVED_JOB_IDS_PREFIX = 'savedJobIds';
const DISMISSED_JOB_IDS_PREFIX = 'dismissedJobIds';

const normalizeCountryCodes = (codes: string[]): string[] => {
    if (!codes || codes.length === 0) return [];
    const uppered = codes.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
    const hasCs = uppered.includes('CS');
    const hasCz = uppered.includes('CZ');
    const expanded = (hasCs || hasCz)
        ? Array.from(new Set([...uppered.filter(c => c !== 'CS' && c !== 'CZ'), 'CZ', 'CS']))
        : uppered;
    return expanded;
};

const inferJobCountryCode = (job: Job): string | null => {
    const explicit = expandCountryAliases(job.country_code)[0];
    if (explicit) return explicit;

    const fromLocation = getCountryCodeFromAddress(job.location || '');
    if (fromLocation) return fromLocation;

    return getCountryCodeFromJobSource(job);
};

const inferJobLanguageCode = (job: Job): string | null => {
    const explicit = String(job.language_code || '').trim().toLowerCase();
    if (explicit) return explicit;

    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) return 'cs';
    if (haystack.includes('profesia.sk')) return 'sk';
    if (haystack.includes('pracuj.pl')) return 'pl';
    if (haystack.includes('karriere.at') || haystack.includes('stepstone.de') || haystack.includes('germantechjobs')) return 'de';

    return null;
};

const normalizeOrigin = (value: string): string => {
    try {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(withProtocol).origin;
    } catch {
        return '';
    }
};

const hasDedicatedSearchRuntime = (): boolean => {
    const searchOrigin = normalizeOrigin(SEARCH_BACKEND_URL || '');
    const coreOrigin = normalizeOrigin(BACKEND_URL || '');
    return !!searchOrigin && !!coreOrigin && searchOrigin !== coreOrigin;
};

// Global deduper helper to prevent repeated logical listings in feed and React key warnings.
const dedupeJobs = (newJobs: Job[], existingJobs: Job[] = []): Job[] => {
    return dedupeJobsList([...existingJobs, ...newJobs]);
};

const normalizeContractTypeFilter = (value: string): string => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!normalized) return '';
    if (normalized === 'ico' || normalized === 'osvc' || normalized === 'szco' || normalized === 'zivnost') return 'ico';
    if (normalized === 'hpp' || normalized === 'full-time' || normalized === 'full_time' || normalized === 'full time') return 'hpp';
    if (normalized === 'part-time' || normalized === 'part_time' || normalized === 'part time') return 'part-time';
    if (normalized === 'brigada' || normalized === 'temporary' || normalized === 'temp' || normalized === 'casual') return 'brigada';
    if (normalized === 'dpp') return 'dpp';
    if (normalized === 'dpc') return 'dpc';
    return normalized;
};

export const usePaginatedJobs = ({ userProfile, initialPageSize = 50, enabled = true }: UsePaginatedJobsProps) => {
    const { i18n } = useTranslation();
    const dedicatedSearchRuntime = hasDedicatedSearchRuntime();
    const candidateIntent = useMemo(() => resolveCandidateIntentProfile(userProfile), [userProfile]);
    const externalSearchSeedTerm = useMemo(() => {
        const explicitRole = getCandidateIntentRoleSeedKeyword(candidateIntent.targetRole);
        if (explicitRole) return explicitRole;
        const keyword = getCandidateIntentDomainSeedKeyword(candidateIntent.primaryDomain);
        if (keyword) return keyword;
        // Last resort: localized label, but this tends to be worse for English-only sources.
        const label = getCandidateIntentDomainLabel(candidateIntent.primaryDomain, i18n.language);
        return String(label || '').trim();
    }, [candidateIntent.primaryDomain, candidateIntent.targetRole, i18n.language]);
    const activeFetchControllerRef = useRef<AbortController | null>(null);
    const externalOverlayControllerRef = useRef<AbortController | null>(null);
    const lastExternalOverlaySignatureRef = useRef<string>('');
    const latestRequestIdRef = useRef(0);
    const lastDebouncedLogAtRef = useRef(0);
    const hasHandledInitialSortFetchRef = useRef(false);
    const hasRunFilterEffectRef = useRef(false);
    const pendingHardRefreshRef = useRef(false);
    const defaultCountryCodes = useMemo(() => {
        const fromPreference = expandCountryAliases(userProfile.preferredCountryCode);
        if (fromPreference.length > 0) return fromPreference;

        const fromAddress = expandCountryAliases(getCountryCodeFromAddress(userProfile.address));
        if (fromAddress.length > 0) return fromAddress;

        return expandCountryAliases(getCountryCodeFromLanguage(i18n.language));
    }, [i18n.language, userProfile.address, userProfile.preferredCountryCode]);
    const normalizedDefaultDomesticCountries = useMemo(
        () => normalizeCountryCodes(defaultCountryCodes),
        [defaultCountryCodes]
    );
    const defaultLanguageCodes = useMemo(
        () => getDefaultLanguageCodesFromLocale(i18n.language),
        [i18n.language]
    );
    const [countryCodes, setCountryCodes] = useState<string[]>(() => defaultCountryCodes);

    const [jobs, setJobs] = useState<Job[]>(() => {
        try {
            const cached = localStorage.getItem(JOBS_FEED_CACHE_KEY);
            if (!cached) return [];
            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) return [];
            return parsed.slice(0, JOBS_FEED_CACHE_MAX) as Job[];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [impressionSessionKey, setImpressionSessionKey] = useState(() => `impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [backendUnreachable, setBackendUnreachable] = useState(false);

    // Filter state
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50);
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false);
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState<string>('all'); // all, 24h, 3d, 7d, 14d
    const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
    const [filterExperience, setFilterExperience] = useState<string[]>([]); // Junior, Medior, Senior, Lead
    const [filterLanguageCodes, setFilterLanguageCodes] = useState<SearchLanguageCode[]>([]);
    const [enableAutoLanguageGuard, setEnableAutoLanguageGuard] = useState(true);
    const [globalSearch, setGlobalSearch] = useState(() => defaultCountryCodes.length === 0); // Toggle for searching entire database
    const [abroadOnly, setAbroadOnly] = useState(false);
    const [sortBy, setSortBy] = useState<string>('newest'); // newest | distance | jhi_desc | salary_desc

    const implicitLanguageCodesApplied = useMemo(() => {
        if (!enableAutoLanguageGuard) return [];
        const hasAnyFilters =
            !!searchTerm ||
            !!filterCity ||
            filterContractType.length > 0 ||
            filterBenefits.length > 0 ||
            !!filterMinSalary ||
            filterDate !== 'all' ||
            filterExperience.length > 0 ||
            enableCommuteFilter ||
            sortBy !== 'newest' ||
            filterLanguageCodes.length > 0 ||
            abroadOnly;
        if (globalSearch) return [];
        if (hasAnyFilters) return [];
        if (defaultLanguageCodes.length === 0) return [];
        return defaultLanguageCodes;
    }, [
        abroadOnly,
        defaultLanguageCodes,
        enableAutoLanguageGuard,
        enableCommuteFilter,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        filterMinSalary,
        globalSearch,
        searchTerm,
        sortBy,
    ]);

    const savedJobStorageKey = `${SAVED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;
    const dismissedJobStorageKey = `${DISMISSED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;

    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
    const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);
    const savedJobIdsRef = useRef<Set<string>>(new Set());
    const dismissedJobIdsRef = useRef<Set<string>>(new Set());
    const interactionStateHydratedRef = useRef(false);
    const lastInteractionSyncSignatureRef = useRef<string>('');
    const interactionSyncTimerRef = useRef<number | null>(null);

    useEffect(() => {
        savedJobIdsRef.current = new Set(savedJobIds);
    }, [savedJobIds]);

    useEffect(() => {
        dismissedJobIdsRef.current = new Set(dismissedJobIds);
    }, [dismissedJobIds]);

    const filterDismissedJobs = useCallback((list: Job[]) => {
        const dismissed = dismissedJobIdsRef.current;
        if (!dismissed.size || !list.length) return list;
        return list.filter((job) => !dismissed.has(job.id));
    }, []);

    const applyDomesticCountrySafeguard = useCallback((list: Job[]) => {
        if (list.length === 0) {
            return list;
        }

        const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
        const isDefaultCountrySelection = sameCountryCodeSet(
            normalizedCountryCodes,
            normalizeCountryCodes(defaultCountryCodes)
        );

        // If the user is using a commute radius and didn't explicitly narrow countries,
        // don't drop cross-border jobs that are still inside the circle.
        const shouldAllowCrossBorderRadius =
            enableCommuteFilter &&
            !globalSearch &&
            !abroadOnly &&
            isDefaultCountrySelection;

        const allowedCountryCodes = (!globalSearch && !shouldAllowCrossBorderRadius && normalizedCountryCodes.length > 0)
            ? new Set(normalizedCountryCodes)
            : null;
        const allowedLanguageCodes = filterLanguageCodes.length > 0
            ? new Set(filterLanguageCodes.map((code) => String(code).trim().toLowerCase()))
            : (
                enableAutoLanguageGuard &&
                !globalSearch &&
                defaultLanguageCodes.length > 0 &&
                !searchTerm &&
                !filterCity &&
                filterContractType.length === 0 &&
                filterBenefits.length === 0 &&
                !filterMinSalary &&
                filterDate === 'all' &&
                filterExperience.length === 0 &&
                !enableCommuteFilter &&
                !abroadOnly
            )
                ? new Set(defaultLanguageCodes.map((code) => String(code).trim().toLowerCase()))
                : null;

        return list.filter((job) => {
            if (allowedCountryCodes) {
                const inferredCountry = inferJobCountryCode(job);
                if (!inferredCountry || !allowedCountryCodes.has(inferredCountry)) {
                    return false;
                }
            }

            if (allowedLanguageCodes) {
                const inferredLanguage = inferJobLanguageCode(job);
                if (inferredLanguage && !allowedLanguageCodes.has(inferredLanguage)) {
                    return false;
                }
            }

            return true;
        });
    }, [
        abroadOnly,
        countryCodes,
        defaultCountryCodes,
        defaultLanguageCodes,
        enableAutoLanguageGuard,
        enableCommuteFilter,
        filterBenefits,
        filterCity,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        filterMinSalary,
        globalSearch,
        searchTerm,
    ]);

    useEffect(() => {
        const readIds = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return [];
                return parsed.map((id: unknown) => String(id));
            } catch {
                return [];
            }
        };
        const readSavedJobIdsFromCache = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return [];
                return Object.keys(parsed).map((id) => String(id)).filter(Boolean);
            } catch {
                return [];
            }
        };

        const saved = readIds(savedJobStorageKey);
        const dismissed = readIds(dismissedJobStorageKey);
        const cachedSaved = readSavedJobIdsFromCache(`${SAVED_JOBS_CACHE_PREFIX}:${userProfile.id || 'guest'}`);
        const mergedSaved = saved.length > 0 ? saved : cachedSaved;
        if (!userProfile.id && saved.length === 0) {
            const legacy = readIds(LEGACY_SAVED_JOBS_KEY);
            const legacyMerged = legacy.length > 0 ? legacy : cachedSaved;
            setSavedJobIds(Array.from(new Set(legacyMerged)).filter((id) => !dismissed.includes(id)));
        } else {
            setSavedJobIds(Array.from(new Set(mergedSaved)).filter((id) => !dismissed.includes(id)));
        }
        setDismissedJobIds(Array.from(new Set(dismissed)));
    }, [savedJobStorageKey, dismissedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(savedJobStorageKey, JSON.stringify(savedJobIds));
            if (!userProfile.id) {
                localStorage.setItem(LEGACY_SAVED_JOBS_KEY, JSON.stringify(savedJobIds));
            }
        } catch (error) {
            console.error('Error saving jobs to localStorage:', error);
        }
    }, [savedJobIds, savedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(dismissedJobStorageKey, JSON.stringify(dismissedJobIds));
        } catch (error) {
            console.error('Error saving dismissed jobs to localStorage:', error);
        }
    }, [dismissedJobIds, dismissedJobStorageKey]);

    useEffect(() => {
        updateInteractionStateCache({
            savedJobIds,
            dismissedJobIds,
        });
    }, [savedJobIds, dismissedJobIds]);

    useEffect(() => {
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;
        if (!interactionStateHydratedRef.current) return;

        const normalizeIds = (list: string[]) => Array.from(new Set(list.map((id) => String(id)))).sort();
        const nextSaved = normalizeIds(savedJobIds);
        const nextDismissed = normalizeIds(dismissedJobIds).filter((id) => !nextSaved.includes(id));
        const signature = JSON.stringify({ saved: nextSaved, dismissed: nextDismissed });
        if (signature === lastInteractionSyncSignatureRef.current) return;

        if (interactionSyncTimerRef.current) {
            window.clearTimeout(interactionSyncTimerRef.current);
        }

        interactionSyncTimerRef.current = window.setTimeout(() => {
            void (async () => {
                const payload = {
                    savedJobIds: nextSaved,
                    dismissedJobIds: nextDismissed,
                    clientUpdatedAt: new Date().toISOString(),
                    source: 'client_state_sync'
                };
                const result = await syncJobInteractionState(payload);
                if (result) {
                    const canonicalSaved = normalizeIds(result.savedJobIds || []);
                    const canonicalDismissed = normalizeIds(result.dismissedJobIds || []).filter((id) => !canonicalSaved.includes(id));
                    const canonicalSignature = JSON.stringify({ saved: canonicalSaved, dismissed: canonicalDismissed });
                    lastInteractionSyncSignatureRef.current = canonicalSignature;
                    if (canonicalSignature !== signature) {
                        setSavedJobIds(canonicalSaved);
                        setDismissedJobIds(canonicalDismissed);
                    }
                } else {
                    lastInteractionSyncSignatureRef.current = signature;
                }
            })();
        }, 800);

        return () => {
            if (interactionSyncTimerRef.current) {
                window.clearTimeout(interactionSyncTimerRef.current);
            }
        };
    }, [savedJobIds, dismissedJobIds, userProfile.isLoggedIn, userProfile.id, enabled]);

    useEffect(() => {
        let cancelled = false;
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;

        (async () => {
            try {
                const state = await fetchJobInteractionState(20000);
                if (cancelled) return;

                // Merge backend state with local cache so historical saved items
                // are not dropped when backend interaction history is partial.
                const mergedSavedSet = new Set<string>([
                    ...Array.from(savedJobIdsRef.current),
                    ...state.savedJobIds.map((id) => String(id)),
                ]);
                const mergedDismissedSet = new Set<string>([
                    ...Array.from(dismissedJobIdsRef.current),
                    ...state.dismissedJobIds.map((id) => String(id)),
                ]);

                const nextSaved = Array.from(mergedSavedSet);
                const nextDismissed = Array.from(mergedDismissedSet).filter((id) => !mergedSavedSet.has(id));

                setSavedJobIds(nextSaved);
                setDismissedJobIds(nextDismissed);
            } catch (error) {
                if (!cancelled) {
                    console.warn('Failed to hydrate interaction state from backend:', error);
                }
            } finally {
                if (!cancelled) {
                    interactionStateHydratedRef.current = true;
                    void flushInteractionStateSyncQueue();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userProfile.isLoggedIn, userProfile.id, enabled]);

    // Persist a warm cache so first paint is never empty when backend wakes up.
    useEffect(() => {
        if (!jobs || jobs.length === 0) return;
        try {
            localStorage.setItem(JOBS_FEED_CACHE_KEY, JSON.stringify(jobs.slice(0, JOBS_FEED_CACHE_MAX)));
        } catch {
            // Ignore storage failures.
        }
    }, [jobs]);

    useEffect(() => {
        if (!dismissedJobIds.length) return;
        setJobs(prev => prev.filter(job => !dismissedJobIds.includes(job.id)));
    }, [dismissedJobIds]);

    useEffect(() => {
        return () => {
            latestRequestIdRef.current += 1;
            if (activeFetchControllerRef.current) {
                activeFetchControllerRef.current.abort();
                activeFetchControllerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (sortBy === 'recommended') {
            setSortBy('newest');
        }
    }, [sortBy]);


    // UI state
    const [showFilters, setShowFilters] = useState(true);
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
        if (!enabled) {
            if (!isLoadMore) {
                setLoading(false);
                setLoadingMore(false);
                setJobs([]);
                setHasMore(false);
                setTotalCount(0);
            }
            return;
        }
        if (!isLoadMore && activeFetchControllerRef.current) {
            activeFetchControllerRef.current.abort();
        }
        const fetchController = new AbortController();
        ++latestRequestIdRef.current;
        const requestId = latestRequestIdRef.current;
        const isStaleRequest = () => requestId !== latestRequestIdRef.current || fetchController.signal.aborted;
        activeFetchControllerRef.current = fetchController;

        setLoading(true);
        if (isLoadMore) setLoadingMore(true);
        if (!isLoadMore && pendingHardRefreshRef.current) {
            pendingHardRefreshRef.current = false;
            setJobs([]);
            setHasMore(false);
            setTotalCount(0);
        }

        try {
            // Only use coordinates if we are doing a commute filter or proximity sort
            let lat = userProfile.coordinates?.lat;
            let lon = userProfile.coordinates?.lon;

            // If user has an address but no coordinates yet, try to resolve it for radius filtering.
            if ((lat == null || lon == null) && enableCommuteFilter && userProfile.address) {
                const addrCoords = getStaticCoordinates(userProfile.address) || await geocodeWithCaching(userProfile.address);
                if (addrCoords) {
                    lat = addrCoords.lat;
                    lon = addrCoords.lon;
                }
            }

            // If no user coordinates but we have a city and commute filter is requested,
            // try to get coordinates for the city to allow radius search.
            if ((lat == null || lon == null) && filterCity && enableCommuteFilter) {
                const cityCoords = getStaticCoordinates(filterCity);
                if (cityCoords) {
                    lat = cityCoords.lat;
                    lon = cityCoords.lon;
                }
            }

            const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
            const hasCountryFilter = !globalSearch && normalizedCountryCodes.length > 0;
            const hasManualOrInferredIntent = Boolean(candidateIntent.primaryDomain || candidateIntent.targetRole);
            const hasAnyFilters =
                !!searchTerm ||
                !!filterCity ||
                filterContractType.length > 0 ||
                filterBenefits.length > 0 ||
                !!filterMinSalary ||
                filterDate !== 'all' ||
                filterExperience.length > 0 ||
                enableCommuteFilter ||
                sortBy !== 'newest' ||
                filterLanguageCodes.length > 0 ||
                abroadOnly;
            const shouldUseExpandedPersonalizedPool =
                page === 0 &&
                hasManualOrInferredIntent &&
                !hasAnyFilters &&
                sortBy === 'newest';
            const implicitLanguageCodes = !globalSearch && !hasAnyFilters && defaultLanguageCodes.length > 0
                ? defaultLanguageCodes
                : [];
            const effectiveLanguageCodes = filterLanguageCodes.length > 0
                ? filterLanguageCodes
                : (enableAutoLanguageGuard ? implicitLanguageCodes : []);
            const requestedPageSize = shouldUseExpandedPersonalizedPool
                ? Math.max(initialPageSize, 120)
                : initialPageSize;

            // Avoid heavy RPC paths when the user effectively wants "show me the newest feed".
            // Supabase PostgREST RPC can hit statement timeouts (57014) on broad queries, while
            // simple pagination over `jobs` stays fast and stable.
            const canUseSimplePagination =
                !hasAnyFilters &&
                (!hasCountryFilter || normalizedCountryCodes.length === 1) &&
                (!dedicatedSearchRuntime || globalSearch);

            if (canUseSimplePagination) {
                const singleCountry = hasCountryFilter ? normalizedCountryCodes[0] : undefined;
                const basicResult = await fetchJobsPaginated(
                    page,
                    requestedPageSize,
                    undefined,
                    undefined,
                    50,
                    singleCountry,
                    effectiveLanguageCodes,
                    false
                );
                if (isStaleRequest()) return;
                setBackendUnreachable(false);

                const visibleJobs = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(basicResult.jobs)));
                if (isLoadMore) {
                    setJobs(prev => dedupeJobs(visibleJobs, prev));
                } else {
                    setJobs(visibleJobs);
                }

                setHasMore(basicResult.hasMore);
                setTotalCount(Math.max(0, Number(basicResult.totalCount || 0) - (basicResult.jobs.length - visibleJobs.length)));
                return;
            }

            const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : normalizedDefaultDomesticCountries;
            const isDefaultCountrySelection = sameCountryCodeSet(normalizedCountryCodes, normalizeCountryCodes(defaultCountryCodes));
            const shouldAutoExpandBorderCountries =
                enableCommuteFilter &&
                lat != null &&
                lon != null &&
                !globalSearch &&
                !abroadOnly &&
                isDefaultCountrySelection &&
                normalizedCountryCodes.length > 0;

            // When radius filtering is enabled and the user didn't explicitly narrow countries,
            // don't block cross-border jobs (AT/SK/DE/PL...) that are still within the commute circle.
            const effectiveCountryCodes = (globalSearch || shouldAutoExpandBorderCountries) ? undefined : normalizedCountryCodes;
            const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;

            const result = await fetchJobsWithFilters({
                page,
                pageSize: requestedPageSize,
                searchTerm,
                sortMode: (sortBy === 'distance' || sortBy === 'salary_desc' || sortBy === 'recommended' ? 'default' : sortBy) as 'default' | 'newest' | 'jhi_desc' | 'recommended',
                filterCity,
                filterContractTypes: filterContractType,
                filterBenefits,
                filterMinSalary,
                filterDatePosted: filterDate,
                filterExperienceLevels: filterExperience,
                radiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
                userLat: lat,
                userLng: lon,
                countryCodes: effectiveCountryCodes,
                excludeCountryCodes,
                filterLanguageCodes: effectiveLanguageCodes.length > 0 ? effectiveLanguageCodes : undefined,
                jhiPreferences: userProfile.jhiPreferences,
                userTaxProfile: userProfile.taxProfile,
                externalSearchSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                externalOverlayMode: 'async',
                includeJhi: false,
                abortSignal: fetchController.signal
            });
            if (isStaleRequest()) return;
            setBackendUnreachable(false);

            const visibleJobs = dedupeJobsList(applyDomesticCountrySafeguard(filterDismissedJobs(result.jobs)));
            if (isLoadMore) {
                setJobs(prev => dedupeJobs(visibleJobs, prev));
            } else {
                setJobs(visibleJobs);
            }

            setHasMore(result.hasMore);
            setTotalCount(Math.max(0, Number(result.totalCount || 0) - (result.jobs.length - visibleJobs.length)));

            // Async external overlay: never block the main feed. Fetch extras in the background
            // and merge them into the already-rendered list (page 0 only).
            if (!isLoadMore && page === 0) {
                try {
                    const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
                    const domesticCountryCodes = normalizedCountryCodes.length > 0 ? normalizedCountryCodes : normalizedDefaultDomesticCountries;
                    const effectiveCountryCodes = globalSearch ? undefined : normalizedCountryCodes;
                    const excludeCountryCodes = abroadOnly ? domesticCountryCodes : undefined;

                    const signature = JSON.stringify({
                        searchTerm: String(searchTerm || '').trim(),
                        filterCity: String(filterCity || '').trim(),
                        countryCodes: effectiveCountryCodes || null,
                        excludeCountryCodes: excludeCountryCodes || null,
                        seed: String(externalSearchSeedTerm || '').trim()
                    });
                    if (signature !== lastExternalOverlaySignatureRef.current) {
                        lastExternalOverlaySignatureRef.current = signature;
                        externalOverlayControllerRef.current?.abort();
                        const overlayController = new AbortController();
                        externalOverlayControllerRef.current = overlayController;

                        void (async () => {
                            const overlayJobs = await fetchExternalOverlayJobs({
                                searchTerm: searchTerm || undefined,
                                externalSeedTerm: searchTerm ? undefined : externalSearchSeedTerm,
                                filterCity,
                                countryCodes: effectiveCountryCodes,
                                excludeCountryCodes,
                                abortSignal: overlayController.signal,
                                includeJhi: false
                            });
                            if (overlayController.signal.aborted) return;
                            if (!overlayJobs.length) return;

                            setJobs((prev) => dedupeJobsList([...prev, ...overlayJobs]));
                        })();
                    }
                } catch {
                    // No-op: overlay is best-effort only.
                }
            }

            // Track analytics
            if ((filterCity || filterContractType.length > 0 || filterBenefits.length > 0)) {
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
            if ((error as any)?.name === 'AbortError') {
                return;
            }
            if (isStaleRequest()) {
                return;
            }
            console.error('Error fetching filtered jobs:', error);
            // Only mark backend unreachable for network/timeout-type failures.
            const msg = String((error as any)?.message || error || '').toLowerCase();
            const code = String((error as any)?.code || '').toLowerCase();
            const looksLikeNetwork =
                msg.includes('failed to fetch') ||
                msg.includes('networkerror') ||
                msg.includes('network error') ||
                msg.includes('ecconnreset') ||
                msg.includes('econnrefused') ||
                msg.includes('etimedout') ||
                msg.includes('timeout') ||
                code.includes('timeout');
            setBackendUnreachable(looksLikeNetwork);
            // Keep previous results on transient errors to avoid "flash then disappear" behavior.
        } finally {
            if (activeFetchControllerRef.current === fetchController) {
                activeFetchControllerRef.current = null;
            }
            if (requestId === latestRequestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [
        enabled, initialPageSize, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, userProfile.coordinates?.lat, userProfile.coordinates?.lon, userProfile.id, countryCodes, globalSearch, filterLanguageCodes, abroadOnly, sortBy, JSON.stringify(userProfile.jhiPreferences), JSON.stringify(userProfile.taxProfile), filterDismissedJobs, normalizedDefaultDomesticCountries, candidateIntent.primaryDomain, candidateIntent.targetRole
    ]);


    // Debounced reload when filters change
    useEffect(() => {
        if (!enabled) return;
        if (hasRunFilterEffectRef.current) {
            setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        }
        if (hasRunFilterEffectRef.current) {
            pendingHardRefreshRef.current = true;
            setLoading(true);
            setLoadingMore(false);
            setJobs([]);
            setHasMore(false);
            setTotalCount(0);
        }
        hasRunFilterEffectRef.current = true;

        const timeoutId = setTimeout(() => {
            if (Date.now() - lastDebouncedLogAtRef.current > 2_000) {
                console.log('⏱️ Debounced filter fetch triggered');
                lastDebouncedLogAtRef.current = Date.now();
            }
            setCurrentPage(0);
            fetchFilteredJobs(0, false);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        enabled, searchTerm, filterCity, filterContractType, filterBenefits,
        filterMinSalary, filterDate, filterExperience, enableCommuteFilter,
        filterMaxDistance, countryCodes, globalSearch, filterLanguageCodes, abroadOnly
    ]); // Excluded fetchFilteredJobs to avoid re-triggering when it's just redefined

    // Re-apply sorting when sort option changes
    useEffect(() => {
        if (!enabled) return;
        if (!hasHandledInitialSortFetchRef.current) {
            hasHandledInitialSortFetchRef.current = true;
            return;
        }
        setImpressionSessionKey(`impr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        pendingHardRefreshRef.current = true;
        setLoading(true);
        setLoadingMore(false);
        setJobs([]);
        setHasMore(false);
        setTotalCount(0);
        setCurrentPage(0);
        fetchFilteredJobs(0, false);
    }, [sortBy, fetchFilteredJobs, enabled]);

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
        return fetchFilteredJobs(0, false);
    }, [fetchFilteredJobs]);

    useEffect(() => {
        if (globalSearch || abroadOnly) return;
        if (defaultCountryCodes.length === 0) return;
        if (!sameCountryCodeSet(countryCodes, defaultCountryCodes)) {
            setCountryCodes(defaultCountryCodes);
        }
    }, [defaultCountryCodes, countryCodes, globalSearch, abroadOnly]);

    // Keep `globalSearch` as an explicit user choice.
    // Auto-flipping it off is confusing and also hides external/imported sources unexpectedly.

    useEffect(() => {
        if (abroadOnly && !globalSearch) {
            setGlobalSearch(true);
            return;
        }
        if (!globalSearch && abroadOnly) {
            setAbroadOnly(false);
        }
    }, [abroadOnly, globalSearch]);

    // Perform search is now just setting the search term
    const performSearch = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    // --- HELPERS REINSTATED ---

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefits(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractTypeFilter = (type: string) => {
        const canonicalType = normalizeContractTypeFilter(type);
        if (!canonicalType) return;
        setFilterContractType(prev =>
            prev.includes(canonicalType)
                ? prev.filter(t => t !== canonicalType)
                : [...prev, canonicalType]
        );
    };

    const toggleExperienceFilter = (level: string) => {
        setFilterExperience(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
    };

    const applyInteractionState = useCallback((
        jobId: string,
        eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave'
    ) => {
        const normalizedId = String(jobId);
        if (!normalizedId) return;

        if (eventType === 'save' || eventType === 'swipe_right') {
            setSavedJobIds(prev => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
            setDismissedJobIds(prev => prev.filter(id => id !== normalizedId));
            return;
        }

        setSavedJobIds(prev => prev.filter(id => id !== normalizedId));
        if (eventType === 'swipe_left') {
            setDismissedJobIds(prev => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
            setJobs(prev => prev.filter(job => job.id !== normalizedId));
        }
    }, []);

    const setSavedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setSavedJobIds(prev => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    const setDismissedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setDismissedJobIds(prev => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterCity('');
        setFilterBenefits([]);
        setFilterContractType([]);
        setFilterDate('all');
        setFilterMinSalary(0);
        setFilterExperience([]);
        setFilterMaxDistance(50);
        setFilterLanguageCodes([]);
        setEnableAutoLanguageGuard(true);
        setAbroadOnly(false);
        setCountryCodes(defaultCountryCodes);
        setGlobalSearch(defaultCountryCodes.length === 0);
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
        impressionSessionKey,
        backendUnreachable,

        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        filterDate,
        filterMinSalary,
        filterExperience,
        filterLanguageCodes,
        enableAutoLanguageGuard,
        implicitLanguageCodesApplied,
        savedJobIds,
        dismissedJobIds,
        showFilters,
        expandedSections,
        globalSearch,
        abroadOnly,
        countryCodes,
        sortBy,

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
        setFilterLanguageCodes,
        setEnableAutoLanguageGuard,
        setSavedJobIds: setSavedJobIdsWithDedupe,
        setDismissedJobIds: setDismissedJobIdsWithDedupe,
        setShowFilters,
        setExpandedSections,
        setGlobalSearch,
        setAbroadOnly,
        setCountryCodes,
        setSortBy,
        applyInteractionState,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        clearAllFilters
    };
};
