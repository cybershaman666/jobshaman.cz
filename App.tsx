import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, startTransition, useDeferredValue } from 'react';
import './src/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { Job, ViewState, UserProfile, CompanyProfile } from './types';

import AppHeader from './components/AppHeader';
import AppSceneRouter from './components/AppSceneRouter';
import { generateSEOMetadata, updatePageMeta } from './utils/seo';
import { fetchJobsByIds } from './services/jobService';
import { supabase, getUserProfile, updateUserProfile, verifyAuthSession } from './services/supabaseService';
import { checkPaymentStatus } from './services/stripeService';
import { clearCsrfToken } from './services/csrfService';
import { clearPasswordRecoveryPending, isPasswordRecoveryPending } from './services/supabaseClient';
import { trackJobInteraction } from './services/jobInteractionService';
import { createJobApplication } from './services/jobApplicationService';
import { sendWelcomeEmail } from './services/welcomeEmailService';
import { useUserProfile } from './hooks/useUserProfile';
import { useGuestDiscoveryTour } from './hooks/useGuestDiscoveryTour';
import { BACKEND_URL, DEFAULT_USER_PROFILE } from './constants';
import AppViewportShell from './src/app/layout/AppViewportShell';
import useHeaderOffsets from './src/app/layout/useHeaderOffsets';
import useMarketplaceDiscovery from './src/app/marketplace/useMarketplaceDiscovery';
import useMarketplaceSceneState from './src/app/marketplace/useMarketplaceSceneState';
import type { CareerOSNotification } from './components/careeros/CareerOSCandidateWorkspace';
import { buildCareerOSNotificationFeed } from './src/app/careeros/model/notificationFeed';
import {
    deriveActivationState,
    getNextActivationStep,
    isActivationComplete,
    markFirstQualityAction,
    withActivationState
} from './services/candidateActivationService';
import { calculateJHI } from './utils/jhiCalculator';
import {
    getLocaleFromPathname,
    getNormalizedAppPath,
    getPathPartsWithoutLocale,
    isExternalStandalonePath,
    resolvePreferredLocale,
} from './utils/appRouting';
import { AlertCircle, ArrowUp } from 'lucide-react';
import { markPerf, measurePerf, measureSyncPerf } from './src/app/perf/perfDebug';
import { trackAnalyticsEventDeferred, trackPageViewDeferred } from './services/deferredAnalytics';

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
const SIGNAL_BOOST_PENDING_PREFIX = 'jobshaman_signal_boost_pending:';
let initialSessionCheckPromise: Promise<void> | null = null;
const noop = () => {};

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

const AuthModal = lazy(() => import('./components/AuthModal'));
const CandidateOnboardingModal = lazy(() => import('./components/CandidateOnboardingModal'));
const CompanyRegistrationModal = lazy(() => import('./components/CompanyRegistrationModal'));
const ApplicationModal = lazy(() => import('./components/ApplicationModal'));
const PremiumUpgradeModal = lazy(() => import('./components/PremiumUpgradeModal'));
const CompanyOnboarding = lazy(() => import('./components/CompanyOnboarding'));
const ApplyFollowupModal = lazy(() => import('./components/ApplyFollowupModal'));
const CookieBanner = lazy(() => import('./components/CookieBanner'));
const GuestDiscoveryTourOverlay = lazy(() => import('./components/GuestDiscoveryTourOverlay'));
const SiteFooter = lazy(() => import('./components/SiteFooter'));
const PodminkyUziti = lazy(() => import('./pages/PodminkyUziti'));
const OchranaSoukromi = lazy(() => import('./pages/OchranaSoukromi'));
const AboutUsPage = lazy(() => import('./pages/AboutUsPage'));
const SignalBoostPublicPage = lazy(() => import('./pages/SignalBoostPublicPage'));

type CandidateOnboardingStepKey = 'entry' | 'location' | 'preferences' | 'cv' | 'done';

// JHI and formatting utilities now imported from utils/

export default function App() {
    const ONBOARDING_ENABLED = false;
    const { t, i18n } = useTranslation();
    const vercelAnalyticsEnabled = import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';
    const getSystemTheme = () => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light' as const;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' as const : 'light' as const;
    };
    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
        if (typeof window === 'undefined') return 'system';
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
        return 'system';
    });
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return getSystemTheme();
    });
    useHeaderOffsets();

    useEffect(() => {
        markPerf('app:bootstrap:end');
        measurePerf('app:bootstrap', 'app:bootstrap:start', 'app:bootstrap:end');
    }, []);

    const {
        selectedJobId,
        setSelectedJobId,
        selectedBlogPostSlug,
        setSelectedBlogPostSlug,
        isBlogOpen,
        setIsBlogOpen,
        selectedCompanyId,
        setSelectedCompanyId,
        discoveryLane,
        setDiscoveryLane,
        discoveryMode,
        setDiscoveryMode,
        discoverySearchMode,
        setDiscoverySearchMode,
        challengeRemoteOnly,
        setChallengeRemoteOnly,
        directlyFetchedJob,
        setDirectlyFetchedJob,
    } = useMarketplaceSceneState();

    // Wrapper to update selectedJobId state; URL sync handled in a dedicated effect
    const getLocalePrefix = () => {
        let lng = (i18n && i18n.language) || 'cs';
        lng = getLocaleFromPathname(window.location.pathname, lng);
        return lng;
    };

    // Track if user intentionally clicked on LIST (to prevent NavRestore from auto-restoring dashboard)
    const userIntentionallyClickedListRef = useRef(false);

    // UI State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'reset'>('login');
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [showCandidateOnboarding, setShowCandidateOnboarding] = useState(false);
    const [candidateOnboardingInitialStepOverride, setCandidateOnboardingInitialStepOverride] = useState<CandidateOnboardingStepKey | null>(null);
    const [applyFollowup, setApplyFollowup] = useState<PendingApplyFollowup | null>(null);
    const [showApplyFollowup, setShowApplyFollowup] = useState(false);
    const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState<{ email?: string } | null>(null);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);
    const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const onboardingDismissedRef = useRef(false);
    const postAuthCandidateOnboardingRef = useRef<CandidateOnboardingStepKey | null>(null);
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
        return getNormalizedAppPath(window.location.pathname);
    }, [window.location.pathname]);

    useEffect(() => {
        const explicitLocale = getLocaleFromPathname(window.location.pathname, '');
        if (explicitLocale) return;

        const preferredLocale = resolvePreferredLocale((i18n.resolvedLanguage || i18n.language || 'cs').split('-')[0].toLowerCase());
        const pathWithoutLocale = getPathPartsWithoutLocale(window.location.pathname).join('/');
        const nextPath = `/${preferredLocale}${pathWithoutLocale ? `/${pathWithoutLocale}` : '/'}`.replace(/\/{2,}/g, '/');
        const currentPathWithQuery = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const nextPathWithQuery = `${nextPath}${window.location.search}${window.location.hash}`;

        if (currentPathWithQuery !== nextPathWithQuery) {
            window.history.replaceState({}, '', nextPathWithQuery);
        }
        if ((i18n.resolvedLanguage || i18n.language || '').split('-')[0].toLowerCase() !== preferredLocale) {
            i18n.changeLanguage(preferredLocale);
        }
    }, [i18n, i18n.language, i18n.resolvedLanguage]);

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
    useEffect(() => {
        if (discoveryMode === 'micro_jobs' && discoveryLane !== 'challenges') {
            setDiscoveryLane('challenges');
        }
    }, [discoveryLane, discoveryMode]);
    const userProfileRef = useRef<UserProfile>(userProfile);

    useEffect(() => {
        userProfileRef.current = userProfile;
    }, [userProfile]);

    const {
        showCookieBanner,
        showGuestDiscoveryTour,
        guestDiscoveryTourSteps,
        guestDiscoveryTourLabels,
        handleCookieAccept,
        handleCookieCustomize,
        completeGuestDiscoveryTour,
    } = useGuestDiscoveryTour({
        language: i18n.language,
        isLoggedIn: userProfile.isLoggedIn,
        isHomeListView,
    });

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
        if (!ONBOARDING_ENABLED) {
            onboardingDismissedRef.current = true;
            postAuthCandidateOnboardingRef.current = null;
            setCandidateOnboardingInitialStepOverride(null);
            if (showCandidateOnboarding) {
                setShowCandidateOnboarding(false);
            }
            if (isOnboardingCompany) {
                setIsOnboardingCompany(false);
            }
            return;
        }

        if (!userProfile.isLoggedIn) {
            onboardingDismissedRef.current = false;
            postAuthCandidateOnboardingRef.current = null;
            setCandidateOnboardingInitialStepOverride(null);
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
        const onboardingComplete = Boolean(activationState.onboarding_completed_at);
        const needsCoreOnboarding =
            !activationState.location_verified ||
            !activationState.cv_ready ||
            activationState.skills_confirmed_count < 3 ||
            !activationState.preferences_ready;
        const shouldShow = (!onboardingComplete || needsCoreOnboarding) && !onboardingDismissedRef.current;

        if (shouldShow) {
            setShowCandidateOnboarding(true);
        } else if (isActivationComplete(activationState)) {
            setShowCandidateOnboarding(false);
        }

        if (postAuthCandidateOnboardingRef.current) {
            const requestedStep = postAuthCandidateOnboardingRef.current;
            const resolvedStep: CandidateOnboardingStepKey =
                requestedStep === 'entry'
                    ? 'entry'
                    : requestedStep === 'location' && !activationState.location_verified
                    ? 'location'
                    : requestedStep === 'preferences' && !activationState.preferences_ready
                        ? 'preferences'
                            : requestedStep === 'cv' && !activationState.cv_ready
                                ? 'cv'
                                : !activationState.onboarding_completed_at
                                    ? 'entry'
                                    : !activationState.location_verified
                                ? 'location'
                                : activationState.skills_confirmed_count < 3 || !activationState.preferences_ready
                                    ? 'preferences'
                                        : !activationState.cv_ready
                                            ? 'cv'
                                        : 'done';

            onboardingDismissedRef.current = false;
            setCandidateOnboardingInitialStepOverride(resolvedStep);
            setShowCandidateOnboarding(true);
            postAuthCandidateOnboardingRef.current = null;
        }
    }, [
        ONBOARDING_ENABLED,
        isOnboardingCompany,
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
        () => getNextActivationStep(candidateActivationState) || 'entry',
        [candidateActivationState]
    );
    const activationMilestonesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!userProfile.isLoggedIn || userProfile.role === 'recruiter' || !userProfile.id) return;
        const current = userProfile.preferences?.activation_v1 || null;
        const sameState = current
            && current.onboarding_started_at === candidateActivationState.onboarding_started_at
            && current.onboarding_completed_at === candidateActivationState.onboarding_completed_at
            && current.profile_nudge_completed_at === candidateActivationState.profile_nudge_completed_at
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
            ['A0', Boolean(candidateActivationState.onboarding_completed_at)],
            ['A1', candidateActivationState.location_verified],
            ['A2', candidateActivationState.cv_ready],
            ['A3', candidateActivationState.skills_confirmed_count >= 3],
            ['A4', candidateActivationState.preferences_ready],
            ['A5', Boolean(candidateActivationState.first_quality_action_at)],
        ] as const;

        reached.forEach(([milestone, done]) => {
            if (!done || activationMilestonesRef.current.has(milestone)) return;
            activationMilestonesRef.current.add(milestone);
            void trackAnalyticsEventDeferred({
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
            void trackAnalyticsEventDeferred({
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
        const isMissingOnboarding = !candidateActivationState.onboarding_completed_at;
        const isMissingA3 = candidateActivationState.skills_confirmed_count < 3;
        const nudgeStep = isMissingOnboarding ? 'A0' : isMissingA3 ? 'A3' : 'A5';
        const nudgeKey = `jobshaman_activation_nudge_at:${userProfile.id}:${nudgeStep}`;
        const now = Date.now();
        const cooldownMs = isMissingOnboarding || isMissingA3 ? 24 * 60 * 60 * 1000 : 72 * 60 * 60 * 1000;
        try {
            const last = Number(localStorage.getItem(nudgeKey) || '0');
            if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) return;
            localStorage.setItem(nudgeKey, String(now));
        } catch {
            if (activationNudgeShownRef.current) return;
            activationNudgeShownRef.current = true;
        }
        void trackAnalyticsEventDeferred({
            event_type: 'nudge_shown',
            feature: 'candidate_activation_v1',
            metadata: {
                source: 'activation_rail',
                next_step: activationNextStep,
                nudge_type: isMissingOnboarding ? 'missing_A0' : isMissingA3 ? 'missing_A3' : 'missing_A5',
            },
        });
    }, [activationNextStep, candidateActivationState, userProfile.id, userProfile.isLoggedIn, userProfile.role, viewState]);

    const {
        filteredJobs,
        isLoadingJobs,
        loadingMore,
        hasMore,
        totalCount,
        searchTerm,
        isSearching,
        loadMoreJobs,
        goToPage,
        performSearch,
        filterCity,
        filterMaxDistance,
        enableCommuteFilter,
        filterBenefits,
        filterContractType,
        filterExperience,
        filterLanguageCodes,
        filterMinSalary,
        savedJobIds,
        setSavedJobIds,
        setSearchTerm,
        setFilterCity,
        setFilterBenefits,
        setFilterContractType,
        setFilterExperience,
        setFilterLanguageCodes,
        setFilterMaxDistance,
        setEnableCommuteFilter,
        setFilterMinSalary,
        filterWorkArrangement,
        setFilterWorkArrangement,
        globalSearch,
        abroadOnly,
        setGlobalSearch,
        setAbroadOnly,
        sortBy,
        currentPage,
        pageSize,
        applyInteractionState,
        searchDiagnostics,
    } = useMarketplaceDiscovery({
        effectiveUserProfile,
        userProfile,
        enabled: !isAdminRoute,
        discoveryMode,
        challengeRemoteOnly,
        setChallengeRemoteOnly,
        selectedJobId,
        setDirectlyFetchedJob,
        isAdminRoute,
        isCompanyProfile,
        companyCoordinates,
        viewState,
    });
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

    const jobsForDisplay = useMemo(() => measureSyncPerf('app:jobs-for-display', () => {
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

        const scopedJobs = discoveryMode === 'micro_jobs'
            ? personalized.filter((job) => job.challenge_format === 'micro_job')
            : personalized;

        if (sortBy === 'distance') {
            return [...scopedJobs].sort((a, b) => {
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
            return [...scopedJobs].sort((a, b) => toMonthly(b) - toMonthly(a));
        }
        return scopedJobs;
    }), [filteredJobs, sortBy, effectiveUserProfile.jhiPreferences, buildJhiCacheKey, discoveryMode]);
    const deferredJobsForDisplay = useDeferredValue(jobsForDisplay);
    const benefitCandidates = useMemo(
        () =>
            Array.from(
                new Set(
                    deferredJobsForDisplay
                        .flatMap((job) => [...(Array.isArray(job.benefits) ? job.benefits : []), ...(Array.isArray(job.tags) ? job.tags : [])])
                        .map((item) => String(item || '').trim())
                        .filter(Boolean)
                )
            ).slice(0, 6),
        [deferredJobsForDisplay]
    );
    const [headerNotifications, setHeaderNotifications] = useState<CareerOSNotification[]>([]);
    const notificationStorageKey = useMemo(
        () => `careeros.notifications.read.${userProfile.id || 'guest'}`,
        [userProfile.id]
    );
    const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
    const [notificationsStorageHydrated, setNotificationsStorageHydrated] = useState(false);
    const notificationMatchCandidates = useMemo(
        () =>
            deferredJobsForDisplay.slice(0, 24).map((job) => {
                const aliases = getSavedJobIdAliases(job.id);
                return {
                    id: job.id,
                    title: String(job.title || '').trim() || t('careeros.notifications.untitled_role', { defaultValue: 'Untitled role' }),
                    company: String(job.company || '').trim() || t('common.company', { defaultValue: 'Company' }),
                    score: Math.round(Number((job as any)?.jhi?.score || 0)),
                    location: String(job.location || '').trim(),
                    salary: String(job.salaryRange || '').trim(),
                    isSaved: aliases.some((id) => savedJobIds.includes(id)),
                };
            }),
        [deferredJobsForDisplay, savedJobIds, t]
    );

    useEffect(() => {
        let cancelled = false;

        const buildHeaderNotificationFeed = async () => {
            const items = await buildCareerOSNotificationFeed({
                locale: i18n.language || userProfile.preferredLocale || 'cs',
                matchCandidates: notificationMatchCandidates,
                userProfile: {
                    id: userProfile.id,
                    dailyDigestEnabled: userProfile.dailyDigestEnabled,
                    dailyDigestLastSentAt: userProfile.dailyDigestLastSentAt,
                    dailyDigestPushEnabled: userProfile.dailyDigestPushEnabled,
                    dailyDigestTime: userProfile.dailyDigestTime,
                    dailyDigestTimezone: userProfile.dailyDigestTimezone,
                },
                t,
                maxItems: 8,
            });

            if (!cancelled) {
                startTransition(() => {
                    setHeaderNotifications(items);
                });
            }
        };

        void buildHeaderNotificationFeed();
        const intervalId = window.setInterval(() => {
            void buildHeaderNotificationFeed();
        }, userProfile.id ? 90_000 : 180_000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [
        i18n.language,
        notificationMatchCandidates,
        t,
        userProfile.dailyDigestEnabled,
        userProfile.dailyDigestLastSentAt,
        userProfile.dailyDigestPushEnabled,
        userProfile.dailyDigestTime,
        userProfile.dailyDigestTimezone,
        userProfile.id,
        userProfile.preferredLocale,
    ]);
    const unreadHeaderNotificationCount = useMemo(
        () => headerNotifications.filter((notification) => !readNotificationIds.includes(notification.id)).length,
        [headerNotifications, readNotificationIds]
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setNotificationsStorageHydrated(false);
        try {
            const raw = window.localStorage.getItem(notificationStorageKey);
            setReadNotificationIds(raw ? JSON.parse(raw) : []);
        } catch {
            setReadNotificationIds([]);
        }
        setNotificationsStorageHydrated(true);
    }, [notificationStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined' || !notificationsStorageHydrated) return;
        try {
            const raw = window.localStorage.getItem(notificationStorageKey);
            const storedIds = raw ? JSON.parse(raw) : [];
            const mergedIds = Array.from(new Set([...(Array.isArray(storedIds) ? storedIds : []), ...readNotificationIds]));
            window.localStorage.setItem(notificationStorageKey, JSON.stringify(mergedIds));
        } catch {
            window.localStorage.setItem(notificationStorageKey, JSON.stringify(readNotificationIds));
        }
    }, [notificationStorageKey, notificationsStorageHydrated, readNotificationIds]);

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
    const deferredResolvedSavedJobs = useDeferredValue(resolvedSavedJobs);

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
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.warn('[App] Failed to resolve session for profile refresh:', error);
                return;
            }
            const userId = session?.user?.id;
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
                if (!initialSessionCheckPromise) {
                    initialSessionCheckPromise = (async () => {
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
                            // keep the resolved promise so StrictMode remounts do not rerun the same init check
                        }
                    })();
                }
                try {
                    await initialSessionCheckPromise;
                } finally {
                    setSessionCheckComplete(true);
                    if (!userProfileRef.current.isLoggedIn) {
                        initialSessionCheckPromise = null;
                    }
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
            const parts = getPathPartsWithoutLocale(window.location.pathname);

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
            } else if (parts[0] === 'market-radar') {
                setIsBlogOpen(false);
                setViewState(ViewState.LIST);
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
        let raf = 0;
        let lastVisible = showScrollToTop;

        const updateVisibility = () => {
            const nextVisible = window.scrollY > 560;
            if (nextVisible === lastVisible) return;
            lastVisible = nextVisible;
            setShowScrollToTop(nextVisible);
        };

        updateVisibility();
        const handleScroll = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(() => {
                raf = 0;
                updateVisibility();
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [showScrollToTop]);

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
            const normalizedCurrentPath = getNormalizedAppPath(window.location.pathname);
            if (isExternalStandalonePath(normalizedCurrentPath)) return;

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

            void trackPageViewDeferred({
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

    // SEO Update Effect
    useEffect(() => {
        const pageName = selectedJob ? 'job-detail' :
            selectedBlogPostSlug ? 'blog-post' :
                normalizedPath === '/about' || normalizedPath === '/about-us' ? 'about' :
                    showCompanyLanding ? 'company-dashboard' :
                        viewState === ViewState.LIST ? 'home' :
                            viewState === ViewState.PROFILE ? 'profile' :
                                viewState === ViewState.SAVED ? 'saved' :
                                    viewState === ViewState.ASSESSMENT ? 'assessment' :
                                        viewState === ViewState.COMPANY_DASHBOARD ? 'company-dashboard' : 'home';

        // Wait until translations are ready to avoid raw keys in browser tab
        if (t('seo.base_title') === 'seo.base_title') return;

        if (!selectedBlogPostSlug) {
            const metadata = generateSEOMetadata(pageName, t, selectedJob);
            updatePageMeta(metadata);
            return;
        }

        let cancelled = false;
        void import('./src/data/blogPosts').then(({ initialBlogPosts }) => {
            if (cancelled) return;
            const selectedBlogPost = initialBlogPosts.find((post) => post.slug === selectedBlogPostSlug);
            const metadata = generateSEOMetadata(pageName, t, selectedBlogPost || selectedJob);
            updatePageMeta(metadata);
        });
        return () => {
            cancelled = true;
        };
    }, [viewState, showCompanyLanding, selectedJob, selectedBlogPostSlug, userProfile, i18n.language, t, normalizedPath]);

    useEffect(() => {
        if (themeMode !== 'system') {
            setTheme(themeMode);
            return;
        }

        const syncSystemTheme = () => {
            setTheme(getSystemTheme());
        };

        syncSystemTheme();

        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => syncSystemTheme();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, [themeMode]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', themeMode);
    }, [theme, themeMode]);

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

    // --- HANDLERS ---

    const handleAuthAction = useCallback(async (mode: 'login' | 'register' = 'login') => {
        if (userProfile.isLoggedIn && userProfile.id) {
            await signOut();
        } else {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
        }
    }, [signOut, userProfile.id, userProfile.isLoggedIn]);

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
        void trackAnalyticsEventDeferred({
            event_type: 'activation_milestone_reached',
            feature: 'candidate_activation_v1',
            metadata: {
                milestone: 'A5',
                source,
                completion_percent: nextProfile.preferences?.activation_v1?.completion_percent || 100,
            },
        });
    }, [candidateActivationState.first_quality_action_at, setUserProfile, userProfile]);

    const handleToggleSave = useCallback((jobId: string, options?: { source?: string; position?: number }) => {
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
    }, [applyInteractionState, jobsForDisplay, persistQualityAction, savedJobIds, selectedJob]);

    const handleApplyToJob = useCallback((job: Job) => {
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
    }, [persistQualityAction]);

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

    const handleJobSelect = useCallback((jobId: string | null) => {
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
    }, [jobsForDisplay, selectedCompanyId, selectedJob, selectedJobId, setDirectlyFetchedJob, setSelectedBlogPostSlug, setSelectedCompanyId, setSelectedJobId, usePageScrollLayout, viewState]);

    const [showPremiumUpgrade, setShowPremiumUpgrade] = useState<{ open: boolean, feature?: string }>({ open: false });

    const handleCompanyPageSelect = useCallback((companyId: string | null) => {
        setSelectedCompanyId(companyId);
        setSelectedJobId(null);
        setSelectedBlogPostSlug(null);
        if (companyId) {
            setViewState(ViewState.LIST);
        }
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
    }, [setSelectedBlogPostSlug, setSelectedCompanyId, setSelectedJobId, setViewState]);

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

    const headerNode = !isImmersiveAssessmentRoute ? (
        <AppHeader
            viewState={viewState}
            setViewState={setViewState}
            selectedJobId={selectedJobId}
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
            theme={theme}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            setIsOnboardingCompany={ONBOARDING_ENABLED ? setIsOnboardingCompany : () => {}}
            onIntentionalListClick={() => { userIntentionallyClickedListRef.current = true; }}
            discoveryLane={discoveryLane}
            setDiscoveryLane={setDiscoveryLane}
            discoveryMode={discoveryMode}
            setDiscoveryMode={setDiscoveryMode}
            discoverySearchMode={discoverySearchMode}
            setDiscoverySearchMode={setDiscoverySearchMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterCity={filterCity}
            setFilterCity={setFilterCity}
            performSearch={performSearch}
            remoteOnly={challengeRemoteOnly}
            setRemoteOnly={setChallengeRemoteOnly}
            filterWorkArrangement={filterWorkArrangement}
            setFilterWorkArrangement={(value) => setFilterWorkArrangement(value, 'user_toggle')}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            abroadOnly={abroadOnly}
            setAbroadOnly={setAbroadOnly}
            enableCommuteFilter={enableCommuteFilter}
            setEnableCommuteFilter={setEnableCommuteFilter}
            filterMinSalary={filterMinSalary}
            setFilterMinSalary={setFilterMinSalary}
            filterMaxDistance={filterMaxDistance}
            setFilterMaxDistance={(value) => setFilterMaxDistance(value, 'user_toggle')}
            transportMode={userProfile.transportMode || 'public'}
            setTransportMode={(mode) => {
                const nextProfile = { ...userProfileRef.current, transportMode: mode };
                userProfileRef.current = nextProfile;
                setUserProfile(nextProfile);
            }}
            discoveryFilterMode={discoveryMode}
            setDiscoveryFilterMode={setDiscoveryMode}
            filterContractType={filterContractType}
            setFilterContractType={(values) => setFilterContractType(values, 'user_toggle')}
            filterExperience={filterExperience}
            setFilterExperience={(values) => setFilterExperience(values, 'user_toggle')}
            filterLanguageCodes={filterLanguageCodes}
            setFilterLanguageCodes={(values) => setFilterLanguageCodes(values, 'user_toggle')}
            filterBenefits={filterBenefits}
            setFilterBenefits={(values) => setFilterBenefits(values, 'user_toggle')}
            benefitCandidates={benefitCandidates}
            notifications={headerNotifications}
            readNotificationIds={readNotificationIds}
            notificationCount={unreadHeaderNotificationCount}
            onMarkNotificationRead={(notificationId) => {
                setReadNotificationIds((current) => Array.from(new Set([...current, notificationId])));
            }}
            onMarkAllNotificationsRead={() => {
                setReadNotificationIds((current) => Array.from(new Set([...current, ...headerNotifications.map((item) => item.id)])));
            }}
            onNotificationAction={(notification) => {
                setReadNotificationIds((current) => Array.from(new Set([...current, notification.id])));
                if (notification.challengeId) {
                    handleJobSelect(notification.challengeId);
                    return;
                }
                setViewState(ViewState.PROFILE);
            }}
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
    ) : null;

    const standalonePageNode = useMemo(() => {
        if (normalizedPath === '/terms' || normalizedPath === '/podminky-uziti') {
            return (
                <Suspense fallback={null}>
                    <PodminkyUziti />
                </Suspense>
            );
        }
        if (normalizedPath === '/privacy-policy' || normalizedPath === '/ochrana-osobnich-udaju') {
            return (
                <Suspense fallback={null}>
                    <OchranaSoukromi />
                </Suspense>
            );
        }
        if (normalizedPath === '/about' || normalizedPath === '/about-us') {
            return (
                <Suspense fallback={null}>
                    <AboutUsPage />
                </Suspense>
            );
        }
        if (normalizedPath.startsWith('/signal/')) {
            return (
                <Suspense fallback={null}>
                    <SignalBoostPublicPage />
                </Suspense>
            );
        }
        return null;
    }, [normalizedPath]);
    const isStandaloneRoute = standalonePageNode !== null;
    const isPrimaryCareerOSHome =
        !isImmersiveAssessmentRoute
        && !isStandaloneRoute
        && viewState === ViewState.LIST
        && !selectedJobId
        && !selectedCompanyId
        && !isBlogOpen
        && !showCompanyLanding;

    const sessionSceneState = useMemo(() => ({
        viewState,
        theme,
        vercelAnalyticsEnabled,
        userProfile,
        companyProfile,
        selectedCompanyId,
        selectedJobId,
        selectedBlogPostSlug,
        showCompanyLanding,
        isBlogOpen,
        selectedJob,
        candidateActivationState,
        activationNextStep,
    }), [
        activationNextStep,
        candidateActivationState,
        companyProfile,
        isBlogOpen,
        selectedBlogPostSlug,
        selectedCompanyId,
        selectedJob,
        selectedJobId,
        showCompanyLanding,
        theme,
        userProfile,
        vercelAnalyticsEnabled,
        viewState,
    ]);

    const discoverySceneState = useMemo(() => ({
        jobsForDisplay: deferredJobsForDisplay,
        resolvedSavedJobs: deferredResolvedSavedJobs,
        savedJobIds,
        savedJobsSearchTerm,
        isLoadingJobs,
        loadingMore,
        hasMore,
        totalCount,
        currentPage,
        pageSize,
        searchTerm,
        filterCity,
        filterMinSalary,
        filterBenefits,
        remoteOnly: challengeRemoteOnly,
        filterWorkArrangement,
        globalSearch,
        abroadOnly,
        enableCommuteFilter,
        filterMaxDistance,
        filterContractType,
        filterExperience,
        filterLanguageCodes,
        discoveryLane,
        discoveryMode,
        searchDiagnostics,
    }), [
        abroadOnly,
        challengeRemoteOnly,
        currentPage,
        deferredJobsForDisplay,
        deferredResolvedSavedJobs,
        discoveryLane,
        discoveryMode,
        enableCommuteFilter,
        filterBenefits,
        filterCity,
        filterContractType,
        filterExperience,
        filterLanguageCodes,
        filterMaxDistance,
        filterMinSalary,
        filterWorkArrangement,
        globalSearch,
        hasMore,
        isLoadingJobs,
        loadingMore,
        pageSize,
        savedJobIds,
        savedJobsSearchTerm,
        searchDiagnostics,
        searchTerm,
        totalCount,
    ]);

    const sceneActions = useMemo(() => ({
        onDeleteAccount: deleteAccount,
        onSignOut: signOut,
        onSetCompanyProfile: setCompanyProfile,
        onSetViewState: setViewState,
        onProfileUpdate: handleProfileUpdate,
        onProfileSave: handleProfileSave,
        onRefreshProfile: refreshUserProfile,
        onToggleSave: handleToggleSave,
        onApplyToJob: handleApplyToJob,
        onSavedJobsSearchChange: setSavedJobsSearchTerm,
        onSetBlogOpen: setIsBlogOpen,
        onSetSelectedBlogPostSlug: setSelectedBlogPostSlug,
        onSetSelectedJobId: setSelectedJobId,
        onSetSelectedCompanyId: setSelectedCompanyId,
        onSetShowCompanyLanding: setShowCompanyLanding,
        onSetCompanyRegistrationOpen: setIsCompanyRegistrationOpen,
        onSetApplyModalOpen: setIsApplyModalOpen,
        onSetShowCandidateOnboarding: ONBOARDING_ENABLED ? setShowCandidateOnboarding : noop,
        onOpenAuth: handleAuthAction,
        onHandleCompanyPageSelect: handleCompanyPageSelect,
        onHandleJobSelect: handleJobSelect,
        onLoadMoreJobs: loadMoreJobs,
        onGoToJobsPage: goToPage,
        onSetDiscoveryLane: setDiscoveryLane,
        onSetDiscoveryMode: setDiscoveryMode,
        onPerformSearch: performSearch,
        onSetFilterCity: setFilterCity,
        onSetFilterMinSalary: setFilterMinSalary,
        onSetFilterBenefits: setFilterBenefits,
        onSetRemoteOnly: setChallengeRemoteOnly,
        onSetFilterWorkArrangement: setFilterWorkArrangement,
        onSetGlobalSearch: setGlobalSearch,
        onSetAbroadOnly: setAbroadOnly,
        onSetEnableCommuteFilter: setEnableCommuteFilter,
        onSetFilterMaxDistance: setFilterMaxDistance,
        onSetFilterContractType: setFilterContractType,
        onSetFilterExperience: setFilterExperience,
        onSetFilterLanguageCodes: setFilterLanguageCodes,
        onSetSearchTerm: setSearchTerm,
    }), [
        deleteAccount,
        goToPage,
        handleApplyToJob,
        handleAuthAction,
        handleCompanyPageSelect,
        handleJobSelect,
        handleProfileSave,
        handleProfileUpdate,
        handleToggleSave,
        loadMoreJobs,
        refreshUserProfile,
        setAbroadOnly,
        setChallengeRemoteOnly,
        setCompanyProfile,
        setDiscoveryLane,
        setDiscoveryMode,
        setEnableCommuteFilter,
        setFilterBenefits,
        setFilterCity,
        setFilterContractType,
        setFilterExperience,
        setFilterLanguageCodes,
        setFilterMaxDistance,
        setFilterMinSalary,
        setFilterWorkArrangement,
        setGlobalSearch,
        setIsApplyModalOpen,
        setIsBlogOpen,
        setIsCompanyRegistrationOpen,
        setSavedJobsSearchTerm,
        setSearchTerm,
        setSelectedBlogPostSlug,
        setSelectedCompanyId,
        setSelectedJobId,
        setShowCompanyLanding,
        setShowCandidateOnboarding,
        setViewState,
        signOut,
    ]);

    const bannerNode = !isImmersiveAssessmentRoute && !userProfile.isLoggedIn && pendingEmailConfirmation ? (
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
    ) : null;

    const sceneNode = (
        <Suspense
            fallback={
                <div className="col-span-1 lg:col-span-12 flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                </div>
            }
        >
            <AppSceneRouter
                normalizedPath={normalizedPath}
                sessionState={sessionSceneState}
                discoveryState={discoverySceneState}
                sceneActions={sceneActions}
                getLocalePrefix={getLocalePrefix}
                onboardingDismissedRef={onboardingDismissedRef}
            />
        </Suspense>
    );

    const floatingActionNode = !isImmersiveAssessmentRoute && showScrollToTop ? (
        <button
            type="button"
            onClick={handleFloatingScrollToTop}
            aria-label={t('app.back_to_top')}
            title={t('app.back_to_top')}
            className="fixed bottom-5 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[var(--surface-elevated)] text-[var(--accent)] shadow-[var(--shadow-card)] backdrop-blur transition hover:-translate-y-[1px] hover:border-[rgba(var(--accent-rgb),0.34)] hover:bg-[var(--surface)] hover:text-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] sm:bottom-6 sm:right-6"
        >
            <ArrowUp size={18} />
        </button>
    ) : null;

    const overlayNodes = (
        <>
            {ONBOARDING_ENABLED ? (
            <Suspense fallback={null}>
                <CandidateOnboardingModal
                    isOpen={showCandidateOnboarding}
                    profile={userProfile}
                    jobs={deferredJobsForDisplay}
                    initialStep={
                        candidateOnboardingInitialStepOverride
                        || (
                            activationNextStep === 'onboarding'
                                ? 'entry'
                                : activationNextStep === 'skills'
                                ? 'preferences'
                                : activationNextStep === 'quality_action'
                                    ? 'done'
                                    : activationNextStep
                        )
                    }
                    onClose={() => {
                        onboardingDismissedRef.current = true;
                        setCandidateOnboardingInitialStepOverride(null);
                        setShowCandidateOnboarding(false);
                    }}
                    onComplete={() => {
                        onboardingDismissedRef.current = true;
                        setCandidateOnboardingInitialStepOverride(null);
                        setShowCandidateOnboarding(false);
                    }}
                    onGoToProfile={() => {
                        onboardingDismissedRef.current = true;
                        setCandidateOnboardingInitialStepOverride(null);
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
                        void trackAnalyticsEventDeferred({
                            event_type: 'onboarding_step_viewed',
                            feature: 'candidate_activation_v1',
                            metadata: {
                                step,
                                completion_percent: candidateActivationState.completion_percent,
                            },
                        });
                    }}
                    onStepCompleted={(step) => {
                        void trackAnalyticsEventDeferred({
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
            ) : null}

            <Suspense fallback={null}>
                <ApplyFollowupModal
                    isOpen={showApplyFollowup}
                    jobTitle={applyFollowup?.title}
                    company={applyFollowup?.company}
                    onConfirm={() => handleApplyFollowupAnswer(true)}
                    onReject={() => handleApplyFollowupAnswer(false)}
                    onLater={handleApplyFollowupLater}
                />
            </Suspense>

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
                        const successMode = authModalMode;
                        const hasPendingSignalBoost = typeof window !== 'undefined'
                            && Object.keys(window.localStorage).some((key) => key.startsWith(SIGNAL_BOOST_PENDING_PREFIX));
                        setIsAuthModalOpen(false);
                        passwordRecoveryInProgressRef.current = false;
                        clearPasswordRecoveryPending();
                        setAuthModalMode('login');
                        if (successMode === 'register') {
                            postAuthCandidateOnboardingRef.current = 'entry';
                            onboardingDismissedRef.current = false;
                            if (!hasPendingSignalBoost) {
                                setSelectedJobId(null);
                                setSelectedBlogPostSlug(null);
                                setShowCompanyLanding(false);
                                setViewState(ViewState.LIST);
                            }
                        }
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
            {ONBOARDING_ENABLED && isOnboardingCompany && userProfile.id && (
                <Suspense fallback={null}>
                    <CompanyOnboarding
                        userId={userProfile.id}
                        onComplete={handleCompanyOnboardingComplete}
                        onCancel={() => {
                            setIsOnboardingCompany(false);
                            setViewState(ViewState.LIST);
                        }}
                    />
                </Suspense>
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

            {showCookieBanner && (
                <Suspense fallback={null}>
                    <CookieBanner
                        onAccept={handleCookieAccept}
                        onCustomize={handleCookieCustomize}
                    />
                </Suspense>
            )}

            <Suspense fallback={null}>
                <GuestDiscoveryTourOverlay
                    open={showGuestDiscoveryTour}
                    steps={guestDiscoveryTourSteps}
                    labels={guestDiscoveryTourLabels}
                    onSkip={completeGuestDiscoveryTour}
                    onComplete={completeGuestDiscoveryTour}
                />
            </Suspense>
        </>
    );

    return (
        <AppViewportShell
            isImmersive={isImmersiveAssessmentRoute}
            usePageScrollLayout={isPrimaryCareerOSHome ? false : (usePageScrollLayout || isStandaloneRoute)}
            header={headerNode}
            banner={isPrimaryCareerOSHome || isStandaloneRoute ? null : bannerNode}
            scene={standalonePageNode ?? sceneNode}
            footer={
                !isImmersiveAssessmentRoute && !isPrimaryCareerOSHome ? (
                    <Suspense fallback={null}>
                        <SiteFooter />
                    </Suspense>
                ) : null
            }
            floatingAction={isPrimaryCareerOSHome ? null : floatingActionNode}
            overlays={overlayNodes}
        />
    );
}
