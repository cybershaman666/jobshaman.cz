import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Briefcase,
  CircleUserRound,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  BrainCircuit,
} from 'lucide-react';

import { cn } from './cn';
import { fetchJobByIdV2, fetchJobsWithFiltersV2 } from '../services/jobServiceV2';
import { createCompany, deleteCVDocument, getRecruiterCompany, getUserCVDocuments, updateCVDocumentParsedData, updateCompanyProfile, updateUserCVSelection, updateUserProfile, uploadApplicationMessageAttachment, uploadUserProfilePhoto } from '../services/v2UserService';
import {
  fetchCandidateApplicationDetail,
  fetchCandidateApplicationMessages,
  fetchMyDialoguesWithCapacity,
  sendCandidateApplicationMessage,
  withdrawCandidateApplication,
} from '../services/v2DialogueService';
import { addExternalHandshakeSubmission, finalizeHandshake, patchHandshakeAnswer, startHandshake } from '../services/v2HandshakeService';
import {
  aiAssistCompanyChallenge,
  aiDraftCompanyChallenge,
  createCompanyChallenge,
  listCompanyChallenges,
  publishCompanyChallenge,
} from '../services/v2ChallengeService';
import { supabase } from '../services/supabaseClient';
import { useUserProfile } from '../hooks/useUserProfile';
import { useCompanyJobsData } from '../hooks/useCompanyJobsData';
import { useCompanyApplicationsData } from '../hooks/useCompanyApplicationsData';
import { useCompanyCandidatesData } from '../hooks/useCompanyCandidatesData';
import { useAllRegisteredCandidates } from '../hooks/useAllRegisteredCandidates';
import { useJobInteractionState } from '../hooks/useJobInteractionState';
import { mergeProfileWithParsedCv, uploadAndParseCv } from '../services/v2CvService';
import { uploadV2Asset } from '../services/v2AssetService';
import { trackJobInteraction } from '../services/jobInteractionService';
import type {
  ApplicationMessageAttachment,
  CandidateDialogueCapacity,
  CVDocument,
  DialogueDetail,
  DialogueMessage,
  DialogueSummary,
} from '../types';
import type {
  Company,
  CandidateJourneySession,
  CandidatePreferenceProfile,
  HandshakeBlueprint,
  MarketplaceFilters,
  MarketplaceSection,
  Role,
} from './models';
import {
  CandidateJcfpmPage,
  CandidateRoleBriefingPage,
  ImportedPrepPage,
} from './candidate/CandidateShell';
import { MarketplaceV2 } from './candidate/MarketplaceV2';
import { CandidateInsightsPage, CandidateJourneyPage } from './candidate/CandidateExperience';
import { CandidateApplicationsPage } from './candidate/CandidateApplicationsPage';
import { CandidateLearningPage } from './candidate/CandidateLearningPage';
import { deriveDashboardMetrics, deriveRecruiterCalendar, deriveRolePipelineStats, deriveTalentPool } from './derivations';
import { RecruiterActivationPage, RecruiterShell } from './recruiter/RecruiterShell';
import type { AuthIntent } from './authTypes';
import { navigateTo, routeFromPath, usePathname } from './routing';
import {
  buildDefaultMarketplaceFilters,
  candidatePreferencesToUserProfileUpdates,
  mapApplicationToInsight,
  mapCandidateToInsight,
  mapChallengeDraftToRole,
  mapCompanyProfileToCompany,
  mapDialoguesToCalendarEvents,
  mapJobToRole,
  mapUserProfileToCandidatePreferences,
} from './adapters';
import { checkPaymentStatus, redirectToCheckout } from '../services/stripeService';
import {
  buildInitialJourneySession,
  getDefaultBlueprintLibrary,
  getDefaultCandidatePreferences,
  getDefaultCompanyLibrary,
  getDefaultRoleAssignments,
  REBUILD_STORAGE_KEYS,
  resolveBlueprintForRole,
  usePersistentState,
} from './state';
import { generateAiBlueprint } from './shellDomain';
import { AppBackdrop } from './ui/ShellChrome';
import { DashboardLayoutV2 } from './ui/DashboardLayoutV2';
import { CompanyEntryPage, LandingChoicePage, LegalPublicPage } from './public/PublicPages';
import { CookieBanner } from './ui/CookieBanner';
import {
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
} from './ui/shellStyles';
import { RebuildThemeProvider } from './ui/rebuildTheme';
import './ui/rebuildTheme.css';
import AdminDashboard from '../pages/AdminDashboard';
import { initializeAnalytics } from '../services/cookieConsentService';
import { AuthPanel } from './auth/AuthPanel';





const JobshamanRebuildApp: React.FC = () => {
  const { t, i18n } = useTranslation();
  React.useEffect(() => {
    initializeAnalytics();
  }, []);

  const [pathname, setPathname] = usePathname();
  const route = React.useMemo(() => routeFromPath(pathname), [pathname]);
  const {
    userProfile,
    companyProfile,
    setUserProfile,
    setCompanyProfile,
    signOut: signOutUser,
    handleSessionRestoration,
  } = useUserProfile();
  const {
    savedJobIds,
    applyInteractionState,
    setDismissedJobIds,
    setSavedJobIds,
  } = useJobInteractionState({
    enabled: true,
    userProfile,
  });
  const [companyLibrary, setCompanyLibrary] = usePersistentState<Company[]>(
    REBUILD_STORAGE_KEYS.companies,
    getDefaultCompanyLibrary(),
  );
  const [preferences, setPreferences] = usePersistentState<CandidatePreferenceProfile>(
    REBUILD_STORAGE_KEYS.preferences,
    getDefaultCandidatePreferences(),
  );
  const [blueprintLibrary, setBlueprintLibrary] = usePersistentState<HandshakeBlueprint[]>(
    REBUILD_STORAGE_KEYS.blueprints,
    getDefaultBlueprintLibrary(),
  );
  const [localCompanyRoles, setLocalCompanyRoles] = usePersistentState<Role[]>(
    REBUILD_STORAGE_KEYS.companyRoles,
    [],
  );
  const [roleAssignments, setRoleAssignments] = usePersistentState<Record<string, string>>(
    REBUILD_STORAGE_KEYS.roleAssignments,
    getDefaultRoleAssignments(),
  );
  const [journeySessions, setJourneySessions] = usePersistentState<Record<string, CandidateJourneySession>>(
    REBUILD_STORAGE_KEYS.journeys,
    {},
  );
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authIntent, setAuthIntent] = React.useState<AuthIntent>('candidate');
  const [marketplaceQuery, setMarketplaceQuery] = React.useState('');
  const [marketplaceFilters, setMarketplaceFilters] = React.useState<MarketplaceFilters>(() => buildDefaultMarketplaceFilters(getDefaultCandidatePreferences()));
  const [recruiterSearch, setRecruiterSearch] = React.useState('');
  const [marketplaceRoles, setMarketplaceRoles] = React.useState<Role[]>([]);
  const [marketplaceSections, setMarketplaceSections] = React.useState<MarketplaceSection[]>([]);
  const [marketplaceTotalCount, setMarketplaceTotalCount] = React.useState(0);

  const [marketplacePage, setMarketplacePage] = React.useState(0);
  const [marketplaceHasMore, setMarketplaceHasMore] = React.useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [cvDocuments, setCvDocuments] = React.useState<CVDocument[]>([]);
  const [cvLoading, setCvLoading] = React.useState(false);
  const [cvBusy, setCvBusy] = React.useState(false);
  const [cvReviewBusy, setCvReviewBusy] = React.useState(false);
  const [candidateApplications, setCandidateApplications] = React.useState<DialogueSummary[]>([]);
  const [candidateApplicationsLoading, setCandidateApplicationsLoading] = React.useState(false);
  const [candidateDialogueCapacity, setCandidateDialogueCapacity] = React.useState<CandidateDialogueCapacity | null>(null);
  const [selectedCandidateApplicationId, setSelectedCandidateApplicationId] = React.useState('');
  const [selectedCandidateApplicationDetail, setSelectedCandidateApplicationDetail] = React.useState<DialogueDetail | null>(null);
  const [selectedCandidateApplicationMessages, setSelectedCandidateApplicationMessages] = React.useState<DialogueMessage[]>([]);
  const [candidateApplicationDetailLoading, setCandidateApplicationDetailLoading] = React.useState(false);
  const [candidateApplicationMessageBusy, setCandidateApplicationMessageBusy] = React.useState(false);
  const [candidateApplicationWithdrawBusy, setCandidateApplicationWithdrawBusy] = React.useState(false);
  const [journeySubmitting, setJourneySubmitting] = React.useState(false);
  const [brandSaving, setBrandSaving] = React.useState(false);
  const [recruiterActivationBusy, setRecruiterActivationBusy] = React.useState(false);
  const [companyLookupBusy, setCompanyLookupBusy] = React.useState(false);
  const [companyLookupFailed, setCompanyLookupFailed] = React.useState(false);
  const [companyLookupRetry, setCompanyLookupRetry] = React.useState(0);
  const [checkoutBusyTier, setCheckoutBusyTier] = React.useState<'starter' | 'growth' | 'professional' | null>(null);



  React.useEffect(() => {
    if (!preferences.address && !userProfile.isLoggedIn) {
      const detectRegion = async () => {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data && data.country_code) {
            const detectedCountry = data.country_code.toUpperCase();
            const supportedCountries = ['CZ', 'PL', 'DE', 'AT', 'SK', 'FI', 'SE', 'NO', 'DK'];
            if (supportedCountries.includes(detectedCountry)) {
              setPreferences(prev => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, countryCode: detectedCountry }
              }));
              setMarketplaceFilters(prev => ({
                ...prev,
                city: data.city || prev.city
              }));

              // Auto-set language based on IP if not already manually changed/persisted
              const countryToLang: Record<string, string> = {
                CZ: 'cs',
                SK: 'sk',
                PL: 'pl',
                DE: 'de',
                AT: 'de',
                FI: 'fi',
                SE: 'sv',
                NO: 'no',
                DK: 'da'
              };
              const targetLang = countryToLang[detectedCountry];
              if (targetLang && i18n.language !== targetLang) {
                // Only change if user hasn't explicitly chosen another language in this session
                // (i18next-browser-languagedetector usually handles localStorage persistence)
                void i18n.changeLanguage(targetLang);
              }
            }
          }
        } catch (e) {
          console.warn('GeoIP detection failed', e);
        }
      };
      detectRegion();
    }
  }, [preferences.address, userProfile.isLoggedIn, setPreferences, i18n]);

  const deferredMarketplaceQuery = React.useDeferredValue(marketplaceQuery);
  const marketplaceCriteriaKey = React.useMemo(() => JSON.stringify({
    q: deferredMarketplaceQuery.trim(),
    city: marketplaceFilters.city.trim(),
    targetRole: marketplaceFilters.targetRole.trim(),
    roleFamily: marketplaceFilters.roleFamily,
    crossBorder: marketplaceFilters.crossBorder,
    benefits: [...marketplaceFilters.benefits].sort(),
    minSalary: marketplaceFilters.minSalary,
    radiusKm: marketplaceFilters.radiusKm,
    remoteOnly: marketplaceFilters.remoteOnly,
    transportMode: marketplaceFilters.transportMode,
    workArrangement: marketplaceFilters.workArrangement,
    borderSearchEnabled: preferences.borderSearchEnabled,
    lat: preferences.coordinates.lat,
    lng: preferences.coordinates.lon,
    searchRadiusKm: preferences.searchRadiusKm,
    countryCode: preferences.taxProfile.countryCode,
  }), [
    deferredMarketplaceQuery,
    marketplaceFilters.city,
    marketplaceFilters.targetRole,
    marketplaceFilters.roleFamily,
    marketplaceFilters.crossBorder,
    marketplaceFilters.benefits,
    marketplaceFilters.minSalary,
    marketplaceFilters.radiusKm,
    marketplaceFilters.remoteOnly,
    marketplaceFilters.transportMode,
    marketplaceFilters.workArrangement,
    preferences.borderSearchEnabled,
    preferences.coordinates.lat,
    preferences.coordinates.lon,
    preferences.searchRadiusKm,
    preferences.taxProfile.countryCode,
  ]);
  const marketplaceCriteriaRef = React.useRef(marketplaceCriteriaKey);
  const navigate = React.useCallback((path: string) => navigateTo(path, setPathname), [setPathname]);

  React.useEffect(() => {
    if (pathname !== '/' || !userProfile.isLoggedIn) return;
    if (userProfile.role === 'recruiter') {
      navigate('/recruiter');
    }
  }, [navigate, pathname, userProfile]);

  const handleSignOutToCompanyEntry = React.useCallback(() => {
    const cleanPreferences = getDefaultCandidatePreferences();
    setPreferences(cleanPreferences);
    setMarketplaceFilters(buildDefaultMarketplaceFilters(cleanPreferences));
    setCvDocuments([]);
    setCandidateApplications([]);
    setCandidateDialogueCapacity(null);
    setSelectedCandidateApplicationId('');
    setSelectedCandidateApplicationDetail(null);
    setSelectedCandidateApplicationMessages([]);
    setJourneySessions({});
    setSavedJobIds([]);
    setDismissedJobIds([]);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('savedJobIds');
        window.localStorage.removeItem('savedJobIds:guest');
        window.localStorage.removeItem('dismissedJobIds:guest');
        window.localStorage.removeItem('jobshaman_saved_jobs_cache:guest');
      } catch {
        // Best effort only; in-memory state is already cleared above.
      }
    }

    void signOutUser().then(() => navigate('/'));
  }, [
    navigate,
    setDismissedJobIds,
    setJourneySessions,
    setPreferences,
    setSavedJobIds,
    signOutUser,
  ]);

  const recruiterCompany = React.useMemo(() => (companyProfile ? mapCompanyProfileToCompany(companyProfile) : null), [companyProfile]);
  const recruiterActiveTab = route.kind === 'recruiter'
    ? route.tab === 'dashboard'
      ? 'overview'
      : route.tab === 'talent-pool'
        ? 'candidates'
        : route.tab === 'roles'
          ? 'jobs'
          : 'settings'
    : '';
  const recruiterDialogueTab = route.kind === 'recruiter'
    ? route.tab === 'roles'
      ? 'applications'
      : 'overview'
    : '';
  const {
    jobs: recruiterJobs,
    setJobs: setRecruiterJobs,
    refreshJobs: refreshRecruiterJobs,
    selectedJobId,
  } = useCompanyJobsData(companyProfile?.id);
  const { dialogues: recruiterDialogues } = useCompanyApplicationsData({
    companyId: companyProfile?.id,
    activeTab: recruiterDialogueTab,
    selectedJobId,
  });
  const { candidates: recruiterCandidates } = useCompanyCandidatesData(
    companyProfile?.id,
    recruiterActiveTab,
    selectedJobId,
    t,
  );
  const { candidates: allRegisteredCandidates } = useAllRegisteredCandidates(companyProfile?.id);

  React.useEffect(() => {
    if (!supabase) return undefined;
    void supabase.auth.getSession().then(({ data: sessionData }: { data: { session: { user: { id: string } } | null } }) => {
      if (sessionData.session?.user?.id) {
        void handleSessionRestoration(sessionData.session.user.id);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string } } | null) => {
      if (session?.user?.id) {
        void handleSessionRestoration(session.user.id);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    checkPaymentStatus();
  }, []);

  const syncedProfileIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!userProfile.isLoggedIn || !userProfile.id) {
      syncedProfileIdRef.current = null;
      return;
    }
    if (syncedProfileIdRef.current === userProfile.id) return;
    setPreferences((current) => mapUserProfileToCandidatePreferences(userProfile, current));
    syncedProfileIdRef.current = userProfile.id;
  }, [setPreferences, userProfile]);

  React.useEffect(() => {
    if (typeof preferences.commuteFilterEnabled === 'boolean') return;
    setPreferences((current) => ({
      ...current,
      commuteFilterEnabled: true,
    }));
  }, [preferences.commuteFilterEnabled, setPreferences]);

  React.useEffect(() => {
    if (!userProfile.id || !userProfile.isLoggedIn) {
      setCvDocuments([]);
      setCvLoading(false);
      return;
    }
    let active = true;
    setCvLoading(true);
    void getUserCVDocuments(userProfile.id)
      .then((documents) => {
        if (!active) return;
        setCvDocuments(documents);
      })
      .catch((error) => {
        console.error('Failed to load CV documents for rebuild shell', error);
        if (active) setCvDocuments([]);
      })
      .finally(() => {
        if (active) setCvLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  const refreshCandidateApplications = React.useCallback(async () => {
    const result = await fetchMyDialoguesWithCapacity(80);
    setCandidateApplications(result.dialogues);
    setCandidateDialogueCapacity(result.candidateCapacity);
  }, []);

  React.useEffect(() => {
    if (!userProfile.id || !userProfile.isLoggedIn) {
      setCandidateApplications([]);
      setCandidateDialogueCapacity(null);
      setCandidateApplicationsLoading(false);
      setSelectedCandidateApplicationId('');
      setSelectedCandidateApplicationDetail(null);
      setSelectedCandidateApplicationMessages([]);
      return;
    }
    let active = true;
    setCandidateApplicationsLoading(true);
    void fetchMyDialoguesWithCapacity(80)
      .then((result) => {
        if (!active) return;
        setCandidateApplications(result.dialogues);
        setCandidateDialogueCapacity(result.candidateCapacity);
      })
      .catch((error) => {
        console.error('Failed to load candidate applications into rebuild shell', error);
        if (!active) return;
        setCandidateApplications([]);
        setCandidateDialogueCapacity(null);
      })
      .finally(() => {
        if (active) setCandidateApplicationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  React.useEffect(() => {
    if (candidateApplications.length === 0) {
      setSelectedCandidateApplicationId('');
      setSelectedCandidateApplicationDetail(null);
      setSelectedCandidateApplicationMessages([]);
      return;
    }
    if (!candidateApplications.some((application) => application.id === selectedCandidateApplicationId)) {
      setSelectedCandidateApplicationId(candidateApplications[0]?.id || '');
    }
  }, [candidateApplications, selectedCandidateApplicationId]);

  React.useEffect(() => {
    if (!selectedCandidateApplicationId || !userProfile.isLoggedIn) {
      setSelectedCandidateApplicationDetail(null);
      setSelectedCandidateApplicationMessages([]);
      setCandidateApplicationDetailLoading(false);
      return;
    }
    let active = true;
    setCandidateApplicationDetailLoading(true);
    void Promise.all([
      fetchCandidateApplicationDetail(selectedCandidateApplicationId),
      fetchCandidateApplicationMessages(selectedCandidateApplicationId),
    ])
      .then(([detail, messages]) => {
        if (!active) return;
        setSelectedCandidateApplicationDetail(detail);
        setSelectedCandidateApplicationMessages(messages);
      })
      .catch((error) => {
        console.error('Failed to load candidate application detail for rebuild shell', error);
        if (!active) return;
        setSelectedCandidateApplicationDetail(null);
        setSelectedCandidateApplicationMessages([]);
      })
      .finally(() => {
        if (active) setCandidateApplicationDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCandidateApplicationId, userProfile.isLoggedIn]);

  React.useEffect(() => {
    if (!recruiterCompany) return;
    setCompanyLibrary((current) => {
      const existing = current.find((company) => company.id === recruiterCompany.id);
      if (!existing) return [recruiterCompany, ...current];
      return current.map((company) => (company.id === recruiterCompany.id ? { ...company, ...recruiterCompany } : company));
    });
  }, [recruiterCompany, setCompanyLibrary]);

  React.useEffect(() => {
    if (marketplaceCriteriaRef.current === marketplaceCriteriaKey) return;
    marketplaceCriteriaRef.current = marketplaceCriteriaKey;
    setMarketplacePage(0);
    setMarketplaceHasMore(false);
  }, [marketplaceCriteriaKey]);

  React.useEffect(() => {
    let active = true;
    const criteriaKey = marketplaceCriteriaKey;
    const loadMarketplace = async () => {
      setMarketplaceLoading(true);
      try {
        const result = await fetchJobsWithFiltersV2(
          marketplacePage,
          500,
          {
            countryCode: marketplaceFilters.crossBorder ? undefined : preferences.taxProfile.countryCode,
            includeRecommendations: marketplacePage === 0,
            searchTerm: deferredMarketplaceQuery,
            filters: marketplaceFilters,
          },
        );

        if (!active) return;
        if (criteriaKey !== marketplaceCriteriaRef.current) return;

        // MappedRoles handling
        const mappedRoles = result.jobs;
        setMarketplaceRoles((current) => {
          if (marketplacePage === 0) {
            return mappedRoles;
          }
          const merged = new Map<string, Role>();
          current.forEach((role) => merged.set(role.id, role));
          mappedRoles.forEach((role) => merged.set(role.id, role));
          return Array.from(merged.values());
        });
        setMarketplaceSections((current) => {
          if (marketplacePage === 0) return result.sections;
          return current; // Only update sections on page 0
        });
        setMarketplaceTotalCount(result.totalCount || 0);
        setMarketplaceHasMore(Boolean(result.hasMore));
      } catch (error) {
        console.error('Failed to load marketplace roles into rebuild shell', error);
        if (active) {
          setMarketplaceRoles([]);
          setMarketplaceTotalCount(0);
          setMarketplaceHasMore(false);
        }
      } finally {
        if (active) setMarketplaceLoading(false);
      }
    };
    void loadMarketplace();
    return () => {
      active = false;
    };
  }, [
    deferredMarketplaceQuery,
    marketplaceFilters.city,
    marketplaceFilters.targetRole,
    marketplaceFilters.roleFamily,
    marketplaceFilters.crossBorder,
    marketplaceFilters.benefits,
    marketplaceFilters.minSalary,
    marketplaceFilters.radiusKm,
    marketplaceFilters.remoteOnly,
    marketplaceFilters.transportMode,
    marketplaceFilters.workArrangement,
    marketplaceCriteriaKey,
    marketplacePage,
    preferences.borderSearchEnabled,
    preferences.coordinates.lat,
    preferences.coordinates.lon,
    preferences.searchRadiusKm,
    preferences.taxProfile.countryCode,
  ]);

  React.useEffect(() => {
    if (!(route.kind === 'candidate-role' || route.kind === 'candidate-imported' || route.kind === 'candidate-journey')) return;
    if (marketplaceRoles.some((role) => role.id === route.roleId)) return;
    let active = true;
    void fetchJobByIdV2(route.roleId).then((role) => {
      if (!active || !role) return;
      setMarketplaceRoles((current) => {
        if (!role || current.some((item) => item.id === role.id)) return current;
        return [role, ...current];
      });
    });
    return () => {
      active = false;
    };
  }, [marketplaceRoles, route]);

  const roleLibrary = React.useMemo(() => {
    const merged = new Map<string, Role>();
    marketplaceRoles.forEach((role) => merged.set(role.id, role));
    localCompanyRoles.forEach((role) => merged.set(role.id, role));
    return Array.from(merged.values());
  }, [localCompanyRoles, marketplaceRoles]);

  const getBlueprintForRole = React.useCallback((role: Role) => {
    return resolveBlueprintForRole(role, blueprintLibrary, roleAssignments) || generateAiBlueprint(role.roleFamily, role.title);
  }, [blueprintLibrary, roleAssignments]);

  const setSessionForRole = React.useCallback((roleId: string, updater: React.SetStateAction<CandidateJourneySession>) => {
    setJourneySessions((current) => {
      const role = roleLibrary.find((item) => item.id === roleId);
      const blueprint = role ? getBlueprintForRole(role) : blueprintLibrary[0] || null;
      if (!blueprint) return current;
      const base = current[roleId] || buildInitialJourneySession(roleId, blueprint);
      const next = typeof updater === 'function' ? (updater as (value: CandidateJourneySession) => CandidateJourneySession)(base) : updater;
      return { ...current, [roleId]: next };
    });
  }, [blueprintLibrary, getBlueprintForRole, roleLibrary, setJourneySessions]);

  const activeRole = React.useMemo(() => {
    if (route.kind === 'candidate-role' || route.kind === 'candidate-imported' || route.kind === 'candidate-journey') {
      return roleLibrary.find((role) => role.id === route.roleId) || null;
    }
    return null;
  }, [roleLibrary, route]);

  const activeBlueprint = React.useMemo(() => (activeRole ? getBlueprintForRole(activeRole) : null), [activeRole, getBlueprintForRole]);
  const activeCvDocument = React.useMemo(
    () => cvDocuments.find((document) => document.isActive) || cvDocuments[0] || null,
    [cvDocuments],
  );
  const activeSession = React.useMemo(() => {
    if (!activeRole || !activeBlueprint) return null;
    return journeySessions[activeRole.id] || buildInitialJourneySession(activeRole.id, activeBlueprint);
  }, [activeBlueprint, activeRole, journeySessions]);
  const candidateApplicationsByRoleId = React.useMemo(
    () => Object.fromEntries(
      candidateApplications
        .filter((application) => application.job_id)
        .map((application) => [String(application.job_id), application]),
    ) as Record<string, DialogueSummary>,
    [candidateApplications],
  );
  const derivedCandidateInsights = React.useMemo(
    () => deriveTalentPool(journeySessions, roleLibrary, preferences, getBlueprintForRole, t),
    [getBlueprintForRole, journeySessions, preferences, roleLibrary, t],
  );
  const liveCandidateInsights = React.useMemo(
    () => recruiterCandidates.map((c) => mapCandidateToInsight(c, t)),
    [recruiterCandidates, t],
  );
  const allRegisteredCandidateInsights = React.useMemo(
    () => allRegisteredCandidates.map((c) => mapCandidateToInsight(c, t)),
    [allRegisteredCandidates, t],
  );
  const recruiterRoleLibrary = React.useMemo(
    () => {
      const merged = new Map<string, Role>();
      recruiterJobs.map(mapJobToRole).forEach((role) => merged.set(role.id, role));
      localCompanyRoles
        .filter((role) => !companyProfile?.id || String(role.companyId) === String(companyProfile.id))
        .forEach((role) => merged.set(role.id, role));
      return Array.from(merged.values());
    },
    [companyProfile?.id, localCompanyRoles, recruiterJobs],
  );
  const dialogueCandidateInsights = React.useMemo(
    () => recruiterDialogues.map((dialogue) => mapApplicationToInsight(dialogue, recruiterRoleLibrary, t)),
    [recruiterDialogues, recruiterRoleLibrary, t],
  );
  const candidateInsights = dialogueCandidateInsights.length > 0
    ? dialogueCandidateInsights
    : liveCandidateInsights.length > 0
      ? liveCandidateInsights
      : derivedCandidateInsights;
  const derivedCalendarEvents = React.useMemo(() => deriveRecruiterCalendar(journeySessions, roleLibrary), [journeySessions, roleLibrary]);
  const liveCalendarEvents = React.useMemo(() => mapDialoguesToCalendarEvents(recruiterDialogues), [recruiterDialogues]);
  const calendarEvents = liveCalendarEvents.length > 0 ? liveCalendarEvents : derivedCalendarEvents;
  const dashboardMetrics = React.useMemo(
    () => companyProfile?.id
      ? {
        curatedRoles: recruiterRoleLibrary.filter((role) => role.source === 'curated').length,
        importedRoles: recruiterRoleLibrary.filter((role) => role.source === 'imported').length,
        blueprints: blueprintLibrary.length,
        candidates: candidateInsights.length,
        interviewsBooked: calendarEvents.filter((event) => event.stage === 'panel').length,
        submittedJourneys: recruiterDialogues.length,
      }
      : deriveDashboardMetrics(roleLibrary, blueprintLibrary, candidateInsights, calendarEvents, journeySessions),
    [blueprintLibrary, calendarEvents, candidateInsights, companyProfile?.id, journeySessions, recruiterDialogues.length, recruiterRoleLibrary, roleLibrary],
  );
  const derivedRolePipelineStats = React.useMemo(
    () => deriveRolePipelineStats(recruiterRoleLibrary, journeySessions),
    [journeySessions, recruiterRoleLibrary, roleLibrary],
  );
  const liveRolePipelineStats = React.useMemo(() => {
    const stats: Record<string, { hasSubmission: boolean; hasSchedule: boolean }> = {};
    recruiterDialogues.forEach((dialogue) => {
      const jobId = String(dialogue.job_id || '');
      if (!jobId) return;
      if (!stats[jobId]) {
        stats[jobId] = { hasSubmission: false, hasSchedule: false };
      }
      stats[jobId].hasSubmission = true;
      stats[jobId].hasSchedule = stats[jobId].hasSchedule || dialogue.status === 'shortlisted' || dialogue.status === 'hired';
    });
    return stats;
  }, [recruiterDialogues]);
  const rolePipelineStats = recruiterDialogues.length > 0 ? liveRolePipelineStats : derivedRolePipelineStats;
  const candidateWorkspaceNavItems = React.useMemo(() => ([
    { id: 'home', label: t('rebuild.nav.home', { defaultValue: 'Home' }), icon: LayoutDashboard, path: '/candidate/insights' },
    { id: 'profile', label: t('rebuild.nav.profile', { defaultValue: 'Profile' }), icon: CircleUserRound, path: '/candidate/profile' },
    { id: 'jcfpm', label: t('rebuild.nav.jcfpm', { defaultValue: 'Self-knowledge' }), icon: BrainCircuit, path: '/candidate/jcfpm' },
    { id: 'work', label: t('rebuild.nav.work', { defaultValue: 'Work' }), icon: Briefcase, path: '/candidate/marketplace' },
    { id: 'applications', label: t('rebuild.nav.applications', { defaultValue: 'Applications' }), icon: MessageSquare, path: '/candidate/applications' },
    { id: 'learning', label: t('rebuild.nav.learning', { defaultValue: 'Learning' }), icon: GraduationCap, path: '/candidate/learning' },
  ]), [t]);
  const candidateWorkspaceActiveItemId = route.kind === 'candidate-jcfpm'
    ? 'profile'
    : route.kind === 'candidate-learning'
      ? 'learning'
      : route.kind === 'candidate-journey' || route.kind === 'candidate-applications'
        ? 'applications'
        : route.kind === 'candidate-role' || route.kind === 'candidate-imported' || route.kind === 'marketplace'
          ? 'work'
          : 'home';
  const candidateGreetingName = userProfile.isLoggedIn
    ? preferences.preferredAlias || preferences.name || userProfile.name
    : '';
  const candidateWorkspaceTitle = route.kind === 'candidate-jcfpm'
    ? t('rebuild.candidate.self_knowledge', { defaultValue: 'Self-knowledge' })
    : route.kind === 'candidate-learning'
      ? t('rebuild.candidate.learning_next_steps', { defaultValue: 'Courses and Next Steps' })
      : route.kind === 'candidate-applications'
        ? t('rebuild.candidate.apps_handshake', { defaultValue: 'Applications and Handshake' })
        : route.kind === 'candidate-journey'
          ? activeRole?.title || t('rebuild.candidate.skill_handshake', { defaultValue: 'Skill-first handshake' })
          : route.kind === 'candidate-role' || route.kind === 'candidate-imported'
            ? activeRole?.title || t('rebuild.candidate.selected_challenge', { defaultValue: 'Selected Challenge' })
            : candidateGreetingName
              ? t('rebuild.candidate.greeting', { defaultValue: 'Hello, {{name}} 👋', name: candidateGreetingName })
              : t('rebuild.candidate.tagline', { defaultValue: 'Let\'s find work that fits you.' });
  const candidateWorkspaceSubtitle = route.kind === 'candidate-jcfpm'
    ? t('rebuild.candidate.self_knowledge_desc', { defaultValue: 'Short profile of strengths, working style, and direction for further growth.' })
    : route.kind === 'candidate-learning'
      ? t('rebuild.candidate.learning_desc', { defaultValue: 'Skills, courses, and specific outcomes you can use in your profile and handshake.' })
      : route.kind === 'candidate-applications'
        ? t('rebuild.candidate.apps_desc', { defaultValue: 'Active processes, saved roles, and your connections with companies.' })
        : route.kind === 'candidate-journey'
          ? t('rebuild.candidate.journey_desc', { defaultValue: 'Skill-first handshake is based on real work, not a generic form.' })
          : route.kind === 'candidate-role' || route.kind === 'candidate-imported'
            ? t('rebuild.candidate.role_analysis_desc', { defaultValue: 'Detailed role analysis and your personalized match.' })
            : t('rebuild.candidate.mission', { defaultValue: 'Everyone has potential. Our mission is to reveal it. — Cybershaman' });
  const renderCandidateWorkspace = (content: React.ReactNode) => (
    <DashboardLayoutV2
      userRole="candidate"
      navItems={candidateWorkspaceNavItems}
      activeItemId={candidateWorkspaceActiveItemId}
      onNavigate={(_id, path) => { if (path) navigate(path); }}
      userProfile={userProfile}
      onSignOut={handleSignOutToCompanyEntry}
      onOpenAuth={openAuth}
      onCompanySwitch={handleCompanySwitch}
      currentLanguage={i18n.language}
      onLanguageChange={(lang) => i18n.changeLanguage(lang)}
      title={candidateWorkspaceTitle}
      subtitle={candidateWorkspaceSubtitle}
      t={t}
    >
      {content}
    </DashboardLayoutV2>
  );

  const renderAdminWorkspace = (content: React.ReactNode) => (
    <DashboardLayoutV2
      userRole="recruiter"
      navItems={[
        { id: 'admin', label: 'Admin', icon: BarChart3, path: '/admin' },
      ]}
      activeItemId="admin"
      onNavigate={(_id, path) => { if (path) navigate(path); }}
      userProfile={userProfile}
      onSignOut={handleSignOutToCompanyEntry}
      onOpenAuth={openAuth}
      currentLanguage={i18n.language}
      onLanguageChange={(lang) => i18n.changeLanguage(lang)}
      title="Admin"
      subtitle={t('rebuild.admin.subtitle', { defaultValue: 'CRM, statistics, and internal operations' })}
      contentClassName="max-w-[1680px]"
      t={t}
    >
      {content}
    </DashboardLayoutV2>
  );

  React.useEffect(() => {
    if (candidateApplications.length === 0 || roleLibrary.length === 0) return;
    setJourneySessions((current) => {
      let changed = false;
      const next = { ...current };
      candidateApplications.forEach((application) => {
        const roleId = String(application.job_id || '');
        if (!roleId) return;
        const role = roleLibrary.find((item) => item.id === roleId);
        if (!role) return;
        const blueprint = getBlueprintForRole(role);
        if (!blueprint) return;
        const existing = next[roleId] || buildInitialJourneySession(roleId, blueprint);
        const merged: CandidateJourneySession = {
          ...existing,
          applicationId: application.id,
          applicationStatus: application.status,
          submittedAt: application.submitted_at || existing.submittedAt,
        };
        if (
          existing.applicationId !== merged.applicationId
          || existing.applicationStatus !== merged.applicationStatus
          || existing.submittedAt !== merged.submittedAt
        ) {
          next[roleId] = merged;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [candidateApplications, getBlueprintForRole, roleLibrary, setJourneySessions]);

  const openAuth = React.useCallback((intent: AuthIntent) => {
    setAuthIntent(intent);
    setAuthOpen(true);
  }, []);

  const handleCompanyCheckout = React.useCallback(async (tier: 'starter' | 'growth' | 'professional') => {
    if (!userProfile.isLoggedIn) {
      openAuth('recruiter');
      return;
    }
    if (!companyProfile?.id) {
      navigate('/recruiter');
      return;
    }
    setCheckoutBusyTier(tier);
    try {
      await redirectToCheckout(tier, companyProfile.id);
    } finally {
      setCheckoutBusyTier(null);
    }
  }, [companyProfile?.id, navigate, openAuth, userProfile.isLoggedIn]);

  const handleCompanySwitch = React.useCallback(() => {
    if (!userProfile.isLoggedIn) {
      openAuth('recruiter');
      return;
    }
    navigate('/recruiter');
  }, [navigate, openAuth, userProfile.isLoggedIn]);

  React.useEffect(() => {
    if (!companyProfile?.id) return;
    setCompanyLookupBusy(false);
    setCompanyLookupFailed(false);
  }, [companyProfile?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (!companyProfile?.id) {
      setLocalCompanyRoles([]);
      return undefined;
    }
    void listCompanyChallenges()
      .then((challenges) => {
        if (cancelled) return;
        const company = recruiterCompany;
        setLocalCompanyRoles(challenges.map((challenge) => mapChallengeDraftToRole(challenge, t, company)));
      })
      .catch((error) => {
        console.warn('Failed to load V2 company challenges', error);
      });
    return () => {
      cancelled = true;
    };
  }, [companyProfile, recruiterCompany, setLocalCompanyRoles]);

  React.useEffect(() => {
    let cancelled = false;
    if (route.kind !== 'recruiter') return undefined;
    if (!userProfile.isLoggedIn || !userProfile.id || companyProfile?.id) return undefined;

    setCompanyLookupBusy(true);
    setCompanyLookupFailed(false);

    void getRecruiterCompany(userProfile.id)
      .then((company) => {
        if (cancelled) return;
        if (!company) {
          setCompanyLookupFailed(true);
          return;
        }
        if (userProfile.role !== 'recruiter') {
          setUserProfile({ role: 'recruiter' });
        }
        setCompanyLookupBusy(false);
        setCompanyLookupFailed(false);
        setCompanyProfile(company);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Company profile lookup failed', error);
        setCompanyLookupFailed(true);
      })
      .finally(() => {
        if (!cancelled) setCompanyLookupBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    companyProfile?.id,
    companyLookupRetry,
    route.kind,
    setCompanyProfile,
    setUserProfile,
    userProfile.id,
    userProfile.isLoggedIn,
    userProfile.role,
  ]);

  const handleSignedIn = React.useCallback(async (intent: AuthIntent) => {
    const session = await supabase?.auth.getSession();
    const userId = session?.data.session?.user?.id;
    if (userId) {
      await handleSessionRestoration(userId);
    }
    navigate(intent === 'recruiter' ? '/recruiter' : '/candidate/insights');
  }, [handleSessionRestoration, navigate]);

  const handleSaveProfile = React.useCallback(async () => {
    if (!userProfile.id) {
      openAuth('candidate');
      return;
    }
    setProfileSaving(true);
    try {
      const updates = candidatePreferencesToUserProfileUpdates(preferences, userProfile);
      await updateUserProfile(userProfile.id, updates);
      setUserProfile(updates);
    } finally {
      setProfileSaving(false);
    }
  }, [openAuth, preferences, setUserProfile, userProfile.id]);

  const refreshCvDocuments = React.useCallback(async () => {
    if (!userProfile.id) return;
    const documents = await getUserCVDocuments(userProfile.id);
    setCvDocuments(documents);
  }, [userProfile.id]);

  const handleToggleSavedRole = React.useCallback((roleId: string) => {
    const normalizedId = String(roleId);
    const isSaved = savedJobIds.includes(normalizedId);
    applyInteractionState(normalizedId, isSaved ? 'unsave' : 'save');
    void trackJobInteraction({
      jobId: normalizedId,
      eventType: isSaved ? 'unsave' : 'save',
      metadata: { surface: 'rebuild_marketplace', modality: 'tap' },
    });
  }, [applyInteractionState, savedJobIds]);

  const handleUploadMessageAttachment = React.useCallback(async (file: File) => {
    return uploadApplicationMessageAttachment(userProfile.id, file);
  }, [userProfile.id]);

  const handleSendApplicationMessage = React.useCallback(async (body: string, attachments: ApplicationMessageAttachment[]) => {
    if (!selectedCandidateApplicationId || (!body.trim() && attachments.length === 0)) return;
    setCandidateApplicationMessageBusy(true);
    try {
      const message = await sendCandidateApplicationMessage(selectedCandidateApplicationId, {
        body: body.trim(),
        attachments,
      });
      if (!message) {
        throw new Error('Failed to send candidate message.');
      }
      setSelectedCandidateApplicationMessages((current) => [...current, message]);
    } finally {
      setCandidateApplicationMessageBusy(false);
    }
  }, [selectedCandidateApplicationId]);

  const handleWithdrawApplication = React.useCallback(async () => {
    if (!selectedCandidateApplicationId) return;
    setCandidateApplicationWithdrawBusy(true);
    try {
      const result = await withdrawCandidateApplication(selectedCandidateApplicationId);
      if (!result.ok) {
        throw new Error('Failed to withdraw the application from the active dialogue lane.');
      }
      await refreshCandidateApplications();
      const refreshedDetail = await fetchCandidateApplicationDetail(selectedCandidateApplicationId);
      setSelectedCandidateApplicationDetail(refreshedDetail);
      if (refreshedDetail?.status === 'withdrawn' || refreshedDetail?.status === 'closed_withdrawn') return;
      setSelectedCandidateApplicationMessages([]);
    } finally {
      setCandidateApplicationWithdrawBusy(false);
    }
  }, [refreshCandidateApplications, selectedCandidateApplicationId]);

  const handleUploadCv = React.useCallback(async (file: File) => {
    if (!userProfile.id || !userProfile.isLoggedIn) {
      openAuth('candidate');
      return;
    }
    setCvBusy(true);
    try {
      const isPremium = (userProfile.subscription?.tier || 'free') !== 'free';
      const { cvUrl, parsedData } = await uploadAndParseCv(userProfile, file, { isPremium });
      const mergedProfile = mergeProfileWithParsedCv(userProfile, cvUrl, parsedData);
      await updateUserProfile(userProfile.id, {
        cvUrl,
        cvText: parsedData.cvText || mergedProfile.cvText,
        cvAiText: parsedData.cvAiText || mergedProfile.cvAiText,
        skills: parsedData.skills || mergedProfile.skills,
        workHistory: parsedData.workHistory || mergedProfile.workHistory,
        education: parsedData.education || mergedProfile.education,
        jobTitle: parsedData.jobTitle || mergedProfile.jobTitle,
        name: parsedData.name || mergedProfile.name,
        phone: parsedData.phone || mergedProfile.phone,
      });
      setUserProfile({
        cvUrl,
        cvText: parsedData.cvText || mergedProfile.cvText,
        cvAiText: parsedData.cvAiText || mergedProfile.cvAiText,
        skills: parsedData.skills || mergedProfile.skills,
        workHistory: parsedData.workHistory || mergedProfile.workHistory,
        education: parsedData.education || mergedProfile.education,
        jobTitle: parsedData.jobTitle || mergedProfile.jobTitle,
        name: parsedData.name || mergedProfile.name,
        phone: parsedData.phone || mergedProfile.phone,
      });
      await refreshCvDocuments();
    } finally {
      setCvBusy(false);
    }
  }, [openAuth, refreshCvDocuments, setUserProfile, userProfile]);

  const handleSelectCv = React.useCallback(async (cvId: string) => {
    if (!userProfile.id) {
      openAuth('candidate');
      return;
    }
    setCvBusy(true);
    try {
      const ok = await updateUserCVSelection(userProfile.id, cvId);
      if (!ok) {
        throw new Error('Failed to activate CV.');
      }
      await refreshCvDocuments();
      await handleSessionRestoration(userProfile.id);
    } finally {
      setCvBusy(false);
    }
  }, [handleSessionRestoration, openAuth, refreshCvDocuments, userProfile.id]);

  const handleUploadPhoto = React.useCallback(async (file: File) => {
    if (!userProfile.id) {
      openAuth('candidate');
      return;
    }
    setProfileSaving(true);
    try {
      const photoUrl = await uploadUserProfilePhoto(userProfile.id, file);
      await updateUserProfile(userProfile.id, { photo: photoUrl });
      setUserProfile({ photo: photoUrl });
      setPreferences((current) => ({ ...current, photo: photoUrl }));
    } finally {
      setProfileSaving(false);
    }
  }, [openAuth, setUserProfile, userProfile.id]);

  const handleDeleteCv = React.useCallback(async (cvId: string) => {
    if (!userProfile.id) {
      openAuth('candidate');
      return;
    }
    setCvBusy(true);
    try {
      const ok = await deleteCVDocument(userProfile.id, cvId);
      if (!ok) {
        throw new Error('Failed to delete CV.');
      }
      await refreshCvDocuments();
      await handleSessionRestoration(userProfile.id);
    } finally {
      setCvBusy(false);
    }
  }, [handleSessionRestoration, openAuth, refreshCvDocuments, userProfile.id]);

  const handleFinalizeJourney = React.useCallback(async (payload: {
    role: Role;
    session: CandidateJourneySession;
    candidateName: string;
    scheduledSlot: string;
    candidateScore: number;
    reviewerSummary: string;
    submissionSnapshot: NonNullable<CandidateJourneySession['submissionSnapshot']>;
  }) => {
    const submittedAt = new Date().toISOString();
    let applicationId = payload.session.applicationId;
    let applicationStatus = payload.session.applicationStatus;

    setJourneySubmitting(true);
    try {
      if (userProfile.id && payload.role.source === 'curated' && !applicationId) {
        let result: { status?: string; application_id?: string; application?: unknown } | null = null;
        const handshake = await startHandshake(payload.role.id);
        applicationId = handshake.handshake_id || applicationId;
        if (!applicationId) {
          throw new Error('Handshake session did not return an id.');
        }
        applicationStatus = handshake.status || handshake.session?.status || applicationStatus;
        for (const [stepId, answer] of Object.entries(payload.session.answers || {})) {
          await patchHandshakeAnswer(applicationId, stepId, answer, stepId);
        }
        const externalValue = String(payload.session.answers.external_link || '').trim();
        if (/^https?:\/\//i.test(externalValue)) {
          await addExternalHandshakeSubmission(applicationId, {
            provider: 'other',
            external_url: externalValue,
            comment: String(payload.session.answers.external_link_comment || '').trim() || null,
            evidence_required: true,
            visibility: 'company_review',
          });
        }
        const finalized = await finalizeHandshake(applicationId, payload.reviewerSummary);
        applicationStatus = finalized.session?.status || finalized.status || applicationStatus;
        result = {
          status: finalized.status || finalized.session?.status || 'submitted',
          application_id: finalized.handshake_id,
          application: finalized.application as any,
        };
        if (!result?.application_id && !result?.status) {
          throw new Error('Handshake submission could not be stored.');
        }
        applicationId = result?.application_id || applicationId;
        applicationStatus = result?.status || applicationStatus;
      }

      setSessionForRole(payload.role.id, (current) => ({
        ...current,
        applicationId,
        applicationStatus,
        submittedAt,
        scheduledSlot: payload.scheduledSlot || current.scheduledSlot,
        candidateName: payload.candidateName,
        candidateLocation: preferences.address,
        candidateScore: payload.candidateScore,
        submissionSnapshot: payload.submissionSnapshot,
        reviewerSummary: payload.reviewerSummary,
      }));
      if (userProfile.id) {
        await refreshCandidateApplications().catch((error) => {
          console.error('Failed to refresh candidate applications after journey finalization', error);
        });
      }
      navigate('/candidate/insights');
    } finally {
      setJourneySubmitting(false);
    }
  }, [navigate, preferences.address, refreshCandidateApplications, setSessionForRole, userProfile.id]);

  const handleSaveCvReview = React.useCallback(async (input: { jobTitle: string; skills: string[]; summary: string }) => {
    if (!userProfile.id || !activeCvDocument) {
      throw new Error('No active CV selected.');
    }
    setCvReviewBusy(true);
    try {
      const ok = await updateCVDocumentParsedData(userProfile.id, activeCvDocument.id, {
        ...(activeCvDocument.parsedData || {}),
        jobTitle: input.jobTitle,
        skills: input.skills,
        cvAiText: input.summary,
        cvText: activeCvDocument.parsedData?.cvText || input.summary,
      });
      if (!ok) {
        throw new Error('Failed to update parsed CV data.');
      }
      await updateUserProfile(userProfile.id, {
        jobTitle: input.jobTitle,
        skills: input.skills,
        cvAiText: input.summary,
      });
      setUserProfile({
        jobTitle: input.jobTitle,
        skills: input.skills,
        cvAiText: input.summary,
      });
      await refreshCvDocuments();
    } finally {
      setCvReviewBusy(false);
    }
  }, [activeCvDocument, refreshCvDocuments, setUserProfile, userProfile.id]);

  const handleRecruiterActivation = React.useCallback(async (input: { companyName: string; website: string; industry: string }) => {
    if (!userProfile.id) {
      openAuth('recruiter');
      return;
    }
    setRecruiterActivationBusy(true);
    try {
      await updateUserProfile(userProfile.id, { role: 'recruiter' });
      setUserProfile({ role: 'recruiter' });
      await createCompany({
        name: input.companyName,
        industry: input.industry,
        tone: '',
        values: [],
        philosophy: '',
        description: '',
        logo_url: '',
        website: input.website,
      }, userProfile.id);
      const refreshed = await getRecruiterCompany(userProfile.id);
      setCompanyProfile(refreshed);
      navigate('/recruiter');
    } finally {
      setRecruiterActivationBusy(false);
    }
  }, [navigate, openAuth, setCompanyProfile, setUserProfile, userProfile.id]);

  const handleUploadCompanyAsset = React.useCallback(async (
    file: File,
    target: 'logo' | 'cover' | 'gallery' | 'reviewer-avatar' | 'handshake-material',
    companyId: string,
  ) => {
    const usageByTarget = {
      logo: 'company_logo',
      cover: 'company_cover',
      gallery: 'company_gallery',
      'reviewer-avatar': 'reviewer_avatar',
      'handshake-material': 'handshake_material',
    } as const;

    return uploadV2Asset(file, {
      kind: target === 'handshake-material' ? 'handshake_material' : 'company_branding',
      usage: usageByTarget[target],
      companyId,
      visibility: 'company',
    });
  }, []);

  const handleSaveRecruiterBrand = React.useCallback(async (company: Company) => {
    if (!companyProfile?.id || !userProfile.id || company.id !== companyProfile.id) return;
    setBrandSaving(true);
    try {
      await updateCompanyProfile(companyProfile.id, {
        name: company.name,
        industry: company.domain,
        philosophy: company.tagline,
        tone: company.reviewer.intro,
        values: [],
        address: company.headquarters,
        description: company.narrative,
        logo_url: company.logo,
        gallery_urls: company.gallery.map((asset) => asset.url),
        members: [
          {
            id: `${company.id}-reviewer`,
            name: company.reviewer.name,
            email: '',
            role: 'admin',
            avatar: company.reviewer.avatarUrl,
            joinedAt: new Date().toISOString(),
            companyRole: company.reviewer.role,
            teamBio: company.reviewer.intro,
          },
        ],
        brand_assets: {
          logo: company.logoAsset || null,
          cover: company.coverAsset || null,
          gallery: company.gallery,
          reviewer_avatar: company.reviewerAvatarAsset || null,
          handshake_materials: company.handshakeMaterials,
        },
        handshake_materials: company.handshakeMaterials,
        marketplace_media: {
          cover_url: company.coverImage,
          gallery_urls: company.gallery.map((asset) => asset.url),
          visual_tone: 'balanced',
        },
      });
      const refreshed = await getRecruiterCompany(userProfile.id);
      setCompanyProfile(refreshed);
      if (refreshed) {
        setCompanyLibrary((current) => {
          const mapped = mapCompanyProfileToCompany(refreshed);
          const exists = current.some((item) => item.id === mapped.id);
          return exists ? current.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...current];
        });
      }
    } finally {
      setBrandSaving(false);
    }
  }, [companyProfile?.id, setCompanyLibrary, setCompanyProfile, userProfile.id]);

  const handleCreateRecruiterChallenge = React.useCallback(async (input: {
    title: string;
    roleFamily: Role['roleFamily'];
    location: string;
    workModel: Role['workModel'];
    summary: string;
    firstStep: string;
    salaryFrom: number | null;
    salaryTo: number | null;
    skills: string[];
  }): Promise<Role> => {
    if (!companyProfile?.id) {
      throw new Error(t('rebuild.error.active_company_required', { defaultValue: 'An active company profile is required first.' }));
    }

    const now = new Date().toISOString();
    const company = recruiterCompany || mapCompanyProfileToCompany(companyProfile);
    const rawCountryCode = String((companyProfile as any).country_code || (companyProfile as any).countryCode || '').toUpperCase();
    const countryCode: Role['countryCode'] = rawCountryCode === 'SK' || rawCountryCode === 'PL' || rawCountryCode === 'DE' || rawCountryCode === 'AT'
      ? rawCountryCode
      : 'CZ';
    const currency: Role['currency'] = countryCode === 'PL' ? 'PLN' : countryCode === 'CZ' ? 'CZK' : 'EUR';
    const challenge = await createCompanyChallenge({
      title: input.title,
      role_family: input.roleFamily,
      summary: input.summary,
      description: `${input.summary}\n\n${t('rebuild.recruiter.first_step_label', { defaultValue: 'First step' })}: ${input.firstStep}`,
      skills: input.skills,
      salary_from: input.salaryFrom,
      salary_to: input.salaryTo,
      salary_currency: currency,
      work_model: input.workModel,
      location: input.location,
      first_reply_prompt: input.firstStep,
      company_goal: input.summary,
      editor_state: {
        source: 'rebuild_challenge_form',
        role_family: input.roleFamily,
        created_at: now,
      },
    });
    const role = mapChallengeDraftToRole(challenge, t, company);

    setLocalCompanyRoles((current) => [role, ...current.filter((item) => item.id !== role.id)]);
    setRecruiterJobs((current) => [
      {
        id: role.id,
        title: role.title,
        company_id: role.companyId,
        company: role.companyName,
        location: role.location,
        salary_from: role.salaryFrom,
        salary_to: role.salaryTo,
        currency: role.currency,
        description: role.description,
        challenge: role.challenge,
        firstStepPrompt: role.firstStep,
        required_skills: role.skills,
        tags: role.skills,
        source: 'jobshaman_native',
      } as any,
      ...current.filter((item) => String(item.id) !== role.id),
    ]);
    setMarketplaceRoles((current) => [role, ...current.filter((item) => item.id !== role.id)]);
    return role;
  }, [companyProfile, recruiterCompany, refreshRecruiterJobs, setLocalCompanyRoles, setRecruiterJobs]);

  const handleAiAssistRecruiterChallenge = React.useCallback(async (roleId: string) => {
    const role = localCompanyRoles.find((item) => item.id === roleId);
    const assisted = await aiAssistCompanyChallenge(roleId, {
      problem_statement: role?.summary || role?.challenge,
      role_family: role?.roleFamily,
    });
    const company = recruiterCompany || (companyProfile ? mapCompanyProfileToCompany(companyProfile) : null);
    const nextRole = mapChallengeDraftToRole(assisted.challenge, t, company);
    setLocalCompanyRoles((current) => current.map((item) => (item.id === roleId ? nextRole : item)));
    setMarketplaceRoles((current) => current.map((item) => (item.id === roleId ? nextRole : item)));
    return nextRole;
  }, [companyProfile, localCompanyRoles, recruiterCompany, setLocalCompanyRoles]);

  const handleAiDraftRecruiterChallenge = React.useCallback(async (input: {
    title?: string;
    roleFamily?: Role['roleFamily'];
    location?: string;
    workModel?: Role['workModel'];
    summary?: string;
    firstStep?: string;
    skills?: string[];
  }) => {
    const result = await aiDraftCompanyChallenge({
      title: input.title,
      role_family: input.roleFamily,
      location: input.location,
      work_model: input.workModel,
      summary: input.summary,
      problem_statement: input.summary,
      candidate_task: input.firstStep,
      first_reply_prompt: input.firstStep,
      skills: input.skills,
    });
    return result.ai_output;
  }, []);

  const handlePublishRecruiterChallenge = React.useCallback(async (roleId: string) => {
    const published = await publishCompanyChallenge(roleId, { human_confirmed: true });
    const company = recruiterCompany || (companyProfile ? mapCompanyProfileToCompany(companyProfile) : null);
    const nextRole = mapChallengeDraftToRole(published, t, company);
    setLocalCompanyRoles((current) => current.map((item) => (item.id === roleId ? nextRole : item)));
    setMarketplaceRoles((current) => [nextRole, ...current.filter((item) => item.id !== roleId)]);
    await refreshRecruiterJobs().catch(() => undefined);
    return nextRole;
  }, [companyProfile, recruiterCompany, refreshRecruiterJobs, setLocalCompanyRoles]);

  const isStandaloneDashboardRoute =
    route.kind === 'admin'
    || route.kind === 'marketplace'
    || route.kind === 'candidate-role'
    || route.kind === 'candidate-imported'
    || route.kind === 'candidate-journey'
    || route.kind === 'candidate-insights'
    || route.kind === 'candidate-jcfpm'
    || route.kind === 'candidate-applications'
    || route.kind === 'candidate-learning'
    || route.kind === 'recruiter';
  const showCandidatePreLanding =
    !userProfile.isLoggedIn
    && (
      route.kind === 'candidate-insights'
      || route.kind === 'candidate-jcfpm'
      || route.kind === 'candidate-applications'
      || route.kind === 'candidate-learning'
    );

  return (
    <RebuildThemeProvider>
      <div className="relative min-h-screen overflow-x-hidden text-[color:var(--shell-text-primary)]">
        {!isStandaloneDashboardRoute ? <AppBackdrop /> : null}
        <AuthPanel open={authOpen} initialIntent={authIntent} onClose={() => setAuthOpen(false)} onSignedIn={(intent) => void handleSignedIn(intent)} navigate={navigate} t={t} />

        {route.kind === 'marketplace' ? (
          <MarketplaceV2
            roles={roleLibrary}
            sections={marketplaceSections}
            loading={marketplaceLoading}
            hasMore={marketplaceHasMore}
            totalCount={marketplaceTotalCount}
            userProfile={userProfile}
            preferences={preferences}
            filters={marketplaceFilters}
            searchValue={marketplaceQuery}
            onSearchChange={setMarketplaceQuery}
            onFiltersChange={setMarketplaceFilters}
            onResetFilters={() => {
              setMarketplaceQuery('');
              setMarketplaceFilters(buildDefaultMarketplaceFilters(preferences));
            }}
            savedRoleIds={savedJobIds}
            candidateApplications={candidateApplications}
            onSignOut={handleSignOutToCompanyEntry}
            onCompanySwitch={handleCompanySwitch}
            onLoadMore={() => setMarketplacePage((current) => current + 1)}
            currentLanguage={i18n.language}
            onLanguageChange={(lang) => i18n.changeLanguage(lang)}
            navigate={navigate}
            t={t}
          />
        ) : null}

        {route.kind === 'public' && route.page === 'home' ? (
          <LandingChoicePage
            userProfile={userProfile}
            navigate={navigate}
            onOpenAuth={openAuth}
          />
        ) : null}

        {route.kind === 'public' && route.page === 'companies' ? (
          <CompanyEntryPage
            userProfile={userProfile}
            companyProfile={companyProfile}
            navigate={navigate}
            onOpenAuth={openAuth}
            onCheckout={handleCompanyCheckout}
            checkoutBusyTier={checkoutBusyTier}
          />
        ) : null}

        {route.kind === 'public' && route.page !== 'home' && route.page !== 'companies' ? (
          <LegalPublicPage page={route.page} />
        ) : null}

        {route.kind === 'admin' ? (
          renderAdminWorkspace(<AdminDashboard />)
        ) : null}

        {route.kind === 'candidate-role' && activeRole && activeBlueprint ? (
          renderCandidateWorkspace(<CandidateRoleBriefingPage
            role={activeRole}
            blueprint={activeBlueprint}
            preferences={preferences}
            companyLibrary={companyLibrary}
            existingApplication={candidateApplicationsByRoleId[activeRole.id] || null}
            isSaved={savedJobIds.includes(String(activeRole.id))}
            onToggleSaved={() => handleToggleSavedRole(activeRole.id)}
            navigate={navigate}
            t={t}
          />)
        ) : null}

        {route.kind === 'candidate-imported' && activeRole ? (
          renderCandidateWorkspace(<ImportedPrepPage
            role={activeRole}
            preferences={preferences}
            isSaved={savedJobIds.includes(String(activeRole.id))}
            onToggleSaved={() => handleToggleSavedRole(activeRole.id)}
            navigate={navigate}
            t={t}
          />)
        ) : null}

        {route.kind === 'candidate-journey' && activeRole && activeBlueprint && activeSession ? (
          renderCandidateWorkspace(<CandidateJourneyPage
            role={activeRole}
            companyId={activeRole.companyId}
            blueprint={activeBlueprint}
            session={route.stepId ? { ...activeSession, currentStepId: route.stepId } : activeSession}
            setSession={(updater) => setSessionForRole(activeRole.id, updater)}
            preferences={preferences}
            userProfile={userProfile}
            activeCvDocument={activeCvDocument}
            companyLibrary={companyLibrary}
            finalizeBusy={journeySubmitting}
            onFinalizeJourney={handleFinalizeJourney}
            navigate={navigate}
          />)
        ) : null}

        {showCandidatePreLanding ? (
          <LandingChoicePage
            userProfile={userProfile}
            navigate={navigate}
            onOpenAuth={openAuth}
          />
        ) : null}

        {route.kind === 'candidate-insights' && !showCandidatePreLanding ? (
          <CandidateInsightsPage
            roles={roleLibrary}
            preferences={preferences}
            setPreferences={setPreferences}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            activeCvDocument={activeCvDocument}
            cvDocuments={cvDocuments}
            cvLoading={cvLoading}
            cvBusy={cvBusy}
            cvReviewBusy={cvReviewBusy}
            candidateApplications={candidateApplications}
            applicationsLoading={candidateApplicationsLoading}
            candidateCapacity={candidateDialogueCapacity}
            selectedApplicationId={selectedCandidateApplicationId}
            selectedApplicationDetail={selectedCandidateApplicationDetail}
            selectedApplicationMessages={selectedCandidateApplicationMessages}
            applicationDetailLoading={candidateApplicationDetailLoading}
            applicationMessageBusy={candidateApplicationMessageBusy}
            applicationWithdrawBusy={candidateApplicationWithdrawBusy}
            savedRoleIds={savedJobIds}
            isSavingProfile={profileSaving}
            onSaveProfile={() => void handleSaveProfile()}
            onOpenAuth={() => openAuth('candidate')}
            onUploadCv={handleUploadCv}
            onSelectCv={handleSelectCv}
            onDeleteCv={handleDeleteCv}
            onSaveCvReview={handleSaveCvReview}
            onSelectApplication={setSelectedCandidateApplicationId}
            onUploadMessageAttachment={handleUploadMessageAttachment}
            onSendApplicationMessage={handleSendApplicationMessage}
            onWithdrawApplication={handleWithdrawApplication}
            onToggleSavedRole={handleToggleSavedRole}
            onUploadPhoto={handleUploadPhoto}
            onSignOut={handleSignOutToCompanyEntry}
            onCompanySwitch={handleCompanySwitch}
            currentLanguage={i18n.language}
            onLanguageChange={(lang) => i18n.changeLanguage(lang)}
            navigate={navigate}
          />
        ) : null}

        {route.kind === 'candidate-applications' && !showCandidatePreLanding ? (
          renderCandidateWorkspace(<CandidateApplicationsPage
            candidateApplications={candidateApplications}
            roleLibrary={roleLibrary}
            savedJobIds={savedJobIds}
            onOpenRole={(roleId) => navigateTo(`/candidate/role/${roleId}`, setPathname)}
            onOpenHandshake={(jobId) => navigateTo(`/candidate/journey/${jobId}`, setPathname)}
            onToggleSavedRole={handleToggleSavedRole}
            t={t}
          />)
        ) : null}

        {route.kind === 'candidate-jcfpm' && !showCandidatePreLanding ? (
          renderCandidateWorkspace(<CandidateJcfpmPage t={t} locale={i18n.language} />)
        ) : null}

        {route.kind === 'candidate-learning' && !showCandidatePreLanding ? (
          renderCandidateWorkspace(<CandidateLearningPage
            userProfile={userProfile}
            preferences={preferences}
            navigate={navigate}
          />)
        ) : null}

        {route.kind === 'recruiter' ? (
          !userProfile.isLoggedIn ? (
            <CompanyEntryPage
              userProfile={userProfile}
              companyProfile={companyProfile}
              navigate={navigate}
              onOpenAuth={openAuth}
              onCheckout={handleCompanyCheckout}
              checkoutBusyTier={checkoutBusyTier}
            />
          ) : !companyProfile && companyLookupBusy ? (
            <div className={shellPageClass}>
              <div className={cn(panelClass, 'mx-auto max-w-3xl p-8')}>
                <div className={pillEyebrowClass}>{t('rebuild.recruiter.company_profile', { defaultValue: 'Company Profile' })}</div>
                <h1 className="mt-3 text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.06em] text-slate-900">{t('rebuild.recruiter.loading_company_account', { defaultValue: 'Loading company account.' })}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600">{t('rebuild.recruiter.preparing_workspace', { defaultValue: 'Preparing your company workspace.' })}</p>
                <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#e8ddd0] bg-white px-4 py-2 text-sm font-medium text-slate-600">
                  <Loader2 size={16} className="animate-spin text-[#0f95ac]" />
                  {t('rebuild.recruiter.just_a_moment', { defaultValue: 'Just a moment' })}
                </div>
              </div>
            </div>
          ) : !companyProfile && companyLookupFailed ? (
            <div className={shellPageClass}>
              <div className={cn(panelClass, 'mx-auto max-w-3xl p-8')}>
                <div className={pillEyebrowClass}>{t('rebuild.recruiter.company_profile', { defaultValue: 'Company Profile' })}</div>
                <h1 className="mt-3 text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.06em] text-slate-900">{t('rebuild.recruiter.company_load_failed', { defaultValue: 'Company account failed to load.' })}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600">{t('rebuild.recruiter.company_load_failed_desc', { defaultValue: 'Check your server connection and try loading again. If you filled in the company before, there should be no need to create it again.' })}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setCompanyLookupRetry((current) => current + 1)} className={primaryButtonClass}>
                    {t('rebuild.actions.try_again', { defaultValue: 'Try again' })}
                  </button>
                  <button type="button" onClick={() => navigate('/firmy')} className={secondaryButtonClass}>
                    {t('rebuild.recruiter.back_to_company_entry', { defaultValue: 'Back to company entry' })}
                  </button>
                </div>
              </div>
            </div>
          ) : !companyProfile ? (
            <RecruiterActivationPage userProfile={userProfile} busy={recruiterActivationBusy} onActivate={handleRecruiterActivation} t={t} />
          ) : (
            <RecruiterShell
              tab={route.tab}
              navigate={navigate}
              userProfile={userProfile}
              roles={recruiterRoleLibrary}
              blueprintLibrary={blueprintLibrary}
              setBlueprintLibrary={setBlueprintLibrary}
              roleAssignments={roleAssignments}
              setRoleAssignments={setRoleAssignments}
              companyLibrary={companyLibrary}
              setCompanyLibrary={setCompanyLibrary}
              recruiterCompany={companyProfile}
              recruiterCompanyHydrated={recruiterCompany}
              onSaveRecruiterBrand={handleSaveRecruiterBrand}
              onCreateChallenge={handleCreateRecruiterChallenge}
              onAiDraftChallenge={handleAiDraftRecruiterChallenge}
              onAiAssistChallenge={handleAiAssistRecruiterChallenge}
              onPublishChallenge={handlePublishRecruiterChallenge}
              onUploadCompanyAsset={handleUploadCompanyAsset}
              brandSaving={brandSaving}
              candidateInsights={candidateInsights}
              allRegisteredCandidates={allRegisteredCandidateInsights}
              calendarEvents={calendarEvents}
              dashboardMetrics={dashboardMetrics}
              rolePipelineStats={rolePipelineStats}
              recruiterSearch={recruiterSearch}
              onRecruiterSearchChange={setRecruiterSearch}
              onSignOut={handleSignOutToCompanyEntry}
              currentLanguage={i18n.language}
              onLanguageChange={(lang) => i18n.changeLanguage(lang)}
              t={t}
              i18n={i18n}
            />
          )
        ) : null}
      </div>
      <CookieBanner />
    </RebuildThemeProvider>
  );
};

export default JobshamanRebuildApp;
