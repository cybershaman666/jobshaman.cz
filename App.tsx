import React, { useState, useEffect, useRef } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import Markdown from 'markdown-to-jsx';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile, JHI, CareerPathfinderResult } from './types';

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
    Dog,
    AlertTriangle,
    XCircle,
    Compass,
    BarChart3,
    BookOpen,
    FileText,
    Mail,
    GraduationCap,
    Briefcase,
    Quote,
    HelpCircle,
    Check,
    Trophy,
    Target,
    Users,
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
        savedJobIds,
        showFilters,
        expandedSections,
        setSearchTerm,
        setFilterCity,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setSavedJobIds,
        setShowFilters,
        setExpandedSections,
        toggleBenefitFilter,
        toggleContractTypeFilter
    } = usePaginatedJobs({ userProfile });

    const totalJobs = totalCount;
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
            if (!jobListRef.current || loadingMore || !hasMore || isSearching) return;
            
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

    // Auto-enable commute filter for existing users with address/coordinates
    useEffect(() => {
        console.log('🔍 Commute filter check:', {
            hasAddress: !!userProfile.address,
            hasCoordinates: !!userProfile.coordinates,
            coordinates: userProfile.coordinates,
            enableCommuteFilter,
            address: userProfile.address
        });
        
        if (userProfile.address && userProfile.coordinates && !enableCommuteFilter) {
            console.log('🏠 User has address and coordinates, auto-enabling commute filter');
            setEnableCommuteFilter(true);
            setFilterMaxDistance(50);
        }
    }, [userProfile.address, userProfile.coordinates, enableCommuteFilter]);

    // Reload jobs when user coordinates change (e.g., after profile update)
    useEffect(() => {
        if (userProfile.coordinates?.lat && userProfile.coordinates?.lon) {
            console.log('📍 Coordinates updated:', userProfile.coordinates, '- Clearing cache and reloading jobs...');
            // Clear the cache to ensure we get fresh results with proximity sorting
            clearJobCache();
            loadRealJobs();
        }
    }, [userProfile.coordinates?.lat, userProfile.coordinates?.lon]);

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
            // Auto-enable commute filter if address is added and filter wasn't on
            if (updatedProfile.address && !enableCommuteFilter) {
                setEnableCommuteFilter(true);
                setFilterMaxDistance(50);
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



    const renderWelcomeGuide = () => {
        const demoJHI: JHI = { score: 70, financial: 75, timeCost: 65, mentalLoad: 70, growth: 75, values: 60 };

        return (
            <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
                    <div className="my-auto w-full max-w-5xl">
                        {/* HERO SECTION */}
                        <header className="text-center mb-16">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 text-xs font-semibold mb-6 border border-cyan-200 dark:border-cyan-800">
                                <Sparkles size={12} />
                                {t('welcome.next_gen_tag')}
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
                                {t('welcome.title_main')} <span className="text-cyan-600 dark:text-cyan-400">{t('welcome.title_accent')}</span>
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
                                {t('welcome.subtitle')}
                            </p>

                            {/* VALUE PROPS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
                                    <div className="text-2xl mb-3">💰</div>
                                    <h2 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.value_props.finance_title')}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('welcome.value_props.finance_desc')}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
                                    <div className="text-2xl mb-3">🎭</div>
                                    <h2 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.value_props.bullshit_title')}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('welcome.value_props.bullshit_desc')}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
                                    <div className="text-2xl mb-3">📊</div>
                                    <h2 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.value_props.jhi_title')}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('welcome.value_props.jhi_desc')}</p>
                                </div>
                            </div>

                            {/* MAIN CTAs */}
                            <div className="flex flex-wrap justify-center gap-4">
                                <button
                                    onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)}
                                    className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                                >
                                    {t('welcome.cta.try_free')}
                                </button>
                                <button
                                    onClick={() => setViewState(ViewState.LIST)}
                                    className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                                >
                                    {t('welcome.cta.browse_offers', { count: totalJobs })}
                                </button>
                            </div>
                        </header>

                        {/* SECTION 1: PROČ JOBSHAMAN */}
                        <section className="mb-20">
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
                                    <Search className="text-cyan-500" /> {t('welcome.section_why.title')}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 text-xl italic font-serif">
                                    {t('welcome.section_why.headline')}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-rose-50/50 dark:bg-rose-950/10 p-8 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                                    <h3 className="font-bold text-rose-700 dark:text-rose-400 mb-6 flex items-center gap-2 uppercase tracking-wider text-sm">
                                        <XCircle size={18} /> {t('welcome.section_why.typical_title')}
                                    </h3>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-rose-500 font-bold">❌</span>
                                            <div>
                                                <span className="font-bold">{t('welcome.section_why.typical_salary')}</span>
                                                <p className="text-xs opacity-70">{t('welcome.section_why.typical_salary_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-rose-500 font-bold">❌</span>
                                            <div>
                                                <span className="font-bold">{t('welcome.section_why.typical_family')}</span>
                                                <p className="text-xs opacity-70">{t('welcome.section_why.typical_family_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-rose-500 font-bold">❌</span>
                                            <div>
                                                <span className="font-bold">{t('welcome.section_why.typical_team')}</span>
                                                <p className="text-xs opacity-70">{t('welcome.section_why.typical_team_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-rose-500 font-bold">❌</span>
                                            <div>
                                                <span className="font-bold">{t('welcome.section_why.typical_dog')}</span>
                                                <p className="text-xs opacity-70">{t('welcome.section_why.typical_dog_sub')}</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-8 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                    <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-6 flex items-center gap-2 uppercase tracking-wider text-sm">
                                        <CheckCircle size={18} /> {t('welcome.section_why.shaman_title')}
                                    </h3>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-emerald-500 font-bold">✅</span>
                                            <div>
                                                <span className="font-bold font-mono">{t('welcome.section_why.shaman_tax')}</span>
                                                <p className="text-xs opacity-70 italic text-emerald-600">{t('welcome.section_why.shaman_tax_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-emerald-500 font-bold">✅</span>
                                            <div>
                                                <span className="font-bold font-mono">{t('welcome.section_why.shaman_ai')}</span>
                                                <p className="text-xs opacity-70 italic text-emerald-600">{t('welcome.section_why.shaman_ai_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-emerald-500 font-bold">✅</span>
                                            <div>
                                                <span className="font-bold font-mono">{t('welcome.section_why.shaman_happiness')}</span>
                                                <p className="text-xs opacity-70 italic text-emerald-600">{t('welcome.section_why.shaman_happiness_sub')}</p>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <span className="text-emerald-500 font-bold">✅</span>
                                            <div>
                                                <span className="font-bold font-mono">{t('welcome.section_why.shaman_benefits')}</span>
                                                <p className="text-xs opacity-70 italic text-emerald-600">{t('welcome.section_why.shaman_benefits_sub')}</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 2: CO JOBSHAMAN UMÍ (Features) */}
                        <div className="mb-20 space-y-32">
                            {/* Feature 1: JHI Skóre */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div className="order-2 lg:order-1 space-y-6">
                                    <div className="flex flex-wrap justify-center gap-2 mb-2">
                                        {['Finance', 'Čas', 'Psychika', 'Růst', 'Hodnoty'].map((dim, i) => (
                                            <span key={i} className="px-3 py-1 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                                                {dim}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl shadow-cyan-500/10 border border-slate-200 dark:border-slate-800 relative ring-1 ring-slate-200 dark:ring-slate-800 h-[400px] flex items-center justify-center overflow-hidden">
                                        <JHIChart jhi={demoJHI} theme={theme} />
                                    </div>
                                </div>
                                <div className="order-1 lg:order-2">
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-tight leading-none">{t('welcome.features.jhi.title')}</h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
                                        {t('welcome.features.jhi.desc')}
                                    </p>

                                    <div className="space-y-4 relative">
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-rose-200 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 font-bold">A</div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('welcome.features.jhi.example_a_desc')}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">{t('welcome.features.jhi.example_a_title')}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-mono font-bold text-rose-500 tracking-tighter">64/100</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Varování ⚠️</p>
                                            </div>
                                        </div>

                                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 z-10 w-8 h-8 bg-slate-50 dark:bg-slate-950 rounded-full border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 italic">VS</div>

                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/30 shadow-xl shadow-emerald-500/5 flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">B</div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('welcome.features.jhi.example_b_desc')}</p>
                                                    <p className="text-[10px] text-emerald-500 uppercase font-bold">{t('welcome.features.jhi.example_b_title')}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-mono font-bold text-emerald-500 tracking-tighter">88/100</p>
                                                <p className="text-[10px] text-emerald-600 font-bold uppercase">Ideál ✅</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex items-center gap-3 p-4 bg-cyan-50 dark:bg-cyan-950/20 rounded-xl border border-cyan-100 dark:border-cyan-900/30">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white"><Zap size={16} /></div>
                                        <p className="text-sm font-medium text-cyan-800 dark:text-cyan-300 italic">{t('welcome.features.jhi.footer')}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Feature 2: Finanční Realita */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div>
                                    <div className="inline-flex p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-6">
                                        <Wallet size={24} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tight">{t('welcome.features.finance.title')}</h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
                                        {t('welcome.features.finance.desc')}
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800">
                                                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-widest text-xs">{t('welcome.features.finance.table_param')}</th>
                                                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-widest text-xs text-center">{t('welcome.features.finance.table_jobs')}</th>
                                                    <th className="pb-3 font-bold text-cyan-500 uppercase tracking-widest text-xs text-center">{t('welcome.features.finance.table_shaman')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {[
                                                    { p: t('welcome.features.finance.gross_wage'), j: '100,000 Kč', s: '100,000 Kč' },
                                                    { p: t('welcome.features.finance.net_wage_shown'), j: '❌ No', s: '✅ 71,500 Kč' },
                                                    { p: t('welcome.features.finance.commute_included'), j: '❌ No', s: '✅ -2,500 Kč' },
                                                    { p: t('welcome.features.finance.reality_check'), j: '❌ No', s: '✅ Yes' }
                                                ].map((row, i) => (
                                                    <tr key={i} className="group">
                                                        <td className="py-3 text-slate-600 dark:text-slate-400">{row.p}</td>
                                                        <td className="py-3 text-center text-slate-500">{row.j}</td>
                                                        <td className="py-3 text-center font-bold text-slate-900 dark:text-white">{row.s}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div>
                                    <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 text-slate-300 font-mono">
                                        <div className="flex items-center gap-2 mb-8 text-white">
                                            <Calculator size={20} className="text-emerald-400" />
                                            <span className="font-bold tracking-tight uppercase text-sm">{t('welcome.features.finance.calc_title')}</span>
                                        </div>
                                        <div className="space-y-4 text-sm">
                                            <div className="flex justify-between"><span>{t('welcome.features.finance.calc_gross')}</span><span className="text-white">100,000 Kč</span></div>
                                            <div className="flex justify-between text-rose-400"><span>{t('welcome.features.finance.calc_taxes')}</span><span>-15,000 Kč</span></div>
                                            <div className="flex justify-between text-rose-400"><span>{t('welcome.features.finance.calc_ins')}</span><span>-11,000 Kč</span></div>
                                            <div className="flex justify-between text-rose-400 border-b border-slate-800 pb-4"><span>{t('welcome.features.finance.calc_commute')}</span><span>-2,500 Kč</span></div>
                                            <div className="flex justify-between text-xl font-bold text-emerald-400 pt-2"><span>{t('welcome.features.finance.calc_net')}</span><span>71,500 Kč</span></div>
                                        </div>
                                        <div className="mt-8 pt-8 border-t border-slate-800 text-[10px] space-y-2 opacity-60 uppercase tracking-widest">
                                            <div className="flex items-center gap-2 leading-none"><MapPin size={10} /> {t('welcome.features.finance.calc_commute_info')}</div>
                                            <div className="flex items-center gap-2 leading-none"><Activity size={10} /> {t('welcome.features.finance.calc_costs_info')}</div>
                                        </div>
                                    </div>
                                </div>
                            </section>



                            {/* Feature 4: Gap Analysis */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div>
                                    <div className="inline-flex p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl mb-6">
                                        <Compass size={24} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tight">{t('welcome.features.gap.title')}</h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                                        {t('welcome.features.gap.desc')}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                                            <p className="text-xl font-bold text-slate-700 dark:text-white uppercase tracking-tight">{t('welcome.features.gap.courses_db')}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Již brzy ⏳</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/10">
                                            <p className="text-xl font-bold text-emerald-600 uppercase tracking-tight">{t('welcome.features.gap.courses_free')}</p>
                                            <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase">V přípravě 📅</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle size={16} /> {t('welcome.features.gap.success_rate')}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">1</div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('welcome.features.gap.step_1')}</p>
                                                <p className="text-xs text-rose-500 font-bold">❌ ({t('welcome.features.gap.step_1_sub')})</p>
                                            </div>
                                        </div>
                                        <div className="ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-800 py-2">
                                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center text-center">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                                    <BookOpen size={18} className="text-slate-400" />
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Kurzy se připravují</p>
                                                <p className="text-[10px] text-slate-500 italic leading-relaxed">Právě pro vás integrujeme nabídky od Khan Academy, Coursera a Úřadu Práce.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-cyan-500/50">2</div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white pt-1">{t('welcome.features.gap.step_2')}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Feature 5: Transparentnost */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div className="order-2 lg:order-1">
                                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 font-sans">
                                        <div className="flex items-center justify-between mb-8">
                                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <BarChart3 size={20} className="text-indigo-500" /> {t('welcome.features.transparency.card_title')}
                                            </h4>
                                            <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold tracking-tight">{t('welcome.features.transparency.badge_ready')}</div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-500">{t('welcome.features.transparency.salary_shown')}</span>
                                                <span className="text-sm font-bold text-emerald-500">✅ Ano (40-60k)</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-500">{t('welcome.features.transparency.fluctuation')}</span>
                                                <span className="text-sm font-bold text-amber-500 font-mono">⚠️ 35% / rok</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-500">{t('welcome.features.transparency.avg_stay')}</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">1.8 roku</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-500">{t('welcome.features.transparency.ghosting_rate')}</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">22%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-500">{t('welcome.features.transparency.response_time')}</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">14 dní</span>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold">€</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t('welcome.features.transparency.eu_badge_title')}</p>
                                                    <p className="text-[10px] text-slate-400 leading-tight">{t('welcome.features.transparency.eu_badge_desc')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="order-1 lg:order-2">
                                    <div className="inline-flex p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-6">
                                        <BarChart3 size={24} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tight">{t('welcome.features.transparency.title')}</h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
                                        {t('welcome.features.transparency.desc')}
                                    </p>
                                    <ul className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <li className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> {t('welcome.features.transparency.list_fluctuation')}</li>
                                        <li className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> {t('welcome.features.transparency.list_ghosting')}</li>
                                        <li className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> {t('welcome.features.transparency.list_response')}</li>
                                        <li className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> {t('welcome.features.transparency.list_salary')}</li>
                                    </ul>
                                </div>
                            </section>
                        </div>

                        {/* SECTION 3: REAL EXAMPLES */}
                        <section className="mb-20">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t('welcome.examples.title')}</h2>
                                <p className="text-slate-500 mt-2">{t('welcome.examples.subtitle')}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    {
                                        title: t('welcome.examples.dog.title'),
                                        icon: <Dog className="text-amber-500" />,
                                        offer: t('welcome.examples.dog.offer'),
                                        ai: t('welcome.examples.dog.ai'),
                                        score: t('welcome.examples.dog.score')
                                    },
                                    {
                                        title: t('welcome.examples.salary.title'),
                                        icon: <Wallet className="text-rose-500" />,
                                        offer: t('welcome.examples.salary.offer'),
                                        ai: t('welcome.examples.salary.ai'),
                                        score: t('welcome.examples.salary.score')
                                    },
                                    {
                                        title: t('welcome.examples.team.title'),
                                        icon: <Users className="text-indigo-500" />,
                                        offer: t('welcome.examples.team.offer'),
                                        ai: t('welcome.examples.team.ai'),
                                        score: t('welcome.examples.team.score')
                                    }
                                ].map((ex, i) => (
                                    <article key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-4">
                                            {ex.icon}
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{ex.title}</h3>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs font-bold mb-4 border border-slate-100 dark:border-slate-800">
                                            {ex.offer}
                                        </div>
                                        <div className="flex-1 text-xs text-slate-500 dark:text-slate-400 italic mb-4 leading-relaxed">
                                            <span className="text-cyan-600 dark:text-cyan-400 font-bold not-italic">🤖 AI: </span>
                                            {ex.ai}
                                        </div>
                                        <footer className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {ex.score}
                                        </footer>
                                    </article>
                                ))}
                            </div>
                        </section>

                        {/* SECTION 4: PRO KANDIDÁTY */}
                        <section className="mb-20">
                            <header className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{t('welcome.candidates.title')}</h2>
                                <p className="text-slate-500 mt-2">{t('welcome.candidates.subtitle')}</p>
                            </header>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                                {[
                                    { title: t('welcome.candidates.jhi'), desc: t('welcome.candidates.jhi_sub'), icon: <Target className="text-cyan-500" /> },
                                    { title: t('welcome.candidates.finance'), desc: t('welcome.candidates.finance_sub'), icon: <Wallet className="text-emerald-500" /> },
                                    { title: t('welcome.candidates.bullshit'), desc: t('welcome.candidates.bullshit_sub'), icon: <Activity className="text-rose-500" /> },
                                    { title: t('welcome.candidates.gap'), desc: t('welcome.candidates.gap_sub'), icon: <Compass className="text-amber-500" /> },
                                    { title: t('welcome.candidates.transparency'), desc: t('welcome.candidates.transparency_sub'), icon: <BarChart3 className="text-indigo-500" /> },
                                    { title: t('welcome.candidates.courses_free'), desc: t('welcome.candidates.courses_free_sub'), icon: <GraduationCap className="text-purple-500" /> },
                                    { title: t('welcome.candidates.cv'), desc: t('welcome.candidates.cv_sub'), icon: <FileText className="text-blue-500" /> },
                                    { title: t('welcome.candidates.mail'), desc: t('welcome.candidates.mail_sub'), icon: <Mail className="text-cyan-500" /> },
                                    { title: t('welcome.candidates.coach'), desc: t('welcome.candidates.coach_sub'), icon: <Trophy className="text-emerald-500" /> }
                                ].map((b, i) => (
                                    <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-4 hover:shadow-lg transition-all group">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl group-hover:scale-110 transition-transform">{b.icon}</div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{b.title}</h3>
                                            <p className="text-xs text-slate-400 mt-1">{b.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                                    <header className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('welcome.candidates.free_forever')}</h3>
                                        <p className="text-slate-500 text-sm mt-1">{t('welcome.candidates.free_sub')}</p>
                                    </header>
                                    <div className="p-8 space-y-4">
                                        {[t('welcome.candidates.jhi'), t('welcome.candidates.finance'), t('welcome.candidates.bullshit'), t('welcome.candidates.gap'), t('marketplace.all_courses'), '3 inzeráty uložené'].map((f, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                                <CheckCircle size={16} className="text-emerald-500" /> {f}
                                            </div>
                                        ))}
                                        <button onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)} className="w-full py-4 mt-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity uppercase tracking-widest text-xs">
                                            {t('welcome.cta.get_started')}
                                        </button>
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-slate-900 border-2 border-cyan-500 rounded-3xl overflow-hidden shadow-2xl relative">
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-cyan-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">{t('welcome.candidates.recommended')}</div>
                                    <header className="p-8 border-b border-slate-100 dark:border-slate-800 bg-cyan-50 dark:bg-cyan-950/20">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('welcome.candidates.premium')}</h3>
                                        <p className="text-cyan-600 font-bold text-2xl mt-1">{t('welcome.candidates.premium_price')}<span className="text-xs text-slate-400 font-normal"> {t('welcome.candidates.premium_sub')}</span></p>
                                    </header>
                                    <div className="p-8 space-y-4">
                                        {['Vše ze Free', t('welcome.candidates.cv') + ' (neomezeno)', t('welcome.candidates.mail'), 'Neomezené uložené nabídky', 'Email upozornění (nové)', 'Prioritní podpora'].map((f, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                                <CheckCircle size={16} className="text-cyan-500" /> {f}
                                            </div>
                                        ))}
                                        <button onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)} className="w-full py-4 mt-4 bg-cyan-600 text-white rounded-xl font-bold hover:shadow-lg shadow-cyan-600/20 transition-all uppercase tracking-widest text-xs">
                                            {t('welcome.candidates.try_premium')}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </section>

                        {/* SECTION 5: PRO FIRMY */}
                        <section className="mb-20 bg-slate-900 rounded-[3rem] p-10 lg:p-16 border border-slate-800 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[100px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-cyan-500/20"></div>
                            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-6 border border-slate-700 uppercase tracking-widest">
                                        <Briefcase size={12} /> {t('welcome.companies.tag')}
                                    </div>
                                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 uppercase tracking-tight">{t('welcome.companies.title')}</h2>
                                    <p className="text-slate-400 text-lg mb-10">
                                        {t('welcome.companies.desc')}
                                    </p>
                                    <div className="grid grid-cols-2 gap-6 text-sm text-slate-300 mb-10">
                                        <div className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> Detektor Klišé</div>
                                        <div className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> Market Insights</div>
                                        <div className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> Assessment Center</div>
                                        <div className="flex items-center gap-2"><Check size={16} className="text-cyan-500" /> Tone Analyzer</div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => setShowCompanyLanding(true)} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors">{t('welcome.companies.test_free')}</button>
                                        <button onClick={() => setShowCompanyLanding(true)} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors">{t('welcome.companies.learn_more')}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 font-mono text-xs overflow-hidden">
                                        <header className="flex items-center gap-2 mb-6 text-white border-b border-slate-700 pb-4 uppercase tracking-widest">
                                            <Zap size={14} className="text-cyan-400" /> {t('welcome.companies.optimizer_title')}
                                        </header>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-slate-500 mb-2 uppercase text-[10px]">{t('welcome.companies.your_ad')}</p>
                                                <p className="text-slate-400 italic">{t('welcome.companies.your_ad_content')}</p>
                                            </div>
                                            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                                                <p className="text-rose-400 font-bold mb-2 flex items-center gap-2 uppercase tracking-widest"><AlertTriangle size={12} /> {t('welcome.companies.detector_found')}</p>
                                                <ul className="space-y-1 text-rose-300">
                                                    <li>🔴 "mladého" - Age discrimination</li>
                                                    <li>🔴 "dynamického" - Vague, meaningless</li>
                                                    <li>🔴 "konkurenceschopným" - No range</li>
                                                    <li>🟠 "teamu" - Spell check: týmu</li>
                                                </ul>
                                            </div>
                                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                                <p className="text-emerald-400 font-bold mb-2 flex items-center gap-2 uppercase tracking-widest"><Check size={12} /> {t('welcome.companies.ai_rec')}</p>
                                                <p className="text-emerald-300 font-bold italic">{t('welcome.companies.ai_rec_content')}</p>
                                            </div>
                                            <div className="flex justify-between items-center pt-2">
                                                <span className="text-slate-500 uppercase tracking-widest">{t('welcome.companies.improvement')}</span>
                                                <span className="font-bold text-emerald-400">🔴 20% → 🟢 95%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 6: DATA & STATS */}
                        <section className="mb-20">
                            <header className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{t('welcome.stats.title')}</h2>
                                <p className="text-slate-500 mt-2">{t('welcome.stats.subtitle')}</p>
                            </header>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
                                {[
                                    { v: totalJobs.toLocaleString(), l: t('welcome.stats.offers'), c: 'text-cyan-500' },
                                    { v: '847', l: t('welcome.stats.cliches'), c: 'text-rose-500' },
                                    { v: '⏳', l: t('welcome.stats.courses'), c: 'text-amber-500' },
                                    { v: '98%', l: t('welcome.stats.remote'), c: 'text-emerald-500' },
                                    { v: '35%', l: t('welcome.stats.fluctuation'), c: 'text-indigo-500' },
                                    { v: '⏳', l: t('welcome.stats.free_courses'), c: 'text-purple-500' }
                                ].map((s, i) => (
                                    <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-sm">
                                        <p className={`text-2xl font-bold ${s.c} mb-1`}>{s.v}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{s.l}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-wider">
                                    <BarChart3 size={20} className="text-cyan-500" /> {t('welcome.stats.data_show')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-sm">
                                    <section>
                                        <h4 className="font-bold text-slate-800 dark:text-white mb-4 border-l-4 border-cyan-500 pl-3 uppercase tracking-widest">{t('welcome.stats.salary_title')}</h4>
                                        <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                                            <li className="flex justify-between"><span>❌ {t('welcome.stats.no_salary')}</span><span className="font-bold">67%</span></li>
                                            <li className="flex justify-between"><span>🤔 {t('welcome.stats.bs_salary')}</span><span className="font-bold">23%</span></li>
                                            <li className="flex justify-between"><span>✅ {t('welcome.stats.exact_range')}</span><span className="font-bold">10%</span></li>
                                        </ul>
                                    </section>
                                    <section>
                                        <h4 className="font-bold text-slate-800 dark:text-white mb-4 border-l-4 border-emerald-500 pl-3 uppercase tracking-widest">{t('welcome.stats.remote_title')}</h4>
                                        <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                                            <li className="flex justify-between"><span>🏠 {t('welcome.stats.wants_remote')}</span><span className="font-bold">98%</span></li>
                                            <li className="flex justify-between"><span>🏢 {t('welcome.stats.only_office')}</span><span className="font-bold">45%</span></li>
                                            <li className="flex justify-between"><span>🤯 {t('welcome.stats.conflicting')}</span><span className="font-bold">30%</span></li>
                                        </ul>
                                    </section>
                                    <section>
                                        <h4 className="font-bold text-slate-800 dark:text-white mb-4 border-l-4 border-indigo-500 pl-3 uppercase tracking-widest">{t('welcome.stats.benefits_title')}</h4>
                                        <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                                            <li className="flex justify-between"><span>🤡 {t('welcome.stats.absurd_benefits')}</span><span className="font-bold">15%</span></li>
                                            <li className="flex justify-between"><span>🍎 {t('welcome.stats.generic_benefits')}</span><span className="font-bold">40%</span></li>
                                            <li className="flex justify-between"><span>👯 {t('welcome.stats.same_benefits')}</span><span className="font-bold">78%</span></li>
                                        </ul>
                                    </section>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 7: HOW IT WORKS */}
                        <section className="mb-20">
                            <header className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{t('welcome.how_it_works.title')}</h2>
                                <p className="text-slate-500 mt-2">{t('welcome.how_it_works.subtitle')}</p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto relative">
                                <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-800"></div>
                                {[
                                    { t: t('welcome.how_it_works.step_1_title'), d: t('welcome.how_it_works.step_1_desc', { count: totalJobs }), n: '1️⃣' },
                                    { t: t('welcome.how_it_works.step_2_title'), d: t('welcome.how_it_works.step_2_desc'), n: '2️⃣' },
                                    { t: t('welcome.how_it_works.step_3_title'), d: t('welcome.how_it_works.step_3_desc'), n: '3️⃣' }
                                ].map((s, i) => (
                                    <article key={i} className="relative z-10 text-center">
                                        <div className="w-16 h-16 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">{s.n}</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 uppercase tracking-wider">{s.t}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.d}</p>
                                    </article>
                                ))}
                            </div>
                            <div className="text-center mt-12">
                                <button onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)} className="px-8 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:shadow-lg shadow-cyan-600/20 transition-all active:scale-95 uppercase tracking-widest text-xs">{t('welcome.cta.try_free')}</button>
                            </div>
                        </section>

                        {/* SECTION 8: TESTIMONIALS */}
                        <section className="mb-20">
                            <header className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{t('welcome.testimonials.title')}</h2>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { q: '"JHI skóre mi ukázalo, že vyšší plat = nižší štěstí. Vzal jsem práci za 20k méně a jsem 2× šťastnější. AI měla pravdu."', u: 'Martin K.', r: 'Senior Developer' },
                                    { q: '"Bullshit detektor našel \'dog-friendly office\' u 100% remote pozice. Smál jsem se 10 minut. Pak jsem nenašel tu firmu vůbec."', u: 'Jana P.', r: 'UX Designer' },
                                    { q: '"Gap analysis mi ukázal 3 kurzy ZDARMA od ÚP. Za 2 měsíce jsem měl Docker, za 4 jsem měl práci. JobShaman = game changer."', u: 'Petr S.', r: 'Junior DevOps' }
                                ].map((t, i) => (
                                    <figure key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div className="mb-6"><Quote size={32} className="text-cyan-500/20" /></div>
                                        <blockquote className="text-sm text-slate-600 dark:text-slate-300 italic mb-6 leading-relaxed">{t.q}</blockquote>
                                        <figcaption className="flex items-center gap-3 border-t border-slate-50 dark:border-slate-800 pt-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-cyan-600">{t.u[0]}</div>
                                            <div>
                                                <cite className="text-xs font-bold text-slate-900 dark:text-white not-italic">{t.u}</cite>
                                                <p className="text-[10px] text-slate-500">{t.r}</p>
                                            </div>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </section>

                        {/* SECTION 9: FAQ */}
                        <section className="mb-20">
                            <header className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3 uppercase tracking-tight">
                                    <HelpCircle className="text-cyan-500" /> {t('welcome.faq.title')}
                                </h2>
                                <p className="text-slate-500 mt-2">{t('welcome.faq.subtitle')}</p>
                            </header>

                            <div className="max-w-3xl mx-auto space-y-4">
                                {[
                                    { q: t('welcome.faq.q1'), a: t('welcome.faq.a1') },
                                    { q: t('welcome.faq.q2'), a: t('welcome.faq.a2') },
                                    { q: t('welcome.faq.q3'), a: t('welcome.faq.a3') },
                                    { q: t('welcome.faq.q4'), a: t('welcome.faq.a4') },
                                    { q: t('welcome.faq.q5'), a: t('welcome.faq.a5') },
                                    { q: t('welcome.faq.q6'), a: t('welcome.faq.a6') }
                                ].map((f, i) => (
                                    <details key={i} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                                        <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-open:text-cyan-600 transition-colors uppercase tracking-wider">{f.q}</h3>
                                            <ChevronDown size={18} className="text-slate-400 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="px-6 pb-6 text-sm text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-50 dark:border-slate-800 pt-4">
                                            {f.a}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>

                        {/* SECTION 10: FINAL CTA */}
                        <footer className="text-center bg-cyan-600 rounded-[3rem] p-12 lg:p-20 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-white/20"></div>
                            <h2 className="text-3xl lg:text-5xl font-bold mb-6 relative z-10 uppercase tracking-tight">{t('welcome.final_cta.title')}</h2>
                            <p className="text-cyan-50 text-lg lg:text-xl mb-12 max-w-2xl mx-auto opacity-90 relative z-10">
                                {t('welcome.final_cta.desc')}
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-6 relative z-10">
                                <button onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.LIST) : setIsAuthModalOpen(true)} className="px-10 py-5 bg-white text-cyan-700 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl uppercase tracking-widest animate-pulse hover:animate-none">
                                    {t('welcome.final_cta.main_btn')}
                                    <p className="text-[10px] font-normal mt-1 opacity-70 normal-case">{t('welcome.final_cta.btn_sub', { count: totalJobs })}</p>
                                </button>
                                <button className="px-10 py-5 bg-cyan-700/50 text-white border border-cyan-400/30 rounded-2xl font-bold text-lg hover:bg-cyan-700/70 transition-colors uppercase tracking-widest">
                                    {t('welcome.final_cta.news_btn')}
                                    <p className="text-[10px] font-normal mt-1 opacity-70 normal-case">{t('welcome.final_cta.news_sub')}</p>
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        );
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
                                        placeholder={viewState === ViewState.SAVED ? t('app.search_saved_placeholder') : t('app.search_placeholder')}
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
                                        <p className="font-bold mb-2">{t('app.no_jobs_found')}</p>
                                        <p className="text-xs opacity-75 max-w-[200px] mb-4">
                                            {t('app.try_adjust_filters')}
                                        </p>
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
                        </div>
                    </div>
                </section>

                {/* RIGHT COLUMN: Detail View (or Welcome Guide) */}
                <section className={`lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 h-full ${!selectedJobId ? 'hidden lg:flex' : 'flex'}`}>
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
                                                                        Procent změny příjmu z dopravy × 1.5 = JHI body<br/>
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

                                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 break-words whitespace-pre-wrap">
                                        <Markdown options={{ forceBlock: true }}>{selectedJob.description}</Markdown>
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
                        renderWelcomeGuide()
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
                savedJobIds={savedJobIds}
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
