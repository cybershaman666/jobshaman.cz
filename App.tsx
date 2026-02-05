import { useState, useEffect, useRef, useCallback } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile, CareerPathfinderResult } from './types';

import { Analytics } from '@vercel/analytics/react';
import { initialBlogPosts } from './src/data/blogPosts';
import AppHeader from './components/AppHeader';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';
import CompanyDashboard from './components/CompanyDashboard';
import FreelancerDashboard from './components/FreelancerDashboard';
import CompanyOnboarding from './components/CompanyOnboarding';
import ProfileEditor from './components/ProfileEditor';
import AuthModal from './components/AuthModal';
import CompanyRegistrationModal from './components/CompanyRegistrationModal';
import FreelancerRegistrationModal from './components/FreelancerRegistrationModal';
import ServicesMarketplace from './components/ServicesMarketplace';
import MarketplacePage from './components/MarketplacePage';
import EnterpriseSignup from './components/EnterpriseSignup';
import CompanyLandingPage from './components/CompanyLandingPage';
import ApplicationModal from './components/ApplicationModal';
import CookieBanner from './components/CookieBanner';
import PodminkyUziti from './pages/PodminkyUziti';
import OchranaSoukromi from './pages/OchranaSoukromi';
import SavedJobsPage from './components/SavedJobsPage';
import JobListSidebar from './components/JobListSidebar';
import JobDetailView from './components/JobDetailView';
import MobileSwipeJobBrowser from './components/MobileSwipeJobBrowser';

import InvitationLanding from './pages/InvitationLanding';
import PremiumUpgradeModal from './components/PremiumUpgradeModal';
import AppFooter from './components/AppFooter';
import { analyzeJobDescription } from './services/geminiService';
import { calculateCommuteReality } from './services/commuteService';
import { fetchJobById } from './services/jobService';
import { clearJobCache } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile, verifyAuthSession } from './services/supabaseService';
import { canCandidateUseFeature } from './services/billingService';
import { analyzeJobForPathfinder } from './services/careerPathfinderService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { checkPaymentStatus } from './services/stripeService';
import { clearCsrfToken } from './services/csrfService';
import { useUserProfile } from './hooks/useUserProfile';
import { usePaginatedJobs } from './hooks/usePaginatedJobs';
import { DEFAULT_USER_PROFILE } from './constants';
import {
    clamp,
    applyTimeCostImpact,
    calculateBenefitsBonus,
    calculateNetBenefitBonus,
    calculateOverallScore
} from './utils/jhi';
import { formatJobDescription } from './utils/formatters';
import {
    Car,
    Bus,
    Bike,
    Footprints
} from 'lucide-react';

// JHI and formatting utilities now imported from utils/

export default function App() {
    const { t, i18n } = useTranslation();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [selectedJobId, setSelectedJobIdState] = useState<string | null>(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        // If first segment is a locale, drop it
        if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
        if (parts[0] === 'jobs') return parts[1] || null;
        return null;
    });

    // Wrapper to update selectedJobId state; URL sync handled in a dedicated effect
    const getLocalePrefix = () => {
        const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        const parts = window.location.pathname.split('/').filter(Boolean);
        let lng = (i18n && i18n.language) || 'cs';
        if (parts.length > 0 && supported.includes(parts[0])) lng = parts[0];
        return lng;
    };

    const setSelectedJobId = (id: string | null) => {
        setSelectedJobIdState(id);
    };
    const [selectedBlogPostSlug, setSelectedBlogPostSlug] = useState<string | null>(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
        if (parts[0] === 'blog') return parts[1] || null;
        return null;
    });
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [directlyFetchedJob, setDirectlyFetchedJob] = useState<Job | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);

    // Career Pathfinder State
    const [pathfinderAnalysis, setPathfinderAnalysis] = useState<CareerPathfinderResult | null>(null);

    // Cookie Consent State
    const [showCookieBanner, setShowCookieBanner] = useState(false);

    // Track if we've already auto-enabled commute filter to avoid re-enabling after user disables it
    const hasAutoEnabledCommuteFilter = useRef(false);
    const deferredAutoEnableRef = useRef(false);

    // Track if user intentionally clicked on LIST (to prevent NavRestore from auto-restoring dashboard)
    const userIntentionallyClickedListRef = useRef(false);

    // UI State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [isFreelancerRegistrationOpen, setIsFreelancerRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);
    const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
    const [showFinancialMethodology, setShowFinancialMethodology] = useState(false);
    const [isMobileSwipeView, setIsMobileSwipeView] = useState(false);
    const [isMobileScreen, setIsMobileScreen] = useState(false);
    const [mobileViewOverride, setMobileViewOverride] = useState<'swipe' | 'list' | null>(null);
    const [openedFromSwipe, setOpenedFromSwipe] = useState(false);


    // Use custom hooks
    const {
        userProfile,
        companyProfile,
        viewState,
        setViewState,
        setUserProfile,
        setCompanyProfile,
        signOut,
        deleteAccount,
        handleSessionRestoration
    } = useUserProfile();

    const {
        jobs: filteredJobs,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching,
        loadInitialJobs,
        loadMoreJobs,
        performSearch,
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
        setSearchTerm,
        setFilterCity,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterDate,
        setFilterMinSalary,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        globalSearch,
        setGlobalSearch,
        sortBy,
        setSortBy
    } = usePaginatedJobs({ userProfile });

    // Prevent layout flash on first render by waiting for client mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Detect mobile screen size and auto-enable mobile swipe view
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobileScreen(isMobile);
            if (!isMobile) {
                setIsMobileSwipeView(false);
                return;
            }
            if (mobileViewOverride) {
                setIsMobileSwipeView(mobileViewOverride === 'swipe');
            } else {
                setIsMobileSwipeView(userProfile.isLoggedIn);
            }
        };

        handleResize(); // Check on mount
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [userProfile.isLoggedIn, mobileViewOverride]);

    const selectedJob = filteredJobs.find(j => j.id === selectedJobId) || directlyFetchedJob;

    // --- EFFECTS ---

    const refreshUserProfile = async () => {
        try {
            if (!supabase) return;
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (userId) {
                const profile = await getUserProfile(userId);
                if (profile) {
                    setUserProfile({
                        ...profile,
                        isLoggedIn: true
                    });
                }
            }
        } catch (error) {
            console.error("Failed to refresh user profile:", error);
        }
    };

    const loadRealJobs = useCallback(async () => {
        setIsLoadingJobs(true);
        try {
            await loadInitialJobs();
        } catch (e) {
            console.error("Failed to load jobs", e);
        } finally {
            setIsLoadingJobs(false);
        }
    }, [loadInitialJobs]);

    // Infinite scroll detection
    const jobListRef = useRef<HTMLDivElement>(null);
    const detailScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (!jobListRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = jobListRef.current;
            const threshold = 300; // Increased threshold
            const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

            if (isNearBottom && !loadingMore && hasMore) {
                console.log('🚀 Infinite scroll triggered! Loading page...', totalCount);
                loadMoreJobs();
            }
        };

        const element = jobListRef.current;
        if (element) {
            console.log('✅ Scroll listener attached to job list');
            element.addEventListener('scroll', handleScroll);
            return () => element.removeEventListener('scroll', handleScroll);
        }
    }, [loadingMore, hasMore, isSearching, loadMoreJobs, isLoadingJobs, viewState]);

    useEffect(() => {
        // Initial Theme Setup
        let initialTheme = 'light';
        try {
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                initialTheme = 'dark';
            }
        } catch (e) { }

        if (initialTheme === 'dark') {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        } else {
            setTheme('light');
            document.documentElement.classList.remove('dark');
        }



        // LOAD REAL DATA
        loadRealJobs();
        checkPaymentStatus();

        // AUTH LISTENER
        if (supabase) {
            // Initial session check
            const initSession = async () => {
                console.log('🏁 [App] Running initial session check...');
                const { isValid, session } = await verifyAuthSession('AppInit');
                if (isValid && session) {
                    console.log('✅ [App] Initial session verified for:', session.user.id);
                    handleSessionRestoration(session.user.id);
                } else {
                    console.log('ℹ️ [App] No initial valid session found.');
                }
            };
            initSession();

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
                console.log(`🔔 [App] Auth state changed: ${event}`);

                if (session) {
                    // Only restore if we have a valid session and it's a meaningful event
                    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                        handleSessionRestoration(session.user.id);
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log('👤 [App] User signed out, clearing state.');
                    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
                    setViewState(ViewState.LIST);
                    setCompanyProfile(null);
                    clearCsrfToken();
                }
            });

            // Deep Link Handling for /jobs/:id and locale-prefixed routes
            const path = window.location.pathname;
            const parts = path.split('/').filter(Boolean);
            const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
            if (parts.length > 0 && supported.includes(parts[0])) parts.shift();

            if (parts[0] === 'jobs') {
                const jobId = parts[1];
                if (jobId) {
                    setViewState(ViewState.LIST);
                    setShowCompanyLanding(false);
                    setSelectedJobId(jobId);
                    console.log('🔗 Deep link detected for job:', jobId);
                }
            } else if (parts[0] === 'blog') {
                const slug = parts[1];
                if (slug) {
                    setViewState(ViewState.LIST);
                    setShowCompanyLanding(false);
                    setSelectedBlogPostSlug(slug);
                    setSelectedJobId(null);
                }
            } else if (parts[0] === 'kurzy-a-rekvalifikace') {
                setViewState(ViewState.MARKETPLACE);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'sluzby') {
                setViewState(ViewState.SERVICES);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'ulozene') {
                setViewState(ViewState.SAVED);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'assessment-centrum') {
                setViewState(ViewState.ASSESSMENT);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'profil') {
                setViewState(ViewState.PROFILE);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'pro-firmy') {
                setShowCompanyLanding(true);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'freelancer-dashboard') {
                setViewState(ViewState.FREELANCER_DASHBOARD);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'company-dashboard' || parts[0] === 'dashboard') {
                setViewState(ViewState.COMPANY_DASHBOARD);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            }

            return () => subscription.unsubscribe();
        }
    }, []);

    // RESTORE DASHBOARD VIEW STATE when navigating back to home (selectedJobId becomes null)
    // This fixes the issue where FreelancerDashboard doesn't load after returning from job details
    // BUT: Only restore if we're coming from a job detail view, NOT from other views like MARKETPLACE
    const prevSelectedJobIdRef = useRef<string | null>(selectedJobId);
    useEffect(() => {
        const prev = prevSelectedJobIdRef.current;
        prevSelectedJobIdRef.current = selectedJobId;

        // Only restore dashboards when user explicitly closes a job detail (prev -> null)
        const closedJobDetail = !!prev && selectedJobId === null;

        if (closedJobDetail && userProfile.isLoggedIn && userProfile.role === 'recruiter') {
            if (viewState === ViewState.LIST && !userIntentionallyClickedListRef.current) {
                console.log("🔄 [NavRestore] Checking profile to restore dashboard. companyProfile:", {
                    id: companyProfile?.id,
                    name: companyProfile?.name,
                    industry: companyProfile?.industry,
                    isFreelancer: companyProfile?.industry === 'Freelancer'
                });

                if (companyProfile?.industry === 'Freelancer') {
                    setViewState(ViewState.FREELANCER_DASHBOARD);
                    console.log("✅ Restored FREELANCER_DASHBOARD after returning from job detail");
                } else if (companyProfile) {
                    setViewState(ViewState.COMPANY_DASHBOARD);
                    console.log("✅ Restored COMPANY_DASHBOARD after returning from job detail");
                }
            } else if (userIntentionallyClickedListRef.current && viewState !== ViewState.LIST) {
                setViewState(ViewState.LIST);
                console.log("✅ Staying on LIST after user clicked the button");
            }

            userIntentionallyClickedListRef.current = false;
        }
    }, [selectedJobId, userProfile.isLoggedIn, userProfile.role, viewState, companyProfile?.industry]);

    // Keep URL in sync with current view state (locale-prefixed routes)
    useEffect(() => {
        try {
            const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
            const base = parts[0] || '';

            // Do not override dedicated static/legal routes
            const isExternalPage = base === 'podminky-uziti'
                || base === 'ochrana-osobnich-udaju'
                || base === 'enterprise'
                || base === 'assessment';
            if (isExternalPage) return;

            const lng = getLocalePrefix();
            let targetPath = `/${lng}/`;

            if (selectedJobId) {
                targetPath = `/${lng}/jobs/${selectedJobId}`;
            } else if (selectedBlogPostSlug) {
                targetPath = `/${lng}/blog/${selectedBlogPostSlug}`;
            } else if (showCompanyLanding) {
                targetPath = `/${lng}/pro-firmy`;
            } else if (viewState === ViewState.MARKETPLACE) {
                targetPath = `/${lng}/kurzy-a-rekvalifikace`;
            } else if (viewState === ViewState.SERVICES) {
                targetPath = `/${lng}/sluzby`;
            } else if (viewState === ViewState.SAVED) {
                targetPath = `/${lng}/ulozene`;
            } else if (viewState === ViewState.ASSESSMENT) {
                targetPath = `/${lng}/assessment-centrum`;
            } else if (viewState === ViewState.PROFILE) {
                targetPath = `/${lng}/profil`;
            } else if (viewState === ViewState.FREELANCER_DASHBOARD) {
                targetPath = `/${lng}/freelancer-dashboard`;
            } else if (viewState === ViewState.COMPANY_DASHBOARD) {
                targetPath = `/${lng}/company-dashboard`;
            }

            if (window.location.pathname !== targetPath) {
                const search = window.location.search || '';
                const hash = window.location.hash || '';
                window.history.replaceState({}, '', targetPath + search + hash);
            }
        } catch (err) {
            console.warn('Failed to sync URL with view state', err);
        }
    }, [selectedJobId, selectedBlogPostSlug, showCompanyLanding, viewState, i18n.language]);

    // REMOVE OLD HISTORY API PATCHING - replaced with selectedJobId effect above
    // Fetch job by ID for direct links (e.g., /jobs/18918)
    useEffect(() => {
        const fetchDirectJob = async () => {
            // Only fetch if:
            // 1. We have a selectedJobId (from URL)
            // 2. The job is not in filteredJobs
            // 3. We haven't already fetched it
            // 4. Jobs have finished initial loading
            if (selectedJobId && !filteredJobs.find(j => j.id === selectedJobId) && !isLoadingJobs) {
                console.log('🔗 Direct link detected, fetching job by ID:', selectedJobId);
                const job = await fetchJobById(selectedJobId);
                if (job) {
                    setDirectlyFetchedJob(job);
                } else {
                    console.warn('⚠️ Job not found for direct link:', selectedJobId);
                }
            }
        };

        fetchDirectJob();
    }, [selectedJobId, filteredJobs.length, isLoadingJobs]);

    // If user session is restored after initial mount, reload jobs to avoid empty list due to race.
    const lastReloadUserIdRef = useRef<string | null>(null);
    const reloadLockRef = useRef(false);

    useEffect(() => {
        if (userProfile && userProfile.isLoggedIn && userProfile.id) {
            // Only reload once per user id to avoid repeated concurrent reloads
            if (lastReloadUserIdRef.current === userProfile.id) return;
            lastReloadUserIdRef.current = userProfile.id;
            console.log('🔁 userProfile became available — reloading jobs to avoid race conditions');
            loadRealJobs();
        }
    }, [userProfile?.id]);

    // Auto-enable commute filter for existing users with address/coordinates (only once)
    useEffect(() => {
        console.log('🔍 Commute filter check:', {
            hasAddress: !!userProfile.address,
            hasCoordinates: !!userProfile.coordinates,
            coordinates: userProfile.coordinates,
            enableCommuteFilter,
            address: userProfile.address,
            alreadyAutoEnabled: hasAutoEnabledCommuteFilter.current
        });

        // Only auto-enable once, and only if user hasn't manually disabled it
        if (userProfile.address && userProfile.coordinates && !enableCommuteFilter && !hasAutoEnabledCommuteFilter.current) {
            // If we don't yet have jobs loaded, defer enabling commute filter to avoid hiding everything
            if (filteredJobs && filteredJobs.length === 0) {
                console.log('🏠 Deferring auto-enable of commute filter until jobs load');
                deferredAutoEnableRef.current = true;
                return;
            }

            console.log('🏠 User has address and coordinates, auto-enabling commute filter for the first time');
            setEnableCommuteFilter(true);
            setFilterMaxDistance(50);
            hasAutoEnabledCommuteFilter.current = true;
            deferredAutoEnableRef.current = false;
        }
    }, [userProfile.address, userProfile.coordinates]);

    // If we queued auto-enable because jobs weren't loaded yet, enable when jobs arrive
    useEffect(() => {
        if (deferredAutoEnableRef.current && filteredJobs && filteredJobs.length > 0 && !hasAutoEnabledCommuteFilter.current) {
            console.log('🏠 Jobs loaded — applying deferred auto-enable of commute filter');
            setEnableCommuteFilter(true);
            setFilterMaxDistance(50);
            hasAutoEnabledCommuteFilter.current = true;
            deferredAutoEnableRef.current = false;
        }
    }, [filteredJobs?.length]);

    // Reload jobs when user coordinates change (e.g., after profile update)
    useEffect(() => {
        if (userProfile.coordinates?.lat && userProfile.coordinates?.lon) {
            (async () => {
                if (reloadLockRef.current) {
                    console.log('Coordinate reload already in progress — skipping');
                    return;
                }

                reloadLockRef.current = true;
                console.log('📍 Coordinates updated:', userProfile.coordinates, '- Clearing cache and reloading jobs...');
                try {
                    // Clear the cache to ensure we get fresh results with proximity sorting
                    await Promise.resolve(clearJobCache());
                    await loadRealJobs();
                } catch (e) {
                    console.error('Error during coordinate-triggered reload:', e);
                } finally {
                    reloadLockRef.current = false;
                }
            })();
        }
    }, [userProfile.coordinates?.lat, userProfile.coordinates?.lon]);

    // Backend cold-start retry: if we have no jobs after initial load, poll the backend
    const backendWakeRetryRef = useRef(false);
    const backendRetryCountRef = useRef(0);
    const backendRetryTimerRef = useRef<number | null>(null);
    const BACKEND_RETRY_MAX = 8; // total tries
    const BACKEND_RETRY_DELAY_MS = 3000; // 3s between tries

    // UI state for showing the waiting hint
    const [backendPolling, setBackendPolling] = useState(false);

    // Keep a ref to filteredJobs so async retry closure can access latest value
    const filteredJobsRef = useRef(filteredJobs);
    useEffect(() => { filteredJobsRef.current = filteredJobs; }, [filteredJobs]);

    useEffect(() => {
        // Guard: don't start if already polling or have jobs
        if (isLoadingJobs || (filteredJobsRef.current && filteredJobsRef.current.length > 0) || backendWakeRetryRef.current) return;

        console.log('Backend wake retry: starting polling to wait for backend wake-up');
        backendWakeRetryRef.current = true;
        setBackendPolling(true);
        backendRetryCountRef.current = 0;

        const runPoll = async () => {
            // If already stopped by cleanup, don't run
            if (!backendWakeRetryRef.current) return;

            backendRetryCountRef.current += 1;
            console.log(`Backend wake retry: attempt ${backendRetryCountRef.current}/${BACKEND_RETRY_MAX}`);

            try {
                await loadRealJobs();
            } catch (e) {
                console.error('Backend wake retry: loadRealJobs error', e);
            }

            // check stop conditions again
            if (filteredJobsRef.current && filteredJobsRef.current.length > 0) {
                console.log('Backend wake retry: jobs appeared, stopping polling');
                backendWakeRetryRef.current = false;
                setBackendPolling(false);
                return;
            }

            if (backendRetryCountRef.current >= BACKEND_RETRY_MAX) {
                console.log('Backend wake retry: reached max attempts, stopping');
                backendWakeRetryRef.current = false;
                setBackendPolling(false);
                return;
            }

            // schedule next
            backendRetryTimerRef.current = window.setTimeout(runPoll, BACKEND_RETRY_DELAY_MS);
        };

        runPoll();

        return () => {
            // Note: We deliberately don't set backendWakeRetryRef.current = false here
            // unless we want to REALLY stop the loop on unmount.
            // If the effect re-runs because of isLoadingJobs (even if isLoadingJobs is stable it might re-run),
            // we don't want to kill a valid loop that is already waiting for a timeout.
            if (backendRetryTimerRef.current) {
                clearTimeout(backendRetryTimerRef.current);
                backendRetryTimerRef.current = null;
            }
            // Reset polling flag ONLY if the component is truly unmounting or we want to allow a restart
            // Actually, for safety, let's keep the flag true so a re-run doesn't start a sibling loop.
        };
    }, [loadRealJobs]); // Only depends on the function stabilize, not transient state like isLoadingJobs

    // SEO Update Effect
    useEffect(() => {
        const pageName = showCompanyLanding ? 'company-dashboard' :
            viewState === ViewState.LIST ? 'home' :
                viewState === ViewState.PROFILE ? 'profile' :
                    viewState === ViewState.MARKETPLACE ? 'marketplace' :
                        viewState === ViewState.SERVICES ? 'services' :
                            viewState === ViewState.FREELANCER_DASHBOARD ? 'freelancer-dashboard' :
                                viewState === ViewState.SAVED ? 'saved' :
                                    viewState === ViewState.ASSESSMENT ? 'assessment' :
                                        viewState === ViewState.COMPANY_DASHBOARD ? 'company-dashboard' : 'home';

        // Wait until translations are ready to avoid raw keys in browser tab
        if (t('seo.base_title') === 'seo.base_title') return;

        const selectedBlogPost = initialBlogPosts.find(p => p.slug === selectedBlogPostSlug);
        const metadata = generateSEOMetadata(
            selectedBlogPostSlug ? 'blog-post' : pageName,
            t,
            selectedBlogPostSlug ? selectedBlogPost : selectedJob
        );
        updatePageMeta(metadata);
    }, [viewState, showCompanyLanding, selectedJob, selectedBlogPostSlug, userProfile, i18n.language, t]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        }
    }, [theme]);

    // Handle Logic when a Job is Selected
    useEffect(() => {
        setAiAnalysis(null);
        setCommuteAnalysis(null);
        setIsApplyModalOpen(false);

        // Always attempt commute calc if we have a job
        if (selectedJob) {
            // Commute Logic
            if (userProfile.isLoggedIn && userProfile.address) {
                const analysis = calculateCommuteReality(selectedJob, userProfile);
                setCommuteAnalysis(analysis);
            } else {
                setCommuteAnalysis(null);
            }



            // Salary Estimation Logic - Disabled for pagination compatibility
            // TODO: Implement in paginated version
        }
    }, [selectedJobId, userProfile]);

    // Career Pathfinder Analysis - Trigger when job is selected
    useEffect(() => {
        if (selectedJob && userProfile?.isLoggedIn) {
            handlePathfinderAnalysis(selectedJob);
        } else {
            setPathfinderAnalysis(null);
        }
    }, [selectedJob?.id, userProfile?.isLoggedIn]);

    // Check cookie consent
    useEffect(() => {
        const hasConsent = checkCookieConsent();
        setShowCookieBanner(!hasConsent);

        // Initialize analytics with current consent
        if (hasConsent) {
            const preferences = getCookiePreferences();
            if (preferences?.analytics) {
                // Analytics can be initialized
                console.log('Analytics consent granted');
            }
        }
    }, []);




    // --- HANDLERS ---

    const handleAuthAction = async () => {
        if (userProfile.isLoggedIn && userProfile.id) {
            await signOut();
        } else {
            setIsAuthModalOpen(true);
        }
    };

    const handleProfileUpdate = async (updatedProfile: UserProfile, persist: boolean = false) => {
        try {
            setUserProfile(updatedProfile);

            // Auto-enable commute filter if address is added and filter wasn't on (only once)
            if (updatedProfile.address && !enableCommuteFilter && !hasAutoEnabledCommuteFilter.current) {
                console.log('🏠 Profile updated locally with address, auto-enabling commute filter');
                setEnableCommuteFilter(true);
                setFilterMaxDistance(50);
                hasAutoEnabledCommuteFilter.current = true;
            }

            // ONLY persist if explicitly requested (e.g., CV/Photo upload)
            if (persist && updatedProfile.id) {
                console.log("💾 Persisting profile changes immediately...");
                await updateUserProfile(updatedProfile.id, updatedProfile);

                // Refetch to sync (only on explicit persistence)
                const { getUserProfile: fetchUpdated } = await import('./services/supabaseService');
                const fresh = await fetchUpdated(updatedProfile.id);
                if (fresh) {
                    setUserProfile(fresh);
                }
            }
        } catch (error) {
            console.error("Failed to update profile locally:", error);
        }
    };

    const handleProfileSave = async () => {
        if (!userProfile.id) return;

        try {
            console.log("💾 Explicitly saving profile to Supabase...");
            await updateUserProfile(userProfile.id, userProfile);
            console.log("✅ Profile saved successfully");

            // 🔄 Refetch profile to get updated coordinates from DB calculated by triggers or service logic
            console.log("🔄 Refetching profile to sync coordinates...");
            const { getUserProfile: fetchUpdated } = await import('./services/supabaseService');
            const freshProfile = await fetchUpdated(userProfile.id);
            if (freshProfile) {
                setUserProfile(freshProfile);
                console.log("✅ Profile refetched. New coordinates:", freshProfile.coordinates);
            }

            // Alert user success
            // Note: We could use a toast here if we had one

        } catch (error) {
            console.error("Failed to save profile:", error);
            alert("Nepodařilo se uložit profil. Zkuste to znovu.");
        }
    };

    const handleCompanyOnboardingComplete = (company: CompanyProfile) => {
        setCompanyProfile(company);
        setIsOnboardingCompany(false);
        setViewState(ViewState.COMPANY_DASHBOARD);
    };

    const handleToggleSave = (jobId: string) => {
        setSavedJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
    };

    const handleOpenJobDetailsFromSwipe = (jobId: string) => {
        handleJobSelect(jobId);
        setOpenedFromSwipe(true);
        setIsMobileSwipeView(false);
    };

    const handleApplyToJob = (job: Job) => {
        handleJobSelect(job.id);
        if (job.source !== 'jobshaman.cz' && job.url) {
            window.open(job.url, '_blank', 'noopener,noreferrer');
            return;
        }
        setIsApplyModalOpen(true);
    };

    const handleJobSelect = (jobId: string | null) => {
        setSelectedJobId(jobId);
        setSelectedBlogPostSlug(null); // Clear blog post when job selected

        if (!jobId) {
            setDirectlyFetchedJob(null);
            if (openedFromSwipe && viewState === ViewState.LIST) {
                setIsMobileSwipeView(true);
                setOpenedFromSwipe(false);
            }
        }

        // Scroll ONLY the right column using setTimeout to ensure DOM is ready
        setTimeout(() => {
            if (detailScrollRef.current) {
                // Force immediate scroll to top with no animation
                detailScrollRef.current.scrollTop = 0;
                console.log('✅ Right column scrolled to top');
            }
        }, 0); // Use 0 timeout to run after current execution stack
    };

    const handleBlogPostSelect = (slug: string | null) => {
        setSelectedBlogPostSlug(slug);
        setSelectedJobId(null); // Clear job when blog selected

        // Scroll to top
        setTimeout(() => {
            if (detailScrollRef.current) {
                detailScrollRef.current.scrollTop = 0;
            }
        }, 0);
    };

    const [showPremiumUpgrade, setShowPremiumUpgrade] = useState<{ open: boolean, feature?: string }>({ open: false });

    const handleAnalyzeJob = async () => {
        if (!selectedJob) return;

        // Feature Gating
        if (!canCandidateUseFeature(userProfile, 'AI_JOB_ANALYSIS')) {
            setShowPremiumUpgrade({ open: true, feature: 'AI analýza pracovních inzerátů' });
            return;
        }

        setAnalyzing(true);
        try {
            // Pass job ID and any existing cached analysis to the service
            const result = await analyzeJobDescription(
                selectedJob.description,
                String(selectedJob.id),
                selectedJob.aiAnalysis
            );
            setAiAnalysis(result);
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };



    const handlePathfinderAnalysis = async (job: Job) => {
        if (!userProfile) {
            alert('Pro analýzu Career Pathfinder se musíte nejprve přihlásit a vyplnit profil.');
            return;
        }

        setPathfinderAnalysis({
            financialReality: null,
            skillsGapAnalysis: null,
            hasAssessment: false,
            isLoading: true,
            error: null
        });

        try {
            const result = await analyzeJobForPathfinder(job, userProfile);
            setPathfinderAnalysis(result);
        } catch (e) {
            console.error('Pathfinder analysis failed:', e);
            setPathfinderAnalysis({
                financialReality: null,
                skillsGapAnalysis: null,
                hasAssessment: false,
                isLoading: false,
                error: e instanceof Error ? e.message : 'Analýza selhala'
            });
        }
    };



    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section as keyof typeof prev] }));
    };

    const getTransportIcon = (mode: string) => {
        switch (mode) {
            case 'car': return Car;
            case 'bike': return Bike;
            case 'walk': return Footprints;
            default: return Bus;
        }
    };

    const renderContent = () => {
        // Handle static pages based on pathname
        const pathname = window.location.pathname;
        if (pathname.startsWith('/assessment/')) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <InvitationLanding />
                </div>
            );
        }
        if (pathname === '/podminky-uziti') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <PodminkyUziti />
                </div>
            );
        }

        if (pathname === '/enterprise') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <EnterpriseSignup />
                </div>
            );
        }

        if (pathname === '/ochrana-osobnich-udaju') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <OchranaSoukromi />
                </div>
            );
        }

        if (showCompanyLanding) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <CompanyLandingPage
                        onRegister={() => setIsCompanyRegistrationOpen(true)}
                        onRequestDemo={() => alert(t('app.demo_alert'))}
                        onLogin={handleAuthAction}
                    />
                </div>
            );
        }

        if (viewState === ViewState.COMPANY_DASHBOARD) {
            if (!companyProfile && userProfile.role === 'recruiter') {
                // If recruiter somehow got here without a profile, show onboarding
                setIsOnboardingCompany(true);
                return null;
            }

            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <CompanyDashboard
                        companyProfile={companyProfile}
                        userEmail={userProfile.email}
                        onDeleteAccount={deleteAccount}
                        onProfileUpdate={setCompanyProfile}
                    />
                </div>
            );
        }

        if (viewState === ViewState.FREELANCER_DASHBOARD) {
            if (!companyProfile) {
                return (
                    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                        <div className="max-w-xl mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                {t('freelancer.dashboard.register_title') || 'Staňte se freelancerem'}
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                {t('freelancer.dashboard.register_desc') || 'Pro vytvoření freelancer profilu je potřeba krátká registrace (IČO a základní údaje).'}
                            </p>
                            <button
                                onClick={() => setIsFreelancerRegistrationOpen(true)}
                                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-colors"
                            >
                                {t('freelancer.dashboard.register_cta') || 'Zaregistrovat se jako freelancer'}
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <FreelancerDashboard
                        userProfile={userProfile}
                        companyProfile={companyProfile}
                        onLogout={signOut}
                    />
                </div>
            );
        }

        if (viewState === ViewState.MARKETPLACE) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <MarketplacePage userProfile={userProfile} />
                </div>
            );
        }

        if (viewState === ViewState.SERVICES) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <ServicesMarketplace userProfile={userProfile} />
                </div>
            );
        }

        if (viewState === ViewState.PROFILE) {
            // STRICT SEPARATION: Recruiters cannot access candidate profile editor
            // Exception: Freelancers (industry=Freelancer) can also manage candidate profile
            if (userProfile.role === 'recruiter' && companyProfile?.industry !== 'Freelancer') {
                // Defer state update to next tick to avoid render-phase update warning
                setTimeout(() => setViewState(ViewState.COMPANY_DASHBOARD), 0);
                return null;
            }

            return (
                <div className="col-span-1 lg:col-span-12 max-w-4xl mx-auto w-full h-full overflow-y-auto custom-scrollbar pb-6 px-1">
                    <ProfileEditor
                        profile={userProfile}
                        onChange={(p, persist) => handleProfileUpdate(p, persist)} // Pass persist flag for immediate saves
                        onSave={handleProfileSave} // Explicit save button
                        onRefreshProfile={refreshUserProfile}
                        onDeleteAccount={deleteAccount}
                        savedJobs={filteredJobs.filter(job => savedJobIds.includes(job.id))}
                        savedJobIds={savedJobIds}
                        onToggleSave={handleToggleSave}
                        onJobSelect={handleJobSelect}
                        onApplyToJob={handleApplyToJob}
                        selectedJobId={selectedJobId}
                    />
                </div>
            );
        }


        if (viewState === ViewState.SAVED) {
            const savedJobs = filteredJobs.filter(job => savedJobIds.includes(job.id));
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                    <SavedJobsPage
                        savedJobs={savedJobs}
                        savedJobIds={savedJobIds}
                        onToggleSave={handleToggleSave}
                        onJobSelect={handleJobSelect}
                        selectedJobId={selectedJobId}
                        userProfile={userProfile}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onApplyToJob={handleApplyToJob}
                    />
                </div>
            );
        }



        const dynamicJHI = selectedJob ? { ...selectedJob.jhi } : null;
        if (dynamicJHI && commuteAnalysis) {
            // Time cost (commute / remote impact)
            dynamicJHI.timeCost = applyTimeCostImpact(
                dynamicJHI.timeCost,
                commuteAnalysis.jhiImpact
            );

            // Financial reality (commute cost, salary adjustments)
            dynamicJHI.financial = clamp(
                dynamicJHI.financial +
                commuteAnalysis.financialReality.scoreAdjustment
            );

            // Benefits → values
            const benefitsValue =
                commuteAnalysis.financialReality.benefitsValue;

            const benefitsBonus = calculateBenefitsBonus(benefitsValue);
            dynamicJHI.values = clamp(dynamicJHI.values + benefitsBonus);

            // Net benefit → growth
            const netBenefitValue =
                benefitsValue -
                commuteAnalysis.financialReality.commuteCost;

            const netBonus = calculateNetBenefitBonus(netBenefitValue);
            dynamicJHI.growth = clamp(dynamicJHI.growth + netBonus);

            // Final score
            dynamicJHI.score = calculateOverallScore(dynamicJHI);
        }

        // Determine what to show in the Financial Card
        const showCommuteDetails =
            userProfile.isLoggedIn &&
            !!userProfile.address &&
            !!commuteAnalysis;

        const showLoginPrompt = !userProfile.isLoggedIn;
        const showAddressPrompt =
            userProfile.isLoggedIn && !userProfile.address;

        return (
            <>
                {/* Vercel Analytics */}
                <Analytics />

                {/* MOBILE SWIPE VIEW - Only show for logged-in users on mobile */}
                {isMobileSwipeView && userProfile.isLoggedIn ? (
                    <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                        <MobileSwipeJobBrowser
                            jobs={filteredJobs}
                            savedJobIds={savedJobIds}
                            onToggleSave={handleToggleSave}
                            onOpenDetails={handleOpenJobDetailsFromSwipe}
                            onSwitchToList={() => {
                                setMobileViewOverride('list');
                                setIsMobileSwipeView(false);
                            }}
                            isLoadingMore={loadingMore}
                            hasMore={hasMore}
                            onLoadMore={loadMoreJobs}
                            theme={theme}
                        />
                    </div>
                ) : (
                    <>
                        {isMobileScreen && userProfile.isLoggedIn && (
                            <div className="lg:hidden px-3 pt-2">
                                <button
                                    onClick={() => {
                                        setMobileViewOverride('swipe');
                                        setIsMobileSwipeView(true);
                                    }}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 text-sm font-semibold shadow-sm hover:bg-white dark:hover:bg-slate-900 transition-colors"
                                >
                                    {t('job.swipe_view') || 'Swipe view'}
                                </button>
                            </div>
                        )}
                        {/* DESKTOP VIEW: LEFT COLUMN: Sidebar (Fixed Filters + Scrollable List) */}
                        <JobListSidebar
                            selectedJobId={selectedJobId}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            performSearch={performSearch}
                            showFilters={showFilters}
                            setShowFilters={setShowFilters}
                            expandedSections={expandedSections}
                            toggleSection={toggleSection}
                            filterCity={filterCity}
                            setFilterCity={setFilterCity}
                            enableCommuteFilter={enableCommuteFilter}
                            setEnableCommuteFilter={setEnableCommuteFilter}
                            filterMaxDistance={filterMaxDistance}
                            setFilterMaxDistance={setFilterMaxDistance}
                            filterContractType={filterContractType}
                            toggleContractTypeFilter={toggleContractTypeFilter}
                            filterDate={filterDate}
                            setFilterDate={setFilterDate}
                            filterMinSalary={filterMinSalary}
                            setFilterMinSalary={setFilterMinSalary}
                            filterExperience={filterExperience}
                            toggleExperienceFilter={toggleExperienceFilter}
                            filterBenefits={filterBenefits}
                            toggleBenefitFilter={toggleBenefitFilter}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            isLoadingJobs={isLoadingJobs}
                            isSearching={isSearching}
                            filteredJobs={filteredJobs}
                            savedJobIds={savedJobIds}
                            handleToggleSave={handleToggleSave}
                            handleJobSelect={handleJobSelect}
                            theme={theme}
                            userProfile={userProfile}
                            jobListRef={jobListRef}
                            loadingMore={loadingMore}
                            hasMore={hasMore}
                            totalCount={totalCount}
                            loadRealJobs={loadRealJobs}
                            backendPolling={backendPolling}
                            globalSearch={globalSearch}
                            setGlobalSearch={setGlobalSearch}
                        />

                        {/* DESKTOP VIEW: RIGHT COLUMN: Detail View (or Welcome Guide) */}
                        <JobDetailView
                            mounted={mounted}
                            selectedJobId={selectedJobId}
                            selectedJob={selectedJob || null}
                            dynamicJHI={dynamicJHI}
                            savedJobIds={savedJobIds}
                            handleToggleSave={handleToggleSave}
                            setSelectedJobId={handleJobSelect}
                            setIsApplyModalOpen={setIsApplyModalOpen}
                            detailScrollRef={detailScrollRef}
                            userProfile={userProfile}
                            commuteAnalysis={commuteAnalysis}
                            showCommuteDetails={showCommuteDetails}
                            showLoginPrompt={showLoginPrompt}
                            showAddressPrompt={showAddressPrompt}
                            handleAuthAction={handleAuthAction}
                            setViewState={setViewState}
                            showFinancialMethodology={showFinancialMethodology}
                            setShowFinancialMethodology={setShowFinancialMethodology}
                            getTransportIcon={getTransportIcon}
                            formatJobDescription={formatJobDescription}
                            theme={theme}
                            pathfinderAnalysis={pathfinderAnalysis}
                            aiAnalysis={aiAnalysis}
                            analyzing={analyzing}
                            handleAnalyzeJob={handleAnalyzeJob}
                            selectedBlogPostSlug={selectedBlogPostSlug}
                            handleBlogPostSelect={handleBlogPostSelect}
                        />
                    </>
                )}
            </>
        );
    };

    return (
        <div className={`flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-900 dark:selection:text-cyan-100`}>
            <AppHeader
                viewState={viewState}
                setViewState={setViewState}
                setSelectedJobId={handleJobSelect}
                showCompanyLanding={showCompanyLanding}
                setShowCompanyLanding={setShowCompanyLanding}
                userProfile={userProfile}
                companyProfile={companyProfile}
                handleAuthAction={handleAuthAction}
                toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                theme={theme}
                setIsOnboardingCompany={setIsOnboardingCompany}
                onIntentionalListClick={() => { userIntentionallyClickedListRef.current = true; }}
            />

            <main className="flex-1 max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
                    {renderContent()}
                </div>
            </main>

            <PremiumUpgradeModal
                show={{ open: showPremiumUpgrade.open, feature: showPremiumUpgrade.feature }}
                onClose={() => setShowPremiumUpgrade({ open: false })}
                userProfile={userProfile}
                onAuth={() => setIsAuthModalOpen(true)}
            />

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={() => setIsAuthModalOpen(false)}
            />

            <CompanyRegistrationModal
                isOpen={isCompanyRegistrationOpen}
                onClose={() => setIsCompanyRegistrationOpen(false)}
                onSuccess={() => {
                    setIsCompanyRegistrationOpen(false);
                    console.log('Company registration successful');
                }}
            />

            <FreelancerRegistrationModal
                isOpen={isFreelancerRegistrationOpen}
                onClose={() => setIsFreelancerRegistrationOpen(false)}
                onSuccess={() => {
                    setIsFreelancerRegistrationOpen(false);
                    window.location.reload();
                }}
            />

            {isOnboardingCompany && userProfile.id && (
                <CompanyOnboarding
                    userId={userProfile.id}
                    onComplete={handleCompanyOnboardingComplete}
                    onCancel={() => {
                        setIsOnboardingCompany(false);
                        setViewState(ViewState.LIST);
                    }}
                />
            )}

            {selectedJob && (
                <ApplicationModal
                    isOpen={isApplyModalOpen}
                    onClose={() => setIsApplyModalOpen(false)}
                    job={selectedJob}
                    user={userProfile}
                />
            )}

            {/* Cookie Banner - Only show when needed */}
            {showCookieBanner && (
                <CookieBanner
                    theme={theme}
                    onAccept={(preferences: any) => {
                        console.log('Cookie preferences accepted:', preferences);
                        setShowCookieBanner(false);
                    }}
                    onCustomize={() => {
                        console.log('Customize cookie preferences');
                        setShowCookieBanner(false);
                    }}
                />
            )}

            <AppFooter />
        </div>
    );
}
