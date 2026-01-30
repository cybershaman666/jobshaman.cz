import { useState, useEffect, useRef } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile, CareerPathfinderResult } from './types';

import { Analytics } from '@vercel/analytics/react';
import AppHeader from './components/AppHeader';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';
import CompanyDashboard from './components/CompanyDashboard';
import CompanyOnboarding from './components/CompanyOnboarding';
import ProfileEditor from './components/ProfileEditor';
import AuthModal from './components/AuthModal';
import CompanyRegistrationModal from './components/CompanyRegistrationModal';
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
    const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
        const path = window.location.pathname;
        if (path.startsWith('/jobs/')) {
            return path.split('/jobs/')[1] || null;
        }
        return null;
    });
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
                    // CSRF token is fetched inside handleSessionRestoration
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
                if (session) {
                    handleSessionRestoration(session.user.id);
                    // CSRF token is fetched inside handleSessionRestoration
                } else {
                    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
                    setViewState(ViewState.LIST);
                    setCompanyProfile(null);
                    // Clear CSRF token on logout
                    clearCsrfToken();
                }
            });

            // Deep Link Handling for /jobs/:id
            const path = window.location.pathname;
            if (path.startsWith('/jobs/')) {
                const jobId = path.split('/jobs/')[1];
                if (jobId) {
                    setViewState(ViewState.LIST);
                    setShowCompanyLanding(false);
                    setSelectedJobId(jobId);
                    console.log('🔗 Deep link detected for job:', jobId);
                }
            }

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
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <CompanyDashboard companyProfile={companyProfile} userEmail={userProfile.email} />
                </div>
            );
        }

        if (viewState === ViewState.PROFILE) {
            // STRICT SEPARATION: Recruiters cannot access candidate profile editor
            if (userProfile.role === 'recruiter') {
                // Defer state update to next tick to avoid render-phase update warning
                setTimeout(() => setViewState(ViewState.COMPANY_DASHBOARD), 0);
                return null;
            }

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

        return (
            <>
                {/* Vercel Analytics */}
                <Analytics />
                {/* LEFT COLUMN: Sidebar (Fixed Filters + Scrollable List) */}
                <JobListSidebar
                    selectedJobId={selectedJobId}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    performSearch={performSearch}
                    setSearchResults={setSearchResults}
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
                    isLoadingJobs={isLoadingJobs}
                    isSearching={isSearching}
                    searchResults={searchResults}
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
                />

                {/* RIGHT COLUMN: Detail View (or Welcome Guide) */}
                <JobDetailView
                    mounted={mounted}
                    selectedJobId={selectedJobId}
                    selectedJob={selectedJob || null}
                    dynamicJHI={dynamicJHI}
                    savedJobIds={savedJobIds}
                    handleToggleSave={handleToggleSave}
                    setSelectedJobId={setSelectedJobId}
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
                />
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
                handleAuthAction={handleAuthAction}
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
