import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile } from './types';

import { Analytics } from '@vercel/analytics/react';
import { initialBlogPosts } from './src/data/blogPosts';
import AppHeader from './components/AppHeader';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';
import CompanyOnboarding from './components/CompanyOnboarding';
import AuthModal from './components/AuthModal';
import CandidateOnboardingModal from './components/CandidateOnboardingModal';
import ApplyFollowupModal from './components/ApplyFollowupModal';
import CompanyRegistrationModal from './components/CompanyRegistrationModal';
import FreelancerRegistrationModal from './components/FreelancerRegistrationModal';
import CourseProviderRegistrationModal from './components/CourseProviderRegistrationModal';
import EnterpriseSignup from './components/EnterpriseSignup';
import ApplicationModal from './components/ApplicationModal';
import CookieBanner from './components/CookieBanner';
import PodminkyUziti from './pages/PodminkyUziti';
import OchranaSoukromi from './pages/OchranaSoukromi';
import JobListSidebar from './components/JobListSidebar';
import PremiumUpgradeModal from './components/PremiumUpgradeModal';
import { analyzeJobDescription } from './services/geminiService';
import { calculateCommuteReality } from './services/commuteService';
import { fetchJobById } from './services/jobService';
import { clearJobCache } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile, verifyAuthSession } from './services/supabaseService';
import { verifyServerSideBilling } from './services/serverSideBillingService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { checkPaymentStatus } from './services/stripeService';
import { clearCsrfToken } from './services/csrfService';
import { trackPageView } from './services/trafficAnalytics';
import { trackJobInteraction } from './services/jobInteractionService';
import { sendWelcomeEmail } from './services/welcomeEmailService';
import { useUserProfile } from './hooks/useUserProfile';
import { usePaginatedJobs } from './hooks/usePaginatedJobs';
import { BACKEND_URL, DEFAULT_USER_PROFILE, SEARCH_BACKEND_URL } from './constants';
import {
    clamp,
    applyTimeCostImpact,
    calculateBenefitsBonus,
    calculateNetBenefitBonus,
    calculateOverallScore
} from './utils/jhi';
import { calculateJHI } from './utils/jhiCalculator';
import { formatJobDescription } from './utils/formatters';
import {
    Car,
    Bus,
    Bike,
    Footprints,
    AlertCircle
} from 'lucide-react';

type PendingApplyFollowup = {
    jobId: number;
    title?: string;
    company?: string;
    url?: string;
    openedAt: string;
    sessionId?: string;
    requestId?: string;
    scoringVersion?: string;
    modelVersion?: string;
    snoozeUntil?: number;
};

const APPLY_FOLLOWUP_STORAGE_KEY = 'jobshaman_apply_followup';
const EMAIL_CONFIRMATION_STORAGE_KEY = 'jobshaman_email_confirmation_pending';

const CompanyDashboard = lazy(() => import('./components/CompanyDashboard'));
const CourseProviderDashboard = lazy(() => import('./components/CourseProviderDashboard'));
const ProfileEditor = lazy(() => import('./components/ProfileEditor'));
const ServicesMarketplace = lazy(() => import('./components/ServicesMarketplace'));
const CompanyLandingPage = lazy(() => import('./components/CompanyLandingPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SavedJobsPage = lazy(() => import('./components/SavedJobsPage'));
const JobDetailView = lazy(() => import('./components/JobDetailView'));
const MobileSwipeJobBrowser = lazy(() => import('./components/MobileSwipeJobBrowser'));
const InvitationLanding = lazy(() => import('./pages/InvitationLanding'));

// JHI and formatting utilities now imported from utils/

export default function App() {
    const { t, i18n } = useTranslation();
    const vercelAnalyticsEnabled = import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';
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

    // Cookie Consent State
    const [showCookieBanner, setShowCookieBanner] = useState(false);

    const shouldBypassCookieBanner = () => {
        const params = new URLSearchParams(window.location.search);
        const cookieBanner = params.get('cookieBanner') || params.get('cookie_banner');
        if (cookieBanner) {
            const value = cookieBanner.toLowerCase();
            return value === '0' || value === 'false' || value === 'off';
        }
        const noCookies = params.get('noCookies') || params.get('no_cookies');
        if (noCookies) {
            const value = noCookies.toLowerCase();
            return value === '1' || value === 'true' || value === 'on';
        }
        return false;
    };

    // Track if we've already auto-enabled commute filter to avoid re-enabling after user disables it
    const hasAutoEnabledCommuteFilter = useRef(false);
    const deferredAutoEnableRef = useRef(false);

    // Track if user intentionally clicked on LIST (to prevent NavRestore from auto-restoring dashboard)
    const userIntentionallyClickedListRef = useRef(false);

    // UI State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [showCandidateOnboarding, setShowCandidateOnboarding] = useState(false);
    const [applyFollowup, setApplyFollowup] = useState<PendingApplyFollowup | null>(null);
    const [showApplyFollowup, setShowApplyFollowup] = useState(false);
    const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState<{ email?: string } | null>(null);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [isFreelancerRegistrationOpen, setIsFreelancerRegistrationOpen] = useState(false);
    const [isCourseProviderRegistrationOpen, setIsCourseProviderRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);
    const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
    const [showFinancialMethodology, setShowFinancialMethodology] = useState(false);
    const [isMobileSwipeView, setIsMobileSwipeView] = useState(false);
    const [isMobileScreen, setIsMobileScreen] = useState(false);
    const [mobileViewOverride, setMobileViewOverride] = useState<'swipe' | 'list' | null>(null);
    const [openedFromSwipe, setOpenedFromSwipe] = useState(false);

    const onboardingDismissedRef = useRef(false);
    const welcomeEmailAttemptedRef = useRef(false);


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

    const onboardingStorageKey = useMemo(() => {
        return userProfile.id ? `jobshaman_candidate_onboarding_seen:${userProfile.id}` : null;
    }, [userProfile.id]);

    const loadPendingEmailConfirmation = useCallback((): { email?: string } | null => {
        try {
            const raw = localStorage.getItem(EMAIL_CONFIRMATION_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed) return null;
            return parsed as { email?: string };
        } catch (error) {
            console.warn('Failed to read email confirmation storage:', error);
            return null;
        }
    }, []);

    const clearPendingEmailConfirmation = useCallback(() => {
        try {
            localStorage.removeItem(EMAIL_CONFIRMATION_STORAGE_KEY);
        } catch (error) {
            console.warn('Failed to clear email confirmation storage:', error);
        }
        setPendingEmailConfirmation(null);
    }, []);

    const markCandidateOnboardingSeen = useCallback(() => {
        onboardingDismissedRef.current = true;
        if (!onboardingStorageKey) return;
        try {
            localStorage.setItem(onboardingStorageKey, 'true');
        } catch (error) {
            console.warn('Failed to persist onboarding flag:', error);
        }
    }, [onboardingStorageKey]);

    const hasSeenCandidateOnboarding = useCallback(() => {
        if (!onboardingStorageKey) return false;
        try {
            return localStorage.getItem(onboardingStorageKey) === 'true';
        } catch (error) {
            console.warn('Failed to read onboarding flag:', error);
            return false;
        }
    }, [onboardingStorageKey]);

    useEffect(() => {
        // Only keep onboarding modal open when explicitly requested and still applicable
        if (isOnboardingCompany) {
            if (userProfile.role !== 'recruiter' || companyProfile) {
                setIsOnboardingCompany(false);
            }
        }
    }, [isOnboardingCompany, userProfile.role, companyProfile?.id]);

    useEffect(() => {
        const syncPending = () => {
            setPendingEmailConfirmation(loadPendingEmailConfirmation());
        };
        syncPending();
        const handleEvent = () => syncPending();
        window.addEventListener('jobshaman:email-confirmation', handleEvent);
        return () => {
            window.removeEventListener('jobshaman:email-confirmation', handleEvent);
        };
    }, [loadPendingEmailConfirmation]);

    useEffect(() => {
        if (userProfile.isLoggedIn) {
            clearPendingEmailConfirmation();
        }
    }, [userProfile.isLoggedIn, clearPendingEmailConfirmation]);

    const loadPendingApplyFollowup = useCallback((): PendingApplyFollowup | null => {
        try {
            const raw = localStorage.getItem(APPLY_FOLLOWUP_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.jobId) return null;
            return parsed as PendingApplyFollowup;
        } catch (error) {
            console.warn('Failed to read apply follow-up storage:', error);
            return null;
        }
    }, []);

    const savePendingApplyFollowup = useCallback((payload: PendingApplyFollowup) => {
        try {
            localStorage.setItem(APPLY_FOLLOWUP_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save apply follow-up storage:', error);
        }
    }, []);

    const clearPendingApplyFollowup = useCallback(() => {
        try {
            localStorage.removeItem(APPLY_FOLLOWUP_STORAGE_KEY);
        } catch (error) {
            console.warn('Failed to clear apply follow-up storage:', error);
        }
    }, []);

    useEffect(() => {
        if (!userProfile.isLoggedIn) {
            onboardingDismissedRef.current = false;
            if (showCandidateOnboarding) {
                setShowCandidateOnboarding(false);
            }
            setPendingEmailConfirmation(loadPendingEmailConfirmation());
            return;
        }

        if (userProfile.role === 'recruiter') {
            if (showCandidateOnboarding) {
                setShowCandidateOnboarding(false);
            }
            return;
        }

        const missingLocation = !userProfile.address && !userProfile.coordinates;
        const missingCv = !userProfile.cvUrl && !userProfile.cvText;
        const alreadySeen = hasSeenCandidateOnboarding();
        const shouldShow = (missingLocation || missingCv) && !onboardingDismissedRef.current && !alreadySeen;

        if (shouldShow) {
            setShowCandidateOnboarding(true);
        } else if (!missingLocation && !missingCv) {
            setShowCandidateOnboarding(false);
        }
    }, [
        userProfile.isLoggedIn,
        userProfile.role,
        userProfile.address,
        userProfile.coordinates,
        userProfile.cvUrl,
        userProfile.cvText,
        showCandidateOnboarding,
        loadPendingEmailConfirmation
    ]);

    useEffect(() => {
        const minDelayMs = 5000;

        const checkPending = () => {
            if (showApplyFollowup) return;
            const pending = loadPendingApplyFollowup();
            if (!pending) return;

            if (pending.snoozeUntil && Date.now() < pending.snoozeUntil) {
                return;
            }

            const openedAtMs = pending.openedAt ? new Date(pending.openedAt).getTime() : 0;
            if (openedAtMs && Date.now() - openedAtMs < minDelayMs) {
                return;
            }

            setApplyFollowup(pending);
            setShowApplyFollowup(true);
        };

        const handleFocus = () => {
            if (document.visibilityState === 'hidden') return;
            checkPending();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);
        checkPending();

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
        };
    }, [loadPendingApplyFollowup, showApplyFollowup]);

    const isCompanyProfile = userProfile.role === 'recruiter' && !!companyProfile && companyProfile.industry !== 'Freelancer';
    const companyCoordinates = (companyProfile?.lat != null && companyProfile?.lng != null)
        ? { lat: Number(companyProfile.lat), lon: Number(companyProfile.lng) }
        : undefined;

    const effectiveUserProfile = useMemo(() => {
        if (isCompanyProfile && viewState === ViewState.LIST && companyProfile?.address && companyCoordinates) {
            return {
                ...userProfile,
                address: companyProfile.address,
                coordinates: companyCoordinates
            };
        }
        return userProfile;
    }, [userProfile, isCompanyProfile, viewState, companyProfile?.address, companyCoordinates?.lat, companyCoordinates?.lon]);

    const {
        jobs: filteredJobs,
        loading: isLoadingJobs,
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
        filterLanguage,
        savedJobIds,
        showFilters,
        expandedSections,
        setSearchTerm,
        setFilterCity,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterDate,
        setFilterMinSalary,
        setFilterLanguage,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        toggleExperienceFilter,
        globalSearch,
        abroadOnly,
        setGlobalSearch,
        setAbroadOnly,
        sortBy,
        setSortBy
    } = usePaginatedJobs({ userProfile: effectiveUserProfile });

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

    const jobsForDisplay = useMemo(() => {
        const personalized = filteredJobs.map((job) => ({
            ...job,
            jhi: calculateJHI({
                salary_from: job.salary_from,
                salary_to: job.salary_to,
                type: job.type,
                benefits: job.benefits,
                description: job.description,
                location: job.location,
                distanceKm: job.distanceKm
            }, 0, effectiveUserProfile.jhiPreferences)
        }));
        if (sortBy === 'personalized_jhi_desc') {
            return personalized.sort((a, b) => (b.jhi.personalizedScore || b.jhi.score) - (a.jhi.personalizedScore || a.jhi.score));
        }
        return personalized;
    }, [filteredJobs, sortBy, effectiveUserProfile.jhiPreferences]);

    const selectedJob = jobsForDisplay.find(j => j.id === selectedJobId) || directlyFetchedJob;

    // --- EFFECTS ---

    // Prevent invalid dashboard routing when role/profile context doesn't match.
    useEffect(() => {
        if (viewState !== ViewState.COMPANY_DASHBOARD) return;

        if (!userProfile.isLoggedIn) {
            setViewState(ViewState.LIST);
            return;
        }

        if (userProfile.role !== 'recruiter') {
            setViewState(ViewState.PROFILE);
            return;
        }

        if (!companyProfile) {
            setViewState(ViewState.PROFILE);
            return;
        }

        if (companyProfile.industry === 'Freelancer') {
            setViewState(ViewState.PROFILE);
            return;
        }

        if (companyProfile.industry === 'Education') {
            setViewState(ViewState.COURSE_PROVIDER_DASHBOARD);
        }
    }, [viewState, userProfile.isLoggedIn, userProfile.role, companyProfile?.id, companyProfile?.industry, setViewState]);

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

    useEffect(() => {
        if (!userProfile.isLoggedIn || !userProfile.id) {
            welcomeEmailAttemptedRef.current = false;
            return;
        }
        if (userProfile.welcomeEmailSent) {
            return;
        }
        if (welcomeEmailAttemptedRef.current) {
            return;
        }

        welcomeEmailAttemptedRef.current = true;
        const locale = (i18n.resolvedLanguage || i18n.language || 'cs').toLowerCase();
        const appUrl = window.location.origin;

        (async () => {
            try {
                const ok = await sendWelcomeEmail(locale, appUrl);
                if (ok) {
                    await refreshUserProfile();
                } else {
                    welcomeEmailAttemptedRef.current = false;
                }
            } catch (error) {
                console.warn('Welcome email flow failed:', error);
                welcomeEmailAttemptedRef.current = false;
            }
        })();
    }, [userProfile.isLoggedIn, userProfile.id, userProfile.welcomeEmailSent, i18n.language]);

    const loadRealJobs = useCallback(async () => {
        try {
            await loadInitialJobs();
        } catch (e) {
            console.error("Failed to load jobs", e);
        }
    }, [loadInitialJobs]);

    // Infinite scroll detection
    const jobListRef = useRef<HTMLDivElement>(null);
    const detailScrollRef = useRef<HTMLDivElement>(null);
    const searchSessionIdRef = useRef(`list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

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
        // Job loading is driven by usePaginatedJobs; avoid forcing parallel initial reload here.
        const paymentStatus = checkPaymentStatus();
        if (paymentStatus === 'success') {
            refreshUserProfile();
        }

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
                    // Restore on explicit sign-in and OAuth returns (INITIAL_SESSION)
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                        // Ensure auth modal doesn't block onboarding/dashboard
                        setIsAuthModalOpen(false);
                        if (!userProfile.isLoggedIn) {
                            handleSessionRestoration(session.user.id);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log('👤 [App] User signed out, clearing state.');
                    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
                    setViewState(ViewState.LIST);
                    setCompanyProfile(null);
                    onboardingDismissedRef.current = false;
                    setShowCandidateOnboarding(false);
                    clearPendingApplyFollowup();
                    setApplyFollowup(null);
                    setShowApplyFollowup(false);
                    welcomeEmailAttemptedRef.current = false;
                    clearPendingEmailConfirmation();
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
                setViewState(ViewState.LIST);
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
                setViewState(ViewState.PROFILE);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'course-provider-dashboard') {
                setViewState(ViewState.COURSE_PROVIDER_DASHBOARD);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'company-dashboard' || parts[0] === 'dashboard') {
                setViewState(ViewState.COMPANY_DASHBOARD);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'digest') {
                setViewState(ViewState.LIST);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            }

            return () => subscription.unsubscribe();
        }
    }, []);

    // RESTORE DASHBOARD VIEW STATE when navigating back to home (selectedJobId becomes null)
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

                if (companyProfile?.industry === 'Education') {
                    setViewState(ViewState.COURSE_PROVIDER_DASHBOARD);
                    console.log("✅ Restored COURSE_PROVIDER_DASHBOARD after returning from job detail");
                } else if (companyProfile?.industry === 'Freelancer') {
                    setViewState(ViewState.PROFILE);
                    console.log("✅ Restored PROFILE after returning from job detail (freelancer dashboard disabled)");
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
                || base === 'assessment'
                || base === 'admin'
                || base === 'digest';
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
                targetPath = `/${lng}/`;
            } else if (viewState === ViewState.SERVICES) {
                targetPath = `/${lng}/sluzby`;
            } else if (viewState === ViewState.SAVED) {
                targetPath = `/${lng}/ulozene`;
            } else if (viewState === ViewState.ASSESSMENT) {
                targetPath = `/${lng}/assessment-centrum`;
            } else if (viewState === ViewState.PROFILE) {
                targetPath = `/${lng}/profil`;
            } else if (viewState === ViewState.FREELANCER_DASHBOARD) {
                targetPath = `/${lng}/profil`;
            } else if (viewState === ViewState.COURSE_PROVIDER_DASHBOARD) {
                targetPath = `/${lng}/course-provider-dashboard`;
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

    const lastTrackedPathRef = useRef<string | null>(null);
    useEffect(() => {
        try {
            const path = window.location.pathname + (window.location.search || '');
            if (lastTrackedPathRef.current === path) return;
            lastTrackedPathRef.current = path;

            trackPageView({
                path: window.location.pathname,
                title: document.title,
                viewState,
                jobId: selectedJobId,
                blogSlug: selectedBlogPostSlug,
                locale: i18n.language,
                companyId: companyProfile?.id || null
            });
        } catch (err) {
            console.warn('Page view tracking failed:', err);
        }
    }, [selectedJobId, selectedBlogPostSlug, showCompanyLanding, viewState, i18n.language, companyProfile?.id]);

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

    const reloadLockRef = useRef(false);

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
        if (effectiveUserProfile.coordinates && !enableCommuteFilter && !hasAutoEnabledCommuteFilter.current) {
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
    }, [effectiveUserProfile.coordinates, isCompanyProfile]);

    // If we queued auto-enable because jobs weren't loaded yet, enable when jobs arrive
    useEffect(() => {
        if (deferredAutoEnableRef.current && filteredJobs && filteredJobs.length > 0 && !hasAutoEnabledCommuteFilter.current) {
            console.log('🏠 Jobs loaded — applying deferred auto-enable of commute filter');
            setEnableCommuteFilter(true);
            setFilterMaxDistance(50);
            hasAutoEnabledCommuteFilter.current = true;
            deferredAutoEnableRef.current = false;
        }
    }, [filteredJobs?.length, isCompanyProfile]);

    // Company profiles: if no coordinates, disable commute filter to avoid empty results
    useEffect(() => {
        if (isCompanyProfile && viewState === ViewState.LIST && !companyCoordinates && enableCommuteFilter) {
            setEnableCommuteFilter(false);
            deferredAutoEnableRef.current = false;
            hasAutoEnabledCommuteFilter.current = false;
        }
    }, [isCompanyProfile, viewState, companyCoordinates?.lat, companyCoordinates?.lon, enableCommuteFilter]);

    // Keep cache coherent when coordinates become available, but do not force another manual reload.
    useEffect(() => {
        if (!userProfile.coordinates?.lat || !userProfile.coordinates?.lon) return;
        if (reloadLockRef.current) return;
        reloadLockRef.current = true;
        Promise.resolve(clearJobCache())
            .catch((e) => console.error('Error during coordinate-triggered cache clear:', e))
            .finally(() => {
                reloadLockRef.current = false;
            });
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
    const loadRealJobsRef = useRef(loadRealJobs);
    useEffect(() => { loadRealJobsRef.current = loadRealJobs; }, [loadRealJobs]);
    const hasDedicatedSearchBackend = useMemo(() => {
        const normalizeOrigin = (value: string): string => {
            try {
                const raw = String(value || '').trim();
                if (!raw) return '';
                const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                return new URL(withProtocol).origin;
            } catch {
                return String(value || '').trim();
            }
        };
        const searchOrigin = normalizeOrigin(SEARCH_BACKEND_URL || '');
        const coreOrigin = normalizeOrigin(BACKEND_URL || '');
        return !!searchOrigin && (!coreOrigin || searchOrigin !== coreOrigin);
    }, []);

    useEffect(() => {
        // With dedicated always-on search backend, polling Render wake-ups only creates noisy duplicate reloads.
        if (hasDedicatedSearchBackend) {
            backendWakeRetryRef.current = false;
            setBackendPolling(false);
            if (backendRetryTimerRef.current) {
                clearTimeout(backendRetryTimerRef.current);
                backendRetryTimerRef.current = null;
            }
            return;
        }

        // Guard: don't start if already polling, loading, or jobs are already present.
        if (backendWakeRetryRef.current || isLoadingJobs || filteredJobsRef.current.length > 0) {
            return;
        }

        console.log('Backend wake retry: starting polling to wait for backend wake-up');
        backendWakeRetryRef.current = true;
        setBackendPolling(true);
        backendRetryCountRef.current = 0;

        const runPoll = async () => {
            if (!backendWakeRetryRef.current) return;

            backendRetryCountRef.current += 1;
            console.log(`Backend wake retry: attempt ${backendRetryCountRef.current}/${BACKEND_RETRY_MAX}`);

            try {
                await loadRealJobsRef.current();
            } catch (e) {
                console.error('Backend wake retry: loadRealJobs error', e);
            }

            if (filteredJobsRef.current.length > 0) {
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

            backendRetryTimerRef.current = window.setTimeout(runPoll, BACKEND_RETRY_DELAY_MS);
        };

        runPoll();

        return () => {
            backendWakeRetryRef.current = false;
            setBackendPolling(false);
            if (backendRetryTimerRef.current) {
                clearTimeout(backendRetryTimerRef.current);
                backendRetryTimerRef.current = null;
            }
        };
    }, [hasDedicatedSearchBackend, isLoadingJobs, filteredJobs.length]);

    // SEO Update Effect
    useEffect(() => {
        const pageName = showCompanyLanding ? 'company-dashboard' :
                    viewState === ViewState.LIST ? 'home' :
                        viewState === ViewState.PROFILE ? 'profile' :
                            viewState === ViewState.MARKETPLACE ? 'home' :
                                viewState === ViewState.SERVICES ? 'services' :
                            viewState === ViewState.FREELANCER_DASHBOARD ? 'profile' :
                                viewState === ViewState.COURSE_PROVIDER_DASHBOARD ? 'course-provider-dashboard' :
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
            if (userProfile.address || userProfile.coordinates) {
                const commuteProfile = userProfile.address
                    ? userProfile
                    : {
                        ...userProfile,
                        address: t('financial.current_location_label', { defaultValue: 'Aktuální poloha' }) as string
                    };
                const analysis = calculateCommuteReality(selectedJob, commuteProfile);
                setCommuteAnalysis(analysis);
            } else {
                setCommuteAnalysis(null);
            }



            // Salary Estimation Logic - Disabled for pagination compatibility
            // TODO: Implement in paginated version
        }
    }, [selectedJobId, userProfile]);

    // Wake backend early to reduce cold start latency
    useEffect(() => {
        let didCancel = false;
        const wakeBackend = async () => {
            try {
                await fetch(`${BACKEND_URL}/healthz`, { method: 'GET' });
            } catch (err) {
                if (!didCancel) {
                    console.warn('Backend wake failed:', err);
                }
            }
        };
        wakeBackend();
        return () => {
            didCancel = true;
        };
    }, []);

    // Check cookie consent
    useEffect(() => {
        if (shouldBypassCookieBanner()) {
            setShowCookieBanner(false);
            return;
        }
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

    const handleAuthAction = async (mode: 'login' | 'register' = 'login') => {
        if (userProfile.isLoggedIn && userProfile.id) {
            await signOut();
        } else {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
        }
    };

    const handleProfileUpdate = async (updatedProfile: UserProfile, persist: boolean = false) => {
        try {
            setUserProfile(updatedProfile);

            // Auto-enable commute filter if address is added and filter wasn't on (only once)
            if ((updatedProfile.address || updatedProfile.coordinates) && !enableCommuteFilter && !hasAutoEnabledCommuteFilter.current) {
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
                const fresh = await getUserProfile(updatedProfile.id);
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
            const freshProfile = await getUserProfile(userProfile.id);
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

    const handleUseCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            alert('Geolokace není v tomto prohlížeči dostupná.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                setUserProfile({
                    ...userProfile,
                    coordinates: coords,
                    address: userProfile.address || (t('financial.current_location_label', { defaultValue: 'Aktuální poloha' }) as string)
                });
                setEnableCommuteFilter(true);
                setFilterMaxDistance(50);
                hasAutoEnabledCommuteFilter.current = true;
                deferredAutoEnableRef.current = false;
            },
            (error) => {
                console.warn('Geolocation failed:', error);
                alert('Nepodařilo se získat polohu. Zkontrolujte prosím oprávnění prohlížeče.');
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
        );
    }, [userProfile, setUserProfile, setEnableCommuteFilter, setFilterMaxDistance, t]);

    const handleCompanyOnboardingComplete = (company: CompanyProfile) => {
        setCompanyProfile(company);
        setIsOnboardingCompany(false);
        setViewState(ViewState.COMPANY_DASHBOARD);
    };

    const handleToggleSave = (jobId: string) => {
        const isAlreadySaved = savedJobIds.includes(jobId);
        const job = jobsForDisplay.find((j) => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);
        const requestId = (job as any)?.requestId || (job as any)?.aiRecommendationRequestId;
        const scoringVersion = (job as any)?.aiMatchScoringVersion;
        const modelVersion = (job as any)?.aiMatchModelVersion;
        trackJobInteraction({
            jobId,
            eventType: isAlreadySaved ? 'unsave' : 'save',
            sessionId: searchSessionIdRef.current,
            requestId,
            scoringVersion,
            modelVersion,
            signalValue: isAlreadySaved ? 0 : 1,
            metadata: {
                source: 'desktop_list',
                position: (job as any)?.rankPosition || (job as any)?.aiRecommendationPosition
            }
        });
        setSavedJobIds(prev => isAlreadySaved ? prev.filter(id => id !== jobId) : [...prev, jobId]);
    };

    const handleOpenJobDetailsFromSwipe = (jobId: string) => {
        handleJobSelect(jobId);
        setOpenedFromSwipe(true);
        setIsMobileSwipeView(false);
    };

    const handleApplyToJob = (job: Job) => {
        const requestId = (job as any)?.requestId || (job as any)?.aiRecommendationRequestId;
        const scoringVersion = (job as any)?.aiMatchScoringVersion;
        const modelVersion = (job as any)?.aiMatchModelVersion;

        trackJobInteraction({
            jobId: job.id,
            eventType: 'apply_click',
            sessionId: searchSessionIdRef.current,
            requestId,
            scoringVersion,
            modelVersion,
            signalValue: 1,
            metadata: {
                source: 'job_apply',
                position: (job as any)?.rankPosition || (job as any)?.aiRecommendationPosition
            }
        });
        handleJobSelect(job.id);
        if (job.source !== 'jobshaman.cz' && job.url) {
            const pending: PendingApplyFollowup = {
                jobId: Number(job.id),
                title: job.title,
                company: job.company,
                url: job.url,
                openedAt: new Date().toISOString(),
                sessionId: searchSessionIdRef.current,
                requestId,
                scoringVersion,
                modelVersion
            };
            savePendingApplyFollowup(pending);
            setApplyFollowup(pending);
            window.open(job.url, '_blank', 'noopener,noreferrer');
            return;
        }
        setIsApplyModalOpen(true);
    };

    const handleApplyFollowupAnswer = async (didApply: boolean) => {
        if (!applyFollowup) {
            setShowApplyFollowup(false);
            return;
        }

        try {
            await trackJobInteraction({
                jobId: applyFollowup.jobId,
                eventType: 'apply_click',
                sessionId: applyFollowup.sessionId,
                requestId: applyFollowup.requestId,
                scoringVersion: applyFollowup.scoringVersion,
                modelVersion: applyFollowup.modelVersion,
                signalValue: didApply ? 1 : 0,
                metadata: {
                    source: 'apply_followup',
                    apply_outcome: didApply ? 'applied' : 'not_applied',
                    opened_at: applyFollowup.openedAt,
                    url: applyFollowup.url || null
                }
            });
        } catch (error) {
            console.warn('Failed to record apply follow-up:', error);
        } finally {
            clearPendingApplyFollowup();
            setApplyFollowup(null);
            setShowApplyFollowup(false);
        }
    };

    const handleApplyFollowupLater = () => {
        if (!applyFollowup) {
            setShowApplyFollowup(false);
            return;
        }
        const snoozeUntil = Date.now() + 6 * 60 * 60 * 1000;
        const next = { ...applyFollowup, snoozeUntil };
        savePendingApplyFollowup(next);
        setApplyFollowup(next);
        setShowApplyFollowup(false);
    };

    const handleJobSelect = (jobId: string | null) => {
        if (jobId) {
            const job = jobsForDisplay.find((j) => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);
            trackJobInteraction({
                jobId,
                eventType: 'open_detail',
                sessionId: searchSessionIdRef.current,
                requestId: (job as any)?.requestId || (job as any)?.aiRecommendationRequestId,
                scoringVersion: (job as any)?.aiMatchScoringVersion,
                modelVersion: (job as any)?.aiMatchModelVersion,
                signalValue: 1,
                metadata: {
                    source: 'desktop_detail',
                    position: (job as any)?.rankPosition || (job as any)?.aiRecommendationPosition
                }
            });
        }
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

        if (!userProfile.isLoggedIn || !userProfile.id) {
            setShowPremiumUpgrade({ open: true, feature: 'AI analýza pracovních inzerátů' });
            return;
        }

        // Feature gating via backend (authoritative).
        const billing = await verifyServerSideBilling({
            userId: userProfile.id,
            feature: 'AI_JOB_ANALYSIS',
            endpoint: '/jobs/analyze'
        });
        if (!billing.hasAccess) {
            const reason = (billing.reason || '').toLowerCase();
            const isEntitlementDeny = reason.includes('feature') || reason.includes('tier') || reason.includes('inactive subscription');
            if (isEntitlementDeny) {
                setShowPremiumUpgrade({ open: true, feature: 'AI analýza pracovních inzerátů' });
            } else if (billing.reason) {
                alert(billing.reason);
            } else {
                alert('Nepodařilo se ověřit předplatné. Zkuste to prosím znovu.');
            }
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
        const supportedLocales = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && supportedLocales.includes(pathParts[0])) {
            pathParts.shift();
        }
        const normalizedPath = `/${pathParts.join('/')}`;

        if (normalizedPath === '/admin') {
            return (
                <AdminDashboard userProfile={userProfile} />
            );
        }
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
                // If recruiter got here without a profile, show onboarding via effect
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
            return (
                <div className="col-span-1 lg:col-span-12 max-w-4xl mx-auto w-full h-full overflow-y-auto custom-scrollbar pb-6 px-1">
                    <ProfileEditor
                        profile={userProfile}
                        onChange={(p, persist) => handleProfileUpdate(p, persist)}
                        onSave={handleProfileSave}
                        onRefreshProfile={refreshUserProfile}
                        onDeleteAccount={deleteAccount}
                        savedJobs={jobsForDisplay.filter(job => savedJobIds.includes(job.id))}
                        savedJobIds={savedJobIds}
                        onToggleSave={handleToggleSave}
                        onJobSelect={handleJobSelect}
                        onApplyToJob={handleApplyToJob}
                        selectedJobId={selectedJobId}
                    />
                </div>
            );
        }

        if (viewState === ViewState.COURSE_PROVIDER_DASHBOARD) {
            if (!companyProfile || companyProfile?.industry !== 'Education') {
                return (
                    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                        <div className="max-w-xl mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                {t('course_provider.dashboard.register_title', { defaultValue: 'Staňte se poskytovatelem kurzů' })}
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                {t('course_provider.dashboard.register_desc', { defaultValue: 'Pro přístup do dashboardu je potřeba krátká registrace.' })}
                            </p>
                            <button
                                onClick={() => setIsCourseProviderRegistrationOpen(true)}
                                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-colors"
                            >
                                {t('course_provider.dashboard.register_cta', { defaultValue: 'Zaregistrovat se jako poskytovatel kurzů' })}
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <CourseProviderDashboard
                        userProfile={userProfile}
                        companyProfile={companyProfile}
                        onLogout={signOut}
                    />
                </div>
            );
        }

        if (viewState === ViewState.MARKETPLACE) {
            // Education marketplace disabled
            setTimeout(() => setViewState(ViewState.LIST), 0);
            return null;
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
            // Important: only redirect when we have a confirmed non-marketplace company profile.
            if (
                userProfile.role === 'recruiter'
                && !!companyProfile
                && companyProfile.industry !== 'Freelancer'
                && companyProfile.industry !== 'Education'
            ) {
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
                        savedJobs={jobsForDisplay.filter(job => savedJobIds.includes(job.id))}
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
            const savedJobs = jobsForDisplay.filter(job => savedJobIds.includes(job.id));
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
            const recomputedScore = calculateOverallScore(dynamicJHI);
            dynamicJHI.score = recomputedScore;
            dynamicJHI.personalizedScore = recomputedScore;
        }

        // Determine what to show in the Financial Card
        const showCommuteDetails =
            !!(userProfile.address || userProfile.coordinates) &&
            !!commuteAnalysis;

        const showLoginPrompt = !userProfile.isLoggedIn && !userProfile.coordinates;
        const showAddressPrompt =
            userProfile.isLoggedIn && !userProfile.address && !userProfile.coordinates;

        return (
            <>
                {/* Vercel Analytics */}
                {vercelAnalyticsEnabled && <Analytics />}

                {/* MOBILE SWIPE VIEW - Only show for logged-in users on mobile */}
                {isMobileSwipeView && userProfile.isLoggedIn ? (
                    <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                        <MobileSwipeJobBrowser
                            jobs={jobsForDisplay}
                            savedJobIds={savedJobIds}
                            onToggleSave={handleToggleSave}
                            onOpenDetails={handleOpenJobDetailsFromSwipe}
                            onSwitchToList={() => {
                                setMobileViewOverride('list');
                                setIsMobileSwipeView(false);
                            }}
                            isLoadingMore={loadingMore}
                            isLoading={isLoadingJobs}
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
                            filterLanguage={filterLanguage}
                            setFilterLanguage={setFilterLanguage}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            isLoadingJobs={isLoadingJobs}
                            isSearching={isSearching}
                            filteredJobs={jobsForDisplay}
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
                            abroadOnly={abroadOnly}
                            setAbroadOnly={setAbroadOnly}
                            onUseCurrentLocation={handleUseCurrentLocation}
                            onTrackImpression={(job, position) => {
                                trackJobInteraction({
                                    jobId: job.id,
                                    eventType: 'impression',
                                    sessionId: searchSessionIdRef.current,
                                    requestId: (job as any)?.requestId || (job as any)?.aiRecommendationRequestId,
                                    scoringVersion: (job as any)?.aiMatchScoringVersion,
                                    modelVersion: (job as any)?.aiMatchModelVersion,
                                    metadata: {
                                        source: 'desktop_list',
                                        position
                                    }
                                });
                            }}
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
                            aiAnalysis={aiAnalysis}
                            analyzing={analyzing}
                            handleAnalyzeJob={handleAnalyzeJob}
                            selectedBlogPostSlug={selectedBlogPostSlug}
                            handleBlogPostSelect={handleBlogPostSelect}
                            onApplyToJob={handleApplyToJob}
                        />
                    </>
                )}
            </>
        );
    };

    return (
        <div className={`flex flex-col min-h-screen app-grid-bg text-slate-900 dark:text-white font-sans transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-900 dark:selection:text-cyan-100`}>
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

            {!userProfile.isLoggedIn && pendingEmailConfirmation && (
                <div className="max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8">
                    <div className="mt-4 mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-amber-600 dark:text-amber-300 mt-0.5" size={20} />
                            <div>
                                <div className="font-bold text-amber-900 dark:text-amber-200">
                                    {t('auth.confirmation_required_title')}
                                </div>
                                <div className="text-sm text-amber-800 dark:text-amber-300">
                                    {t('auth.confirmation_required')}
                                </div>
                                {pendingEmailConfirmation.email && (
                                    <div className="text-xs text-amber-700 dark:text-amber-200 mt-1">
                                        {pendingEmailConfirmation.email}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={clearPendingEmailConfirmation}
                            className="px-4 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-800/40"
                        >
                            {t('app.close')}
                        </button>
                    </div>
                </div>
            )}

            <main className="flex-1 min-h-0 max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100dvh-120px)]">
                    <Suspense
                        fallback={
                            <div className="col-span-1 lg:col-span-12 flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                            </div>
                        }
                    >
                        {renderContent()}
                    </Suspense>
                </div>
            </main>

            <CandidateOnboardingModal
                isOpen={showCandidateOnboarding}
                profile={userProfile}
                onClose={() => {
                    markCandidateOnboardingSeen();
                    setShowCandidateOnboarding(false);
                }}
                onComplete={() => {
                    markCandidateOnboardingSeen();
                    setShowCandidateOnboarding(false);
                }}
                onGoToProfile={() => {
                    markCandidateOnboardingSeen();
                    setShowCandidateOnboarding(false);
                    setViewState(ViewState.PROFILE);
                }}
                onUpdateProfile={handleProfileUpdate}
                onOpenPremium={(featureLabel) => setShowPremiumUpgrade({ open: true, feature: featureLabel })}
                onRefreshProfile={refreshUserProfile}
            />

            <ApplyFollowupModal
                isOpen={showApplyFollowup}
                jobTitle={applyFollowup?.title}
                company={applyFollowup?.company}
                onConfirm={() => handleApplyFollowupAnswer(true)}
                onReject={() => handleApplyFollowupAnswer(false)}
                onLater={handleApplyFollowupLater}
            />

            <PremiumUpgradeModal
                show={{ open: showPremiumUpgrade.open, feature: showPremiumUpgrade.feature }}
                onClose={() => setShowPremiumUpgrade({ open: false })}
                userProfile={userProfile}
                onAuth={() => handleAuthAction('login')}
            />

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={() => setIsAuthModalOpen(false)}
                defaultMode={authModalMode}
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

            <CourseProviderRegistrationModal
                isOpen={isCourseProviderRegistrationOpen}
                onClose={() => setIsCourseProviderRegistrationOpen(false)}
                onSuccess={() => {
                    setIsCourseProviderRegistrationOpen(false);
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

        </div>
    );
}
