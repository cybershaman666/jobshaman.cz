import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { Job, ViewState, UserProfile, CompanyProfile } from './types';

import { Analytics } from '@vercel/analytics/react';
import { initialBlogPosts } from './src/data/blogPosts';
import AppHeader from './components/AppHeader';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';
import CompanyOnboarding from './components/CompanyOnboarding';
import ApplyFollowupModal from './components/ApplyFollowupModal';
import EnterpriseSignup from './components/EnterpriseSignup';
import CookieBanner from './components/CookieBanner';
import PodminkyUziti from './pages/PodminkyUziti';
import OchranaSoukromi from './pages/OchranaSoukromi';
import CandidateActivationRail from './components/CandidateActivationRail';
import ChallengeHomeSections from './components/challenges/ChallengeHomeSections';
import ChallengeMarketplace from './components/challenges/ChallengeMarketplace';
import ChallengeFocusView from './components/challenges/ChallengeFocusView';
import PublicCompanyProfilePage from './components/challenges/PublicCompanyProfilePage';
import BlogSection from './components/BlogSection';
import { fetchJobById, fetchJobsByIds } from './services/jobService';
import { clearJobCache } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile, verifyAuthSession, trackAnalyticsEvent } from './services/supabaseService';
import { checkCookieConsent, getCookiePreferences } from './services/cookieConsentService';
import { checkPaymentStatus } from './services/stripeService';
import { clearCsrfToken } from './services/csrfService';
import { clearPasswordRecoveryPending, isPasswordRecoveryPending } from './services/supabaseClient';
import { trackPageView } from './services/trafficAnalytics';
import { trackJobInteraction } from './services/jobInteractionService';
import { createJobApplication } from './services/jobApplicationService';
import { sendWelcomeEmail } from './services/welcomeEmailService';
import { useUserProfile } from './hooks/useUserProfile';
import { usePaginatedJobs } from './hooks/usePaginatedJobs';
import { BACKEND_URL, DEFAULT_USER_PROFILE, SEARCH_BACKEND_URL } from './constants';
import { mapJcfpmToJhiPreferencesWithExplanation } from './services/jcfpmService';
import { createDefaultJHIPreferences } from './services/profileDefaults';
import {
    deriveActivationState,
    getNextActivationStep,
    isActivationComplete,
    markFirstQualityAction,
    withActivationState
} from './services/candidateActivationService';
import { calculateJHI } from './utils/jhiCalculator';
import { AlertCircle, ArrowUp } from 'lucide-react';

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
const SAVED_JOBS_CACHE_PREFIX = 'jobshaman_saved_jobs_cache';

const normalizeSavedJobId = (jobId: string): string => {
    const raw = String(jobId || '').trim();
    if (!raw) return '';
    return raw.startsWith('db-') ? raw.substring(3) : raw;
};

const getSavedJobIdAliases = (jobId: string): string[] => {
    const raw = String(jobId || '').trim();
    const normalized = normalizeSavedJobId(raw);
    return Array.from(new Set([raw, normalized, normalized ? `db-${normalized}` : ''].filter(Boolean)));
};

const CompanyDashboard = lazy(() => import('./components/CompanyDashboard'));
const CompanyLandingPage = lazy(() => import('./components/CompanyLandingPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SavedJobsPage = lazy(() => import('./components/SavedJobsPage'));
const InvitationLanding = lazy(() => import('./pages/InvitationLanding'));
const AssessmentPreviewPage = lazy(() => import('./pages/AssessmentPreviewPage'));
const DemoHandshakePage = lazy(() => import('./pages/DemoHandshakePage'));
const DemoCompanyHandshakePage = lazy(() => import('./pages/DemoCompanyHandshakePage'));
const JcfpmFlow = lazy(() => import('./components/jcfpm/JcfpmFlow'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const CandidateOnboardingModal = lazy(() => import('./components/CandidateOnboardingModal'));
const CompanyRegistrationModal = lazy(() => import('./components/CompanyRegistrationModal'));
const ApplicationModal = lazy(() => import('./components/ApplicationModal'));
const ProfileEditor = lazy(() => import('./components/ProfileEditor'));
const PremiumUpgradeModal = lazy(() => import('./components/PremiumUpgradeModal'));

// JHI and formatting utilities now imported from utils/

export default function App() {
    const { t, i18n } = useTranslation();
    const vercelAnalyticsEnabled = import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('theme');
            if (stored === 'dark') {
                document.documentElement.classList.add('dark');
                return 'dark';
            }
        }
        document.documentElement.classList.remove('dark');
        return 'light';
    });
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
    const [isBlogOpen, setIsBlogOpen] = useState<boolean>(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
        return parts[0] === 'blog';
    });
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
        if (parts[0] === 'companies') return parts[1] || null;
        return null;
    });
    const [discoveryLane, setDiscoveryLane] = useState<'challenges' | 'imports'>('challenges');
    const [discoverySearchMode, setDiscoverySearchMode] = useState(false);
    const [challengeRemoteOnly, setChallengeRemoteOnly] = useState(false);
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

    // Track if user intentionally clicked on LIST (to prevent NavRestore from auto-restoring dashboard)
    const userIntentionallyClickedListRef = useRef(false);

    // UI State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'reset'>('login');
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [showCandidateOnboarding, setShowCandidateOnboarding] = useState(false);
    const [applyFollowup, setApplyFollowup] = useState<PendingApplyFollowup | null>(null);
    const [showApplyFollowup, setShowApplyFollowup] = useState(false);
    const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState<{ email?: string } | null>(null);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);
    const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const onboardingDismissedRef = useRef(false);
    const activationNudgeShownRef = useRef(false);
    const timeToValueTrackedRef = useRef(false);
    const welcomeEmailAttemptedRef = useRef(false);
    const passwordRecoveryInProgressRef = useRef(false);
    const guestAuthPromptedRef = useRef(false);


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
    const normalizedPath = useMemo(() => {
        const supportedLocales = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length > 0 && supportedLocales.includes(parts[0])) {
            parts.shift();
        }
        return `/${parts.join('/')}`;
    }, [window.location.pathname]);

    const isImmersiveAssessmentRoute = useMemo(() => {
        if (viewState === ViewState.JCFPM || viewState === ViewState.ASSESSMENT) return true;
        return normalizedPath === '/assessment-preview' ||
            normalizedPath.startsWith('/assessment/') ||
            normalizedPath === '/jcfpm' ||
            normalizedPath === '/profile/jcfpm' ||
            normalizedPath === '/profil/jcfpm';
    }, [viewState, normalizedPath]);
    const isAdminRoute = normalizedPath === '/admin';
    const usePageScrollLayout = !isImmersiveAssessmentRoute && (viewState === ViewState.PROFILE || viewState === ViewState.LIST || !!selectedCompanyId);
    const isHomeListView = !isImmersiveAssessmentRoute && viewState === ViewState.LIST && !selectedJobId && !selectedCompanyId;

    useEffect(() => {
        if (viewState !== ViewState.LIST || selectedCompanyId || isBlogOpen || showCompanyLanding) {
            setDiscoverySearchMode(false);
        }
    }, [isBlogOpen, selectedCompanyId, showCompanyLanding, viewState]);
    const userProfileRef = useRef<UserProfile>(userProfile);

    useEffect(() => {
        userProfileRef.current = userProfile;
    }, [userProfile]);

    // Track whether we should show the guest auth prompt.
    useEffect(() => {
        // If the session check hasn't finished at all, we do nothing.
        if (!sessionCheckComplete) return;

        // The critical check: If sessionCheckComplete is true but userProfile.id is missing,
        // we might just be in the split-second gap where handleSessionRestoration is fetching
        // the profile. If isLoggedIn is true, we ARE logged in and just waiting for the profile
        // object to fill out. Wait for it.
        if (userProfile.isLoggedIn && !userProfile.id) return;

        const isJcfpmRoute = normalizedPath === '/jcfpm' ||
            normalizedPath === '/profile/jcfpm' ||
            normalizedPath === '/profil/jcfpm';

        // Now we can safely assume (!userProfile.id) means "Guest"
        if (isJcfpmRoute && !userProfile.id && !guestAuthPromptedRef.current && !isAuthModalOpen) {
            console.log('🚪 [App] JCFPM guest detected, prompting registration...');
            guestAuthPromptedRef.current = true;
            setAuthModalMode('register');
            setIsAuthModalOpen(true);
        } else if (!isJcfpmRoute) {
            guestAuthPromptedRef.current = false;
        }
    }, [normalizedPath, sessionCheckComplete, userProfile.id, userProfile.isLoggedIn]);

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

        const activationState = deriveActivationState(userProfile);
        const needsCoreOnboarding =
            !activationState.location_verified ||
            !activationState.cv_ready ||
            activationState.skills_confirmed_count < 3 ||
            !activationState.preferences_ready;
        const shouldShow = needsCoreOnboarding && !onboardingDismissedRef.current;

        if (shouldShow) {
            setShowCandidateOnboarding(true);
        } else if (isActivationComplete(activationState)) {
            setShowCandidateOnboarding(false);
        }
    }, [
        userProfile.isLoggedIn,
        userProfile.role,
        userProfile,
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

    const isCompanyProfile = userProfile.role === 'recruiter' && !!companyProfile;
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
    const candidateActivationState = useMemo(
        () => deriveActivationState(userProfile),
        [userProfile]
    );
    const activationNextStep = useMemo(
        () => getNextActivationStep(candidateActivationState) || 'location',
        [candidateActivationState]
    );
    const activationMilestonesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!userProfile.isLoggedIn || userProfile.role === 'recruiter' || !userProfile.id) return;
        const current = userProfile.preferences?.activation_v1 || null;
        const sameState = current
            && current.location_verified === candidateActivationState.location_verified
            && current.cv_ready === candidateActivationState.cv_ready
            && current.skills_confirmed_count === candidateActivationState.skills_confirmed_count
            && current.preferences_ready === candidateActivationState.preferences_ready
            && current.first_quality_action_at === candidateActivationState.first_quality_action_at
            && current.completion_percent === candidateActivationState.completion_percent
            && current.last_prompted_step === candidateActivationState.last_prompted_step;
        if (sameState) return;

        const nextProfile = withActivationState(userProfile);
        userProfileRef.current = nextProfile;
        setUserProfile(nextProfile);
        void updateUserProfile(userProfile.id, { preferences: nextProfile.preferences }).catch((error) => {
            console.warn('Failed to persist activation state:', error);
        });
    }, [candidateActivationState, userProfile, setUserProfile]);

    useEffect(() => {
        if (!userProfile.isLoggedIn || userProfile.role === 'recruiter') return;
        const reached = [
            ['A1', candidateActivationState.location_verified],
            ['A2', candidateActivationState.cv_ready],
            ['A3', candidateActivationState.skills_confirmed_count >= 3],
            ['A4', candidateActivationState.preferences_ready],
            ['A5', Boolean(candidateActivationState.first_quality_action_at)],
        ] as const;

        reached.forEach(([milestone, done]) => {
            if (!done || activationMilestonesRef.current.has(milestone)) return;
            activationMilestonesRef.current.add(milestone);
            void trackAnalyticsEvent({
                event_type: 'activation_milestone_reached',
                feature: 'candidate_activation_v1',
                metadata: {
                    milestone,
                    completion_percent: candidateActivationState.completion_percent,
                },
            });
        });

        if (candidateActivationState.first_quality_action_at && !timeToValueTrackedRef.current) {
            timeToValueTrackedRef.current = true;
            void trackAnalyticsEvent({
                event_type: 'time_to_value_recorded',
                feature: 'candidate_activation_v1',
                metadata: {
                    first_quality_action_at: candidateActivationState.first_quality_action_at,
                },
            });
        }
    }, [candidateActivationState, userProfile.isLoggedIn, userProfile.role]);

    useEffect(() => {
        if (!userProfile.isLoggedIn || userProfile.role === 'recruiter' || !userProfile.id) return;
        if (viewState !== ViewState.PROFILE) return;
        if (isActivationComplete(candidateActivationState)) return;
        const isMissingA3 = candidateActivationState.skills_confirmed_count < 3;
        const nudgeKey = `jobshaman_activation_nudge_at:${userProfile.id}:${isMissingA3 ? 'A3' : 'A5'}`;
        const now = Date.now();
        const cooldownMs = isMissingA3 ? 24 * 60 * 60 * 1000 : 72 * 60 * 60 * 1000;
        try {
            const last = Number(localStorage.getItem(nudgeKey) || '0');
            if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) return;
            localStorage.setItem(nudgeKey, String(now));
        } catch {
            if (activationNudgeShownRef.current) return;
            activationNudgeShownRef.current = true;
        }
        void trackAnalyticsEvent({
            event_type: 'nudge_shown',
            feature: 'candidate_activation_v1',
            metadata: {
                source: 'activation_rail',
                next_step: activationNextStep,
                nudge_type: isMissingA3 ? 'missing_A3' : 'missing_A5',
            },
        });
    }, [activationNextStep, candidateActivationState, userProfile.id, userProfile.isLoggedIn, userProfile.role, viewState]);

    const {
        jobs: filteredJobs,
        loading: isLoadingJobs,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching,
        backendUnreachable,
        loadInitialJobs,
        loadMoreJobs,
        performSearch,
        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        filterDate,
        filterExperience,
        filterLanguageCodes,
        enableAutoLanguageGuard,
        setEnableAutoLanguageGuard,
        implicitLanguageCodesApplied,
        filterMinSalary,
        savedJobIds,
        setSavedJobIds,
        setSearchTerm,
        setFilterCity,
        setFilterBenefits,
        setFilterContractType,
        setFilterDate,
        setFilterExperience,
        setFilterLanguageCodes,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterMinSalary,
        toggleBenefitFilter,
        toggleContractTypeFilter,
        globalSearch,
        abroadOnly,
        setGlobalSearch,
        setAbroadOnly,
        sortBy,
        applyInteractionState
    } = usePaginatedJobs({ userProfile: effectiveUserProfile, enabled: !isAdminRoute });
    const [savedJobsSearchTerm, setSavedJobsSearchTerm] = useState('');
    useEffect(() => {
        if (viewState === ViewState.SAVED) {
            setSavedJobsSearchTerm('');
        }
    }, [viewState]);

    const jhiCacheRef = useRef<Map<string, { key: string; jhi: any }>>(new Map());
    const jhiPrefsKey = useMemo(
        () => JSON.stringify(effectiveUserProfile.jhiPreferences || {}),
        [effectiveUserProfile.jhiPreferences]
    );

    const buildJhiCacheKey = useCallback(
        (job: Job) => {
            const benefitsKey = Array.isArray(job.benefits) ? job.benefits.join('|') : '';
            return [
                jhiPrefsKey,
                job.id,
                job.salary_from ?? '',
                job.salary_to ?? '',
                job.type ?? '',
                job.location ?? '',
                job.distanceKm ?? '',
                job.description?.length ?? '',
                benefitsKey
            ].join('|');
        },
        [jhiPrefsKey]
    );

    const jobsForDisplay = useMemo(() => {
        const prevCache = jhiCacheRef.current;
        const nextCache = new Map<string, { key: string; jhi: any }>();
        const personalized = filteredJobs.map((job) => {
            const cacheKey = buildJhiCacheKey(job);
            const cached = prevCache.get(job.id);
            const jhi = cached && cached.key === cacheKey
                ? cached.jhi
                : calculateJHI({
                    salary_from: job.salary_from,
                    salary_to: job.salary_to,
                    type: job.type,
                    benefits: job.benefits,
                    description: job.description,
                    location: job.location,
                    distanceKm: job.distanceKm
                }, 0, effectiveUserProfile.jhiPreferences);
            nextCache.set(job.id, { key: cacheKey, jhi });
            return {
                ...job,
                jhi
            };
        });
        jhiCacheRef.current = nextCache;

        if (sortBy === 'distance') {
            return [...personalized].sort((a, b) => {
                const da = (a as any)?.distanceKm ?? (a as any)?.distance_km ?? Number.POSITIVE_INFINITY;
                const db = (b as any)?.distanceKm ?? (b as any)?.distance_km ?? Number.POSITIVE_INFINITY;
                return da - db;
            });
        }
        if (sortBy === 'salary_desc') {
            const toMonthly = (job: any) => {
                let salary = 0;
                if (job.salary_from && job.salary_to) {
                    salary = (Number(job.salary_from) + Number(job.salary_to)) / 2;
                } else {
                    salary = Number(job.salary_from || job.salary_to || 0);
                }
                if (!salary) return 0;
                const tf = String(job.salary_timeframe || '').toLowerCase();
                if (tf === 'hour' || tf === 'hourly') return Math.round(salary * 22 * 8);
                if (tf === 'day' || tf === 'daily') return Math.round(salary * 22);
                if (tf === 'week' || tf === 'weekly') return Math.round(salary * 4.345);
                if (tf === 'year' || tf === 'yearly' || tf === 'annual') return Math.round(salary / 12);
                return salary;
            };
            return [...personalized].sort((a, b) => toMonthly(b) - toMonthly(a));
        }
        return personalized;
    }, [filteredJobs, sortBy, effectiveUserProfile.jhiPreferences, buildJhiCacheKey]);

    const savedJobsCacheKey = useMemo(
        () => `${SAVED_JOBS_CACHE_PREFIX}:${userProfile.id || 'guest'}`,
        [userProfile.id]
    );
    const [savedJobsCache, setSavedJobsCache] = useState<Record<string, Job>>({});

    useEffect(() => {
        try {
            const raw = localStorage.getItem(savedJobsCacheKey);
            if (!raw) {
                setSavedJobsCache({});
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                setSavedJobsCache({});
                return;
            }
            setSavedJobsCache(parsed as Record<string, Job>);
        } catch {
            setSavedJobsCache({});
        }
    }, [savedJobsCacheKey]);

    useEffect(() => {
        try {
            localStorage.setItem(savedJobsCacheKey, JSON.stringify(savedJobsCache));
        } catch (error) {
            console.warn('Failed to persist saved jobs cache:', error);
        }
    }, [savedJobsCache, savedJobsCacheKey]);

    useEffect(() => {
        setSavedJobsCache((prev) => {
            const next: Record<string, Job> = {};
            for (const savedId of savedJobIds) {
                const fresh = jobsForDisplay.find((job) => job.id === savedId);
                if (fresh) {
                    next[savedId] = fresh;
                    continue;
                }
                if (prev[savedId] !== undefined) {
                    next[savedId] = prev[savedId];
                }
            }
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length === nextKeys.length && prevKeys.every((key) => next[key] === prev[key])) {
                return prev;
            }
            return next;
        });
    }, [jobsForDisplay, savedJobIds]);

    useEffect(() => {
        let cancelled = false;
        const jobsById = new Set(jobsForDisplay.map((job) => job.id));
        const missingIds = savedJobIds.filter((id) => !jobsById.has(id) && savedJobsCache[id] === undefined);
        if (!missingIds.length) return;

        (async () => {
            try {
                const fetched = await fetchJobsByIds(missingIds.slice(0, 120));
                if (cancelled) return;
                const fetchedIds = new Set<string>();
                for (const job of fetched) {
                    fetchedIds.add(job.id);
                    if (job.id.startsWith('db-')) {
                        fetchedIds.add(job.id.substring(3));
                    }
                }
                const notFoundIds = missingIds.slice(0, 120).filter((id) => !fetchedIds.has(id));
                if (notFoundIds.length > 0) {
                    setSavedJobIds((current) => current.filter((id) => !notFoundIds.includes(id)));
                }
                setSavedJobsCache((prev) => {
                    const next = { ...prev };
                    for (const missingId of missingIds.slice(0, 120)) {
                        next[missingId] = null as any;
                    }
                    for (const job of fetched) {
                        next[job.id] = job;
                    }
                    notFoundIds.forEach((id) => {
                        delete next[id];
                    });
                    return next;
                });
            } catch (error) {
                if (!cancelled) {
                    console.warn('Failed to hydrate saved jobs cache from DB:', error);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [savedJobIds, jobsForDisplay, savedJobsCache, setSavedJobIds]);

    const resolvedSavedJobs = useMemo(() => {
        const jobsById = new Map(jobsForDisplay.map((job) => [job.id, job]));
        const out: Job[] = [];
        for (const id of savedJobIds) {
            const live = jobsById.get(id);
            if (live) {
                out.push(live);
                continue;
            }
            const cached = savedJobsCache[id];
            if (cached) {
                out.push(cached);
            }
        }
        return out;
    }, [jobsForDisplay, savedJobIds, savedJobsCache]);

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

        setViewState(ViewState.COMPANY_DASHBOARD);
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
    const discoveryScrollYRef = useRef<number | null>(null);
    const shouldRestoreDiscoveryScrollRef = useRef(false);
    const searchSessionIdRef = useRef(`list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    useEffect(() => {
        let raf = 0;
        const handleScroll = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                if (!jobListRef.current) return;
                const { scrollTop, scrollHeight, clientHeight } = jobListRef.current;
                const threshold = 300;
                const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;
                if (isNearBottom && !loadingMore && hasMore) {
                    loadMoreJobs();
                }
            });
        };

        const element = jobListRef.current;
        if (element) {
            element.addEventListener('scroll', handleScroll, { passive: true });
            return () => {
                if (raf) cancelAnimationFrame(raf);
                element.removeEventListener('scroll', handleScroll);
            };
        }
    }, [loadingMore, hasMore, isSearching, loadMoreJobs, isLoadingJobs, viewState]);

    useEffect(() => {
        // Initial Theme handled by useState initializer to prevent flashes and race conditions
        // Job loading is driven by usePaginatedJobs; avoid forcing parallel initial reload here.
        const paymentStatus = checkPaymentStatus();
        if (paymentStatus === 'success') {
            refreshUserProfile();
        }

        // AUTH LISTENER
        if (supabase) {
            // Initial session check
            const initSession = async () => {
                try {
                    console.log('🏁 [App] Running initial session check...');
                    const { isValid, session } = await verifyAuthSession('AppInit');
                    if (isValid && session) {
                        console.log('✅ [App] Initial session verified for:', session.user.id);
                        await handleSessionRestoration(session.user.id);
                    } else {
                        console.log('ℹ️ [App] No initial valid session found.');
                    }
                } finally {
                    setSessionCheckComplete(true);
                }
            };
            initSession();

            if (isPasswordRecoveryPending()) {
                passwordRecoveryInProgressRef.current = true;
                setAuthModalMode('reset');
                setIsAuthModalOpen(true);
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
                console.log(`🔔 [App] Auth state changed: ${event}`);

                if (session) {
                    if (event === 'PASSWORD_RECOVERY') {
                        passwordRecoveryInProgressRef.current = true;
                        setAuthModalMode('reset');
                        setIsAuthModalOpen(true);
                        if (window.location.hash.includes('type=recovery')) {
                            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
                        }
                        return;
                    }
                    // Restore on explicit sign-in and OAuth returns (INITIAL_SESSION)
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                        if (!userProfile.isLoggedIn) {
                            handleSessionRestoration(session.user.id);
                        }
                        // Do not auto-close auth modal while password recovery flow is active.
                        if (!passwordRecoveryInProgressRef.current) {
                            setIsAuthModalOpen(false);
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

            const recoveryHash = window.location.hash || '';
            if (recoveryHash.includes('type=recovery')) {
                passwordRecoveryInProgressRef.current = true;
                setAuthModalMode('reset');
                setIsAuthModalOpen(true);
                window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
            }

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
                setViewState(ViewState.LIST);
                setShowCompanyLanding(false);
                setIsBlogOpen(true);
                setSelectedBlogPostSlug(slug || null);
                setSelectedJobId(null);
            } else if (parts[0] === 'ulozene') {
                setIsBlogOpen(false);
                setViewState(ViewState.SAVED);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'assessment-centrum') {
                setIsBlogOpen(false);
                setViewState(ViewState.ASSESSMENT);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'profil' || parts[0] === 'profile') {
                setIsBlogOpen(false);
                if (parts[1] === 'jcfpm') {
                    setViewState(ViewState.JCFPM);
                } else {
                    setViewState(ViewState.PROFILE);
                }
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'jcfpm') {
                setIsBlogOpen(false);
                setViewState(ViewState.JCFPM);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'pro-firmy') {
                setIsBlogOpen(false);
                setShowCompanyLanding(true);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'company-dashboard' || parts[0] === 'dashboard') {
                setIsBlogOpen(false);
                setViewState(ViewState.COMPANY_DASHBOARD);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else if (parts[0] === 'digest') {
                setIsBlogOpen(false);
                setViewState(ViewState.LIST);
                setShowCompanyLanding(false);
                setSelectedJobId(null);
                setSelectedBlogPostSlug(null);
            } else {
                setIsBlogOpen(false);
            }

            return () => subscription.unsubscribe();
        }
    }, []);

    // RESTORE DASHBOARD VIEW STATE when navigating back to home (selectedJobId becomes null)
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
                    industry: companyProfile?.industry
                });

                if (companyProfile) {
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

    useEffect(() => {
        if (selectedJobId !== null) return;
        if (viewState !== ViewState.LIST || selectedCompanyId) return;
        if (!shouldRestoreDiscoveryScrollRef.current) return;

        const targetY = discoveryScrollYRef.current;
        shouldRestoreDiscoveryScrollRef.current = false;
        if (targetY == null) return;

        const restoreScroll = () => {
            window.scrollTo({ top: targetY, behavior: 'auto' });
        };

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                restoreScroll();
            });
        });

        const timeoutId = window.setTimeout(restoreScroll, 90);
        return () => window.clearTimeout(timeoutId);
    }, [selectedJobId, selectedCompanyId, viewState]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateVisibility = () => {
            setShowScrollToTop(window.scrollY > 560);
        };

        updateVisibility();
        window.addEventListener('scroll', updateVisibility, { passive: true });
        return () => window.removeEventListener('scroll', updateVisibility);
    }, []);

    const handleFloatingScrollToTop = useCallback(() => {
        const parseCssLengthToPx = (rawValue: string, fallback: number) => {
            const raw = String(rawValue || '').trim();
            if (!raw) return fallback;
            if (raw.endsWith('rem')) {
                const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
                const remValue = parseFloat(raw);
                return Number.isFinite(remValue) ? remValue * rootFontSize : fallback;
            }
            if (raw.endsWith('px')) {
                const pxValue = parseFloat(raw);
                return Number.isFinite(pxValue) ? pxValue : fallback;
            }
            const numericValue = parseFloat(raw);
            return Number.isFinite(numericValue) ? numericValue : fallback;
        };

        if (viewState === ViewState.LIST && !selectedJobId && !selectedCompanyId && !isBlogOpen) {
            const discoveryRoot = document.getElementById('challenge-discovery');
            if (discoveryRoot) {
                const headerOffset = parseCssLengthToPx(
                    getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset'),
                    104
                );
                const targetY = Math.max(0, window.scrollY + discoveryRoot.getBoundingClientRect().top - headerOffset - 16);
                window.scrollTo({ top: targetY, behavior: 'smooth' });
                return;
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [isBlogOpen, selectedCompanyId, selectedJobId, viewState]);

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
                || base === 'assessment-preview'
                || base === 'demo-handshake'
                || base === 'demo-company-handshake'
                || base === 'admin'
                || base === 'digest';
            if (isExternalPage) return;

            const lng = getLocalePrefix();
            let targetPath = `/${lng}/`;

            if (selectedJobId) {
                targetPath = `/${lng}/jobs/${selectedJobId}`;
            } else if (selectedCompanyId) {
                targetPath = `/${lng}/companies/${selectedCompanyId}`;
            } else if (isBlogOpen && selectedBlogPostSlug) {
                targetPath = `/${lng}/blog/${selectedBlogPostSlug}`;
            } else if (isBlogOpen) {
                targetPath = `/${lng}/blog`;
            } else if (showCompanyLanding) {
                targetPath = `/${lng}/pro-firmy`;
            } else if (viewState === ViewState.SAVED) {
                targetPath = `/${lng}/ulozene`;
            } else if (viewState === ViewState.ASSESSMENT) {
                targetPath = `/${lng}/assessment-centrum`;
            } else if (viewState === ViewState.PROFILE) {
                targetPath = `/${lng}/profil`;
            } else if (viewState === ViewState.JCFPM) {
                targetPath = `/${lng}/profile/jcfpm`;
            }

            if (window.location.pathname !== targetPath) {
                const search = window.location.search || '';
                const hash = window.location.hash || '';
                window.history.replaceState({}, '', targetPath + search + hash);
            }
        } catch (err) {
            console.warn('Failed to sync URL with view state', err);
        }
    }, [selectedJobId, selectedCompanyId, selectedBlogPostSlug, isBlogOpen, showCompanyLanding, viewState, i18n.language]);

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
                companyId: selectedCompanyId || companyProfile?.id || null
            });
        } catch (err) {
            console.warn('Page view tracking failed:', err);
        }
    }, [selectedJobId, selectedCompanyId, selectedBlogPostSlug, showCompanyLanding, viewState, i18n.language, companyProfile?.id]);

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

    // Remote-only search and commute radius are mutually exclusive in practice.
    useEffect(() => {
        if (!challengeRemoteOnly || !enableCommuteFilter) return;
        setEnableCommuteFilter(false);
    }, [challengeRemoteOnly, enableCommuteFilter, setEnableCommuteFilter]);

    // Company profiles: if no coordinates, disable commute filter to avoid empty results
    useEffect(() => {
        if (isCompanyProfile && viewState === ViewState.LIST && !companyCoordinates && enableCommuteFilter) {
            setEnableCommuteFilter(false);
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
    const backendRetryStartTimerRef = useRef<number | null>(null);
    const BACKEND_RETRY_MAX = 8; // total tries
    const BACKEND_RETRY_DELAY_MS = 3000; // 3s between tries
    const BACKEND_RETRY_INITIAL_DELAY_MS = 4500; // avoid brief "flash" polling on transient hiccups

    // UI state for showing the waiting hint
    // Keep a ref to filteredJobs so async retry closure can access latest value
    const filteredJobsRef = useRef(filteredJobs);
    useEffect(() => { filteredJobsRef.current = filteredJobs; }, [filteredJobs]);
    const backendUnreachableRef = useRef(backendUnreachable);
    useEffect(() => { backendUnreachableRef.current = backendUnreachable; }, [backendUnreachable]);
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
            if (backendRetryTimerRef.current) {
                clearTimeout(backendRetryTimerRef.current);
                backendRetryTimerRef.current = null;
            }
            if (backendRetryStartTimerRef.current) {
                clearTimeout(backendRetryStartTimerRef.current);
                backendRetryStartTimerRef.current = null;
            }
            return;
        }

        // Guard: don't start if already polling, loading, jobs are present, or backend seems healthy.
        if (backendWakeRetryRef.current || isLoadingJobs || filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
            return;
        }

        const runPoll = async () => {
            if (!backendWakeRetryRef.current) return;

            backendRetryCountRef.current += 1;
            console.log(`Backend wake retry: attempt ${backendRetryCountRef.current}/${BACKEND_RETRY_MAX}`);

            try {
                await loadRealJobsRef.current();
            } catch (e) {
                console.error('Backend wake retry: loadRealJobs error', e);
            }

            if (filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
                console.log('Backend wake retry: jobs appeared, stopping polling');
                backendWakeRetryRef.current = false;
                return;
            }

            if (backendRetryCountRef.current >= BACKEND_RETRY_MAX) {
                console.log('Backend wake retry: reached max attempts, stopping');
                backendWakeRetryRef.current = false;
                return;
            }

            backendRetryTimerRef.current = window.setTimeout(runPoll, BACKEND_RETRY_DELAY_MS);
        };

        // Start polling with a short delay so transient 500s do not cause a visible "flash" in UI.
        backendRetryStartTimerRef.current = window.setTimeout(() => {
            // Re-check guards right before polling starts.
            if (backendWakeRetryRef.current || isLoadingJobs || filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
                return;
            }
            console.log('Backend wake retry: starting polling to wait for backend wake-up');
            backendWakeRetryRef.current = true;
            backendRetryCountRef.current = 0;
            void runPoll();
        }, BACKEND_RETRY_INITIAL_DELAY_MS);

        return () => {
            backendWakeRetryRef.current = false;
            if (backendRetryStartTimerRef.current) {
                clearTimeout(backendRetryStartTimerRef.current);
                backendRetryStartTimerRef.current = null;
            }
            if (backendRetryTimerRef.current) {
                clearTimeout(backendRetryTimerRef.current);
                backendRetryTimerRef.current = null;
            }
        };
    }, [hasDedicatedSearchBackend, isLoadingJobs, filteredJobs.length, backendUnreachable]);

    // SEO Update Effect
    useEffect(() => {
        const pageName = showCompanyLanding ? 'company-dashboard' :
            viewState === ViewState.LIST ? 'home' :
                viewState === ViewState.PROFILE ? 'profile' :
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
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [theme]);

    useEffect(() => {
        setIsApplyModalOpen(false);
    }, [selectedJobId]);

    // Wake backend early to reduce cold start latency (fire-and-forget, no CORS noise).
    useEffect(() => {
        const WAKE_THROTTLE_MS = 10 * 60 * 1000;
        const lastWakeKey = 'jobshaman_backend_wake_at';
        const wakeBackend = () => {
            const lastWake = Number(localStorage.getItem(lastWakeKey) || 0);
            const now = Date.now();
            if (lastWake && now - lastWake < WAKE_THROTTLE_MS) return;
            localStorage.setItem(lastWakeKey, String(now));
            // Use no-cors to avoid console errors; we only need the ping to reach the server.
            void fetch(`${BACKEND_URL}/healthz`, {
                method: 'GET',
                mode: 'no-cors',
                keepalive: true
            });
        };

        const scheduleWake = () => {
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(wakeBackend, { timeout: 1500 });
            } else {
                setTimeout(wakeBackend, 800);
            }
        };

        scheduleWake();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                scheduleWake();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
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
            userProfileRef.current = updatedProfile;
            setUserProfile(updatedProfile);

            // ONLY persist if explicitly requested (e.g., CV/Photo upload)
            if (persist && updatedProfile.id) {
                console.log("💾 Persisting profile changes immediately...");
                await updateUserProfile(updatedProfile.id, updatedProfile);

                // Refetch to sync (only on explicit persistence)
                const fresh = await getUserProfile(updatedProfile.id);
                if (fresh) {
                    userProfileRef.current = fresh;
                    setUserProfile(fresh);
                }
            }
        } catch (error) {
            console.error("Failed to update profile locally:", error);
        }
    };

    const handleProfileSave = async (): Promise<boolean> => {
        const profileToSave = userProfileRef.current;
        if (!profileToSave.id) return false;

        try {
            console.log("💾 Explicitly saving profile to Supabase...");
            await updateUserProfile(profileToSave.id, profileToSave);
            console.log("✅ Profile saved successfully");

            // 🔄 Refetch profile to get updated coordinates from DB calculated by triggers or service logic
            console.log("🔄 Refetching profile to sync coordinates...");
            const freshProfile = await getUserProfile(profileToSave.id);
            if (freshProfile) {
                userProfileRef.current = freshProfile;
                setUserProfile(freshProfile);
                console.log("✅ Profile refetched. New coordinates:", freshProfile.coordinates);
            }

            // Alert user success
            // Note: We could use a toast here if we had one
            return true;

        } catch (error) {
            console.error("Failed to save profile:", error);
            alert(t('alerts.profile_save_failed'));
            return false;
        }
    };

    const handleCompanyOnboardingComplete = (company: CompanyProfile) => {
        setCompanyProfile(company);
        setIsOnboardingCompany(false);
        setViewState(ViewState.COMPANY_DASHBOARD);
    };

    const persistQualityAction = useCallback((source: 'save' | 'apply' | 'assessment') => {
        if (!userProfile.isLoggedIn || userProfile.role === 'recruiter' || !userProfile.id) return;
        if (candidateActivationState.first_quality_action_at) return;
        const nextProfile = markFirstQualityAction(userProfile);
        userProfileRef.current = nextProfile;
        setUserProfile(nextProfile);
        void updateUserProfile(userProfile.id, { preferences: nextProfile.preferences }).catch((error) => {
            console.warn('Failed to persist quality action milestone:', error);
        });
        void trackAnalyticsEvent({
            event_type: 'activation_milestone_reached',
            feature: 'candidate_activation_v1',
            metadata: {
                milestone: 'A5',
                source,
                completion_percent: nextProfile.preferences?.activation_v1?.completion_percent || 100,
            },
        });
    }, [candidateActivationState.first_quality_action_at, setUserProfile, userProfile]);

    const handleToggleSave = (jobId: string, options?: { source?: string; position?: number }) => {
        const aliases = getSavedJobIdAliases(jobId);
        const isAlreadySaved = aliases.some((id) => savedJobIds.includes(id));
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
                source: options?.source || 'desktop_list',
                position: options?.position ?? (job as any)?.rankPosition ?? (job as any)?.aiRecommendationPosition
            }
        });
        if (!isAlreadySaved && job) {
            setSavedJobsCache((prev) => ({ ...prev, [jobId]: job }));
            persistQualityAction('save');
        }
        if (isAlreadySaved) {
            setSavedJobsCache((prev) => {
                const hasAnyAlias = aliases.some((id) => id in prev);
                if (!hasAnyAlias) return prev;
                const next = { ...prev };
                aliases.forEach((id) => {
                    delete next[id];
                });
                return next;
            });
        }
        if (isAlreadySaved) {
            aliases.forEach((id) => applyInteractionState(id, 'unsave'));
            return;
        }
        applyInteractionState(jobId, 'save');
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
        persistQualityAction('apply');
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
            if (didApply) {
                await createJobApplication(applyFollowup.jobId, 'apply_followup', {
                    opened_at: applyFollowup.openedAt,
                    url: applyFollowup.url || null
                });
            }
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
            if (!selectedJobId && viewState === ViewState.LIST && !selectedCompanyId) {
                discoveryScrollYRef.current = window.scrollY;
                shouldRestoreDiscoveryScrollRef.current = false;
            }
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
        setSelectedCompanyId(null);
        setSelectedBlogPostSlug(null); // Clear blog post when job selected

        if (!jobId) {
            if (selectedJobId && discoveryScrollYRef.current != null) {
                shouldRestoreDiscoveryScrollRef.current = true;
            }
            setDirectlyFetchedJob(null);
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (usePageScrollLayout || !detailScrollRef.current) {
                    window.scrollTo({ top: 0, behavior: 'auto' });
                    return;
                }
                detailScrollRef.current.scrollTop = 0;
            });
        });
    };

    const [showPremiumUpgrade, setShowPremiumUpgrade] = useState<{ open: boolean, feature?: string }>({ open: false });

    const handleCompanyPageSelect = (companyId: string | null) => {
        setSelectedCompanyId(companyId);
        setSelectedJobId(null);
        setSelectedBlogPostSlug(null);
        if (companyId) {
            setViewState(ViewState.LIST);
        }
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
    };

    const handleInsightsOpen = () => {
        setViewState(ViewState.LIST);
        setSelectedCompanyId(null);
        setSelectedJobId(null);
        setIsBlogOpen(true);
        setSelectedBlogPostSlug(null);
        setShowCompanyLanding(false);
        window.setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
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
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                    <AdminDashboard userProfile={userProfile} />
                </div>
            );
        }
        if (normalizedPath === '/jcfpm' || normalizedPath === '/profile/jcfpm' || normalizedPath === '/profil/jcfpm') {
            const queryParams = new URLSearchParams(window.location.search);
            const requestedSection = queryParams.get('section') || 'full';
            const normalizedSection = requestedSection === 'basic' ? 'full' : requestedSection;
            const sectionParam = userProfile.subscription?.tier === 'premium'
                ? normalizedSection
                : 'full';

            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div></div>}>
                        <JcfpmFlow
                            userId={userProfile.id || 'guest'}
                            isPremium={userProfile.subscription?.tier === 'premium'}
                            section={sectionParam}
                            initialSnapshot={userProfile.preferences?.jcfpm_v1 || null}
                            theme={theme}
                            onPersist={async (snapshot: any) => {
                                console.log('JCFPM Persist:', snapshot);
                                const mapped = mapJcfpmToJhiPreferencesWithExplanation(
                                    snapshot,
                                    userProfile.jhiPreferences || createDefaultJHIPreferences()
                                );
                                const updatedProfile: UserProfile = {
                                    ...userProfile,
                                    preferences: {
                                        ...userProfile.preferences,
                                        jcfpm_v1: snapshot,
                                        jcfpm_jhi_adjustment_v1: mapped.explanation,
                                    },
                                    jhiPreferences: mapped.preferences,
                                };
                                await handleProfileUpdate(updatedProfile, true);
                                void trackAnalyticsEvent({
                                    event_type: 'jcfpm_profile_saved',
                                    feature: 'jcfpm_v1',
                                    metadata: {
                                        schema_version: snapshot.schema_version,
                                        confidence: snapshot.confidence,
                                    },
                                });
                            }}
                            onClose={() => {
                                setViewState(ViewState.LIST);
                                const lng = getLocalePrefix();
                                window.history.pushState({}, '', `/${lng}/`);
                            }}
                        />
                    </Suspense>
                </div>
            );
        }
        if (normalizedPath === '/assessment-preview') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                    <AssessmentPreviewPage />
                </div>
            );
        }
        if (normalizedPath === '/demo-handshake') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <DemoHandshakePage
                        onRegister={() => {
                            const lng = getLocalePrefix();
                            setShowCompanyLanding(false);
                            setSelectedJobId(null);
                            setSelectedBlogPostSlug(null);
                            setViewState(ViewState.LIST);
                            window.history.pushState({}, '', `/${lng}/`);
                            handleAuthAction('register');
                        }}
                        onBrowseRoles={() => {
                            const lng = getLocalePrefix();
                            window.location.assign(`/${lng}/`);
                        }}
                    />
                </div>
            );
        }
        if (normalizedPath === '/demo-company-handshake') {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <DemoCompanyHandshakePage
                        onRegister={() => {
                            const lng = getLocalePrefix();
                            setShowCompanyLanding(true);
                            setSelectedJobId(null);
                            setSelectedBlogPostSlug(null);
                            setViewState(ViewState.LIST);
                            window.history.pushState({}, '', `/${lng}/pro-firmy`);
                            setIsCompanyRegistrationOpen(true);
                        }}
                        onBackToCompanyLanding={() => {
                            const lng = getLocalePrefix();
                            setShowCompanyLanding(true);
                            setSelectedJobId(null);
                            setSelectedBlogPostSlug(null);
                            setViewState(ViewState.LIST);
                            window.location.assign(`/${lng}/pro-firmy`);
                        }}
                    />
                </div>
            );
        }
        if (normalizedPath.startsWith('/assessment/')) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
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
                        onRequestDemo={() => {
                            const lng = getLocalePrefix();
                            setShowCompanyLanding(false);
                            setSelectedJobId(null);
                            setSelectedBlogPostSlug(null);
                            setViewState(ViewState.LIST);
                            window.location.assign(`/${lng}/demo-company-handshake`);
                        }}
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

        if (viewState === ViewState.PROFILE) {
            return (
                <div className="col-span-1 lg:col-span-12 w-full pb-6 px-1">
                    {userProfile.isLoggedIn
                        && userProfile.role !== 'recruiter'
                        && !isActivationComplete(candidateActivationState)
                        && activationNextStep !== 'quality_action' && (
                            <div className="mb-4">
                                <CandidateActivationRail
                                    state={candidateActivationState}
                                    onContinue={() => {
                                        onboardingDismissedRef.current = false;
                                        setShowCandidateOnboarding(true);
                                        void trackAnalyticsEvent({
                                            event_type: 'nudge_clicked',
                                            feature: 'candidate_activation_v1',
                                            metadata: { source: 'profile_rail', next_step: activationNextStep },
                                        });
                                    }}
                                />
                            </div>
                        )}
                    <Suspense fallback={null}>
                        <ProfileEditor
                            profile={userProfile}
                            onChange={(p, persist) => handleProfileUpdate(p, persist)} // Pass persist flag for immediate saves
                            onSave={handleProfileSave} // Explicit save button
                            onRefreshProfile={refreshUserProfile}
                            onDeleteAccount={deleteAccount}
                            savedJobs={resolvedSavedJobs}
                            savedJobIds={savedJobIds}
                            onToggleSave={handleToggleSave}
                            onJobSelect={handleJobSelect}
                            onApplyToJob={handleApplyToJob}
                            selectedJobId={selectedJobId}
                        />
                    </Suspense>
                </div>
            );
        }


        if (viewState === ViewState.SAVED) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                    <SavedJobsPage
                        savedJobs={resolvedSavedJobs}
                        savedJobIds={savedJobIds}
                        onToggleSave={handleToggleSave}
                        onJobSelect={handleJobSelect}
                        selectedJobId={selectedJobId}
                        userProfile={userProfile}
                        searchTerm={savedJobsSearchTerm}
                        onSearchChange={setSavedJobsSearchTerm}
                        onApplyToJob={handleApplyToJob}
                    />
                </div>
            );
        }

        if (isBlogOpen) {
            return (
                <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                    <BlogSection
                        selectedBlogPostSlug={selectedBlogPostSlug}
                        setSelectedBlogPostSlug={(slug) => {
                            setIsBlogOpen(true);
                            setSelectedBlogPostSlug(slug);
                        }}
                    />
                </div>
            );
        }

        const nativeChallenges = jobsForDisplay.filter((job) => job.listingKind !== 'imported');
        const importedJobs = jobsForDisplay.filter((job) => job.listingKind === 'imported');
        const hasNativeChallenges = nativeChallenges.length > 0;
        const featuredChallenges = (hasNativeChallenges ? nativeChallenges : importedJobs).slice(0, 6);
        const featuredImportedJobs = importedJobs.slice(0, 6);

        return (
            <>
                {vercelAnalyticsEnabled && <Analytics />}

                <div className="col-span-1 lg:col-span-12">
                    <div className="space-y-6">
                        {selectedCompanyId ? (
                            <PublicCompanyProfilePage
                                companyId={selectedCompanyId}
                                onBack={() => handleCompanyPageSelect(null)}
                                onOpenChallenge={handleJobSelect}
                            />
                        ) : selectedJob ? (
                            <ChallengeFocusView
                                job={selectedJob}
                                userProfile={userProfile}
                                onBack={() => handleJobSelect(null)}
                                onRequireAuth={() => handleAuthAction(userProfile.isLoggedIn ? 'login' : 'register')}
                                onOpenProfile={() => {
                                    setSelectedJobId(null);
                                    setSelectedCompanyId(null);
                                    setSelectedBlogPostSlug(null);
                                    setShowCompanyLanding(false);
                                    setViewState(ViewState.PROFILE);
                                }}
                                onOpenSupportingContext={() => {
                                    if (!userProfile.isLoggedIn) {
                                        handleAuthAction('login');
                                        return;
                                    }
                                    setIsApplyModalOpen(true);
                                }}
                                onOpenCompanyPage={handleCompanyPageSelect}
                                onOpenImportedListing={() => handleApplyToJob(selectedJob)}
                            />
                        ) : (
                            <>
                                {!discoverySearchMode ? (
                                    <div className="hidden md:block">
                                        <ChallengeHomeSections
                                            hasNativeChallenges={hasNativeChallenges}
                                            featuredChallenges={featuredChallenges}
                                            importedJobs={featuredImportedJobs}
                                            onOpenChallenge={handleJobSelect}
                                            onSearchFocus={() => {
                                                setDiscoverySearchMode(true);
                                                window.setTimeout(() => {
                                                    document.getElementById('challenge-discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    focusDiscoverySearch();
                                                }, 0);
                                            }}
                                            onOpenAuth={() => handleAuthAction('register')}
                                        />
                                    </div>
                                ) : null}
                                <div id="challenge-discovery">
                                    <ChallengeMarketplace
                                        hasNativeChallenges={hasNativeChallenges}
                                        jobs={jobsForDisplay}
                                        selectedJobId={selectedJobId}
                                        savedJobIds={savedJobIds}
                                        userProfile={userProfile}
                                        lane={discoveryLane}
                                        setLane={setDiscoveryLane}
                                        loading={isLoadingJobs}
                                        loadingMore={loadingMore}
                                        hasMore={hasMore}
                                        totalCount={totalCount}
                                        loadMoreJobs={loadMoreJobs}
                                        applyInteractionState={applyInteractionState}
                                        theme={theme}
                                        searchTerm={searchTerm}
                                        setSearchTerm={setSearchTerm}
                                        performSearch={performSearch}
                                        filterCity={filterCity}
                                        setFilterCity={setFilterCity}
                                        filterMinSalary={filterMinSalary}
                                        setFilterMinSalary={setFilterMinSalary}
                                        filterBenefits={filterBenefits}
                                        setFilterBenefits={setFilterBenefits}
                                        toggleBenefitFilter={toggleBenefitFilter}
                                        remoteOnly={challengeRemoteOnly}
                                        setRemoteOnly={setChallengeRemoteOnly}
                                        globalSearch={globalSearch}
                                        setGlobalSearch={setGlobalSearch}
                                        abroadOnly={abroadOnly}
                                        setAbroadOnly={setAbroadOnly}
                                        enableCommuteFilter={enableCommuteFilter}
                                        setEnableCommuteFilter={setEnableCommuteFilter}
                                        filterMaxDistance={filterMaxDistance}
                                        setFilterMaxDistance={setFilterMaxDistance}
                                        filterContractType={filterContractType}
                                        setFilterContractType={setFilterContractType}
                                        toggleContractTypeFilter={toggleContractTypeFilter}
                                        filterDate={filterDate}
                                        setFilterDate={setFilterDate}
                                        filterExperience={filterExperience}
                                        setFilterExperience={setFilterExperience}
                                        filterLanguageCodes={filterLanguageCodes}
                                        setFilterLanguageCodes={setFilterLanguageCodes}
                                        enableAutoLanguageGuard={enableAutoLanguageGuard}
                                        setEnableAutoLanguageGuard={setEnableAutoLanguageGuard}
                                        implicitLanguageCodesApplied={implicitLanguageCodesApplied}
                                        handleJobSelect={handleJobSelect}
                                        handleToggleSave={handleToggleSave}
                                        onOpenProfile={() => setViewState(ViewState.PROFILE)}
                                        onOpenAuth={() => handleAuthAction('register')}
                                        onOpenPremium={(featureLabel) => setShowPremiumUpgrade({ open: true, feature: featureLabel })}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </>
        );
    };

    const focusDiscoverySearch = () => {
        const attemptFocus = () => {
            // Prefer the header search on lg+, fallback to the in-list input on mobile/tablet.
            const candidates = ['appheader-discovery-search', 'challenge-discovery-search'];
            for (const id of candidates) {
                const input = document.getElementById(id) as HTMLInputElement | null;
                if (!input) continue;
                // Skip elements that are not visible (hidden by breakpoint classes).
                if ((input as any).offsetParent === null) continue;
                input.focus({ preventScroll: true });
                input.select?.();
                return true;
            }
            return false;
        };

        window.setTimeout(() => {
            if (attemptFocus()) return;
            window.setTimeout(() => {
                attemptFocus();
            }, 180);
        }, 80);
    };

    return (
        <div className={`flex min-h-screen flex-col ${isImmersiveAssessmentRoute ? (theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900') : 'app-shell-bg text-[var(--text)] dark:text-[var(--text)]'} font-sans transition-colors duration-300`}>
            {!isImmersiveAssessmentRoute && (
                <AppHeader
                    viewState={viewState}
                    setViewState={setViewState}
                    setSelectedJobId={handleJobSelect}
                    isBlogOpen={isBlogOpen}
                    setIsBlogOpen={setIsBlogOpen}
                    setSelectedBlogPostSlug={setSelectedBlogPostSlug}
                    showCompanyLanding={showCompanyLanding}
                    setShowCompanyLanding={setShowCompanyLanding}
                    userProfile={userProfile}
                    companyProfile={companyProfile}
                    setCompanyProfile={setCompanyProfile}
                    handleAuthAction={handleAuthAction}
                    toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                    theme={theme}
                    setIsOnboardingCompany={setIsOnboardingCompany}
                    onIntentionalListClick={() => { userIntentionallyClickedListRef.current = true; }}
                    discoveryLane={discoveryLane}
                    setDiscoveryLane={setDiscoveryLane}
                    discoverySearchMode={discoverySearchMode}
                    onOpenInsights={handleInsightsOpen}
                    setDiscoverySearchMode={setDiscoverySearchMode}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filterCity={filterCity}
                    setFilterCity={setFilterCity}
                    performSearch={performSearch}
                    onOpenDiscoverySearch={() => {
                        userIntentionallyClickedListRef.current = true;
                        setDiscoverySearchMode(true);
                        setIsBlogOpen(false);
                        setShowCompanyLanding(false);
                        setIsOnboardingCompany(false);
                        setSelectedCompanyId(null);
                        setSelectedBlogPostSlug(null);
                        setViewState(ViewState.LIST);
                        setSelectedJobId(null);
                        window.setTimeout(() => {
                            document.getElementById('challenge-discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            focusDiscoverySearch();
                        }, 0);
                    }}
                />
            )}

            {!isImmersiveAssessmentRoute && !userProfile.isLoggedIn && pendingEmailConfirmation && (
                <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6">
                    <div className="mb-2 mt-4 flex flex-col gap-4 rounded-[1.4rem] border border-amber-200 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-500/10">
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

            <main className={
                isImmersiveAssessmentRoute
                    ? "flex-1 min-h-0 w-full overflow-hidden"
                    : `flex-1 min-h-0 mx-auto w-full max-w-[1680px] px-4 pb-6 pt-3 sm:px-5 lg:px-6 ${isHomeListView ? 'pb-2' : 'pb-6'} ${usePageScrollLayout ? '' : 'overflow-hidden'}`
            }>
                <div className={
                    isImmersiveAssessmentRoute
                        ? "h-full"
                        : usePageScrollLayout
                            ? "grid grid-cols-1 gap-5 lg:grid-cols-12"
                            : "grid h-[calc(100dvh-118px)] grid-cols-1 gap-5 lg:grid-cols-12"
                }>
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

            {!isImmersiveAssessmentRoute && showScrollToTop && (
                <button
                    type="button"
                    onClick={handleFloatingScrollToTop}
                    aria-label={t('app.back_to_top')}
                    title={t('app.back_to_top')}
                    className="fixed bottom-5 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[var(--surface-elevated)] text-[var(--accent)] shadow-[var(--shadow-card)] backdrop-blur transition hover:-translate-y-[1px] hover:border-[rgba(var(--accent-rgb),0.34)] hover:bg-[var(--surface)] hover:text-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] sm:bottom-6 sm:right-6"
                >
                    <ArrowUp size={18} />
                </button>
            )}

            <Suspense fallback={null}>
                <CandidateOnboardingModal
                    isOpen={showCandidateOnboarding}
                    profile={userProfile}
                    initialStep={
                        activationNextStep === 'skills'
                            ? 'preferences'
                            : activationNextStep === 'quality_action'
                                ? 'done'
                                : activationNextStep
                    }
                    onClose={() => {
                        onboardingDismissedRef.current = true;
                        setShowCandidateOnboarding(false);
                    }}
                    onComplete={() => {
                        onboardingDismissedRef.current = true;
                        setShowCandidateOnboarding(false);
                    }}
                    onGoToProfile={() => {
                        onboardingDismissedRef.current = true;
                        setShowCandidateOnboarding(false);
                        setSelectedJobId(null);
                        setSelectedBlogPostSlug(null);
                        setShowCompanyLanding(false);
                        try {
                            const lng = getLocalePrefix();
                            window.history.replaceState({}, '', `/${lng}/profil${window.location.search || ''}${window.location.hash || ''}`);
                        } catch (error) {
                            console.warn('Failed to navigate to profile path:', error);
                        }
                        setViewState(ViewState.PROFILE);
                    }}
                    onStepViewed={(step) => {
                        void trackAnalyticsEvent({
                            event_type: 'onboarding_step_viewed',
                            feature: 'candidate_activation_v1',
                            metadata: {
                                step,
                                completion_percent: candidateActivationState.completion_percent,
                            },
                        });
                    }}
                    onStepCompleted={(step) => {
                        void trackAnalyticsEvent({
                            event_type: 'onboarding_step_completed',
                            feature: 'candidate_activation_v1',
                            metadata: {
                                step,
                                completion_percent: candidateActivationState.completion_percent,
                            },
                        });
                    }}
                    onUpdateProfile={handleProfileUpdate}
                    onOpenPremium={(featureLabel) => setShowPremiumUpgrade({ open: true, feature: featureLabel })}
                    onRefreshProfile={refreshUserProfile}
                />
            </Suspense>

            <ApplyFollowupModal
                isOpen={showApplyFollowup}
                jobTitle={applyFollowup?.title}
                company={applyFollowup?.company}
                onConfirm={() => handleApplyFollowupAnswer(true)}
                onReject={() => handleApplyFollowupAnswer(false)}
                onLater={handleApplyFollowupLater}
            />

            <Suspense fallback={null}>
                <PremiumUpgradeModal
                    show={{ open: showPremiumUpgrade.open, feature: showPremiumUpgrade.feature }}
                    onClose={() => setShowPremiumUpgrade({ open: false })}
                    userProfile={userProfile}
                    onAuth={() => handleAuthAction('login')}
                />
            </Suspense>

            <Suspense fallback={null}>
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => {
                        setIsAuthModalOpen(false);
                        passwordRecoveryInProgressRef.current = false;
                        clearPasswordRecoveryPending();
                        setAuthModalMode('login');
                    }}
                    onSuccess={() => {
                        setIsAuthModalOpen(false);
                        passwordRecoveryInProgressRef.current = false;
                        clearPasswordRecoveryPending();
                        setAuthModalMode('login');
                    }}
                    defaultMode={authModalMode}
                />
            </Suspense>

            <Suspense fallback={null}>
                <CompanyRegistrationModal
                    isOpen={isCompanyRegistrationOpen}
                    onClose={() => setIsCompanyRegistrationOpen(false)}
                    onSuccess={() => {
                        setIsCompanyRegistrationOpen(false);
                        console.log('Company registration successful');
                    }}
                />
            </Suspense>

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
                <Suspense fallback={null}>
                    <ApplicationModal
                        isOpen={isApplyModalOpen}
                        onClose={() => setIsApplyModalOpen(false)}
                        job={selectedJob}
                        user={userProfile}
                    />
                </Suspense>
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
