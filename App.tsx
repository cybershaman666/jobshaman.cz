import React, { useState, useEffect } from 'react';
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
import { analyzeJobDescription, estimateSalary } from './services/geminiService';
import { calculateCommuteReality } from './services/commuteService';
import { fetchRealJobs } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile } from './services/supabaseService';
import { canCandidateUseFeature } from './services/billingService';
import { analyzeJobForPathfinder } from './services/careerPathfinderService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { checkPaymentStatus } from './services/stripeService';
import { useUserProfile } from './hooks/useUserProfile';
import { useJobFilters } from './hooks/useJobFilters';
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
    ThumbsUp,
    CheckCircle,
    Gift,
    Globe,
    Map,
    ShieldCheck,
    Info,
    RefreshCw,
    Lock,
    Navigation,
    Dog,
    AlertTriangle
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
    // --- STATE ---
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isEstimatingSalary, setIsEstimatingSalary] = useState(false);

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
        filteredJobs,
        searchTerm,
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
    } = useJobFilters(jobs, userProfile);

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
            console.log("Fetching jobs...");
            const realJobs = await fetchRealJobs();
            console.log(`Fetched ${realJobs.length} jobs.`);
            setJobs(realJobs);
        } catch (e) {
            console.error("Failed to load jobs", e);
        } finally {
            setIsLoadingJobs(false);
        }
    };

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



            // Salary Estimation Logic (New)
            if ((!selectedJob.salaryRange || selectedJob.salaryRange === "Mzda neuvedena") && !selectedJob.aiEstimatedSalary && !isEstimatingSalary) {
                setIsEstimatingSalary(true);
                estimateSalary(selectedJob.title, selectedJob.company, selectedJob.location, selectedJob.description)
                    .then(estimate => {
                        if (estimate) {
                            setJobs(prevJobs => prevJobs.map(j =>
                                j.id === selectedJob.id ? { ...j, aiEstimatedSalary: estimate } : j
                            ));
                        }
                    })
                    .catch(err => console.error("Salary estimation error", err))
                    .finally(() => setIsEstimatingSalary(false));
            }
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

        // Scroll detail view to top after a short delay to allow the content to render
        setTimeout(() => {
            const detailScrollElement = document.querySelector('[data-detail-scroll="true"]');
            if (detailScrollElement) {
                detailScrollElement.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        }, 150);
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
        // ... [No changes here] ...
        const demoJHI: JHI = { score: 70, financial: 75, timeCost: 65, mentalLoad: 70, growth: 75, values: 60 };
        return (
            <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
                    <div className="my-auto w-full max-w-5xl">
                        <div className="text-center mb-16">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
                                <Sparkles size={12} />
                                {t('welcome.next_gen_tag')}
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight">
                                {t('welcome.title_main')} <span className="text-cyan-600 dark:text-cyan-400">{t('welcome.title_accent')}</span>
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                                {t('welcome.subtitle')}
                            </p>
                        </div>
                        {/* Demo components here */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Zap size={24} className="text-emerald-500" />
                                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('welcome.jhi_score')}</h3>
                                    </div>
                                    <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                        {t('welcome.how_it_works')} <Info size={14} />
                                    </button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-8">
                                    <div className="h-56 w-full sm:w-1/2">
                                        <JHIChart jhi={demoJHI} theme={theme} />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                                        <p className="leading-relaxed">{t('welcome.jhi_desc')}</p>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded">{t('welcome.finance_stat')}</span>
                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded">{t('welcome.growth_stat')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* More visual components */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Activity size={24} className="text-rose-500" />
                                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('welcome.signal_noise')}</h3>
                                        <span className="text-xs text-slate-400">{t('welcome.cliche_detector')}</span>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                            <span>{t('welcome.cliche_detector')}</span>
                                            <span className="text-emerald-500"><ThumbsUp size={12} className="inline mr-1" /> {t('welcome.clean_signal')}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full w-[15%]"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <span className="text-slate-500">{t('welcome.cliche_tone')}</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{t('welcome.tone_professional')}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 italic">
                                        {t('welcome.cliche_desc')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                    <Wallet size={20} className="text-indigo-500" /> {t('financial.reality_title')}
                                </h3>
                                <div className="space-y-3 text-sm font-mono">
                                    <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('financial.gross_monthly')}</span><span>100 000 Kč</span></div>
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- {t('financial.tax_insurance')}</span><span>23 000 Kč</span></div>
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- {t('financial.commute_costs')}</span><span>2 500 Kč</span></div>
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 text-lg"><span>{t('financial.net_income')}</span><span>74 500 Kč</span></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-4">{t('financial.calculation_hint')}</p>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                    <ShieldCheck size={20} className="text-amber-500" /> {t('welcome.transparency_title')}
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">{t('welcome.fluctuation')}</div>
                                        <div className="text-emerald-500 font-bold text-xl">{t('welcome.fluctuation_val')}</div>
                                    </div>
                                    <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">{t('welcome.ghosting')}</div>
                                        <div className="text-amber-500 font-bold text-xl">{t('welcome.ghosting_val')}</div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                                    {t('welcome.transparency_desc')}
                                </p>

                                {/* EU Transparent Badge Explanation */}
                                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="w-4 h-4 bg-emerald-600 dark:bg-emerald-500 rounded flex items-center justify-center">
                                                <span className="text-white text-[10px] font-bold">€</span>
                                            </div>
                                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t('welcome.eu_transparent_title')}</h4>
                                        </div>
                                    </div>
                                    <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300 mt-2">
                                        {t('welcome.eu_transparent_desc')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Benefit Validation Example */}
                        <div className="mt-16 bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                    <AlertTriangle size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('welcome.benefit_validation_title')}</h3>
                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{t('welcome.ai_analysis_label')}</span>
                            </div>

                            <div className="space-y-6">
                                <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-r-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Dog size={16} className="text-amber-600 dark:text-amber-400" />
                                        <span className="text-sm font-bold text-amber-800 dark:text-amber-200">{t('welcome.case_study')}</span>
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300 text-sm">
                                        <p className="font-medium mb-2">{t('welcome.remote_job_example')}</p>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-200 dark:border-amber-700">
                                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">{t('welcome.not_applicable')} (1)</div>
                                            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                                <span>•</span>
                                                <span className="font-medium">{t('welcome.dog_friendly_office')}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 italic leading-relaxed">
                                                {t('welcome.dog_joke')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ThumbsUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                                            <span className="font-bold text-emerald-800 dark:text-emerald-200">{t('welcome.relevant_benefits')}</span>
                                        </div>
                                        <ul className="text-emerald-700 dark:text-emerald-300 space-y-1 text-xs">
                                            <li>• {t('welcome.flexible_hours')}</li>
                                            <li>• {t('welcome.ho_equipment')}</li>
                                            <li>• {t('welcome.virtual_teambuilding')}</li>
                                        </ul>
                                    </div>
                                    <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                                            <span className="font-bold text-rose-800 dark:text-rose-200">{t('welcome.warning_signals')}</span>
                                        </div>
                                        <ul className="text-rose-700 dark:text-rose-300 space-y-1 text-xs">
                                            <li>• {t('welcome.office_dog_remote')}</li>
                                            <li>• {t('welcome.great_atmosphere')}</li>
                                            <li>• {t('welcome.canteen')}</li>
                                        </ul>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {t('welcome.ai_analysis_desc')}
                                </p>
                            </div>
                        </div>
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
                <section className={`lg:col-span-4 xl:col-span-3 flex flex-col gap-4 min-h-0 ${selectedJobId ? 'hidden lg:flex' : 'flex'} sticky top-20 max-h-[calc(100vh-100px)]`}>
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
                                        onChange={(e) => setSearchTerm(e.target.value)}
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
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nalezené pozice ({filteredJobs.length})</h3>
                                {showFilters && (
                                    <button onClick={() => setShowFilters(false)} className="text-xs text-cyan-500 hover:underline lg:hidden">
                                        Skrýt filtry
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {isLoadingJobs ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                        <Activity className="animate-spin mb-2 text-cyan-500" size={24} />
                                        <p className="text-sm">{t('app.searching')}</p>
                                    </div>
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
                                        {jobs.length === 0 && (
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
                <section className={`lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 ${!selectedJobId ? 'hidden lg:flex' : 'flex'}`}>
                    {selectedJob && dynamicJHI ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex flex-col h-full overflow-hidden sticky top-20 max-h-[calc(100vh-100px)]">
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar" data-detail-scroll="true">
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
                                                <div className="p-6 bg-slate-900/30">
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
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-900 dark:selection:text-cyan-100`}>
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

            <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
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
