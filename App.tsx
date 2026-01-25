import React, { useState, useEffect, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Job, ViewState, AIAnalysisResult, UserProfile, CommuteAnalysis, CompanyProfile, JHI, CareerPathfinderResult } from './types';

import { Analytics } from '@vercel/analytics/react';
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
import { analyzeJobDescription, estimateSalary } from './services/geminiService';
import { calculateCommuteReality } from './services/commuteService';
import { fetchRealJobs } from './services/jobService';
import { supabase, signOut, getUserProfile, updateUserProfile, getRecruiterCompany } from './services/supabaseService';
import { canCandidateUseFeature } from './services/billingService';
import { analyzeJobForPathfinder } from './services/careerPathfinderService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { redirectToCheckout, checkPaymentStatus } from './services/stripeService';
import {
    Search,
    Filter,
    ArrowUpRight,
    UserCircle,
    LogOut,
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
    Sun,
    Moon,
    ChevronDown,
    ChevronUp,
    ThumbsUp,
    CheckCircle,
    Gift,
    Globe,

    Map,
    ShieldCheck,
    Info,
    Briefcase,
    RefreshCw,
    Lock,
    Navigation,
    ShoppingBag,
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

// HELPER: Remove accents for robust searching (Brno == Brňo, Plzen == Plzeň)
const removeAccents = (str: any) => {
    if (!str) return '';
    if (typeof str !== 'string') return String(str).toLowerCase();
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// HELPER: Benefit keyword mapping for smart filtering
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

export default function App() {
    // --- STATE ---
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LIST);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isEstimatingSalary, setIsEstimatingSalary] = useState(false);

    // Career Pathfinder State
    const [pathfinderAnalysis, setPathfinderAnalysis] = useState<CareerPathfinderResult | null>(null);

    // Cookie Consent State
    const [showCookieBanner, setShowCookieBanner] = useState(false);



    // UI State
    const [showFilters, setShowFilters] = useState(false);

    // Auth & Onboarding State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);

    // USER PROFILE STATE
    const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

    // Filter Sections State
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        contract: true,
        benefits: true
    });



    // Application Modal State
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

    // Company Registration State
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);

    // Saved Jobs State
    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState<number>(50); // Default 50km
    const [enableCommuteFilter, setEnableCommuteFilter] = useState(false); // Default OFF to show all jobs
    const [filterBenefits, setFilterBenefits] = useState<string[]>([]);
    const [filterContractType, setFilterContractType] = useState<string[]>([]);

    const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
    const selectedJob = jobs.find(j => j.id === selectedJobId);

    // --- EFFECTS ---

    const handleSessionRestoration = async (userId: string) => {
        try {
            const profile = await getUserProfile(userId);
            if (profile) {
                setUserProfile(prev => ({
                    ...prev,
                    ...profile,
                    isLoggedIn: true
                }));

                // Auto-Upgrade Logic for Admin Tester
                if (profile.email === 'misahlavacu@gmail.com' && profile.role !== 'recruiter') {
                    console.log("Auto-upgrading admin tester to recruiter...");
                    await updateUserProfile(userId, { role: 'recruiter' });
                    // Force update local state
                    setUserProfile(prev => ({ ...prev, role: 'recruiter' }));
                    // Check if admin already has a company
                    const company = await getRecruiterCompany(userId);
                    if (company) {
                        setCompanyProfile(company);
                        setViewState(ViewState.COMPANY_DASHBOARD);
                    } else {
                        // Don't automatically show onboarding - let them click to create company
                        setViewState(ViewState.LIST);
                    }
                }

                // Auto-enable commute filter on restore if address exists
                if (profile.address) {
                    setEnableCommuteFilter(true);
                    setFilterMaxDistance(50);
                }

                if (profile.role === 'recruiter') {
                    const company = await getRecruiterCompany(userId);
                    if (company) {
                        setCompanyProfile(company);
                        setViewState(ViewState.COMPANY_DASHBOARD);
                    } else {
                        // Don't automatically show onboarding - user can click to create company
                        setViewState(ViewState.LIST);
                    }
                }
            }
        } catch (error) {
            console.error("Session restoration failed:", error);
        }
    };

    const refreshUserProfile = async () => {
        try {
            if (!supabase) return;
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (userId) {
                const profile = await getUserProfile(userId);
                if (profile) {
                    setUserProfile(prev => ({
                        ...prev,
                        ...profile,
                        isLoggedIn: true
                    }));
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

        // Update SEO meta tags based on current view
        const pageName = showCompanyLanding ? 'company-dashboard' :
            viewState === ViewState.LIST ? 'home' :
                viewState === ViewState.PROFILE ? 'profile' :
                    viewState === ViewState.MARKETPLACE ? 'marketplace' :
                        viewState === ViewState.COMPANY_DASHBOARD ? 'company-dashboard' : 'home';

        const metadata = generateSEOMetadata(pageName, selectedJob);
        updatePageMeta(metadata);

        // LOAD REAL DATA
        loadRealJobs();
        checkPaymentStatus();

        // AUTH LISTENER
        if (supabase) {
            supabase.auth.getSession().then(({ data }) => {
                if (data?.session) {
                    handleSessionRestoration(data.session.user.id);
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

        const metadata = generateSEOMetadata(pageName, selectedJob);
        updatePageMeta(metadata);
    }, [viewState, showCompanyLanding, selectedJob, userProfile]);

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

    // --- FILTERING LOGIC ---

    const filteredJobs = useMemo(() => {
        let sourceJobs = jobs;
        if (viewState === ViewState.SAVED) {
            sourceJobs = jobs.filter(job => savedJobIds.includes(job.id));
        }

        const filtered = sourceJobs.filter(job => {
            // 1. Text Search (Accent Insensitive)
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

            // 2. City Filter (Accent Insensitive + Tag Check)
            // Determines if we are in "Manual Location Mode"
            const isManualLocationSearch = filterCity.trim().length > 0;

            if (isManualLocationSearch) {
                const cityNormalized = removeAccents(filterCity.trim());
                // Check explicit location OR tags (tags often contain the normalized city name)
                const locMatch = removeAccents(job.location).includes(cityNormalized);
                const tagMatch = job.tags.some(t => removeAccents(t).includes(cityNormalized));

                if (!locMatch && !tagMatch) return false;
            }

            // 3. Benefits Filter (Smart Matching)
            if (filterBenefits.length > 0) {
                const hasAllBenefits = filterBenefits.every(filterBenefit => {
                    // Get keywords for this filter category
                    const keywords = BENEFIT_KEYWORDS[filterBenefit] || [removeAccents(filterBenefit)];

                    // Check if ANY of the keywords exist in ANY of the job benefits
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

            // 4. Contract Type
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

            // 5. Distance Filter
            // Rule: Auto-apply if enabled AND user has address AND user is NOT manually searching for another city
            if (!isManualLocationSearch && enableCommuteFilter && userProfile.isLoggedIn && userProfile.address) {
                const commute = calculateCommuteReality(job, userProfile);
                if (commute && commute.distanceKm !== -1 && !commute.isRelocation && commute.distanceKm > filterMaxDistance) return false;
            }

            return true;
        });

        // --- SORTING ---
        if (userProfile.isLoggedIn && userProfile.address && !searchTerm && !filterCity) {
            return filtered.sort((a, b) => {
                const commuteA = calculateCommuteReality(a, userProfile);
                const commuteB = calculateCommuteReality(b, userProfile);

                const getSortDist = (c: CommuteAnalysis | null) => {
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


    // --- HANDLERS ---

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

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
        if (!canCandidateUseFeature(userProfile, 'ATC_HACK')) {
            setShowPremiumUpgrade({ open: true, feature: 'AI Analýza & ATC Hack' });
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

    const PremiumUpgradeModal = () => {
        if (!showPremiumUpgrade.open) return null;

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                    onClick={() => setShowPremiumUpgrade({ open: false })}
                ></div>
                <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 p-10 text-center">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-600 to-blue-600"></div>

                    <div className="w-20 h-20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Sparkles size={40} />
                    </div>

                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Odemkněte JobShaman Premium</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                        Funkce <span className="font-bold text-cyan-600 dark:text-cyan-400">"{showPremiumUpgrade.feature}"</span> a další AI nástroje jsou dostupné pouze pro prémiové členy.
                    </p>

                    <div className="grid grid-cols-1 gap-3 mb-8 text-left">
                        {[
                            'Neomezená AI analýza inzerátů (ATC Hack)',
                            'Automatické generování motivačních dopisů',
                            'Inteligentní optimalizace CV na míru pozici',
                            'Prioritní zobrazení pro náboraře'
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{f}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            if (!userProfile.isLoggedIn || !userProfile.id) {
                                setIsAuthModalOpen(true);
                                setShowPremiumUpgrade({ open: false });
                                return;
                            }
                            redirectToCheckout('premium', userProfile.id);
                        }}
                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-95 mb-4"
                    >
                        Upgradovat na Premium za 199 Kč/měsíc
                    </button>

                    <button
                        onClick={() => setShowPremiumUpgrade({ open: false })}
                        className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Možná později
                    </button>
                </div>
            </div>
        );
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

    const toggleBenefitFilter = (benefit: string) => {
        setFilterBenefits(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
    };

    const toggleContractFilter = (type: string) => {
        setFilterContractType(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
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

    // HEADER COMPONENT
    const Header = () => (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto">
                {/* Logo */}
                <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
                >
                    <img
                        src="/logo.png"
                        alt="JobShaman"
                        className="w-8 h-8 rounded-lg transition-transform group-hover:scale-105"
                    />
                    <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Job<span className="text-cyan-600 dark:text-cyan-400">Shaman</span></span>
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-x-auto">
                    {!showCompanyLanding && (
                        <>
                            <button
                                onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.LIST ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                Nabídky
                            </button>
                            <button
                                onClick={() => setViewState(ViewState.SAVED)}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.SAVED ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                Uložené
                                <span className={`text-[10px] px-1.5 rounded-full ${savedJobIds.length > 0 ? 'bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-200/50 dark:bg-slate-800/50'}`}>{savedJobIds.length}</span>
                            </button>
                            <button
                                onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.PROFILE) : handleAuthAction()}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.PROFILE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                Profil
                            </button>
                            <button
                                onClick={() => setViewState(ViewState.MARKETPLACE)}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.MARKETPLACE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                <ShoppingBag className="w-4 h-4" />
                                Kurzy & Rekvalifikace
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => {
                            if (showCompanyLanding) {
                                setShowCompanyLanding(false);
                                setViewState(ViewState.LIST);
                            } else if (userProfile.isLoggedIn) {
                                if (userProfile.role === 'recruiter') {
                                    setViewState(ViewState.COMPANY_DASHBOARD);
                                } else {
                                    setShowCompanyLanding(true);
                                }
                            } else {
                                setShowCompanyLanding(true);
                            }
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <Briefcase size={14} /> {showCompanyLanding ? 'Zpět' : 'Pro Firmy'}
                    </button>
                </nav>

                {/* Right Actions */}
                {!showCompanyLanding && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Změnit režim"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        {userProfile.isLoggedIn ? (
                            <div className="flex items-center gap-3 pl-2">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{userProfile.name}</div>
                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">JHI Aktivní</div>
                                </div>
                                <button
                                    onClick={handleAuthAction}
                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                    title="Odhlásit se"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAuthAction}
                                className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                            >
                                <UserCircle size={18} />
                                Přihlásit
                            </button>
                        )}
                    </div>
                )}

                {/* Legal Links - Desktop */}

            </div>
        </header>
    );

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
                                Next-Gen Hiring Intelligence
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
                                Profesionální <span className="text-cyan-600 dark:text-cyan-400">Analýza Nabídek</span>
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                                JobShaman dekóduje realitu za korporátními inzeráty. Počítáme skutečný čistý příjem, filtrujeme "balast" a kvantifikujeme štěstí v práci pomocí ověřených metrik.
                            </p>
                        </div>
                        {/* Demo components here */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Zap size={24} className="text-emerald-500" />
                                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">JHI Skóre</h3>
                                    </div>
                                    <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                        Jak to počítáme? <Info size={14} />
                                    </button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-8">
                                    <div className="h-56 w-full sm:w-1/2">
                                        <JHIChart jhi={demoJHI} theme={theme} />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                                        <p className="leading-relaxed">Kompozitní metrika (0-100) hodnotící nabídku holisticky: peníze, čas, stres a růst.</p>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded">Finance 90%</span>
                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded">Růst 70%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* More visual components */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Activity size={24} className="text-rose-500" />
                                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Signál vs. Šum</h3>
                                        <span className="text-xs text-slate-400">AI Detektor Klišé</span>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                            <span>Detektor Klišé</span>
                                            <span className="text-emerald-500"><ThumbsUp size={12} className="inline mr-1" /> Čistý signál</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full w-[15%]"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <span className="text-slate-500">Detekovaný tón</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">Professional</span>
                                    </div>
                                    <p className="text-xs text-slate-400 italic">
                                        Automatická detekce klišé ("Jsme jako rodina") a varovných signálů ("Odolnost vůči stresu").
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                    <Wallet size={20} className="text-indigo-500" /> Finanční Realita
                                </h3>
                                <div className="space-y-3 text-sm font-mono">
                                    <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Hrubá mzda</span><span>100 000 Kč</span></div>
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- Daně & Pojištění</span><span>23 000 Kč</span></div>
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- Náklady na cestu</span><span>2 500 Kč</span></div>
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 text-lg"><span>Skutečný čistý příjem</span><span>74 500 Kč</span></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-4">*Kalkulace zahrnuje hodnotu benefitů a náklady na dojíždění z vaší adresy.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                    <ShieldCheck size={20} className="text-amber-500" /> Transparentnost
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Fluktuace</div>
                                        <div className="text-emerald-500 font-bold text-xl">8% / rok</div>
                                    </div>
                                    <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Ghosting</div>
                                        <div className="text-amber-500 font-bold text-xl">15%</div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                                    Zobrazujeme průměrnou délku úvazku a pravděpodobnost, že se vám ozvou zpět. Data, která HR tají.
                                </p>

                                {/* EU Transparent Badge Explanation */}
                                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="w-4 h-4 bg-emerald-600 dark:bg-emerald-500 rounded flex items-center justify-center">
                                                <span className="text-white text-[10px] font-bold">€</span>
                                            </div>
                                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Proč vidíte EU Transparent odznak?</h4>
                                        </div>
                                    </div>
                                    <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300 mt-2">
                                        Od června 2026 bude uvádění platového rozmezí v EU povinné.
                                        My v JobShamanu věříme, že váš čas má svou cenu už dnes.
                                        Firmy s tímto označením hrají fér a otevřeně ukazují odměnu jako první.
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
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Kontextová Validace Benefitů</h3>
                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">AI Rozbor</span>
                            </div>

                            <div className="space-y-6">
                                <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-r-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Dog size={16} className="text-amber-600 dark:text-amber-400" />
                                        <span className="text-sm font-bold text-amber-800 dark:text-amber-200">Příklad z praxe</span>
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300 text-sm">
                                        <p className="font-medium mb-2">Vzdálená práce • 100% remote • Možnost home office</p>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-200 dark:border-amber-700">
                                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">Neaplikovatelné (1)</div>
                                            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                                <span>•</span>
                                                <span className="font-medium">dog-friendly office</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 italic leading-relaxed">
                                                Firma sice nabízí dog-friendly office, ale jelikož budete pracovat z obýváku, doporučujeme probrat s vaším psem, jestli s vaší celodenní přítomností u něj doma souhlasí.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ThumbsUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                                            <span className="font-bold text-emerald-800 dark:text-emerald-200">Relevantní benefity</span>
                                        </div>
                                        <ul className="text-emerald-700 dark:text-emerald-300 space-y-1 text-xs">
                                            <li>• Flexibilní pracovní doba</li>
                                            <li>• Příspěvek na home office vybavení</li>
                                            <li>• Virtualní teambuildingy</li>
                                        </ul>
                                    </div>
                                    <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                                            <span className="font-bold text-rose-800 dark:text-rose-200">Varovné signály</span>
                                        </div>
                                        <ul className="text-rose-700 dark:text-rose-300 space-y-1 text-xs">
                                            <li>• "Kancelářský pes" při remote práci</li>
                                            <li>• "Skvělá atmosféra v kanceláři"</li>
                                            <li>• "Obědy v firemní kantýně"</li>
                                        </ul>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Naše AI analyzuje relevantnost benefitů v kontextu pracovních podmínek. 
                                    Odhalíme nesrovnalosti a ušetříme čas čtením mezi řádky.
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
                        onRequestDemo={() => alert('Demo brzy dostupné! Kontaktujte nás na info@jobshaman.cz')}
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
            // Apply time cost impact (both negative for long commute, positive for remote)
            if (commuteAnalysis.jhiImpact !== 0) {
                dynamicJHI.timeCost = Math.max(0, Math.min(100, dynamicJHI.timeCost + (commuteAnalysis.jhiImpact * 2)));
            }

            // Apply financial adjustment (benefits, costs, etc.)
            const finAdjustment = commuteAnalysis.financialReality.scoreAdjustment;
            dynamicJHI.financial = Math.min(100, Math.max(0, dynamicJHI.financial + finAdjustment));

            // Apply bonus for good benefits package directly to growth/values
            const benefitsValue = commuteAnalysis.financialReality.benefitsValue;
            if (benefitsValue > 100) { // >100 EUR/month benefits
                const benefitsBonus = Math.min(8, Math.round(benefitsValue / 30)); // Up to 8 points, more generous scaling
                dynamicJHI.values = Math.min(100, dynamicJHI.values + benefitsBonus);
            }

            // Additional financial bonus for high net value (benefits - commute cost)
            const netBenefitValue = benefitsValue - commuteAnalysis.financialReality.commuteCost;
            if (netBenefitValue > 200) { // >200 EUR/month net benefit
                const netBonus = Math.min(6, Math.round((netBenefitValue - 200) / 100)); // Additional bonus
                dynamicJHI.growth = Math.min(100, dynamicJHI.growth + netBonus);
            }

            // Recalculate overall score
            dynamicJHI.score = Math.round((dynamicJHI.financial + dynamicJHI.timeCost + dynamicJHI.mentalLoad + dynamicJHI.growth + dynamicJHI.values) / 5);
        }

        // Determine what to show in the Financial Card
        const showCommuteDetails = userProfile.isLoggedIn && userProfile.address && commuteAnalysis;
        const showLoginPrompt = !userProfile.isLoggedIn;
        const showAddressPrompt = userProfile.isLoggedIn && !userProfile.address;

        // Currency for display
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
                                        placeholder={viewState === ViewState.SAVED ? "Hledat v uložených..." : "Hledat pozici, firmu..."}
                                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-sm font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-all"
                                    />
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`absolute inset-y-1 right-1 p-1.5 rounded-md transition-all ${showFilters ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400'}`}
                                        title="Filtry"
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
                                            <span>Lokalita & Dojezd</span>
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
                                                        placeholder="Město (např. Praha)"
                                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                                    />
                                                </div>
                                                <label className="flex items-center justify-between cursor-pointer p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <Car size={16} className={`transition-colors ${enableCommuteFilter ? 'text-cyan-500' : 'text-slate-400'}`} />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Limitovat dojezdem</span>
                                                    </div>
                                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${enableCommuteFilter ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'}`} onClick={(e) => { e.preventDefault(); setEnableCommuteFilter(!enableCommuteFilter); }}>
                                                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${enableCommuteFilter ? 'left-6' : 'left-1'}`}></div>
                                                    </div>
                                                </label>
                                                {enableCommuteFilter && (
                                                    <div className={`p-3 rounded-md border ${userProfile.isLoggedIn && userProfile.address ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-100 dark:bg-slate-900/50 border-dashed border-slate-300 dark:border-slate-800 opacity-60'}`}>
                                                        <div className="flex justify-between text-xs mb-2">
                                                            <span className="font-medium text-slate-500 dark:text-slate-400">Max Vzdálenost</span>
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
                                            <span>Typ Úvazku</span>
                                            {expandedSections.contract ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        {expandedSections.contract && (
                                            <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1">
                                                {['HPP', 'IČO', 'Part-time'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => toggleContractFilter(type)}
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
                                        <p className="text-sm">Hledám nabídky...</p>
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
                                        <p className="font-bold mb-2">Nebyly nalezeny žádné pozice.</p>
                                        <p className="text-xs opacity-75 max-w-[200px] mb-4">
                                            Zkuste upravit filtry nebo hledaný výraz.
                                        </p>
                                        {jobs.length === 0 && (
                                            <button
                                                onClick={loadRealJobs}
                                                className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <RefreshCw size={14} /> Zkusit znovu
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
                                        <button className="lg:hidden mb-4 flex items-center gap-1 text-slate-500 text-sm hover:text-slate-900 dark:hover:text-white" onClick={() => setSelectedJobId(null)}>&larr; Zpět</button>
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
                                        {pathfinderAnalysis && !pathfinderAnalysis.isLoading && (
                                            pathfinderAnalysis.hasAssessment ? (
                                                <button
                                                    className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg border border-amber-600 transition-colors text-sm font-medium flex items-center gap-2"
                                                    title="Spustit AI Assessment"
                                                    onClick={() => {
                                                        alert('AI Assessment module brzy dostupný!');
                                                        // TODO: Implement actual assessment functionality
                                                    }}
                                                >
                                                    <img src="/logo.png" alt="AI Test" className="w-4 h-4" />
                                                    AI Test
                                                </button>
                                            ) : (
                                                <button
                                                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
                                                    title="Koupit AI Assessment"
                                                    onClick={() => {
                                                        if (!userProfile.isLoggedIn || !userProfile.id) {
                                                            setIsAuthModalOpen(true);
                                                            return;
                                                        }
                                                        redirectToCheckout('assessment_bundle', userProfile.id);
                                                    }}
                                                >
                                                    <Zap size={16} className="text-amber-500" />
                                                    AI Test
                                                </button>
                                            )
                                        )}
                                        {selectedJob.url ? (
                                            <a
                                                href={selectedJob.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95"
                                            >
                                                Mám zájem <ArrowUpRight size={18} />
                                            </a>
                                        ) : (
                                            <button onClick={() => setIsApplyModalOpen(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95">
                                                Mám zájem <ArrowUpRight size={18} />
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
                                                    <Wallet className="text-emerald-400" size={20} /> Finanční & Dojezdová Realita
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {showCommuteDetails ? `Na základě ${userProfile.address}` : 'Kalkulace čistého příjmu a nákladů na dojíždění.'}
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
                                                <h4 className="text-white font-bold text-lg mb-2">Odemkněte Finanční Realitu</h4>
                                                <p className="text-slate-400 max-w-sm mb-6 text-sm">
                                                    Přihlaste se a zjistěte, kolik vám skutečně zůstane v peněžence po odečtení daní a dojíždění.
                                                </p>
                                                <button onClick={handleAuthAction} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                                                    Přihlásit se
                                                </button>
                                            </div>
                                        )}

                                        {/* State: Logged In but No Address */}
                                        {showAddressPrompt && (
                                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                                <Navigation size={40} className="text-slate-500 mb-4" />
                                                <h4 className="text-white font-bold text-lg mb-2">Chybí nám startovní bod</h4>
                                                <p className="text-slate-400 max-w-sm mb-6 text-sm">
                                                    Nastavte svou adresu v profilu, abychom mohli spočítat čas a náklady na cestu do {selectedJob.location}.
                                                </p>
                                                <button onClick={() => setViewState(ViewState.PROFILE)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                                                    Nastavit adresu v profilu
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
                                                            <h4 className="text-white font-bold text-lg mb-1">Nutná Relokace</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">Tato pozice vyžaduje stěhování nebo digitální nomádství.</p>
                                                        </div>
                                                    ) : commuteAnalysis.isRelocation ? (
                                                        <div className="text-center py-2">
                                                            <Map size={40} className="text-rose-500 mx-auto mb-3 opacity-70" />
                                                            <h4 className="text-white font-bold text-lg mb-1">Vyžaduje stěhování</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">Vzdálenost {commuteAnalysis.distanceKm} km je pro denní dojíždění nepraktická.</p>
                                                        </div>
                                                    ) : commuteAnalysis.distanceKm === -1 ? (
                                                        <div className="text-center py-2">
                                                            <Map size={40} className="text-slate-500 mx-auto mb-3 opacity-50" />
                                                            <h4 className="text-white font-bold text-lg mb-1">Neznámá vzdálenost</h4>
                                                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">Systém nedokázal přesně určit lokaci.</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><MapPin size={12} /> Logistika Dojíždění</h4>
                                                            <div className="relative h-12 mb-6">
                                                                <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Domov</span><span>Práce</span></div>
                                                                <div className="absolute top-6 left-0 right-0 h-1.5 bg-slate-900/50 rounded-full overflow-hidden"><div className={`h-full ${commuteAnalysis.timeMinutes > 45 ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%` }}></div></div>
                                                                <div className="absolute top-4 p-1.5 bg-slate-600 border border-slate-500 rounded-full text-white shadow-md transition-all" style={{ left: `clamp(0%, ${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%, 100%)`, transform: 'translateX(-50%)' }}>{React.createElement(getTransportIcon(userProfile.transportMode), { size: 14 })}</div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div><div className="text-2xl font-mono text-white font-light flex items-center gap-2"><Clock size={20} className="text-slate-400" /> {commuteAnalysis.timeMinutes * 2} <span className="text-sm text-slate-400 font-sans font-bold">min</span></div><div className="text-[10px] text-slate-400 mt-1">Denně tam a zpět</div></div>
                                                                <div><div className="text-2xl font-mono text-white font-light">{commuteAnalysis.distanceKm} <span className="text-sm text-slate-400 font-sans font-bold">km</span></div><div className="text-[10px] text-slate-400 mt-1">Jedna cesta</div></div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="p-6 bg-slate-900/30">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calculator size={12} /> Čistý Příjem vs Realita</h4>
                                                    <div className="space-y-1 text-sm font-mono">
                                                        {/* AI Estimation Hint */}
                                                        {selectedJob.aiEstimatedSalary && (
                                                            <div className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                                                                <Sparkles size={10} />
                                                                Mzda odhadnuta AI modelem na základě tržních dat.
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between text-slate-300">
                                                            <span>Hrubá mzda</span>
                                                            <span>{commuteAnalysis.financialReality.grossMonthlySalary > 0 ? `${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString()} ${cur}` : (selectedJob.aiEstimatedSalary ? `${selectedJob.aiEstimatedSalary.min.toLocaleString()} - ${selectedJob.aiEstimatedSalary.max.toLocaleString()} ${selectedJob.aiEstimatedSalary.currency}` : "???")}</span>
                                                        </div>
                                                        <div className="flex justify-between text-rose-300 text-xs">
                                                            <span>- Daň/Poj. (Zaměstnanec)</span>
                                                            <span>{commuteAnalysis.financialReality.estimatedTaxAndInsurance.toLocaleString()} {cur}</span>
                                                        </div>
                                                        <div className="flex justify-between text-white font-bold pt-2 mt-1 border-t border-slate-700">
                                                            <span>Čistý základ</span>
                                                            <span>{commuteAnalysis.financialReality.netBaseSalary.toLocaleString()} {cur}</span>
                                                        </div>
                                                        <div className="flex justify-between text-emerald-400">
                                                            <span>+ Hodnota benefitů</span>
                                                            <span>{commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}</span>
                                                        </div>
                                                        {commuteAnalysis.financialReality.benefitsValue > 0 && (
                                                            <div className="text-xs text-slate-400 mt-2 italic">
                                                                <div className="flex items-start gap-1">
                                                                    <span className="text-blue-400">ℹ️</span>
                                                                    <div>
                                                                        <div>Hodnota benefitů: {commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}/měsíc</div>
                                                                        <div>Odhad založený na průměrných tržních hodnotách.</div>
                                                                        <div>Skutečná hodnota se může lišit.</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {(
                                                            <div className="flex justify-between text-rose-400">
                                                                <span>- Náklady na cestu</span>
                                                                <span>{commuteAnalysis.isRelocation ? '???' : `${commuteAnalysis.financialReality.commuteCost.toLocaleString()} ${cur}`}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-xl font-bold text-white pt-3 mt-3 border-t border-slate-700">
                                                            <span>Čistá Realita</span>
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
                                                <Gift size={16} /> Benefity & Výhody
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
                                                        <div><h3 className="text-slate-900 dark:text-slate-100 font-bold">Index Štěstí (JHI)</h3><p className="text-slate-500 dark:text-slate-400 text-xs">Kompozitní skóre kvality</p></div>
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
                                                    <h3 className="font-bold text-cyan-600 dark:text-cyan-400 mb-2">AI Analýza</h3>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200">{aiAnalysis.summary}</p>
                                                </div>
                                            ) : (
                                                <button onClick={handleAnalyzeJob} disabled={analyzing} className="w-full py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-300 rounded-xl flex items-center justify-center gap-3 text-sm font-bold shadow-sm">
                                                    {analyzing ? 'Analyzuji...' : 'Spustit AI Analýzu'}
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
            <Header />

            <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    {renderContent()}
                </div>
            </main>

            <PremiumUpgradeModal />

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
                    // TODO: Handle successful registration
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

            {/* Footer */}
            <footer className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            © 2026 JobShaman. Všechna práva vyhrazena.
                        </div>
                        <div className="flex gap-6 text-sm">
                            <a
                                href="/podminky-uziti"
                                target="_blank"
                                className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                            >
                                Podmínky použití
                            </a>
                            <a
                                href="/ochrana-osobnich-udaju"
                                target="_blank"
                                className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                            >
                                Ochrana osobních údajů
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
}
