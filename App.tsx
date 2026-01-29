import React, { useState, useEffect, useRef } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import Markdown from 'markdown-to-jsx';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile, CareerPathfinderResult } from './types';

import { Analytics } from '@vercel/analytics/react';
import AppHeader from './components/AppHeader';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';

import JobCard from './components/JobCard';
import JHIChart from './components/JHIChart';
import BullshitMeter from './components/BullshitMeter';
import TransparencyCard from './components/TransparencyCard';
import SkillsGapBox from './components/SkillsGapBox';
import CompanyDashboard from './components/CompanyDashboard';
import CompanyOnboarding from './components/CompanyOnboarding';
import ProfileEditor from './components/ProfileEditor';
import AuthModal from './components/AuthModal';
import CompanyRegistrationModal from './components/CompanyRegistrationModal';
import MarketplacePage from './components/MarketplacePage';
import EnterpriseSignup from './components/EnterpriseSignup';
import CompanyLandingPage from './components/CompanyLandingPage';
import ContextualRelevance from './components/ContextualRelevance';
import ApplicationModal from './components/ApplicationModal';
import CookieBanner from './components/CookieBanner';
import PodminkyUziti from './pages/PodminkyUziti';
import OchranaSoukromi from './pages/OchranaSoukromi';
import SavedJobsPage from './components/SavedJobsPage';
import WelcomePage from './components/WelcomePage';

import InvitationLanding from './pages/InvitationLanding';
import PremiumUpgradeModal from './components/PremiumUpgradeModal';
import AppFooter from './components/AppFooter';
import { analyzeJobDescription } from './services/geminiService';
import { calculateCommuteReality } from './services/commuteService';
import { clearJobCache } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile } from './services/supabaseService';
import { canCandidateUseFeature } from './services/billingService';
import { analyzeJobForPathfinder } from './services/careerPathfinderService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { checkPaymentStatus } from './services/stripeService';
import { useUserProfile } from './hooks/useUserProfile';
import { usePaginatedJobs } from './hooks/usePaginatedJobs';
import {
    Search,
    Filter,
    ArrowUpRight,
    MapPin,
    Clock,
    Home,
    Wallet,
    Bookmark,
    Calculator,
    Car,
    Bus,
    Bike,
    Footprints,
    Sparkles,
    Zap,
    Activity,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    Gift,
    Globe,
    Map,
    RefreshCw,
    Lock,
    Navigation,
    Info
} from 'lucide-react';

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
    isLoggedIn: false,
    name: '',
    email: '',
    address: '',
    transportMode: 'public',
    preferences: {
        workLifeBalance: 50,
        financialGoals: 50,
        commuteTolerance: 45,
        priorities: []
    }
};

// --- JHI LOGIC CONFIGURATION ---
const JHI_TUNING = {
    clampMin: 0,
    clampMax: 100,

    timeCost: {
        impactMultiplier: 2,
    },

    benefits: {
        thresholdEur: 100,      // minimum to count
        eurPerPoint: 30,        // scaling
        maxBonus: 8,
    },

    netBenefit: {
        thresholdEur: 200,
        eurPerPoint: 100,
        maxBonus: 6,
    },

    score: {
        minFactorWeight: 0.3,   // how much the weakest dimension penalizes score
    },
};

// --- JHI UTILITY FUNCTIONS ---
const clamp = (value: number) =>
    Math.max(JHI_TUNING.clampMin, Math.min(JHI_TUNING.clampMax, value));

const average = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;

const applyTimeCostImpact = (base: number, jhiImpact: number) => {
    if (!jhiImpact) return base;
    return clamp(base + jhiImpact * JHI_TUNING.timeCost.impactMultiplier);
};

const calculateBenefitsBonus = (benefitsValue: number) => {
    if (benefitsValue <= JHI_TUNING.benefits.thresholdEur) return 0;

    return Math.min(
        JHI_TUNING.benefits.maxBonus,
        Math.round(benefitsValue / JHI_TUNING.benefits.eurPerPoint)
    );
};

const calculateNetBenefitBonus = (netBenefitValue: number) => {
    if (netBenefitValue <= JHI_TUNING.netBenefit.thresholdEur) return 0;

    return Math.min(
        JHI_TUNING.netBenefit.maxBonus,
        Math.round(
            (netBenefitValue - JHI_TUNING.netBenefit.thresholdEur) /
            JHI_TUNING.netBenefit.eurPerPoint
        )
    );
};

const calculateOverallScore = (jhi: {
    financial: number;
    timeCost: number;
    mentalLoad: number;
    growth: number;
    values: number;
}) => {
    const dimensions = [
        jhi.financial,
        jhi.timeCost,
        jhi.mentalLoad,
        jhi.growth,
        jhi.values,
    ];

    const avg = average(dimensions);
    const minFactor = Math.min(...dimensions) / 100;

    const penaltyMultiplier =
        1 - JHI_TUNING.score.minFactorWeight * (1 - minFactor);

    return Math.round(avg * penaltyMultiplier);
};




const formatJobDescription = (description: string): string => {
    if (!description) return '';

    // Convert common bullet point characters to Markdown hyphens
    // This helps with older scraped data or direct database entries
    let formatted = description
        .replace(/[•◦▪▫∙‣⁃]/g, '-')
        // Ensure there's a space after the hyphen if it's missing (e.g., "-Requirement" -> "- Requirement")
        .replace(/^-\s*([^\s-].*)/gm, '- $1');

    // Convert potential HTML <li> tags to Markdown if any slipped through
    formatted = formatted
        .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<\/?ul>/gi, '')
        .replace(/<\/?ol>/gi, '');

    return formatted;
};

export default function App() {
    const { t, i18n } = useTranslation();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);

    // Career Pathfinder State
    const [pathfinderAnalysis, setPathfinderAnalysis] = useState<CareerPathfinderResult | null>(null);

    // Cookie Consent State
    const [showCookieBanner, setShowCookieBanner] = useState(false);

    // Track if we've already auto-enabled commute filter to avoid re-enabling after user disables it
    const hasAutoEnabledCommuteFilter = useRef(false);
    const deferredAutoEnableRef = useRef(false);

    // UI State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);
    const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
    const [showFinancialMethodology, setShowFinancialMethodology] = useState(false);

    // Use custom hooks
    const {
        userProfile,
        companyProfile,
        viewState,
        setViewState,
        setUserProfile,
        setCompanyProfile,
        signOut,
        handleSessionRestoration
    } = useUserProfile();

    const {
        jobs: filteredJobs,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching,
        searchResults,
        setSearchResults,
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
        toggleExperienceFilter
    } = usePaginatedJobs({ userProfile });

    // Prevent layout flash on first render by waiting for client mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const selectedJob = filteredJobs.find(j => j.id === selectedJobId);

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

    const loadRealJobs = async () => {
        setIsLoadingJobs(true);
        try {
            await loadInitialJobs();
        } catch (e) {
            console.error("Failed to load jobs", e);
        } finally {
            setIsLoadingJobs(false);
        }
    };

    // Infinite scroll detection
    const jobListRef = useRef<HTMLDivElement>(null);
    const detailScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (!jobListRef.current || loadingMore || !hasMore) return;

            const { scrollTop, scrollHeight, clientHeight } = jobListRef.current;
            const threshold = 200; // Load more when 200px from bottom

            if (scrollTop + clientHeight >= scrollHeight - threshold) {
                loadMoreJobs();
            }
        };

        const element = jobListRef.current;
        if (element) {
            element.addEventListener('scroll', handleScroll);
            return () => element.removeEventListener('scroll', handleScroll);
        }
    }, [loadingMore, hasMore, isSearching, loadMoreJobs]);

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
            supabase.auth.getSession().then(({ data }: { data: any }) => {
                if (data?.session) {
                    handleSessionRestoration(data.session.user.id);
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
                if (session) {
                    handleSessionRestoration(session.user.id);
                } else {
                    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
                    setViewState(ViewState.LIST);
                    setCompanyProfile(null);
                }
            });

            return () => subscription.unsubscribe();
        }
    }, []);

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
        // Start polling only when not currently loading and we have zero jobs
        if (isLoadingJobs) return;
        if (filteredJobsRef.current && filteredJobsRef.current.length > 0) return;
        if (backendWakeRetryRef.current) return; // already polling

        // Start polling
        backendWakeRetryRef.current = true;
        backendRetryCountRef.current = 0;
        setBackendPolling(true);

        console.log('Backend wake retry: starting polling to wait for backend wake-up');

        const attempt = async () => {
            backendRetryCountRef.current += 1;
            console.log(`Backend wake retry: attempt ${backendRetryCountRef.current}/${BACKEND_RETRY_MAX}`);
            try {
                await loadRealJobs();
            } catch (e) {
                console.error('Backend wake retry: loadRealJobs error', e);
            }

            // If jobs arrived, stop
            if (filteredJobsRef.current && filteredJobsRef.current.length > 0) {
                console.log('Backend wake retry: jobs appeared, stopping polling');
                backendWakeRetryRef.current = false;
                setBackendPolling(false);
                if (backendRetryTimerRef.current) { clearTimeout(backendRetryTimerRef.current); backendRetryTimerRef.current = null; }
                return;
            }

            if (backendRetryCountRef.current >= BACKEND_RETRY_MAX) {
                console.log('Backend wake retry: reached max attempts, stopping');
                backendWakeRetryRef.current = false;
                setBackendPolling(false);
                return;
            }

            // Schedule next attempt
            backendRetryTimerRef.current = window.setTimeout(attempt, BACKEND_RETRY_DELAY_MS);
        };

        // First immediate attempt
        attempt();

        return () => {
            backendWakeRetryRef.current = false;
            setBackendPolling(false);
            if (backendRetryTimerRef.current) { clearTimeout(backendRetryTimerRef.current); backendRetryTimerRef.current = null; }
        };
    }, [isLoadingJobs]);

    // SEO Update Effect
    useEffect(() => {
        const pageName = showCompanyLanding ? 'company-dashboard' :
            viewState === ViewState.LIST ? 'home' :
                viewState === ViewState.PROFILE ? 'profile' :
                    viewState === ViewState.MARKETPLACE ? 'marketplace' :
                        viewState === ViewState.COMPANY_DASHBOARD ? 'company-dashboard' : 'home';

        // Wait until translations are ready to avoid raw keys in browser tab
        if (t('seo.base_title') === 'seo.base_title') return;

        const metadata = generateSEOMetadata(pageName, t, selectedJob);
        updatePageMeta(metadata);
    }, [viewState, showCompanyLanding, selectedJob, userProfile, i18n.language, t]);

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

    const handleProfileUpdate = async (updatedProfile: UserProfile) => {
        try {
            setUserProfile(updatedProfile);
            // Auto-enable commute filter if address is added and filter wasn't on (only once)
            if (updatedProfile.address && !enableCommuteFilter && !hasAutoEnabledCommuteFilter.current) {
                console.log('🏠 Profile updated with address, auto-enabling commute filter');
                setEnableCommuteFilter(true);
                setFilterMaxDistance(50);
                hasAutoEnabledCommuteFilter.current = true;
            }

            // Save to Supabase if we have a user ID
            if (updatedProfile.id) {
                await updateUserProfile(updatedProfile.id, updatedProfile);
                console.log("Profile saved successfully");

                // 🔄 CRITICAL: Refetch profile to get updated coordinates from DB
                console.log("🔄 Refetching profile to sync coordinates...");
                const { getUserProfile } = await import('./services/supabaseService');
                const freshProfile = await getUserProfile(updatedProfile.id);
                if (freshProfile) {
                    setUserProfile(freshProfile);
                    console.log("✅ Profile refetched. New coordinates:", freshProfile.coordinates);
                }
            } else {
                console.log("Local profile updated (no ID yet)");
            }
        } catch (error) {
            console.error("Failed to update profile:", error);
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

    const handleJobSelect = (jobId: string) => {
        setSelectedJobId(jobId);

        // Scroll ONLY the right column using setTimeout to ensure DOM is ready
        setTimeout(() => {
            if (detailScrollRef.current) {
                // Force immediate scroll to top with no animation
                detailScrollRef.current.scrollTop = 0;
                console.log('✅ Right column scrolled to top');
            }
        }, 0); // Use 0 timeout to run after current execution stack
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
            const result = await analyzeJobDescription(selectedJob.description);
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



    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <CompanyDashboard companyProfile={companyProfile} userEmail={userProfile.email} />
                </div>
            );
        }

        if (viewState === ViewState.PROFILE) {
            return (
                <div className="col-span-1 lg:col-span-12 max-w-4xl mx-auto w-full h-full overflow-y-auto custom-scrollbar pb-6 px-1">
                    <ProfileEditor
                        profile={userProfile}
                        onChange={handleProfileUpdate}
                        onSave={() => setViewState(ViewState.LIST)}
                        onRefreshProfile={refreshUserProfile}
                        savedJobs={filteredJobs.filter(job => savedJobIds.includes(job.id))}
                        savedJobIds={savedJobIds}
                        onToggleSave={handleToggleSave}
                        onJobSelect={handleJobSelect}
                        selectedJobId={selectedJobId}
                    />
                </div>
            );
        }

        if (viewState === ViewState.MARKETPLACE) {
            return (
                <div className="col-span-1 lg:col-span-12 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar pb-6 px-1">
                    <MarketplacePage theme={theme} userProfile={userProfile} />
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

        const cur = commuteAnalysis?.financialReality.currency || 'Kč';

        return (
            <>
                {/* Vercel Analytics */}
                <Analytics />
                {/* LEFT COLUMN: Sidebar (Fixed Filters + Scrollable List) */}
                <section className={`lg:col-span-4 xl:col-span-3 flex flex-col gap-4 min-h-0 ${selectedJobId ? 'hidden lg:flex' : 'flex'} h-full`}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">

                        {/* Fixed Header Section (Search & Filters) */}
                        <div className="flex-none bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800">
                            <div className="p-4">
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
                                            if (term.trim()) {
                                                performSearch(term);
                                            } else {
                                                // Clear search results when term is empty
                                                setSearchResults([]);
                                            }
                                        }}
                                        onFocus={() => setShowFilters(true)}
                                        placeholder={t('app.search_placeholder')}
                                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-sm font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-all"
                                    />
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`absolute inset-y-1 right-1 p-1.5 rounded-md transition-all ${showFilters ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400'}`}
                                        title={t('app.filters')}
                                    >
                                        <Filter size={16} className={showFilters ? "fill-current" : ""} />
                                    </button>
                                </div>
                            </div>

                            {/* Collapsible Filters Container */}
                            {showFilters && (
                                <div className="px-4 pb-4 max-h-[40vh] overflow-y-auto custom-scrollbar border-t border-slate-100 dark:border-slate-800 pt-4 animate-in slide-in-from-top-2">

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
                                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                                    />
                                                </div>
                                                <label className="flex items-center justify-between cursor-pointer p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <Car size={16} className={`transition-colors ${enableCommuteFilter ? 'text-cyan-500' : 'text-slate-400'}`} />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('filters.limit_by_commute')}</span>
                                                    </div>
                                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${enableCommuteFilter ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'}`} onClick={(e) => { e.preventDefault(); setEnableCommuteFilter(!enableCommuteFilter); }}>
                                                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${enableCommuteFilter ? 'left-6' : 'left-1'}`}></div>
                                                    </div>
                                                </label>
                                                {enableCommuteFilter && (
                                                    <div className={`p-3 rounded-md border ${userProfile.isLoggedIn && userProfile.address ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-100 dark:bg-slate-900/50 border-dashed border-slate-300 dark:border-slate-800 opacity-60'}`}>
                                                        <div className="flex justify-between text-xs mb-2">
                                                            <span className="font-medium text-slate-500 dark:text-slate-400">{t('filters.max_distance')}</span>
                                                            <span className="font-mono text-cyan-600 dark:text-cyan-400">{userProfile.isLoggedIn && userProfile.address ? `${filterMaxDistance} km` : 'N/A'}</span>
                                                        </div>
                                                        <input type="range" min="5" max="100" step="5" value={filterMaxDistance} onChange={(e) => setFilterMaxDistance(parseInt(e.target.value))} disabled={!userProfile.isLoggedIn || !userProfile.address} className="w-full accent-cyan-500 cursor-pointer disabled:cursor-not-allowed bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none" />
                                                    </div>
                                                )}

                                                {/* Load More Indicator */}
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
                                                {['HPP', 'IČO', 'Part-time'].map(type => (
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
                                            <span>Klíčové Benefity</span>
                                            {expandedSections.benefits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        {expandedSections.benefits && (
                                            <div className="space-y-2 animate-in slide-in-from-top-1">
                                                {['Auto pro osobní použití', 'Přátelské k dětem', 'Flexibilní hodiny', 'Vzdělávací kurzy', 'Multisport karta', 'Příspěvek na stravu', 'Home Office', '5 týdnů dovolené', 'Dog Friendly', 'Zaměstnanecké akcie'].map(benefit => (
                                                    <label key={benefit} className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filterBenefits.includes(benefit) ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300 dark:border-slate-600 group-hover:border-cyan-400'}`}>
                                                            {filterBenefits.includes(benefit) && <CheckCircle size={10} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={filterBenefits.includes(benefit)} onChange={() => toggleBenefitFilter(benefit)} />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{benefit}</span>
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
                            <div className="space-y-3">
                                {isLoadingJobs ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                        <Activity className="animate-spin mb-2 text-cyan-500" size={24} />
                                        <p className="text-sm">{t('app.searching')}</p>
                                    </div>
                                ) : isSearching ? (
                                    searchResults.length > 0 ? (
                                        searchResults.map(job => (
                                            <JobCard
                                                key={job.id}
                                                job={job}
                                                isSelected={selectedJobId === job.id}
                                                isSaved={savedJobIds.includes(job.id)}
                                                onToggleSave={() => handleToggleSave(job.id)}
                                                onClick={() => handleJobSelect(job.id)}
                                                variant={theme}
                                                userProfile={userProfile}
                                            />
                                        ))
                                    ) : (
                                        <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                            <Search size={32} className="mb-4 opacity-50" />
                                            <p className="font-bold mb-2">Žádné výsledky pro "{searchTerm}"</p>
                                            <p className="text-xs opacity-75 max-w-[200px] mb-4">
                                                Zkuste jiná klíčová slova
                                            </p>
                                        </div>
                                    )
                                ) : filteredJobs.length > 0 ? (
                                    filteredJobs.map(job => (
                                        <JobCard
                                            key={job.id}
                                            job={job}
                                            isSelected={selectedJobId === job.id}
                                            isSaved={savedJobIds.includes(job.id)}
                                            onToggleSave={() => handleToggleSave(job.id)}
                                            onClick={() => handleJobSelect(job.id)}
                                            variant={theme}
                                            userProfile={userProfile}
                                        />
                                    ))
                                ) : (
                                    <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                        <Search size={32} className="mb-4 opacity-50" />
                                        {backendPolling ? (
                                            <div className="flex flex-col items-center">
                                                <p className="font-bold mb-2">Probouzím backend… ☕🔮</p>
                                                <p className="text-xs opacity-75 max-w-[260px] mb-4">Chvíli to trvá — kontroluji, jestli server vylezl z postele. Zkusím to znovu automaticky.</p>
                                                <div className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                                                    <Activity className="animate-spin text-cyan-500" size={18} />
                                                    <span>Čekám na backend…</span>
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
                            </div>
                        </div>
                    </div>
                </section>

                {/* RIGHT COLUMN: Detail View (or Welcome Guide) */}
                {
                    // Avoid flicker on refresh/hydration by defaulting to visible until mounted
                }
                <section className={`lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 h-full ${!mounted ? 'flex' : (!selectedJobId ? 'hidden lg:flex' : 'flex')}`}>
                    {selectedJob && dynamicJHI ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
                            <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex-none bg-white dark:bg-slate-900 z-10">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="w-full">
                                        <button className="lg:hidden mb-4 flex items-center gap-1 text-slate-500 text-sm hover:text-slate-900 dark:hover:text-white" onClick={() => setSelectedJobId(null)}>&larr; {t('app.back')}</button>
                                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{selectedJob.title}</h1>
                                        <div className="flex flex-wrap items-center gap-2 mt-3 text-slate-500 dark:text-slate-400 font-medium">
                                            <span className="text-cyan-600 dark:text-cyan-400">{selectedJob.company}</span>
                                            <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                            <span className="text-slate-600 dark:text-slate-300">{selectedJob.location}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-none">
                                        <button onClick={() => handleToggleSave(selectedJob.id)} className={`p-2.5 rounded-lg border transition-all ${savedJobIds.includes(selectedJob.id) ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200'}`}>
                                            <Bookmark size={20} className={savedJobIds.includes(selectedJob.id) ? "fill-current" : ""} />
                                        </button>

                                        {selectedJob.url ? (
                                            <a
                                                href={selectedJob.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95"
                                            >
                                                {t('app.i_am_interested')} <ArrowUpRight size={18} />
                                            </a>
                                        ) : (
                                            <button onClick={() => setIsApplyModalOpen(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95">
                                                {t('app.i_am_interested')} <ArrowUpRight size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div ref={detailScrollRef} className="flex-1 overflow-y-auto custom-scrollbar" data-detail-scroll="true" style={{ overscrollBehavior: 'contain' }}>
                                {/* Detail Content */}
                                <div className="p-6 sm:p-8 space-y-8">

                                    {/* Financial Card */}
                                    <div className="bg-[#1e293b] text-slate-200 rounded-xl overflow-hidden shadow-xl mb-8 border border-slate-700 relative">

                                        {/* Card Header */}
                                        <div className="p-6 border-b border-slate-700 flex justify-between items-start">
                                            <div>
                                                <h3 className="text-white text-lg font-bold flex items-center gap-2">
                                                    <Wallet className="text-emerald-400" size={20} /> {t('financial.reality_title')}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {showCommuteDetails ? `Na základě ${userProfile.address}` : t('financial.reality_desc', 'Kalkulace čistého příjmu a nákladů na dojíždění.')}
                                                </p>
                                            </div>
                                            {showCommuteDetails && (
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">JHI DOPAD</div>
                                                    <div className={`text-xl font-bold ${commuteAnalysis.jhiImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {commuteAnalysis.jhiImpact > 0 ? '+' : ''}{commuteAnalysis.jhiImpact} bodů
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* State: Guest */}
                                        {showLoginPrompt && (
                                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                                <Lock size={40} className="text-slate-500 mb-4" />
                                                <h4 className="text-white font-bold text-lg mb-2">{t('financial.unlock_title')}</h4>
                                                <p className="text-slate-400 max-w-sm mb-6 text-sm">
                                                    {t('financial.unlock_desc')}
                                                </p>
                                                <button onClick={handleAuthAction} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                                                    {t('financial.login_button')}
                                                </button>
                                            </div>
                                        )}

                                        {/* State: Logged In but No Address */}
                                        {showAddressPrompt && (
                                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                                <Navigation size={40} className="text-slate-500 mb-4" />
                                                <h4 className="text-white font-bold text-lg mb-2">{t('financial.missing_address')}</h4>
                                                <p className="text-slate-400 max-w-sm mb-6 text-sm">
                                                    {t('financial.set_address_desc')}
                                                </p>
                                                <button onClick={() => setViewState(ViewState.PROFILE)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                                                    {t('financial.set_address_button')}
                                                </button>
                                            </div>
                                        )}

                                        {/* State: Full Data */}
                                        {showCommuteDetails && (
                                            <div className="grid grid-cols-1 md:grid-cols-2">
                                                <div className="p-6 border-r border-slate-700 flex flex-col justify-center">
                                                    {selectedJob.type === 'Remote' ? (
                                                        <div className="text-center py-2">
                                                            <Home size={40} className="text-emerald-400 mx-auto mb-3 opacity-80" />
                                                            <h4 className="text-white font-bold text-lg mb-1">Home Office</h4>
                                                            <div className="text-emerald-400 text-sm font-medium mb-2">
                                                                Úspora za home office
                                                            </div>
                                                            <div className="text-xs text-emerald-400 mb-3 text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <span className="text-green-400">🏠</span>
                                                                    <div>
                                                                        <div>{commuteAnalysis.financialReality.avoidedCommuteCost.toLocaleString()} {cur}/měsíc</div>
                                                                        <div>Ušetřený čas a peníze za dojíždění.</div>
                                                                        <div>Ekologicky šetrnější volba.</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : commuteAnalysis.isRelocation ? (
                                                        <div className="text-center py-2">
                                                            <Globe size={40} className="text-cyan-400 mx-auto mb-3 opacity-80" />
                                                            <h4 className="text-white font-bold text-lg mb-1">{t('logistics.relocation_required')}</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">{t('logistics.relocation_desc')}</p>
                                                        </div>
                                                    ) : commuteAnalysis.isRelocation ? (
                                                        <div className="text-center py-2">
                                                            <Map size={40} className="text-rose-500 mx-auto mb-3 opacity-70" />
                                                            <h4 className="text-white font-bold text-lg mb-1">{t('logistics.too_far_title')}</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">{t('logistics.too_far_desc', { distance: commuteAnalysis.distanceKm })}</p>
                                                        </div>
                                                    ) : commuteAnalysis.distanceKm === -1 ? (
                                                        <div className="text-center py-2">
                                                            <Map size={40} className="text-slate-500 mx-auto mb-3 opacity-50" />
                                                            <h4 className="text-white font-bold text-lg mb-1">{t('logistics.unknown_location_title')}</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">{t('logistics.unknown_location_desc')}</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><MapPin size={12} /> {t('logistics.logistics_title')}</h4>
                                                            <div className="relative h-12 mb-6">
                                                                <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>{t('logistics.home')}</span><span>{t('logistics.work')}</span></div>
                                                                <div className="absolute top-6 left-0 right-0 h-1.5 bg-slate-900/50 rounded-full overflow-hidden"><div className={`h-full ${commuteAnalysis.timeMinutes > 45 ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%` }}></div></div>
                                                                <div className="absolute top-4 p-1.5 bg-slate-600 border border-slate-500 rounded-full text-white shadow-md transition-all" style={{ left: `clamp(0%, ${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%, 100%)`, transform: 'translateX(-50%)' }}>{React.createElement(getTransportIcon(userProfile.transportMode), { size: 14 })}</div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div><div className="text-2xl font-mono text-white font-light flex items-center gap-2"><Clock size={20} className="text-slate-400" /> {commuteAnalysis.timeMinutes * 2} <span className="text-sm text-slate-400 font-sans font-bold">min</span></div><div className="text-[10px] text-slate-400 mt-1">{t('logistics.daily_commute')}</div></div>
                                                                <div><div className="text-2xl font-mono text-white font-light">{commuteAnalysis.distanceKm} <span className="text-sm text-slate-400 font-sans font-bold">km</span></div><div className="text-[10px] text-slate-400 mt-1">{t('logistics.one_way')}</div></div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="p-6 bg-slate-900/30 flex flex-col">
                                                    <div className="flex-1">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calculator size={12} /> {t('financial.reality_vs_income')}</h4>
                                                        <div className="space-y-1 text-sm font-mono">
                                                            {/* AI Estimation Hint */}
                                                            {selectedJob.aiEstimatedSalary && (
                                                                <div className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                                                                    <Sparkles size={10} />
                                                                    {t('financial.ai_estimation_hint')}
                                                                </div>
                                                            )}

                                                            <div className="flex justify-between text-slate-300">
                                                                <span>{t('financial.gross_monthly')}</span>
                                                                <span>{commuteAnalysis.financialReality.grossMonthlySalary > 0 ? `${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString()} ${cur}` : (selectedJob.aiEstimatedSalary ? `${selectedJob.aiEstimatedSalary.min.toLocaleString()} - ${selectedJob.aiEstimatedSalary.max.toLocaleString()} ${selectedJob.aiEstimatedSalary.currency}` : "???")}</span>
                                                            </div>
                                                            <div className="flex justify-between text-rose-300 text-xs">
                                                                <span>- {t('financial.tax_insurance')}</span>
                                                                <span>{commuteAnalysis.financialReality.estimatedTaxAndInsurance.toLocaleString()} {cur}</span>
                                                            </div>
                                                            <div className="flex justify-between text-white font-bold pt-2 mt-1 border-t border-slate-700">
                                                                <span>{t('financial.net_base')}</span>
                                                                <span>{commuteAnalysis.financialReality.netBaseSalary.toLocaleString()} {cur}</span>
                                                            </div>
                                                            <div className="flex justify-between text-emerald-400">
                                                                <span>+ {t('financial.benefit_value_label')}</span>
                                                                <span>{commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}</span>
                                                            </div>
                                                            {commuteAnalysis.financialReality.benefitsValue > 0 && (
                                                                <div className="text-xs text-slate-400 mt-2 italic">
                                                                    <div className="flex items-start gap-1">
                                                                        <span className="text-blue-400">ℹ️</span>
                                                                        <div>
                                                                            <div>{t('financial.benefit_value_label')}: {commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}/{t('financial.per_month')}</div>
                                                                            <div>{t('financial.benefit_info_desc')}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {(
                                                                <div className="flex justify-between text-rose-400">
                                                                    <span>- {t('financial.commute_costs')}</span>
                                                                    <span>{commuteAnalysis.isRelocation ? '???' : `${commuteAnalysis.financialReality.commuteCost.toLocaleString()} ${cur}`}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between text-xl font-bold text-white pt-3 mt-3 border-t border-slate-700">
                                                                <span>{t('financial.reality_summary')}</span>
                                                                <span>{commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString()} {cur}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Information Box - How JHI and Transport are Calculated */}
                                                    <div className="mt-6 pt-4 border-t border-slate-700">
                                                        <button
                                                            onClick={() => setShowFinancialMethodology(!showFinancialMethodology)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800/50 transition-colors text-xs font-semibold"
                                                        >
                                                            <Info size={14} className="text-blue-400 flex-shrink-0" />
                                                            <span>Jak se počítá JHI a doprava?</span>
                                                            {showFinancialMethodology ? (
                                                                <ChevronUp size={12} className="ml-auto text-slate-500" />
                                                            ) : (
                                                                <ChevronDown size={12} className="ml-auto text-slate-500" />
                                                            )}
                                                        </button>

                                                        {showFinancialMethodology && (
                                                            <div className="mt-3 p-3 rounded bg-slate-800/30 border border-slate-700 space-y-3 text-[11px] text-slate-300">
                                                                {/* JHI Explanation */}
                                                                <div>
                                                                    <div className="font-bold text-white mb-1 flex items-center gap-1">
                                                                        <Zap size={11} className="text-yellow-400" /> JHI Impact Formula
                                                                    </div>
                                                                    <p className="text-slate-400">
                                                                        Procent změny příjmu z dopravy × 1.5 = JHI body<br />
                                                                        <span className="text-[10px]">Příklad: Pokud doprava sníží příjem o 1%, JHI klesne o ~1.5 bodů</span>
                                                                    </p>
                                                                </div>

                                                                {/* Transport Costs */}
                                                                <div>
                                                                    <div className="font-bold text-white mb-1 flex items-center gap-1">
                                                                        <Bus size={11} className="text-blue-400" /> Výpočet Dopravy
                                                                    </div>
                                                                    <div className="space-y-1 text-slate-400 text-[10px]">
                                                                        <div>🚗 Auto: 5 CZK/km × 2 × 22 dnů</div>
                                                                        <div>🚌 MHD: Město letenka (Praha 1500 Kč) - nejlevnější</div>
                                                                        <div>🚴 Kolo: 0.05 CZK/km × 2 × 22 dnů</div>
                                                                        <div>🚶 Pěšky: 0 Kč (zdarma)</div>
                                                                    </div>
                                                                </div>

                                                                {/* Final Calculation */}
                                                                <div>
                                                                    <div className="font-bold text-white mb-1">Vzorec Čisté Reality</div>
                                                                    <p className="text-slate-400 text-[10px]">
                                                                        Čistý základ + Benefity - Doprava = Reálný Příjem
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Benefits Section */}
                                    {/* Benefits Section */}
                                    {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                                        <div className="mb-8">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                                <Gift size={16} /> {t('job_detail.benefits_title')}
                                            </h3>

                                            <div className="flex flex-wrap gap-2 mb-6">
                                                {selectedJob.benefits.map((benefit, i) => (
                                                    <span key={i} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {benefit}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Contextual Relevance Section */}
                                    {selectedJob.contextualRelevance && (
                                        <div className="mb-8">
                                            <ContextualRelevance contextualRelevance={selectedJob.contextualRelevance} compact={false} />
                                        </div>
                                    )}

                                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 break-words">
                                        <Markdown options={{ forceBlock: true }}>{formatJobDescription(selectedJob.description)}</Markdown>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 p-6 sm:p-8">
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"><Zap size={20} /></div>
                                                        <div><h3 className="text-slate-900 dark:text-slate-100 font-bold">{t('job_detail.jhi_title')}</h3><p className="text-slate-500 dark:text-slate-400 text-xs">{t('job_detail.jhi_desc')}</p></div>
                                                    </div>
                                                    <span className={`text-3xl font-mono font-bold ${commuteAnalysis ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`}>{dynamicJHI.score}</span>
                                                </div>
                                                <JHIChart
                                                    jhi={dynamicJHI}
                                                    theme={theme}
                                                    highlightGrowth={!!(pathfinderAnalysis?.skillsGapAnalysis?.recommended_resources.length)}
                                                />
                                            </div>

                                            {aiAnalysis ? (
                                                <div className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-500/30 rounded-xl p-6 shadow-sm">
                                                    <h3 className="font-bold text-cyan-600 dark:text-cyan-400 mb-2">{t('job_detail.ai_analysis')}</h3>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200">{aiAnalysis.summary}</p>
                                                </div>
                                            ) : (
                                                <button onClick={handleAnalyzeJob} disabled={analyzing} className="w-full py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-300 rounded-xl flex items-center justify-center gap-3 text-sm font-bold shadow-sm">
                                                    {analyzing ? t('job_detail.analyzing') : t('job_detail.run_ai_analysis')}
                                                </button>
                                            )}
                                            <TransparencyCard data={selectedJob.transparency} variant={theme} />
                                        </div>
                                        <div className="space-y-6">
                                            {/* Career Pathfinder - Skills Gap Analysis */}
                                            <SkillsGapBox
                                                skillsGapAnalysis={pathfinderAnalysis?.skillsGapAnalysis || null}
                                                isLoading={pathfinderAnalysis?.isLoading || false}
                                                error={pathfinderAnalysis?.error || null}
                                                theme={theme}
                                                userProfile={{
                                                    isLoggedIn: userProfile.isLoggedIn,
                                                    hasCV: !!userProfile.cvText || !!userProfile.cvUrl,
                                                    name: userProfile.name
                                                }}
                                                onResourceClick={(resource) => {
                                                    window.open(resource.url, '_blank');
                                                }}
                                                onShowMarketplace={() => {
                                                    setViewState(ViewState.MARKETPLACE);
                                                    setSelectedJobId(null);
                                                }}
                                                onShowProfile={() => {
                                                    setViewState(ViewState.PROFILE);
                                                    setSelectedJobId(null);
                                                }}
                                            />
                                            <BullshitMeter metrics={selectedJob.noiseMetrics} variant={theme} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                            <WelcomePage
                                onTryFree={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)}
                                onBrowseOffers={() => setViewState(ViewState.LIST)}
                            />
                        </div>
                    )}
                </section>
            </>
        );
    };

    return (
        <div className={`flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-900 dark:selection:text-cyan-100`}>
            <AppHeader
                viewState={viewState}
                setViewState={setViewState}
                setSelectedJobId={setSelectedJobId}
                showCompanyLanding={showCompanyLanding}
                setShowCompanyLanding={setShowCompanyLanding}
                userProfile={userProfile}
                handleAuthAction={() => setIsAuthModalOpen(true)}
                toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                theme={theme}
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
