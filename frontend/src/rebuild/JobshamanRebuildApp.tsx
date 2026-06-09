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
import { acceptInvitation, createCompany, deleteCVDocument, getRecruiterCompany, getUserCVDocuments, getUserProfile, updateCVDocumentParsedData, updateCompanyProfile, updateUserCVSelection, updateUserProfile, uploadApplicationMessageAttachment, uploadUserProfilePhoto } from '../services/v2UserService';
import {
  fetchCandidateApplicationDetail,
  fetchCandidateApplicationMessages,
  fetchMyDialoguesWithCapacity,
  sendCandidateApplicationMessage,
  withdrawCandidateApplication,
} from '../services/v2DialogueService';
import { addExternalHandshakeSubmission, fetchHandshakeAvailability, finalizeHandshake, patchHandshakeAnswer, startHandshake } from '../services/v2HandshakeService';
import {
  aiAssistCompanyChallenge,
  aiDraftCompanyChallenge,
  createCompanyChallenge,
  deleteCompanyChallenge,
  listCompanyChallenges,
  publishCompanyChallenge,
  updateCompanyChallenge,
} from '../services/v2ChallengeService';
import type { AssessmentTask } from '../services/v2ChallengeService';
import { updateCompanyRoleLifecycle } from '../services/companyJobDraftService';
import { supabase } from '../services/supabaseClient';
import { useUserProfile } from '../hooks/useUserProfile';
import { useCompanyJobsData } from '../hooks/useCompanyJobsData';
import { useCompanyApplicationsData } from '../hooks/useCompanyApplicationsData';
import { useCompanyCandidatesData } from '../hooks/useCompanyCandidatesData';
import { useAllRegisteredCandidates } from '../hooks/useAllRegisteredCandidates';
import { useJobInteractionState } from '../hooks/useJobInteractionState';
import { uploadAndParseCv } from '../services/v2CvService';
import { uploadV2Asset } from '../services/v2AssetService';
import { trackJobInteraction } from '../services/jobInteractionService';
import { getStaticCoordinates } from '../services/geocodingService';
import { fetchKarmaSummary, redeemKarmaReward, submitCompanyReferral, type KarmaAccountSummary } from '../services/karmaService';
import type {
  ApplicationMessageAttachment,
  CandidateDialogueCapacity,
  CVDocument,
  DialogueDetail,
  DialogueMessage,
  DialogueSummary,
  SupportedCountryCode,
  UserProfile,
  Job,
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
const CandidateJcfpmPage = React.lazy(() => import('./candidate/CandidateShell').then(m => ({ default: m.CandidateJcfpmPage })));
const CandidateOnboardingWizard = React.lazy(() => import('./candidate/CandidateOnboardingWizard').then(m => ({ default: m.CandidateOnboardingWizard })));
const CandidateRoleBriefingPage = React.lazy(() => import('./candidate/CandidateShell').then(m => ({ default: m.CandidateRoleBriefingPage })));
const ImportedPrepPage = React.lazy(() => import('./candidate/CandidateShell').then(m => ({ default: m.ImportedPrepPage })));
const MarketplaceV2 = React.lazy(() => import('./candidate/MarketplaceV2').then(m => ({ default: m.MarketplaceV2 })));
const CandidateInsightsPage = React.lazy(() => import('./candidate/CandidateInsightsPage').then(m => ({ default: m.CandidateInsightsPage })));
const CandidateHandshakeLayout = React.lazy(() => import('./candidate/handshake/CandidateHandshakeLayout').then(m => ({ default: m.CandidateHandshakeLayout })));
const CandidateApplicationsPage = React.lazy(() => import('./candidate/CandidateApplicationsPage').then(m => ({ default: m.CandidateApplicationsPage })));
const CandidateLearningPage = React.lazy(() => import('./candidate/CandidateLearningPage').then(m => ({ default: m.CandidateLearningPage })));
const TheRitual = React.lazy(() => import('../cybershaman/ritual/TheRitual').then(m => ({ default: m.TheRitual })));
import { deriveDashboardMetrics, deriveRecruiterCalendar, deriveRolePipelineStats, deriveTalentPool } from './derivations';
const RecruiterActivationPage = React.lazy(() => import('./recruiter/RecruiterShell').then(m => ({ default: m.RecruiterActivationPage })));
const RecruiterShell = React.lazy(() => import('./recruiter/RecruiterShell').then(m => ({ default: m.RecruiterShell })));
import type { AuthIntent } from './authTypes';
import { navigateTo, routeFromPath, usePathname } from './routing';
import { resolveCompany } from './shellDomain';
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
import { getCandidateGreetingName } from './candidate/greeting';
import { checkPaymentStatus, redirectToCheckout } from '../services/stripeService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
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
import { AppBackdrop } from './ui/RebuildChrome';
import { DashboardLayoutV2 } from './ui/DashboardLayoutV2';
import { type RoleClusterId } from './candidate/MarketplaceV2';
import type { CandidateSidebarSummary } from './ui/SidebarV2';
import { initializeAnalytics } from '../services/cookieConsentService';
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

const marketplaceRoleText = (role: Role) => [
  role.title,
  role.companyName,
  role.location,
  role.summary,
  role.description,
  role.roleFamily,
  role.skills.join(' '),
].join(' ').toLowerCase();

const getMarketplaceClusterId = (role: Role): RoleClusterId => {
  const text = marketplaceRoleText(role)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\b(project manager|projektov|operations manager|provozni manager|program manager|delivery manager|vedouci|manager|manazer|koordinator)\b/.test(text)) return 'management';
  if (['frontline', 'logistics', 'construction', 'operations'].includes(role.roleFamily)) return 'operations';
  if (['sales', 'finance', 'people', 'legal', 'marketing'].includes(role.roleFamily)) return 'business';
  if (['engineering', 'product', 'design'].includes(role.roleFamily)) return 'digital';
  if (['care', 'education', 'health'].includes(role.roleFamily)) return 'services';
  return 'other';
};

const CandidatePremiumGate: React.FC<{
  title: string;
  copy: string;
  busy?: boolean;
  onUpgrade: () => void;
  t: any;
}> = ({ title, copy, busy, onUpgrade, t }) => (
  <div className={shellPageClass}>
    <section className="mx-auto flex min-h-[68vh] max-w-4xl flex-col justify-center px-4 py-10">
      <div className={cn(panelClass, 'p-6 md:p-8')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0f95ac] text-white">
          <SparklesIcon />
        </div>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#0f95ac]">Premium</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{copy}</p>
        <div className="mt-6 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">{t('rebuild.premium.benefit_jobfit', { defaultValue: 'JobFit Kompas v ceně' })}</div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">{t('rebuild.premium.benefit_slots', { defaultValue: '25 aktivních odpovědních slotů' })}</div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">{t('rebuild.premium.benefit_ai_roles', { defaultValue: 'AI hodnocení inzerátů' })}</div>
        </div>
        <button type="button" disabled={busy} onClick={onUpgrade} className={cn(primaryButtonClass, 'mt-7')}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {t('rebuild.premium.upgrade_cta', { defaultValue: 'Upgradovat na Premium' })}
        </button>
      </div>
    </section>
  </div>
);

const SparklesIcon = () => <BrainCircuit size={22} />;
const CompanyEntryPage = React.lazy(() => import('./public/PublicPages').then(m => ({ default: m.CompanyEntryPage })));
const LandingChoicePage = React.lazy(() => import('./public/PublicPages').then(m => ({ default: m.LandingChoicePage })));
const LegalPublicPage = React.lazy(() => import('./public/PublicPages').then(m => ({ default: m.LegalPublicPage })));
const AuthPanel = React.lazy(() => import('./auth/AuthPanel').then(m => ({ default: m.AuthPanel })));
const AdminDashboard = React.lazy(() => import('../pages/AdminDashboard'));





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
  const [companyLibrary, setCompanyLibrary] = React.useState<Company[]>(() => getDefaultCompanyLibrary());
  const [preferences, setPreferences] = usePersistentState<CandidatePreferenceProfile>(
    REBUILD_STORAGE_KEYS.preferences,
    getDefaultCandidatePreferences(),
  );
  const [blueprintLibrary, setBlueprintLibrary] = React.useState<HandshakeBlueprint[]>(() => getDefaultBlueprintLibrary());
  const [localCompanyRoles, setLocalCompanyRoles] = React.useState<Role[]>([]);
  const [roleAssignments, setRoleAssignments] = React.useState<Record<string, string>>(() => getDefaultRoleAssignments());
  const [journeySessions, setJourneySessions] = usePersistentState<Record<string, CandidateJourneySession>>(
    REBUILD_STORAGE_KEYS.journeys,
    {},
  );
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authIntent, setAuthIntent] = React.useState<AuthIntent>('candidate');
  const [acceptingInvite, setAcceptingInvite] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [marketplaceQuery, setMarketplaceQuery] = React.useState('');
  const [marketplaceFilters, setMarketplaceFilters] = React.useState<MarketplaceFilters>(() => buildDefaultMarketplaceFilters(getDefaultCandidatePreferences()));
  const [recruiterSearch, setRecruiterSearch] = React.useState('');
  const [marketplaceRoles, setMarketplaceRoles] = React.useState<Role[]>([]);
  const [marketplaceSections, setMarketplaceSections] = React.useState<MarketplaceSection[]>([]);
  const [marketplaceTotalCount, setMarketplaceTotalCount] = React.useState(0);

  const [marketplacePage, setMarketplacePage] = React.useState(0);
  const [marketplaceHasMore, setMarketplaceHasMore] = React.useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = React.useState(false);
  const [marketplaceCategoryOffsets, setMarketplaceCategoryOffsets] = React.useState<Record<RoleClusterId, number>>({
    management: 0,
    operations: 0,
    business: 0,
    digital: 0,
    services: 0,
    other: 0,
  });
  const [marketplaceCategoryLoading, setMarketplaceCategoryLoading] = React.useState<RoleClusterId | null>(null);
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
  const [karmaSummary, setKarmaSummary] = React.useState<KarmaAccountSummary | null>(null);
  const [_karmaLoading, setKarmaLoading] = React.useState(false);
  const [karmaSlotRedeeming, setKarmaSlotRedeeming] = React.useState(false);
  const [referralModalOpen, setReferralModalOpen] = React.useState(false);
  const [referralSubmitting, setReferralSubmitting] = React.useState(false);
  const [referralDraft, setReferralDraft] = React.useState({ companyName: '', websiteUrl: '', contactEmail: '', note: '' });
  const [brandSaving, setBrandSaving] = React.useState(false);
  const [recruiterActivationBusy, setRecruiterActivationBusy] = React.useState(false);
  const [companyLookupBusy, setCompanyLookupBusy] = React.useState(false);
  const [companyLookupFailed, setCompanyLookupFailed] = React.useState(false);
  const [companyLookupRetry, setCompanyLookupRetry] = React.useState(0);
  const [checkoutBusyTier, setCheckoutBusyTier] = React.useState<'starter' | 'growth' | 'professional' | null>(null);
  const [candidatePremiumBusy, setCandidatePremiumBusy] = React.useState(false);
  const pendingCheckoutTierRef = React.useRef<'starter' | 'growth' | 'professional' | null>(null);
  React.useEffect(() => {
    if (!preferences.address && !userProfile.isLoggedIn) {
      const detectRegion = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error('GeoIP service response not OK');
          const data = await res.json();
          if (data && data.country_code) {
            const detectedCountry = data.country_code.toUpperCase();
            const supportedCountries = ['CZ', 'PL', 'DE', 'AT', 'SK', 'FI', 'SE', 'NO', 'DK'];
            if (supportedCountries.includes(detectedCountry)) {
              setPreferences(prev => ({
                ...prev,
                taxProfile: { ...prev.taxProfile, countryCode: detectedCountry as SupportedCountryCode }
              }));
              // Auto-set language based on IP if not already manually changed/persisted
              const countryToLang: Record<string, string> = {
                CZ: 'cs',
                SK: 'sk',
                PL: 'pl',
                DE: 'de',
                AT: 'at',
                FI: 'fi',
                SE: 'sv',
                NO: 'no',
                DK: 'da'
              };
              const targetLang = countryToLang[detectedCountry];
              const hasStoredLang = localStorage.getItem('i18nextLng');
              if (targetLang && i18n.language !== targetLang && !hasStoredLang) {
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

  // Synchronize country with language when language is manually changed
  React.useEffect(() => {
    const langToCountry: Record<string, string> = {
      cs: 'CZ',
      sk: 'SK',
      pl: 'PL',
      de: 'DE',
      at: 'AT',
      da: 'DK',
      sv: 'SE',
      no: 'NO',
      fi: 'FI',
    };
    const baseLang = i18n.language.split('-')[0].toLowerCase();
    const targetCountry = langToCountry[baseLang] as SupportedCountryCode | undefined;
    // Sync country when language is manually changed - this overrides GeoIP for user intent.
    // English is intentionally left global and should not force GB as country filter.
    if (targetCountry && preferences.taxProfile.countryCode !== targetCountry) {
      setPreferences(prev => ({
        ...prev,
        taxProfile: { ...prev.taxProfile, countryCode: targetCountry }
      }));
    }
  }, [i18n.language, preferences.taxProfile.countryCode, setPreferences]);

  const deferredMarketplaceQuery = React.useDeferredValue(marketplaceQuery);
  const marketplaceRequestCoordinates = React.useMemo(() => {
    const staticCoordinates = getStaticCoordinates(preferences.address || '');
    if (staticCoordinates) return staticCoordinates;
    const lat = preferences.coordinates?.lat;
    const lon = preferences.coordinates?.lon || (preferences.coordinates as any)?.lng;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }, [preferences.address, preferences.coordinates]);
  const marketplaceCriteriaKey = React.useMemo(() => JSON.stringify({
    q: deferredMarketplaceQuery.trim(),
    city: marketplaceFilters.city.trim(),
    targetRole: marketplaceFilters.targetRole.trim(),
    roleFamily: marketplaceFilters.roleFamily,
    crossBorder: marketplaceFilters.crossBorder,
    enableCommuteFilter: marketplaceFilters.enableCommuteFilter,
    benefits: [...marketplaceFilters.benefits].sort(),
    minSalary: marketplaceFilters.minSalary,
    radiusKm: marketplaceFilters.radiusKm,
    remoteOnly: marketplaceFilters.remoteOnly,
    transportMode: marketplaceFilters.transportMode,
    workArrangement: marketplaceFilters.workArrangement,
    borderSearchEnabled: preferences.borderSearchEnabled,
    lat: marketplaceRequestCoordinates?.lat ?? null,
    lng: marketplaceRequestCoordinates?.lon ?? null,
    searchRadiusKm: preferences.searchRadiusKm,
    countryCode: preferences.taxProfile.countryCode,
  }), [
    deferredMarketplaceQuery,
    marketplaceFilters, // Broaden dependency to catch all filter changes
    marketplaceRequestCoordinates,
    preferences.borderSearchEnabled,
    preferences.searchRadiusKm,
    preferences.taxProfile.countryCode,
  ]);
  const marketplaceCriteriaRef = React.useRef(marketplaceCriteriaKey);
  const navigate = React.useCallback((path: string) => navigateTo(path, setPathname), [setPathname]);

  React.useEffect(() => {
    if (pathname !== '/' || !userProfile.isLoggedIn) return;
    if (userProfile.role === 'recruiter') {
      navigate('/recruiter');
      return;
    }
    navigate('/candidate/insights');
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

  const recruiterCompany = React.useMemo(() => {
    if (!companyProfile) return null;
    const mapped = mapCompanyProfileToCompany(companyProfile);
    // Always enrich reviewer with logged-in user's identity — userProfile is the authoritative
    // source for the recruiter's own name and photo. Fall back to DB data only when missing.
    const enrichedName = userProfile.name || userProfile.email || mapped.reviewer.name;
    const enrichedAvatarUrl = userProfile.photo || mapped.reviewer.avatarUrl;
    const isGenericRole = !mapped.reviewer.role || mapped.reviewer.role === 'Recruiter';
    return {
      ...mapped,
      reviewer: {
        ...mapped.reviewer,
        name: enrichedName,
        role: isGenericRole ? 'Founder / Hiring lead' : mapped.reviewer.role,
        avatarUrl: enrichedAvatarUrl,
      },
    };
  }, [companyProfile, userProfile.email, userProfile.name, userProfile.photo]);
  const recruiterActiveTab = route.kind === 'recruiter'
    ? route.tab === 'dashboard'
      ? 'overview'
      : route.tab === 'talent-pool'
        ? 'candidates'
        : route.tab === 'roles'
          ? 'jobs'
          : route.tab === 'assistant'
            ? 'assistant'
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

  React.useEffect(() => {
    let cancelled = false;
    if (!userProfile.id || !userProfile.isLoggedIn) return undefined;
    void getSubscriptionStatus(userProfile.id)
      .then((status) => {
        if (cancelled) return;
        const tier = String(status.tier || 'free') as any;
        setUserProfile({
          subscription: {
            tier,
            expiresAt: status.expiresAt,
            usage: {
              activeDialogueSlotsUsed: status.dialogueSlotsUsed || 0,
              activeDialogueSlotsLimit: status.dialogueSlotsAvailable || (tier === 'premium' ? 25 : 5),
            } as any,
          },
          slots: status.dialogueSlotsAvailable || (tier === 'premium' ? 25 : 5),
        });
      })
      .catch((error) => {
        console.warn('Failed to load candidate subscription status', error);
      });
    return () => {
      cancelled = true;
    };
  }, [setUserProfile, userProfile.id, userProfile.isLoggedIn]);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = searchParams.get('token');

    if (pathname === '/accept-invitation' && tokenFromUrl) {
      sessionStorage.setItem('pending_invitation_token', tokenFromUrl);
      navigate('/');
      if (!userProfile.isLoggedIn) {
        setAuthIntent('recruiter');
        setAuthOpen(true);
      }
      return;
    }

    const pendingToken = sessionStorage.getItem('pending_invitation_token');
    if (pendingToken && userProfile.isLoggedIn && userProfile.id && !acceptingInvite) {
      const performAccept = async () => {
        setAcceptingInvite(true);
        setInviteError(null);
        try {
          await acceptInvitation(pendingToken);
          sessionStorage.removeItem('pending_invitation_token');
          // Refresh user session/profile to pick up recruiter role and company profile
          await handleSessionRestoration(userProfile.id as string, true);
          navigate('/recruiter');
        } catch (err: any) {
          console.error('Failed to accept invitation:', err);
          setInviteError(err?.message || 'Nelze přijmout pozvánku. Token je pravděpodobně neplatný nebo expirovaný.');
          sessionStorage.removeItem('pending_invitation_token');
        } finally {
          setAcceptingInvite(false);
        }
      };
      void performAccept();
    }
  }, [pathname, userProfile.isLoggedIn, userProfile.id, navigate, handleSessionRestoration, acceptingInvite]);

  React.useEffect(() => {
    if (!userProfile.isLoggedIn || userProfile.role === 'recruiter') return;
    if (route.kind === 'ritual') {
      navigate('/candidate/onboarding');
      return;
    }
    const onboardingComplete = Boolean(userProfile.preferences?.candidate_onboarding_v2?.completed_at);
    if (onboardingComplete) return;
    if (
      route.kind === 'candidate-insights'
      || route.kind === 'marketplace'
      || route.kind === 'candidate-applications'
      || route.kind === 'candidate-learning'
    ) {
      navigate('/candidate/onboarding');
    }
  }, [navigate, route.kind, userProfile.isLoggedIn, userProfile.preferences?.candidate_onboarding_v2?.completed_at, userProfile.role]);

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
      commuteFilterEnabled: false,
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

  const refreshKarmaSummary = React.useCallback(async () => {
    const summary = await fetchKarmaSummary();
    setKarmaSummary(summary);
  }, []);

  const handleSubmitReferral = React.useCallback(async () => {
    if (!referralDraft.companyName.trim()) return;
    setReferralSubmitting(true);
    try {
      await submitCompanyReferral({
        companyName: referralDraft.companyName.trim(),
        websiteUrl: referralDraft.websiteUrl.trim() || undefined,
        contactEmail: referralDraft.contactEmail.trim() || undefined,
        note: referralDraft.note.trim() || undefined,
      });
      setReferralDraft({ companyName: '', websiteUrl: '', contactEmail: '', note: '' });
      setReferralModalOpen(false);
      await refreshKarmaSummary();
    } catch (error) {
      console.error('Failed to submit company referral', error);
    } finally {
      setReferralSubmitting(false);
    }
  }, [referralDraft, refreshKarmaSummary]);

  const handleRedeemSlot = React.useCallback(async () => {
    if ((karmaSummary?.balance ?? 0) < (karmaSummary?.nextSlotCost ?? 250)) return;
    setKarmaSlotRedeeming(true);
    try {
      await redeemKarmaReward('candidate_slot');
      await Promise.all([
        refreshKarmaSummary(),
        fetchMyDialoguesWithCapacity(80).then((result) => setCandidateDialogueCapacity(result.candidateCapacity)),
      ]);
    } catch (error) {
      console.error('Failed to redeem candidate slot', error);
    } finally {
      setKarmaSlotRedeeming(false);
    }
  }, [karmaSummary, refreshKarmaSummary]);

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
    setMarketplaceCategoryOffsets({
      management: 0,
      operations: 0,
      business: 0,
      digital: 0,
      services: 0,
      other: 0,
    });
  }, [marketplaceCriteriaKey]);

  React.useEffect(() => {
    let active = true;
    const criteriaKey = marketplaceCriteriaKey;
    const loadMarketplace = async () => {
      setMarketplaceLoading(true);
      try {
        const result = await fetchJobsWithFiltersV2(
          marketplacePage,
          50,
          {
            countryCode: marketplaceFilters.crossBorder || marketplaceFilters.city.trim() ? undefined : preferences.taxProfile.countryCode,
            includeRecommendations: false,
            searchTerm: deferredMarketplaceQuery,
            filters: marketplaceFilters,
            userLat: marketplaceRequestCoordinates?.lat,
            userLng: marketplaceRequestCoordinates?.lon,
            radiusKm: marketplaceFilters.enableCommuteFilter !== false ? marketplaceFilters.radiusKm || preferences.searchRadiusKm : undefined,
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
    marketplaceFilters.enableCommuteFilter,
    marketplaceFilters.benefits,
    marketplaceFilters.minSalary,
    marketplaceFilters.radiusKm,
    marketplaceFilters.remoteOnly,
    marketplaceFilters.transportMode,
    marketplaceFilters.workArrangement,
    marketplaceCriteriaKey,
    marketplaceRequestCoordinates,
    marketplacePage,
    preferences.borderSearchEnabled,
    preferences.searchRadiusKm,
    preferences.taxProfile.countryCode,
  ]);

  React.useEffect(() => {
    if (!userProfile.isLoggedIn) {
      setKarmaSummary(null);
      return;
    }
    let active = true;
    setKarmaLoading(true);
    void fetchKarmaSummary()
      .then((summary) => {
        if (!active) return;
        setKarmaSummary(summary);
      })
      .catch((error) => {
        console.error('Failed to load Karma summary', error);
        if (active) setKarmaSummary(null);
      })
      .finally(() => {
        if (active) setKarmaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

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

  const handleMarketplaceCategoryLoadMore = React.useCallback(async (categoryId: RoleClusterId) => {
    if (marketplaceCategoryLoading) return;
    const currentlyLoadedInCategory = marketplaceRoles.filter((role) => getMarketplaceClusterId(role) === categoryId).length;
    const offset = Math.max(marketplaceCategoryOffsets[categoryId] || 0, currentlyLoadedInCategory);
    setMarketplaceCategoryLoading(categoryId);
    try {
      const result = await fetchJobsWithFiltersV2(0, 36, {
        countryCode: marketplaceFilters.crossBorder || marketplaceFilters.city.trim() ? undefined : preferences.taxProfile.countryCode,
        includeRecommendations: false,
        searchTerm: deferredMarketplaceQuery,
        filters: marketplaceFilters,
        category: categoryId,
        offsetOverride: offset,
        userLat: marketplaceRequestCoordinates?.lat,
        userLng: marketplaceRequestCoordinates?.lon,
        radiusKm: marketplaceFilters.enableCommuteFilter !== false ? marketplaceFilters.radiusKm || preferences.searchRadiusKm : undefined,
      });
      setMarketplaceRoles((current) => {
        const merged = new Map<string, Role>();
        current.forEach((role) => merged.set(role.id, role));
        result.jobs.forEach((role) => merged.set(role.id, role));
        return Array.from(merged.values());
      });
      setMarketplaceCategoryOffsets((current) => ({
        ...current,
        [categoryId]: offset + Math.max(result.jobs.length, 36),
      }));
    } catch (error) {
      console.error('Failed to load marketplace category roles', error);
    } finally {
      setMarketplaceCategoryLoading(null);
    }
  }, [
    deferredMarketplaceQuery,
    marketplaceCategoryLoading,
    marketplaceCategoryOffsets,
    marketplaceFilters,
    marketplaceRequestCoordinates,
    marketplaceRoles,
    preferences.searchRadiusKm,
    preferences.taxProfile.countryCode,
  ]);

  const handleMarketplaceLoadMore = React.useCallback(() => {
    if (marketplaceLoading || !marketplaceHasMore) return;
    setMarketplacePage((current) => current + 1);
  }, [marketplaceHasMore, marketplaceLoading]);

  const roleLibrary = React.useMemo(() => {
    const merged = new Map<string, Role>();
    marketplaceRoles.forEach((role) => merged.set(role.id, role));
    localCompanyRoles.forEach((role) => merged.set(role.id, role));
    return Array.from(merged.values());
  }, [localCompanyRoles, marketplaceRoles]);

  const getBlueprintForRole = React.useCallback((role: Role) => {
    return resolveBlueprintForRole(role, blueprintLibrary, roleAssignments);
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

  React.useEffect(() => {
    if (route.kind !== 'candidate-journey' || !activeRole || activeRole.source !== 'curated' || !userProfile.id) return;
    const current = journeySessions[activeRole.id];
    if (current?.applicationId) return;
    let cancelled = false;
    void (async () => {
      const availability = await fetchHandshakeAvailability(activeRole.id).catch(() => null);
      if (cancelled) return;
      if (availability && !availability.available && !availability.existingHandshakeId) {
        setSessionForRole(activeRole.id, (session) => ({ ...session, slotAvailability: availability }));
        return;
      }
      const handshake = await startHandshake(activeRole.id);
      if (cancelled) return;
      const backendAnswers = Object.fromEntries(
        Object.entries(handshake.session?.answers || {}).map(([key, value]: [string, any]) => [
          key,
          value && typeof value === 'object' && 'answer' in value ? value.answer : value,
        ]),
      ) as CandidateJourneySession['answers'];
      setSessionForRole(activeRole.id, (session) => ({
        ...session,
        applicationId: handshake.handshake_id,
        applicationStatus: handshake.status || handshake.session?.status || session.applicationStatus,
        answers: { ...backendAnswers, ...session.answers },
        backendSession: handshake.session as any,
        slotAvailability: availability || session.slotAvailability,
        liveHydratedAt: new Date().toISOString(),
      }));
    })().catch((error) => {
      console.error('Failed to start or hydrate live handshake', error);
    });
    return () => {
      cancelled = true;
    };
  }, [activeRole, journeySessions, route.kind, setSessionForRole, userProfile.id]);
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
  const candidateInsights = companyProfile?.id
    ? (dialogueCandidateInsights.length > 0 ? dialogueCandidateInsights : liveCandidateInsights)
    : dialogueCandidateInsights.length > 0
      ? dialogueCandidateInsights
      : liveCandidateInsights.length > 0
        ? liveCandidateInsights
        : derivedCandidateInsights;
  const derivedCalendarEvents = React.useMemo(() => deriveRecruiterCalendar(journeySessions, roleLibrary), [journeySessions, roleLibrary]);
  const liveCalendarEvents = React.useMemo(() => mapDialoguesToCalendarEvents(recruiterDialogues), [recruiterDialogues]);
  const calendarEvents = companyProfile?.id ? liveCalendarEvents : (liveCalendarEvents.length > 0 ? liveCalendarEvents : derivedCalendarEvents);
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
    ? 'jcfpm'
    : route.kind === 'candidate-learning'
      ? 'learning'
      : route.kind === 'candidate-journey' || route.kind === 'candidate-applications'
        ? 'applications'
        : route.kind === 'candidate-role' || route.kind === 'candidate-imported' || route.kind === 'marketplace'
          ? 'work'
          : 'home';
  const candidateGreetingName = userProfile.isLoggedIn
    ? getCandidateGreetingName({
        preferredAlias: preferences.preferredAlias,
        preferenceName: preferences.name,
        profileName: userProfile.name,
        language: i18n.language,
      })
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
              ? t('rebuild.candidate.greeting', { defaultValue: 'Hello, {{name}}', name: candidateGreetingName })
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
            : t('rebuild.candidate.mission', { defaultValue: 'Každý má potenciál. Shami pomůže najít práci, kde dává smysl ho ukázat.' });
  const candidateSidebarSummary = React.useMemo<CandidateSidebarSummary | undefined>(() => {
    if (!userProfile.isLoggedIn) return undefined;
    const profileScore = Math.max(5, Math.min(100, [
      userProfile.name,
      userProfile.jobTitle,
      userProfile.bio,
      preferences.address,
      Array.isArray(userProfile.skills) ? userProfile.skills.length > 2 : false,
    ].filter(Boolean).length * 20));
    const limit = candidateDialogueCapacity?.limit ?? 5;
    const active = candidateDialogueCapacity?.active ?? 0;
    const bonusSlotsAvailable = karmaSummary?.bonusSlotsAvailable ?? 0;
    const slotsRemaining = candidateDialogueCapacity?.remaining ?? Math.max(0, limit - active);
    return {
      slotsRemaining,
      slotsLimit: limit,
      karmaBalance: karmaSummary?.balance ?? 0,
      nextSlotCost: karmaSummary?.nextSlotCost ?? 250,
      bonusSlotsAvailable,
      profileScore,
      onOpenReferral: () => setReferralModalOpen(true),
      onRedeemSlot: () => {
        void handleRedeemSlot();
      },
      redeemingSlot: karmaSlotRedeeming,
    };
  }, [candidateDialogueCapacity, handleRedeemSlot, karmaSlotRedeeming, karmaSummary, preferences.address, userProfile.bio, userProfile.isLoggedIn, userProfile.jobTitle, userProfile.name, userProfile.skills]);

  const renderCandidateWorkspace = (content: React.ReactNode, extra?: { actionRegion?: React.ReactNode; title?: string; subtitle?: string; searchValue?: string; onSearchChange?: (val: string) => void; }) => (
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
      title={extra?.title || candidateWorkspaceTitle}
      subtitle={extra?.subtitle || candidateWorkspaceSubtitle}
      searchValue={extra?.searchValue}
      onSearchChange={extra?.onSearchChange}
      actionRegion={extra?.actionRegion}
      
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
      pendingCheckoutTierRef.current = tier;
      openAuth('recruiter');
      return;
    }
    if (!companyProfile?.id) {
      pendingCheckoutTierRef.current = tier;
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

  const handleCandidatePremiumCheckout = React.useCallback(async () => {
    if (!userProfile.id || !userProfile.isLoggedIn) {
      openAuth('candidate');
      return;
    }
    setCandidatePremiumBusy(true);
    try {
      await redirectToCheckout('premium', userProfile.id);
    } finally {
      setCandidatePremiumBusy(false);
    }
  }, [openAuth, userProfile.id, userProfile.isLoggedIn]);

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
    // Resume pending checkout if user just came through auth + company creation
    const pendingTier = pendingCheckoutTierRef.current;
    if (pendingTier) {
      pendingCheckoutTierRef.current = null;
      void (async () => {
        setCheckoutBusyTier(pendingTier);
        try {
          await redirectToCheckout(pendingTier, companyProfile.id!);
        } finally {
          setCheckoutBusyTier(null);
        }
      })();
    }
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

    let hasOnboardingComplete = false;
    if (userId && intent === 'candidate') {
      const profile = await getUserProfile(userId);
      hasOnboardingComplete = Boolean(profile?.preferences?.candidate_onboarding_v2?.completed_at);
    }

    // If there's a pending checkout tier, navigate to recruiter so we can trigger checkout after company setup
    if (pendingCheckoutTierRef.current) {
      navigate('/recruiter');
    } else if (intent === 'candidate' && !hasOnboardingComplete) {
      navigate('/candidate/onboarding');
    } else {
      navigate(intent === 'recruiter' ? '/recruiter' : '/candidate/insights');
    }
  }, [handleSessionRestoration, navigate]);

  const handleSaveProfile = React.useCallback(async (profileOverrides: Partial<UserProfile> = {}) => {
    if (!userProfile.id) {
      openAuth('candidate');
      return;
    }
    setProfileSaving(true);
    try {
      const nextProfile = { ...userProfile, ...profileOverrides };
      const overridePreferences = (profileOverrides.preferences || {}) as Partial<UserProfile['preferences']>;
      const nextPreferences: CandidatePreferenceProfile = {
        ...preferences,
        name: profileOverrides.name ?? preferences.name,
        legalName: profileOverrides.name ?? preferences.legalName,
        address: profileOverrides.address ?? preferences.address,
        coordinates: profileOverrides.coordinates ?? preferences.coordinates,
        transportMode: profileOverrides.transportMode ?? preferences.transportMode,
        story: profileOverrides.story ?? preferences.story,
        taxProfile: profileOverrides.taxProfile ?? preferences.taxProfile,
        jhiPreferences: profileOverrides.jhiPreferences ?? preferences.jhiPreferences,
        linkedInUrl: overridePreferences.linkedIn ?? preferences.linkedInUrl,
        portfolioUrl: overridePreferences.portfolio ?? preferences.portfolioUrl,
        searchRadiusKm: overridePreferences.searchProfile?.defaultMaxDistanceKm ?? preferences.searchRadiusKm,
      };
      const updates = {
        ...candidatePreferencesToUserProfileUpdates(nextPreferences, nextProfile),
        ...profileOverrides,
      };
      await updateUserProfile(userProfile.id, updates);
      setUserProfile(updates);
      setPreferences(nextPreferences);
    } finally {
      setProfileSaving(false);
    }
  }, [openAuth, preferences, setPreferences, setUserProfile, userProfile]);

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
      await updateUserProfile(userProfile.id, {
        cvUrl,
      });
      setUserProfile({
        cvUrl,
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
      if (userProfile.id && payload.role.source === 'curated') {
        if (!applicationId) {
          const handshake = await startHandshake(payload.role.id);
          applicationId = handshake.handshake_id || applicationId;
          if (!applicationId) {
            throw new Error('Handshake session did not return an id.');
          }
          applicationStatus = handshake.status || handshake.session?.status || applicationStatus;
          for (const [stepId, answer] of Object.entries(payload.session.answers || {})) {
            await patchHandshakeAnswer(applicationId, stepId, answer, stepId);
          }
        }

        const externalSubmissions = Array.isArray(payload.session.answers.external_submissions)
          ? payload.session.answers.external_submissions
          : [];
        const legacyExternalValue = String(payload.session.answers.external_link || '').trim();
        const normalizedExternalSubmissions = [
          ...externalSubmissions,
          ...(legacyExternalValue
            ? [{
                provider: 'other',
                external_url: legacyExternalValue,
                comment: String(payload.session.answers.external_link_comment || '').trim(),
              }]
            : []),
        ];
        for (const item of normalizedExternalSubmissions) {
          const externalUrl = String((item as any)?.external_url || '').trim();
          if (!/^https?:\/\//i.test(externalUrl)) continue;
          await addExternalHandshakeSubmission(applicationId, {
            provider: (['notion', 'canva', 'figma', 'google_docs', 'miro', 'other'].includes(String((item as any)?.provider || '').trim())
              ? String((item as any)?.provider || '').trim()
              : 'other') as any,
            external_url: externalUrl,
            comment: String((item as any)?.comment || '').trim() || null,
            evidence_required: true,
            visibility: 'company_review',
          });
        }

        const finalized = await finalizeHandshake(applicationId, payload.reviewerSummary);
        applicationStatus = finalized.session?.status || finalized.status || applicationStatus;
        applicationId = finalized.handshake_id || applicationId;
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
          video_url: company.marketplaceVideoUrl || null,
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

  const handleRefreshRecruiterCompany = React.useCallback(async () => {
    if (!userProfile.id) return;
    const refreshed = await getRecruiterCompany(userProfile.id);
    setCompanyProfile(refreshed);
    if (refreshed) {
      setCompanyLibrary((current) => {
        const mapped = mapCompanyProfileToCompany(refreshed);
        const exists = current.some((item) => item.id === mapped.id);
        return exists ? current.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...current];
      });
    }
  }, [setCompanyLibrary, setCompanyProfile, userProfile.id]);

  const handleCreateRecruiterChallenge = React.useCallback(async (input: {
    id?: string;
    title: string;
    roleFamily: Role['roleFamily'];
    location: string;
    workModel: Role['workModel'];
    summary: string;
    firstStep: string;
    salaryFrom: number | null;
    salaryTo: number | null;
    hoursPerWeek?: number | null;
    employmentType?: Role['employmentType'];
    benefits?: string[];
    workPerks?: string[];
    skills: string[];
    assessmentTasks?: AssessmentTask[];
    handshakeBlueprint?: Record<string, any>;
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
    
    let challenge;
    if (input.id) {
      challenge = await updateCompanyChallenge(input.id, {
        title: input.title,
        role_family: input.roleFamily,
        summary: input.summary,
        description: input.summary,
        skills: input.skills,
        salary_from: input.salaryFrom,
        salary_to: input.salaryTo,
        salary_currency: currency,
        hours_per_week: input.hoursPerWeek ?? null,
        employment_type: input.employmentType ?? null,
        benefits: input.benefits || [],
        work_perks: input.workPerks || [],
        work_model: input.workModel,
        location: input.location,
        first_reply_prompt: input.firstStep,
        company_goal: input.summary,
        assessment_tasks: input.assessmentTasks,
        handshake_blueprint_v1: input.handshakeBlueprint,
        editor_state: {
          source: 'rebuild_challenge_form',
          role_family: input.roleFamily,
          hours_per_week: input.hoursPerWeek ?? null,
          employment_type: input.employmentType ?? null,
          benefits: input.benefits || [],
          work_perks: input.workPerks || [],
          updated_at: now,
        },
      });
    } else {
      challenge = await createCompanyChallenge({
        title: input.title,
        role_family: input.roleFamily,
        summary: input.summary,
        description: input.summary,
        skills: input.skills,
        salary_from: input.salaryFrom,
        salary_to: input.salaryTo,
        salary_currency: currency,
        hours_per_week: input.hoursPerWeek ?? null,
        employment_type: input.employmentType ?? null,
        benefits: input.benefits || [],
        work_perks: input.workPerks || [],
        work_model: input.workModel,
        location: input.location,
        first_reply_prompt: input.firstStep,
        company_goal: input.summary,
        assessment_tasks: input.assessmentTasks,
        handshake_blueprint_v1: input.handshakeBlueprint,
        editor_state: {
          source: 'rebuild_challenge_form',
          role_family: input.roleFamily,
          hours_per_week: input.hoursPerWeek ?? null,
          employment_type: input.employmentType ?? null,
          benefits: input.benefits || [],
          work_perks: input.workPerks || [],
          created_at: now,
        },
      });
    }
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
        hours_per_week: role.hoursPerWeek,
        employment_type: role.employmentType,
        benefits: role.benefits,
        work_perks: role.workPerks,
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
  }, [companyProfile, recruiterCompany, refreshRecruiterJobs, setLocalCompanyRoles, setRecruiterJobs, t]);

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

  const handleRefreshRecruiterRoles = React.useCallback(async () => {
    if (!companyProfile?.id) return;
    try {
      const challenges = await listCompanyChallenges();
      const company = recruiterCompany;
      setLocalCompanyRoles(challenges.map((challenge) => mapChallengeDraftToRole(challenge, t, company)));
      await refreshRecruiterJobs().catch(() => undefined);
    } catch (error) {
      console.warn('Failed to refresh recruiter roles/challenges', error);
      throw error;
    }
  }, [companyProfile, recruiterCompany, refreshRecruiterJobs, setLocalCompanyRoles, t]);

  const handleUpdateRoleStatus = React.useCallback(async (roleId: string, nextStatus: 'active' | 'paused' | 'closed' | 'archived' | 'published') => {
    const isLocalChallenge = localCompanyRoles.some((r) => r.id === roleId);
    let nextRole: Role;
    const company = recruiterCompany || (companyProfile ? mapCompanyProfileToCompany(companyProfile) : null);
    
    if (isLocalChallenge) {
      const mappedChallengeStatus = nextStatus === 'active' || nextStatus === 'published' ? 'published' : nextStatus;
      const updatedChallenge = await updateCompanyChallenge(roleId, { status: mappedChallengeStatus });
      nextRole = mapChallengeDraftToRole(updatedChallenge, t, company);
    } else {
      const mappedJobStatus = nextStatus === 'published' ? 'active' : nextStatus;
      await updateCompanyRoleLifecycle(roleId, mappedJobStatus as any);
      
      const updatedJobs = recruiterJobs.map((j) => {
        if (String(j.id) === String(roleId)) {
          return { ...j, status: mappedJobStatus as any } as Job;
        }
        return j;
      });
      setRecruiterJobs(updatedJobs);
      const targetJob = updatedJobs.find((j) => String(j.id) === String(roleId));
      if (targetJob) {
        nextRole = mapJobToRole(targetJob);
      } else {
        await refreshRecruiterJobs().catch(() => undefined);
        return;
      }
    }
    
    setLocalCompanyRoles((current) => current.map((item) => (item.id === roleId ? { ...item, ...nextRole } : item)));
    setMarketplaceRoles((current) => current.map((item) => (item.id === roleId ? { ...item, ...nextRole } : item)));
    
    await refreshRecruiterJobs().catch(() => undefined);
  }, [localCompanyRoles, recruiterCompany, companyProfile, recruiterJobs, setRecruiterJobs, refreshRecruiterJobs, setLocalCompanyRoles, t]);

  const handleDeleteRole = React.useCallback(async (roleId: string) => {
    const isLocalChallenge = localCompanyRoles.some((r) => r.id === roleId);
    if (!isLocalChallenge) {
      throw new Error(t('rebuild.recruiter.delete_supported_only_native', { defaultValue: 'Permanent deletion is currently supported only for native company challenges.' }));
    }
    await deleteCompanyChallenge(roleId);
    setLocalCompanyRoles((current) => current.filter((item) => item.id !== roleId));
    setMarketplaceRoles((current) => current.filter((item) => item.id !== roleId));
    setRecruiterJobs((current) => current.filter((item) => String(item.id) !== String(roleId)));
    await refreshRecruiterJobs().catch(() => undefined);
  }, [localCompanyRoles, refreshRecruiterJobs, setLocalCompanyRoles, setRecruiterJobs, t]);


  const isStandaloneDashboardRoute =
    route.kind === 'admin'
    || route.kind === 'marketplace'
    || route.kind === 'ritual'
    || route.kind === 'candidate-onboarding'
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

        {acceptingInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
              <Loader2 className="h-12 w-12 animate-spin text-[#12AFCB]" />
              <div className="text-lg font-semibold text-slate-100">
                Přijímání pozvánky do firmy...
              </div>
              <div className="text-sm text-slate-400">
                Přiřazujeme váš účet k týmu.
              </div>
            </div>
          </div>
        )}

        {inviteError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-red-900/50 bg-slate-900 p-8 text-center shadow-2xl">
              <div className="rounded-full bg-red-950/50 p-3 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="text-lg font-semibold text-slate-100 font-sans">
                Pozvánku se nepodařilo přijmout
              </div>
              <div className="text-sm text-slate-400 font-sans">
                {inviteError}
              </div>
              <button
                onClick={() => setInviteError(null)}
                className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Zavřít
              </button>
            </div>
          </div>
        )}

        {referralModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0f95ac]">
                    {t('rebuild.sidebar.refer_company', { defaultValue: 'Doporuč nám firmu' })}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-slate-100">
                    {t('rebuild.sidebar.referral_modal_title', { defaultValue: 'Přidej firmu do karmické ekonomiky' })}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t('rebuild.sidebar.referral_modal_copy', { defaultValue: 'Karma přijde až po ověření firmy. Tady je jen začátek doporučení.' })}
                  </p>
                </div>
                <button type="button" onClick={() => setReferralModalOpen(false)} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                <input value={referralDraft.companyName} onChange={(e) => setReferralDraft((current) => ({ ...current, companyName: e.target.value }))} placeholder={t('rebuild.sidebar.company_name', { defaultValue: 'Firma' })} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#12afcb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <input value={referralDraft.websiteUrl} onChange={(e) => setReferralDraft((current) => ({ ...current, websiteUrl: e.target.value }))} placeholder={t('rebuild.sidebar.website', { defaultValue: 'Web nebo doména' })} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#12afcb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <input value={referralDraft.contactEmail} onChange={(e) => setReferralDraft((current) => ({ ...current, contactEmail: e.target.value }))} placeholder={t('rebuild.sidebar.contact_email', { defaultValue: 'Kontaktní e-mail' })} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#12afcb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <textarea value={referralDraft.note} onChange={(e) => setReferralDraft((current) => ({ ...current, note: e.target.value }))} placeholder={t('rebuild.sidebar.note', { defaultValue: 'Co je na firmě zajímavé?' })} className="min-h-28 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#12afcb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('rebuild.sidebar.reward_after_verification', { defaultValue: '100 Karma po ověření' })}
                </div>
                <button type="button" onClick={() => void handleSubmitReferral()} disabled={referralSubmitting || !referralDraft.companyName.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0f95ac] px-5 text-sm font-black text-white transition hover:bg-[#087f95] disabled:cursor-not-allowed disabled:bg-slate-300">
                  {referralSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {referralSubmitting ? t('rebuild.actions.saving', { defaultValue: 'Ukládám' }) : t('rebuild.actions.submit', { defaultValue: 'Odeslat' })}
                </button>
              </div>
            </div>
          </div>
        )}

        <React.Suspense fallback={
          <div className="flex min-h-[60vh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-4 border-[color:var(--accent-soft)]"></div>
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-[color:var(--accent)] border-t-transparent"></div>
              </div>
              <div className="text-sm font-medium text-[color:var(--dashboard-text-muted)] animate-pulse">
                {t('rebuild.loading.workspace', { defaultValue: 'Initializing workspace...' })}
              </div>
            </div>
          </div>
        }>

        {route.kind === 'marketplace' ? (
          renderCandidateWorkspace(
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
              onLoadMore={handleMarketplaceLoadMore}
              onLoadMoreCategory={handleMarketplaceCategoryLoadMore}
              onToggleSavedRole={handleToggleSavedRole}
              loadingCategoryId={marketplaceCategoryLoading}
              currentLanguage={i18n.language}
              onLanguageChange={(lang) => i18n.changeLanguage(lang)}
              navigate={navigate}
              t={t}
            />,
            {
              title: t('rebuild.marketplace.header_title', { defaultValue: 'Marketplace práce' }),
              subtitle: t('rebuild.marketplace.header_subtitle', { defaultValue: 'Procházej nabídky, uprav filtry a otevírej jen ty role, které dávají smysl.' }),
            },
          )
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
            userProfile={userProfile}
            companyLibrary={companyLibrary}
            existingApplication={candidateApplicationsByRoleId[activeRole.id] || null}
            isSaved={savedJobIds.includes(String(activeRole.id))}
            onToggleSaved={() => handleToggleSavedRole(activeRole.id)}
            onUpgradePremium={() => void handleCandidatePremiumCheckout()}
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
          renderCandidateWorkspace(<CandidateHandshakeLayout
            handshakeId={activeSession.applicationId || ''}
            role={activeRole}
            company={resolveCompany(activeRole, companyLibrary) || companyLibrary[0]}
            blueprint={activeBlueprint}
            initialSession={route.stepId ? { ...activeSession, currentStepId: route.stepId } : (activeSession as any)}
            preferences={preferences}
            userProfile={userProfile}
            activeCvDocument={activeCvDocument}
            onNavigateBack={() => navigate('/candidate/marketplace')}
            onNavigateToStep={(stepId) => navigate(`/candidate/journey/${activeRole.id}/${stepId}`)}
            onFinalizeHandshake={async (session, score) => {
              await handleFinalizeJourney({
                role: activeRole,
                session,
                candidateName: userProfile.name || '',
                scheduledSlot: String(session.answers?.schedule_slot || ''),
                candidateScore: score,
                reviewerSummary: String(session.answers?.final_note || ''),
                submissionSnapshot: (session.submissionSnapshot || {
                  candidateJobTitle: userProfile.jobTitle || '',
                  keySkills: userProfile.skills?.slice(0, 4) || [],
                  taxSummary: '',
                  commuteSummary: '',
                  realMonthlyValue: 0,
                  takeHomeMonthly: 0,
                  seniorityScore: 0,
                  workplaceScore: 0,
                  travelScore: 0,
                }) as any
              });
            }}
            finalizeBusy={journeySubmitting}
          />)
        ) : null}

        {route.kind === 'ritual' ? (
          <TheRitual
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            handleSessionRestoration={handleSessionRestoration}
            onComplete={() => navigate('/candidate/insights')}
          />
        ) : null}

        {route.kind === 'candidate-onboarding' ? (
          <CandidateOnboardingWizard
            userProfile={userProfile}
            activeCvDocument={activeCvDocument}
            cvDocuments={cvDocuments}
            cvBusy={cvBusy}
            onOpenAuth={() => openAuth('candidate')}
            onUploadCv={handleUploadCv}
            onSaveProfile={(updates) => handleSaveProfile(updates)}
            setUserProfile={setUserProfile}
            navigate={navigate}
            t={t}
          />
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
            onSaveProfile={(updates) => void handleSaveProfile(updates)}
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
            onUpgradePremium={handleCandidatePremiumCheckout}
            premiumBusy={candidatePremiumBusy}
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
          (userProfile.subscription?.tier || 'free') === 'free'
            ? <CandidatePremiumGate
                title={t('rebuild.premium.jobfit_title', { defaultValue: 'JobFit Kompas je součást Premium.' })}
                copy={t('rebuild.premium.jobfit_copy', { defaultValue: 'Test odemkne pracovní styl, silné stránky a přesnější doporučení. V Premium získáš také více odpovědních slotů a AI hodnocení nabídek.' })}
                busy={candidatePremiumBusy}
                onUpgrade={handleCandidatePremiumCheckout}
                t={t}
              />
            : renderCandidateWorkspace(<CandidateJcfpmPage t={t} locale={i18n.language} />)
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
              onRefreshCompany={handleRefreshRecruiterCompany}
              onCreateChallenge={handleCreateRecruiterChallenge}
              onAiDraftChallenge={handleAiDraftRecruiterChallenge}
              onAiAssistChallenge={handleAiAssistRecruiterChallenge}
              onPublishChallenge={handlePublishRecruiterChallenge}
              onUpdateRoleStatus={handleUpdateRoleStatus}
              onDeleteRole={handleDeleteRole}
              onRefreshRoles={handleRefreshRecruiterRoles}
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

        {route.kind === 'accept-invitation' ? (
          <div className="flex min-h-[60vh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-4 border-[color:var(--accent-soft)]"></div>
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-[color:var(--accent)] border-t-transparent"></div>
              </div>
              <div className="text-sm font-medium text-[color:var(--dashboard-text-muted)] animate-pulse">
                Ověřování pozvánky...
              </div>
            </div>
          </div>
        ) : null}
        </React.Suspense>
      </div>
      <CookieBanner />
    </RebuildThemeProvider>
  );
};

export default JobshamanRebuildApp;
