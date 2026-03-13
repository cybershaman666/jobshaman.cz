import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Globe,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrainFront
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CandidateDialogueCapacity, DiscoveryFilterSource, Job, JobSearchFilters, MicroJobCollaborationMode, MicroJobLongTermPotential, SearchLanguageCode, SearchMode, SupportedCountryCode, UserProfile } from '../../types';
import { buildCandidateSearchPresets } from '../../services/searchProfilePresets';
import { createDefaultCandidateSearchProfile } from '../../services/profileDefaults';
import { fetchMyDialogueCapacity } from '../../services/jobApplicationService';
import { calculateDistanceKm, isRemoteJob } from '../../services/commuteService';
import { computeCandidateAnnotations, getCandidateIntentRoleSeedKeyword, getCandidateIntentSignals, resolveCandidateIntentProfile, sortJobsForDiscovery } from '../../services/candidateIntentService';
import MobileSwipeJobBrowser from '../MobileSwipeJobBrowser';
import PremiumFeatureExplainModal, { PremiumFeatureExplainContent } from '../PremiumFeatureExplainModal';
import PublicActivityPanel from '../PublicActivityPanel';
import { SavedFiltersMenu } from '../SavedFiltersMenu';
import { EmptyState, FilterChip, MetricTile, PageHeader, SurfaceCard, Toolbar, cn } from '../ui/primitives';
import { recordRuntimeSignal } from '../../services/runtimeSignals';

type MarketplaceLanguage = 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en';
type LocaleLabels = { cs: string; en: string; sk?: string; de?: string; at?: string; pl?: string };

interface ChallengeMarketplaceProps {
  hasNativeChallenges: boolean;
  jobs: Job[];
  selectedJobId: string | null;
  savedJobIds: string[];
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  microJobsOnly: boolean;
  setLane: (lane: 'challenges' | 'imports') => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  loadMoreJobs: () => void;
  goToPage: (page: number) => void;
  applyInteractionState: (jobId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  theme: 'light' | 'dark';
  searchTerm: string;
  setSearchTerm: (term: string, source?: DiscoveryFilterSource) => void;
  performSearch: (term: string) => void;
  filterCity: string;
  setFilterCity: (city: string, source?: DiscoveryFilterSource) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number, source?: DiscoveryFilterSource) => void;
  filterBenefits: string[];
  setFilterBenefits: (benefits: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
  toggleBenefitFilter: (benefit: string) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean, source?: DiscoveryFilterSource) => void;
  globalSearch: boolean;
  setGlobalSearch: (enabled: boolean, source?: DiscoveryFilterSource) => void;
  abroadOnly: boolean;
  setAbroadOnly: (enabled: boolean, source?: DiscoveryFilterSource) => void;
  countryCodes: string[];
  setCountryCodes: (codes: string[] | ((prev: string[]) => string[])) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean, source?: DiscoveryFilterSource) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number, source?: DiscoveryFilterSource) => void;
  filterContractType: string[];
  setFilterContractType: (types: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
  toggleContractTypeFilter: (type: string) => void;
  filterDate: string;
  setFilterDate: (date: string, source?: DiscoveryFilterSource) => void;
  filterExperience: string[];
  setFilterExperience: (levels: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
  filterLanguageCodes: SearchLanguageCode[];
  setFilterLanguageCodes: (codes: SearchLanguageCode[] | ((prev: SearchLanguageCode[]) => SearchLanguageCode[]), source?: DiscoveryFilterSource) => void;
  enableAutoLanguageGuard: boolean;
  setEnableAutoLanguageGuard: (enabled: boolean) => void;
  implicitLanguageCodesApplied: string[];
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  onOpenPremium: (featureLabel: string) => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  applyDiscoveryDefaults: (filters: JobSearchFilters) => void;
  searchMode: SearchMode;
}

const getLocaleLabel = (labels: LocaleLabels, language: MarketplaceLanguage): string => {
  return labels[language] || labels.en;
};

const ROLE_TYPES = [
  { key: 'hpp', labels: { cs: 'HPP', sk: 'HPP', de: 'Vollzeit', at: 'Vollzeit', pl: 'Pełny etat', en: 'Full-time' } },
  { key: 'part-time', labels: { cs: 'Zkrácený úvazek', sk: 'Skrátený úväzok', de: 'Teilzeit', at: 'Teilzeit', pl: 'Część etatu', en: 'Part-time' } },
  { key: 'ico', labels: { cs: 'IČO', sk: 'IČO', de: 'Vertrag / Freelance', at: 'Vertrag / Freelance', pl: 'B2B / kontrakt', en: 'Contract' } }
];

const BENEFIT_FILTERS = [
  { key: 'home_office', labels: { cs: 'Home office', sk: 'Home office', de: 'Homeoffice', at: 'Homeoffice', pl: 'Home office', en: 'Home office' } },
  { key: 'dog_friendly', labels: { cs: 'Dog-friendly kancelář', sk: 'Dog-friendly kancelária', de: 'Hundefreundliches Büro', at: 'Hundefreundliches Büro', pl: 'Biuro przyjazne psom', en: 'Dog-friendly office' } },
  { key: 'child_friendly', labels: { cs: 'Pro rodiče', sk: 'Pre rodičov', de: 'Familienfreundlich', at: 'Familienfreundlich', pl: 'Przyjazne rodzicom', en: 'Child-friendly' } },
  { key: 'flex_time', labels: { cs: 'Flexibilita', sk: 'Flexibilita', de: 'Flexible Zeiten', at: 'Flexible Zeiten', pl: 'Elastyczny czas', en: 'Flex time' } },
  { key: 'childcare_support', labels: { cs: 'Podpora péče o děti', sk: 'Podpora starostlivosti o deti', de: 'Kinderbetreuung', at: 'Kinderbetreuung', pl: 'Wsparcie opieki nad dziećmi', en: 'Childcare support' } },
  { key: 'meal_allowance', labels: { cs: 'Stravování', sk: 'Stravovanie', de: 'Verpflegung', at: 'Verpflegung', pl: 'Posiłki', en: 'Meals' } },
  { key: 'car_personal', labels: { cs: 'Služební auto', sk: 'Služobné auto', de: 'Firmenwagen', at: 'Firmenwagen', pl: 'Samochód służbowy', en: 'Company car' } },
  { key: 'transport_support', labels: { cs: 'Doprava / parkování', sk: 'Doprava / parkovanie', de: 'Transport / Parken', at: 'Transport / Parken', pl: 'Dojazd / parking', en: 'Transport / parking' } },
  { key: 'health_care', labels: { cs: 'Zdravotní péče', sk: 'Zdravotná starostlivosť', de: 'Gesundheitsbenefity', at: 'Gesundheitsbenefity', pl: 'Opieka zdrowotna', en: 'Healthcare' } },
  { key: 'pension', labels: { cs: 'Penzijko / spoření', sk: 'Dôchodok / sporenie', de: 'Vorsorge / Pension', at: 'Vorsorge / Pension', pl: 'Emerytura / oszczędzanie', en: 'Pension / retirement' } },
  { key: 'vacation_5w', labels: { cs: 'Extra dovolená', sk: 'Extra dovolenka', de: 'Mehr Urlaub', at: 'Mehr Urlaub', pl: 'Dodatkowy urlop', en: 'Extra vacation' } },
  { key: 'multisport', labels: { cs: 'Sport / wellness', sk: 'Šport / wellness', de: 'Sport / Wellness', at: 'Sport / Wellness', pl: 'Sport / wellness', en: 'Sport / wellness' } },
  { key: 'education', labels: { cs: 'Vzdělávání', sk: 'Vzdelávanie', de: 'Weiterbildung', at: 'Weiterbildung', pl: 'Rozwój / szkolenia', en: 'Education' } },
  { key: 'relocation_support', labels: { cs: 'Relokace / bydlení', sk: 'Relokácia / bývanie', de: 'Umzug / Wohnen', at: 'Umzug / Wohnen', pl: 'Relokacja / mieszkanie', en: 'Relocation / housing' } },
  { key: 'employee_shares', labels: { cs: 'Akcie / ESOP', sk: 'Akcie / ESOP', de: 'Anteile / ESOP', at: 'Anteile / ESOP', pl: 'Udziały / ESOP', en: 'Equity / ESOP' } }
];

const EXPERIENCE_LEVELS = [
  { key: 'junior', labels: { cs: 'Junior', sk: 'Junior', de: 'Junior', at: 'Junior', pl: 'Junior', en: 'Junior' } },
  { key: 'medior', labels: { cs: 'Medior', sk: 'Medior', de: 'Mittelstufe', at: 'Mittelstufe', pl: 'Mid', en: 'Mid-level' } },
  { key: 'senior', labels: { cs: 'Senior', sk: 'Senior', de: 'Senior', at: 'Senior', pl: 'Senior', en: 'Senior' } }
];

const REMOTE_LANGUAGE_OPTIONS: Array<{ key: SearchLanguageCode; labels: LocaleLabels }> = [
  { key: 'cs', labels: { cs: 'Čeština', sk: 'Čeština', de: 'Tschechisch', at: 'Tschechisch', pl: 'Czeski', en: 'Czech' } },
  { key: 'en', labels: { cs: 'Angličtina', sk: 'Angličtina', de: 'Englisch', at: 'Englisch', pl: 'Angielski', en: 'English' } },
  { key: 'de', labels: { cs: 'Němčina', sk: 'Nemčina', de: 'Deutsch', at: 'Deutsch', pl: 'Niemiecki', en: 'German' } },
  { key: 'sk', labels: { cs: 'Slovenština', sk: 'Slovenčina', de: 'Slowakisch', at: 'Slowakisch', pl: 'Słowacki', en: 'Slovak' } },
  { key: 'pl', labels: { cs: 'Polština', sk: 'Poľština', de: 'Polnisch', at: 'Polnisch', pl: 'Polski', en: 'Polish' } }
];

const BORDER_COUNTRY_MAP: Record<SupportedCountryCode, SupportedCountryCode[]> = {
  CZ: ['DE', 'PL', 'SK', 'AT'],
  SK: ['CZ', 'PL', 'AT'],
  PL: ['CZ', 'SK', 'DE'],
  DE: ['CZ', 'PL', 'AT'],
  AT: ['CZ', 'SK', 'DE'],
};

type WorkArrangementFilter = 'all' | 'remote' | 'hybrid' | 'onsite';
type GeographicScopeFilter = 'domestic' | 'border' | 'abroad' | 'all';

const MIN_NATIVE_CHALLENGE_POOL = 20;

const simplifyDescription = (value: string | null | undefined): string => {
  const plain = String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= 132) return plain;
  return `${plain.slice(0, 129).trim()}...`;
};

const pickReadableChallengeSlice = (value: string): string => {
  const plain = simplifyDescription(value);
  if (!plain) return '';

  const taskMarkerMatch = plain.match(
    /\b(n[aá]pl[nň]\s+pr[aá]ce|pracovn[ií]\s+n[aá]pl[nň]|job\s+description|responsibilities|your\s+tasks|deine\s+aufgaben|aufgaben|what\s+you(?:'|’)ll\s+do)\s*:\s*(.+)$/i
  );
  if (taskMarkerMatch?.[2]) {
    return simplifyDescription(taskMarkerMatch[2]);
  }

  const colonIndex = plain.indexOf(':');
  if (colonIndex > 0) {
    const before = plain.slice(0, colonIndex).trim();
    const after = plain.slice(colonIndex + 1).trim();
    const uppercaseRatio =
      before.length > 0
        ? before.replace(/[^A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽÄÖÜß]/g, '').length / Math.max(1, before.replace(/[^A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽÄÖÜß]/g, '').length)
        : 0;
    if (after && (uppercaseRatio > 0.5 || before.length > 36)) {
      return simplifyDescription(after);
    }
  }

  const sentence = plain.split(/(?<=[.!?])\s+/)[0] || plain;
  return simplifyDescription(sentence);
};

const getChallengePreview = (job: Job): string => {
  const source = String(job.challenge || job.aiAnalysis?.summary || job.description || '').trim();
  return pickReadableChallengeSlice(source || job.title);
};

const isRemoteListing = (job: Job): boolean => {
  return isRemoteJob(job);
};

const normalizeSupportedCountryCode = (value: string | null | undefined): SupportedCountryCode | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'CS' || normalized === 'CZ') return 'CZ';
  if (normalized === 'SK') return 'SK';
  if (normalized === 'PL') return 'PL';
  if (normalized === 'DE') return 'DE';
  if (normalized === 'AT') return 'AT';
  return null;
};

const getNormalizedWorkArrangement = (job: Job): WorkArrangementFilter => {
  if (isRemoteListing(job)) return 'remote';

  const raw = [
    job.work_model,
    (job as any).work_type,
    job.type,
    job.location,
    job.description,
    ...(job.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();

  if (!raw) return 'all';
  if (raw.includes('hybrid')) return 'hybrid';
  if (raw.includes('onsite') || raw.includes('on-site') || raw.includes('office') || raw.includes('field')) return 'onsite';
  return 'all';
};

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) {
    return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  }
  if (from || to) {
    return `${(from || to).toLocaleString(locale)} ${currency}`;
  }
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const getWorkModel = (job: Job, isCsLike: boolean): string => {
  if (isRemoteListing(job)) {
    return isCsLike ? 'Práce z domu' : 'Home office';
  }

  const raw = String(job.work_model || (job as any).work_type || job.type || '').trim();
  if (!raw) return isCsLike ? 'Model neuveden' : 'Work model TBD';
  if (/remote/i.test(raw)) {
    return isCsLike ? 'Práce z domu' : 'Home office';
  }
  return raw;
};

const isMicroJob = (job: Job): boolean => job.challenge_format === 'micro_job';

const getMicroJobBadge = (language: MarketplaceLanguage): string => ({
  cs: 'MINI VYZVA',
  sk: 'MINI VYZVA',
  de: 'MINI-AUFGABE',
  at: 'MINI-AUFGABE',
  pl: 'MINI WYZWANIE',
  en: 'MINI CHALLENGE'
}[language]);

const getMicroJobKindLabel = (kind: Job['micro_job_kind'], language: MarketplaceLanguage): string | null => {
  if (!kind) return null;
  const labels: Record<NonNullable<Job['micro_job_kind']>, Record<MarketplaceLanguage, string>> = {
    one_off_task: {
      cs: 'Jednorázový task',
      sk: 'Jednorazový task',
      de: 'Einmalige Aufgabe',
      at: 'Einmalige Aufgabe',
      pl: 'Jednorazowe zadanie',
      en: 'One-off task'
    },
    short_project: {
      cs: 'Krátký projekt',
      sk: 'Krátky projekt',
      de: 'Kurzprojekt',
      at: 'Kurzprojekt',
      pl: 'Krótki projekt',
      en: 'Short project'
    },
    audit_review: {
      cs: 'Audit / review',
      sk: 'Audit / review',
      de: 'Audit / Review',
      at: 'Audit / Review',
      pl: 'Audyt / review',
      en: 'Audit / review'
    },
    prototype: {
      cs: 'Prototyp',
      sk: 'Prototyp',
      de: 'Prototyp',
      at: 'Prototyp',
      pl: 'Prototyp',
      en: 'Prototype'
    },
    experiment: {
      cs: 'Experiment',
      sk: 'Experiment',
      de: 'Experiment',
      at: 'Experiment',
      pl: 'Eksperyment',
      en: 'Experiment'
    }
  };
  return labels[kind]?.[language] || labels[kind]?.en || null;
};

const getMicroJobCollaborationLabel = (
  modes: Job['micro_job_collaboration_modes'],
  language: MarketplaceLanguage
): string | null => {
  if (!Array.isArray(modes) || modes.length === 0) return null;
  const labelMap: Record<MicroJobCollaborationMode, Record<MarketplaceLanguage, string>> = {
    remote: {
      cs: 'Remote',
      sk: 'Remote',
      de: 'Remote',
      at: 'Remote',
      pl: 'Remote',
      en: 'Remote'
    },
    async: {
      cs: 'Asynchronně',
      sk: 'Asynchrónne',
      de: 'Asynchron',
      at: 'Asynchron',
      pl: 'Asynchronicznie',
      en: 'Async'
    },
    call: {
      cs: 'Call',
      sk: 'Call',
      de: 'Call',
      at: 'Call',
      pl: 'Call',
      en: 'Call'
    }
  };
  return modes
    .map((mode) => labelMap[mode]?.[language] || labelMap[mode]?.en || mode)
    .join(' • ');
};

const getMicroJobLongTermPotentialLabel = (
  value: Job['micro_job_long_term_potential'],
  language: MarketplaceLanguage
): string | null => {
  if (!value) return null;
  const labelMap: Record<MicroJobLongTermPotential, Record<MarketplaceLanguage, string>> = {
    yes: {
      cs: 'Další spolupráce: Ano',
      sk: 'Ďalšia spolupráca: Áno',
      de: 'Weitere Zusammenarbeit: Ja',
      at: 'Weitere Zusammenarbeit: Ja',
      pl: 'Dalsza współpraca: Tak',
      en: 'Long-term potential: Yes'
    },
    maybe: {
      cs: 'Další spolupráce: Možná',
      sk: 'Ďalšia spolupráca: Možno',
      de: 'Weitere Zusammenarbeit: Vielleicht',
      at: 'Weitere Zusammenarbeit: Vielleicht',
      pl: 'Dalsza współpraca: Możliwe',
      en: 'Long-term potential: Maybe'
    },
    no: {
      cs: 'Další spolupráce: Ne',
      sk: 'Ďalšia spolupráca: Nie',
      de: 'Weitere Zusammenarbeit: Nein',
      at: 'Weitere Zusammenarbeit: Nein',
      pl: 'Dalsza współpraca: Nie',
      en: 'Long-term potential: No'
    }
  };
  return labelMap[value]?.[language] || labelMap[value]?.en || null;
};

const getExperienceLabel = (job: Job, isCsLike: boolean): string | null => {
  const source = `${(job as any).seniority || ''} ${(job as any).experience_level || ''} ${job.title || ''}`.toLowerCase();
  if (!source) return null;
  if (/junior|entry/.test(source)) return isCsLike ? 'Junior' : 'Junior';
  if (/senior|lead|principal|staff/.test(source)) return isCsLike ? 'Senior+' : 'Senior+';
  if (/medior|mid/.test(source)) return isCsLike ? 'Medior' : 'Mid-level';
  return null;
};

const getJobAgeLabel = (job: Job, language: string): string | null => {
  const locale = (language || 'en').split('-')[0].toLowerCase();
  const isCs = locale === 'cs';
  const isSk = locale === 'sk';
  const source = String(job.scrapedAt || (job as any).scraped_at || (job as any).created_at || '').trim();
  if (!source) return null;

  const timestamp = new Date(source).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return null;

  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 24) {
    if (isSk) return `Pred ${diffHours} h`;
    if (isCs) return `Před ${diffHours} h`;
    return `${diffHours}h ago`;
  }

  if (diffDays < 30) {
    if (isSk) return `Pred ${diffDays} d`;
    if (isCs) return `Před ${diffDays} d`;
    return `${diffDays}d ago`;
  }

  const diffWeeks = Math.max(1, Math.floor(diffDays / 7));
  if (diffWeeks < 9) {
    if (isSk) return `Pred ${diffWeeks} t`;
    if (isCs) return `Před ${diffWeeks} t`;
    return `${diffWeeks}w ago`;
  }

  const diffMonths = Math.max(1, Math.floor(diffDays / 30));
  if (isSk) return `Pred ${diffMonths} mes.`;
  if (isCs) return `Před ${diffMonths} měs.`;
  return `${diffMonths}mo ago`;
};

const ChallengeMarketplace: React.FC<ChallengeMarketplaceProps> = ({
  hasNativeChallenges,
  jobs,
  selectedJobId,
  savedJobIds,
  userProfile,
  lane,
  microJobsOnly,
  setLane,
  loading,
  loadingMore,
  hasMore,
  totalCount,
  currentPage,
  pageSize,
  loadMoreJobs,
  goToPage,
  applyInteractionState,
  theme,
  searchTerm,
  setSearchTerm,
  performSearch,
  filterCity,
  setFilterCity,
  filterMinSalary,
  setFilterMinSalary,
  filterBenefits,
  setFilterBenefits,
  toggleBenefitFilter,
  remoteOnly,
  setRemoteOnly,
  globalSearch,
  setGlobalSearch,
  abroadOnly,
  setAbroadOnly,
  countryCodes,
  setCountryCodes,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  filterContractType,
  setFilterContractType,
  toggleContractTypeFilter,
  filterDate,
  setFilterDate,
  filterExperience,
  setFilterExperience,
  filterLanguageCodes,
  setFilterLanguageCodes,
  enableAutoLanguageGuard,
  setEnableAutoLanguageGuard,
  implicitLanguageCodesApplied,
  handleJobSelect,
  handleToggleSave,
  onOpenPremium,
  onOpenProfile,
  onOpenAuth,
  applyDiscoveryDefaults,
  searchMode
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language: MarketplaceLanguage = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale)
    ? (locale as MarketplaceLanguage)
    : 'en';
  const isCsLike = language === 'cs' || language === 'sk';
  const [dialogueCapacity, setDialogueCapacity] = useState<CandidateDialogueCapacity | null>(null);
  const [isDialogueCapacityLoading, setIsDialogueCapacityLoading] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'swipe' | 'list'>(userProfile.isLoggedIn ? 'swipe' : 'list');
  const [mobileSwipeIntroDismissed, setMobileSwipeIntroDismissed] = useState(false);
  const [guestDiscoverySlide, setGuestDiscoverySlide] = useState(0);
  const [isXlViewport, setIsXlViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1280px)').matches;
  });
  const [usePersonalSetup, setUsePersonalSetup] = useState(true);
  const [pendingSearchScroll, setPendingSearchScroll] = useState(false);
  const [selectedPremiumFeature, setSelectedPremiumFeature] = useState<PremiumFeatureExplainContent | null>(null);
  const hasPremiumAccess = ['premium', 'pro', 'business'].includes(String(userProfile.subscription?.tier || 'free').toLowerCase());

  const copy = ({
    cs: {
      eyebrow: 'Hledání',
      title: 'Přehled výzev podle vaší situace',
      body: 'Nabídky, filtry podle reality a chytrý předvýběr na jednom místě.',
      toolbarSearch: 'Hledat nabídky, firmy, typy rolí nebo důležité signály',
      toolbarLocation: 'Město, region, práce na dálku',
      search: 'Hledat',
      location: 'Místo',
      laneChallenges: 'Výzvy',
      laneImports: 'Importované nabídky',
      results: 'výsledků',
      filters: 'Filtry podle reality',
      cockpitTitle: 'Chytrý předvýběr',
      cockpitBody: 'Přednastavení převádí životní situaci do praktického hledání. Výsledkem není nekonečný seznam, ale použitelný výběr.',
      firstContactTitle: 'První kontakt místo slepého CV',
      firstContactBody: 'První krok není nahrání dokumentu, ale krátká odpověď na situaci, kterou tým skutečně řeší.',
      lifeFiltersTitle: 'Filtry podle reálného života',
      lifeFiltersBody: 'Příhraničí, IČO, jazyk nabídky, dojíždění nebo kancelář vstřícná ke psům. Hledání se přizpůsobuje realitě.',
      laneBadge: lane === 'imports' ? 'Importovaný přehled' : 'Hlavní přehled',
      laneBody:
          lane === 'imports'
            ? 'Širší importovaný přehled, stále čtený přes to, co bude potřeba zvládnout.'
            : 'Vlastní role s doplněnými importy tam, kde trhu chybí podrobnější zadání.',
      personalPresets: 'Nastavení pro moji situaci',
      mySetup: 'Moje nastavení',
      mySetupBody: 'Přehled začíná rolemi, které odpovídají vašemu nastavení a aktuálním filtrům.',
      mySetupOffBody: 'Přehled teď používá jen vaše ruční filtry a hledaná slova. Osobní nastavení je pro toto hledání vypnuté.',
      useSetup: 'Používat moje nastavení',
      disableSetup: 'Hledat bez přednastavení',
      matchesNow: 'Sedí právě teď',
      setupEmpty: 'Přidejte filtry nebo preference a přehled se začne skládat podle vaší reality.',
      setupSection: 'Nejrelevantnější pro vás',
      setupSectionBody: 'Role, které nejlépe sedí vašemu oboru, cílové roli a reálným podmínkám.',
      remoteSection: 'Příbuzné role',
      remoteSectionBody: 'Blízké směry a sousední role, které stále dávají smysl pro váš profil.',
      dogSection: 'Kanceláře vstřícné ke psům',
      dogSectionBody: 'Týmy, kde kancelářský režim není v konfliktu s péčí o psa.',
      moreSection: 'Širší možnosti ve vašem směru',
      moreSectionBody: 'Širší tržní záběr po aplikaci vašich filtrů a životní situace.',
      manualSection: 'Výsledky podle vašeho hledání',
      manualSectionBody: 'Role podle zadaných slov a aktuálně zapnutých filtrů.',
      intentPromptTitle: 'Potvrďte svůj obor a cílovou roli',
      intentPromptBody: 'Máme předvyplněný odhad z profilu nebo životopisu. Stačí ho potvrdit nebo upravit a feed bude mnohem přesnější.',
      intentPromptCta: 'Upravit profil',
      remote: 'Práce z domu',
      commute: 'Dojíždění',
      commuteInactive: 'Bez adresy',
      commuteHint: 'Bez adresy zůstává výpočet dojezdu vypnutý, ale práce na dálku se pořád zobrazí správně.',
      commuteProfileCta: 'Doplnit adresu do profilu',
      commuteRegisterCta: 'Registrovat se a doplnit adresu',
      roleScope: 'Profesní záběr',
      roleScopeOn: 'Moje nastavení rozšiřuje hledání i na příbuzné role ve stejném směru.',
      roleScopeOff: 'Bez přednastavení se hledání drží hlavně vašich slov a ručních filtrů.',
      locationScope: 'Kde hledat',
      roleType: 'Typ spolupráce',
      experience: 'Zkušenost',
      remoteLanguages: 'Jazyky nabídky',
      benefits: 'Benefity',
      minSalary: 'Minimální mzda',
      date: 'Jak je nabídka čerstvá',
      saveSearches: 'Uložená hledání',
      allMarkets: 'I širší okolní trhy',
      border: 'Zahraničí',
      domestic: 'Jen domovský trh',
      remoteOnly: 'Jen práce z domu',
      allWorkModels: 'Všechny modely',
      hybridOnly: 'Hybrid',
      onsiteOnly: 'Na místě',
      locationAll: 'Vše',
      locationBorder: 'Příhraničí',
      workModelMode: 'Kde práce probíhá',
      workModelHint: 'Nejprve určete, jestli chcete jen role z domu, nebo i nabídky s kanceláří a terénem.',
      commuteMode: 'Filtrovat podle vzdálenosti od bydliště',
      commuteEnabledLabel: 'Počítat dojezd',
      commuteDisabledLabel: 'Bez filtru dojezdu',
      listingLanguageLabel: 'Jazyk nabídky:',
      listingLanguageDisableTitle: 'Vypnout automatické omezení podle jazyka nabídky',
      listingLanguageAutoDisabled: 'Omezení jazyka nabídky podle profilu je vypnuté.',
      anySalary: 'Bez minima',
      allDates: 'Kdykoliv',
      last3Days: 'Poslední 3 dny',
      last7Days: 'Poslední týden',
      last30Days: 'Poslední měsíc',
      detail: 'Otevřít detail',
      shortlist: 'Uložit si',
      shortlisted: 'Uloženo',
      sourceImported: 'Import',
      sourceNative: 'Vlastní výzva',
      fit: 'Shoda podle JHI',
      workModel: 'Způsob práce',
      emptyTitle: 'Teď nic dobře nesedí',
      emptyBody: 'Rozšiřte záběr, vypněte část filtrů nebo zkuste jiné nastavení. Přehled má vracet použitelný výběr, ne prázdno.',
      loadingTitle: 'Načítáme nabídky podle zadaných filtrů',
      loadingBody: 'Chvíli to může trvat. Připravujeme nový přehled podle vašeho hledání a aktuálního nastavení.',
      noNative: 'Vlastních výzev je zatím málo, proto se doplňují importovanými nabídkami.',
      openPreview: 'Zobrazit ukázku',
      selected: 'Vybráno',
      scoreLabel: 'Skóre shody',
      fitNote: 'Systém zvýrazní role s největší šancí, že budou opravdu dávat smysl pro vaši situaci.',
      challengeLabel: 'Co bude potřeba zvládnout',
      riskLabel: 'Na co si dát pozor',
      openCard: 'Otevřít nabídku',
      slotsTitle: 'Dialogové sloty',
      slotsBody: 'Každá odpověď otevírá omezený počet aktivních dialogů. Díky tomu se z výběru nestane nekonečný funnel bez reakce.',
      slotsEmpty: 'Po přihlášení uvidíš, kolik aktivních dialogů ti ještě zbývá.',
      slotsLoading: 'Kapacita dialogových slotů se načítá.',
      slotsUnavailable: 'Kapacitu dialogových slotů teď nebylo možné načíst.',
      slotsValue: '{{active}} / {{limit}} obsazeno',
      slotsRemaining: '{{remaining}} volných',
      slotsRemainingLabel: 'Volná kapacita',
      premiumTitle: hasPremiumAccess ? 'Premium je aktivní' : 'Co odemyká premium',
      premiumBody: hasPremiumAccess
        ? 'Máte odemčené širší rozhodovací vrstvu včetně detailnější podpory a větší kapacity pro odpovědi.'
        : 'Premium dává víc prostoru pro odpovědi, chytřejší vedení profilem a přesnější doporučení podle vaší reality.',
      premiumCta: hasPremiumAccess ? 'Spravovat premium' : 'Zobrazit premium',
      premiumBullets: [
        'Více dialogových slotů pro aktivní odpovědi',
        'AI průvodce profilem a životní situací',
        'Personalizovaný JHI index',
        'Detailní report JCFPM testu'
      ],
      mobileSwipeTitle: 'Rychlé procházení nabídek',
      mobileSwipe: 'Karty',
      mobileList: 'Seznam',
      mobileSwipeBody: 'Na mobilu můžeš nabídky hned procházet tahem doleva nebo doprava. Detail si otevřeš klepnutím na kartu.',
      mobileSwipeGuestBody: 'Pokud se zaregistruješ, ukládání a odmítnutí se ti budou pamatovat napříč relacemi.',
      mobileSwipeRegister: 'Registrovat se',
      mobileSwipeSkip: 'Raději klasický seznam'
    },
    sk: {
      eyebrow: 'Hľadanie',
      title: 'Prehľad výziev podľa vašej situácie',
      body: 'Ponuky, filtre podľa reality a múdry predvýber na jednom mieste.',
      toolbarSearch: 'Hľadať ponuky, firmy, typy rolí alebo dôležité signály',
      toolbarLocation: 'Mesto, región, práca na diaľku',
      search: 'Hľadať',
      location: 'Miesto',
      laneChallenges: 'Výzvy',
      laneImports: 'Importované ponuky',
      results: 'výsledkov',
      filters: 'Filtre podľa reality',
      cockpitTitle: 'Múdry predvýber',
      cockpitBody: 'Prednastavenia prevádzajú životnú situáciu do praktického hľadania. Výsledkom nie je nekonečný zoznam, ale použiteľný výber.',
      firstContactTitle: 'Prvý kontakt namiesto slepého CV',
      firstContactBody: 'Prvým krokom nie je nahratie dokumentu, ale krátka odpoveď na situáciu, ktorú tím skutočne rieši.',
      lifeFiltersTitle: 'Filtre podľa reálneho života',
      lifeFiltersBody: 'Pohraničie, IČO, jazyk ponuky, dochádzanie alebo kancelária priateľská k psom. Hľadanie sa prispôsobuje realite.',
      laneBadge: lane === 'imports' ? 'Importovaný prehľad' : 'Hlavný prehľad',
      laneBody: lane === 'imports' ? 'Širší importovaný prehľad, stále čítaný cez to, čo bude treba zvládnuť.' : 'Vlastné výzvy doplnené importmi tam, kde trhu chýba podrobnejšie zadanie.',
      personalPresets: 'Nastavenie pre moju situáciu',
      mySetup: 'Moje nastavenie',
      mySetupBody: 'Prehľad začína rolami, ktoré zodpovedajú vášmu nastaveniu a aktuálnym filtrom.',
      mySetupOffBody: 'Prehľad teraz používa len vaše ručné filtre a hľadané slová. Osobné nastavenie je pre toto hľadanie vypnuté.',
      useSetup: 'Používať moje nastavenie',
      disableSetup: 'Hľadať bez prednastavenia',
      matchesNow: 'Sedí práve teraz',
      setupEmpty: 'Pridajte filtre alebo preferencie a prehľad sa začne skladať podľa vašej reality.',
      setupSection: 'Najrelevantnejšie pre vás',
      setupSectionBody: 'Roly, ktoré najlepšie sedia vášmu odboru, cieľovej roli a reálnym podmienkam.',
      remoteSection: 'Príbuzné roly',
      remoteSectionBody: 'Blízke smery a susedné roly, ktoré stále dávajú zmysel pre váš profil.',
      dogSection: 'Kancelárie priateľské ku psom',
      dogSectionBody: 'Tímy, kde kancelársky režim nie je v konflikte so starostlivosťou o psa.',
      moreSection: 'Širšie možnosti vo vašom smere',
      moreSectionBody: 'Širší trhový záber po aplikovaní vašich filtrov a životnej situácie.',
      manualSection: 'Výsledky podľa vášho hľadania',
      manualSectionBody: 'Roly podľa zadaných slov a aktuálne zapnutých filtrov.',
      intentPromptTitle: 'Potvrďte svoj odbor a cieľovú rolu',
      intentPromptBody: 'Máme predvyplnený odhad z profilu alebo životopisu. Stačí ho potvrdiť alebo upraviť a feed bude presnejší.',
      intentPromptCta: 'Upraviť profil',
      remote: 'Práca z domu',
      commute: 'Dochádzanie',
      commuteInactive: 'Bez adresy',
      commuteHint: 'Bez adresy zostáva výpočet dochádzania vypnutý, ale práca na diaľku sa stále zobrazí správne.',
      commuteProfileCta: 'Doplniť adresu do profilu',
      commuteRegisterCta: 'Registrovať sa a doplniť adresu',
      roleScope: 'Profesijný záber',
      roleScopeOn: 'Moje nastavenie rozširuje hľadanie aj na príbuzné roly v rovnakom smere.',
      roleScopeOff: 'Bez prednastavenia sa hľadanie drží hlavne vašich slov a ručných filtrov.',
      locationScope: 'Kde hľadať',
      roleType: 'Typ spolupráce',
      experience: 'Skúsenosť',
      remoteLanguages: 'Jazyky ponuky',
      benefits: 'Benefity',
      minSalary: 'Minimálna mzda',
      date: 'Ako je ponuka čerstvá',
      saveSearches: 'Uložené hľadania',
      allMarkets: 'Aj širšie okolité trhy',
      border: 'Zahraničie',
      domestic: 'Len domáci trh',
      remoteOnly: 'Len práca z domu',
      allWorkModels: 'Všetky modely',
      hybridOnly: 'Hybrid',
      onsiteOnly: 'Na mieste',
      locationAll: 'Všetko',
      locationBorder: 'Prihraničie',
      workModelMode: 'Kde práca prebieha',
      workModelHint: 'Najprv určite, či chcete len roly z domu alebo aj ponuky s kanceláriou a terénom.',
      commuteMode: 'Filtrovať podľa vzdialenosti od bydliska',
      commuteEnabledLabel: 'Počítať dochádzanie',
      commuteDisabledLabel: 'Bez filtra dochádzania',
      listingLanguageLabel: 'Jazyk ponuky:',
      listingLanguageDisableTitle: 'Vypnúť automatické obmedzenie podľa jazyka ponuky',
      listingLanguageAutoDisabled: 'Obmedzenie jazyka ponuky podľa profilu je vypnuté.',
      anySalary: 'Bez minima',
      allDates: 'Kedykoľvek',
      last3Days: 'Posledné 3 dni',
      last7Days: 'Posledný týždeň',
      last30Days: 'Posledný mesiac',
      detail: 'Otvoriť detail',
      shortlist: 'Uložiť si',
      shortlisted: 'Uložené',
      sourceImported: 'Import',
      sourceNative: 'Vlastná výzva',
      fit: 'Zhoda podľa JHI',
      workModel: 'Spôsob práce',
      emptyTitle: 'Teraz nič dobre nesedí',
      emptyBody: 'Rozšír záber, vypni časť filtrov alebo skús iné nastavenie. Prehľad má vracať použiteľný výber, nie prázdno.',
      loadingTitle: 'Načítavame ponuky podľa zadaných filtrov',
      loadingBody: 'Chvíľu to môže trvať. Pripravujeme nový prehľad podľa vášho hľadania a aktuálneho nastavenia.',
      noNative: 'Vlastných výziev je zatiaľ málo, preto sa dopĺňajú importovanými ponukami.',
      openPreview: 'Zobraziť ukážku',
      selected: 'Vybrané',
      scoreLabel: 'Skóre zhody',
      fitNote: 'Systém zvýrazní roly s najväčšou šancou, že budú naozaj dávať zmysel.',
      challengeLabel: 'Čo bude treba zvládnuť',
      riskLabel: 'Na čo si dať pozor',
      openCard: 'Otvoriť ponuku',
      slotsTitle: 'Dialógové sloty',
      slotsBody: 'Každá odpoveď otvára obmedzený počet aktívnych dialógov. Vďaka tomu sa z výberu nestane nekonečný funnel bez reakcie.',
      slotsEmpty: 'Po prihlásení uvidíš, koľko aktívnych dialógov ti ešte zostáva.',
      slotsLoading: 'Kapacita dialógových slotov sa načítava.',
      slotsUnavailable: 'Kapacitu dialógových slotov sa teraz nepodarilo načítať.',
      slotsValue: '{{active}} / {{limit}} obsadené',
      slotsRemaining: '{{remaining}} voľných',
      slotsRemainingLabel: 'Voľná kapacita',
      premiumTitle: hasPremiumAccess ? 'Premium je aktívne' : 'Čo odomyká premium',
      premiumBody: hasPremiumAccess
        ? 'Máte odomknutú silnejšiu rozhodovaciu vrstvu vrátane detailnejšej podpory a väčšej kapacity pre odpovede.'
        : 'Premium dáva viac priestoru na odpovede, múdrejšie vedenie profilom a presnejšie odporúčania podľa vašej reality.',
      premiumCta: hasPremiumAccess ? 'Spravovať premium' : 'Zobraziť premium',
      premiumBullets: [
        'Viac dialógových slotov pre aktívne odpovede',
        'AI sprievodca profilom a životnou situáciou',
        'Personalizovaný JHI index',
        'Detailný report JCFPM testu'
      ],
      mobileSwipeTitle: 'Rýchle prechádzanie ponúk',
      mobileSwipe: 'Karty',
      mobileList: 'Zoznam',
      mobileSwipeBody: 'Na mobile môžeš ponuky hneď prechádzať ťahom doľava alebo doprava. Detail otvoríš klepnutím na kartu.',
      mobileSwipeGuestBody: 'Ak sa zaregistruješ, uloženia a odmietnutia sa ti budú pamätať naprieč reláciami.',
      mobileSwipeRegister: 'Registrovať sa',
      mobileSwipeSkip: 'Radšej klasický zoznam'
    },
    de: {
      eyebrow: 'Suche',
      title: 'Aufgaben passend zu deiner Situation',
      body: 'Rollen, alltagsnahe Filter und eine klügere Vorauswahl an einem Ort.',
      toolbarSearch: 'Rollen, Firmen, Arbeitsmodelle oder wichtige Signale suchen',
      toolbarLocation: 'Stadt, Region, Remote',
      search: 'Suchen',
      location: 'Ort',
      laneChallenges: 'Aufgaben',
      laneImports: 'Importierte Rollen',
      results: 'Ergebnisse',
      filters: 'Filter für den Alltag',
      cockpitTitle: 'Kluge Vorauswahl',
      cockpitBody: 'Voreinstellungen übersetzen deine Lebenssituation in eine praktische Suche. Das Ergebnis ist kein endloser Feed, sondern eine brauchbare Auswahl.',
      firstContactTitle: 'Erstkontakt statt blindem CV',
      firstContactBody: 'Der erste Schritt ist nicht das Hochladen eines Dokuments, sondern eine kurze Antwort auf eine echte Situation des Teams.',
      lifeFiltersTitle: 'Filter nach echtem Alltag',
      lifeFiltersBody: 'Grenzregion, IČO, Sprache der Anzeige, Pendeln oder hundefreundliches Büro. Die Suche richtet sich nach der Realität.',
      laneBadge: lane === 'imports' ? 'Importierte Rollen' : 'Eigene Aufgaben',
      laneBody: lane === 'imports' ? 'Breiter importierter Überblick, weiterhin gelesen über die eigentliche Aufgabe.' : 'Eigene Aufgaben mit importierten Ergänzungen dort, wo dem Markt klare Aufgabenbeschreibungen fehlen.',
      personalPresets: 'Einstellungen für meine Situation',
      mySetup: 'Meine Einstellungen',
      mySetupBody: 'Die Übersicht beginnt mit Rollen, die zu deinen Einstellungen und aktuellen Filtern passen.',
      mySetupOffBody: 'Die Übersicht nutzt jetzt nur Ihre manuellen Filter und Suchbegriffe. Persönliche Voreinstellungen sind für diese Suche ausgeschaltet.',
      useSetup: 'Meine Einstellungen nutzen',
      disableSetup: 'Ohne Voreinstellungen suchen',
      matchesNow: 'Passt gerade',
      setupEmpty: 'Füge Filter oder Präferenzen hinzu, dann richtet sich die Übersicht nach deiner Realität aus.',
      setupSection: 'Am relevantesten für Sie',
      setupSectionBody: 'Rollen, die am besten zu Ihrem Bereich, Ihrer Zielrolle und Ihrer Realität passen.',
      remoteSection: 'Verwandte Rollen',
      remoteSectionBody: 'Nahe Richtungen und benachbarte Rollen, die weiterhin zu Ihrem Profil passen.',
      dogSection: 'Hundefreundliche Büros',
      dogSectionBody: 'Teams, bei denen Büroarbeit nicht im Konflikt mit Hundebetreuung steht.',
      moreSection: 'Breiterer Markt in Ihrer Richtung',
      moreSectionBody: 'Breiterer Marktüberblick nach Anwendung Ihrer Filter und Alltagsbedingungen.',
      manualSection: 'Ergebnisse für Ihre Suche',
      manualSectionBody: 'Rollen passend zu Ihren Suchbegriffen und aktuell aktiven Filtern.',
      intentPromptTitle: 'Bereich und Zielrolle bestätigen',
      intentPromptBody: 'Wir haben aus Profil oder Lebenslauf eine erste Richtung abgeleitet. Bestätigen oder korrigieren Sie sie für einen besseren Feed.',
      intentPromptCta: 'Profil öffnen',
      remote: 'Homeoffice',
      commute: 'Pendeln',
      commuteInactive: 'Ohne Adresse',
      commuteHint: 'Ohne Adresse bleibt die Pendelberechnung aus, Remote-Rollen werden aber weiterhin korrekt angezeigt.',
      commuteProfileCta: 'Adresse im Profil ergänzen',
      commuteRegisterCta: 'Registrieren und Adresse ergänzen',
      roleScope: 'Beruflicher Fokus',
      roleScopeOn: 'Meine Einstellungen erweitern die Suche auch auf verwandte Rollen in derselben Richtung.',
      roleScopeOff: 'Ohne Voreinstellungen bleibt die Suche vor allem bei Ihren Begriffen und manuellen Filtern.',
      locationScope: 'Wo suchen',
      roleType: 'Arbeitsform',
      experience: 'Erfahrung',
      remoteLanguages: 'Sprache der Anzeige',
      benefits: 'Benefits',
      minSalary: 'Mindestgehalt',
      date: 'Aktualität',
      saveSearches: 'Gespeicherte Suchen',
      allMarkets: 'Auch umliegende Märkte',
      border: 'Ausland',
      domestic: 'Nur Heimatmarkt',
      remoteOnly: 'Nur Homeoffice',
      allWorkModels: 'Alle Modelle',
      hybridOnly: 'Hybrid',
      onsiteOnly: 'Vor Ort',
      locationAll: 'Alles',
      locationBorder: 'Grenzregion',
      workModelMode: 'Wo die Arbeit stattfindet',
      workModelHint: 'Legen Sie zuerst fest, ob Sie nur Homeoffice-Rollen oder auch Angebote mit Büro und Außendienst sehen möchten.',
      commuteMode: 'Nach Entfernung vom Wohnort filtern',
      commuteEnabledLabel: 'Pendeln einbeziehen',
      commuteDisabledLabel: 'Ohne Pendelfilter',
      listingLanguageLabel: 'Anzeigesprache:',
      listingLanguageDisableTitle: 'Automatische Einschränkung nach Anzeigesprache deaktivieren',
      listingLanguageAutoDisabled: 'Die Einschränkung der Anzeigesprache anhand Ihres Profils ist deaktiviert.',
      anySalary: 'Kein Minimum',
      allDates: 'Jederzeit',
      last3Days: 'Letzte 3 Tage',
      last7Days: 'Letzte Woche',
      last30Days: 'Letzter Monat',
      detail: 'Detail öffnen',
      shortlist: 'Merken',
      shortlisted: 'Gemerkt',
      sourceImported: 'Importiert',
      sourceNative: 'Eigene Aufgabe',
      fit: 'JHI-Passung',
      workModel: 'Arbeitsweise',
      emptyTitle: 'Im Moment passt nichts richtig',
      emptyBody: 'Erweitere den Fokus, schalte Filter ab oder probiere andere Einstellungen. Die Übersicht soll brauchbare Auswahl liefern, nicht Leere.',
      loadingTitle: 'Passende Rollen werden geladen',
      loadingBody: 'Das kann einen Moment dauern. Die Übersicht wird gerade nach Ihren Filtern und Ihrer Suche aktualisiert.',
      noNative: 'Es gibt noch wenige eigene Aufgaben, deshalb wird mit importierten Rollen ergänzt.',
      openPreview: 'Vorschau öffnen',
      selected: 'Ausgewählt',
      scoreLabel: 'Passungswert',
      fitNote: 'Das System hebt die Rollen hervor, die am wahrscheinlichsten wirklich passen.',
      challengeLabel: 'Was gelöst werden soll',
      riskLabel: 'Worauf man achten sollte',
      openCard: 'Rolle öffnen',
      slotsTitle: 'Dialog-Slots',
      slotsBody: 'Jede Antwort öffnet nur eine begrenzte Zahl aktiver Dialoge. So wird die Auswahl nicht zu einem endlosen Funnel ohne Rückmeldung.',
      slotsEmpty: 'Nach dem Anmelden siehst du, wie viele aktive Dialoge dir noch bleiben.',
      slotsLoading: 'Die Slot-Kapazität wird geladen.',
      slotsUnavailable: 'Die Slot-Kapazität konnte gerade nicht geladen werden.',
      slotsValue: '{{active}} / {{limit}} belegt',
      slotsRemaining: '{{remaining}} frei',
      slotsRemainingLabel: 'Freie Kapazität',
      premiumTitle: hasPremiumAccess ? 'Premium ist aktiv' : 'Was Premium freischaltet',
      premiumBody: hasPremiumAccess
        ? 'Die erweiterte Entscheidungsebene ist aktiv, mit mehr Unterstützung und mehr Raum für laufende Antworten.'
        : 'Premium gibt mehr Raum für Antworten, bessere Profilführung und präzisere Empfehlungen passend zu deiner Realität.',
      premiumCta: hasPremiumAccess ? 'Premium verwalten' : 'Premium ansehen',
      premiumBullets: [
        'Mehr Dialog-Slots für aktive Antworten',
        'KI-Begleitung für Profil und Lebenssituation',
        'Personalisierter JHI-Index',
        'Detaillierter JCFPM-Bericht'
      ],
      mobileSwipeTitle: 'Schnelles Durchgehen von Rollen',
      mobileSwipe: 'Karten',
      mobileList: 'Liste',
      mobileSwipeBody: 'Auf dem Handy kannst du Rollen sofort per Wischen nach links oder rechts durchgehen. Per Tipp öffnest du das Detail.',
      mobileSwipeGuestBody: 'Wenn du dich registrierst, bleiben gespeicherte und abgelehnte Rollen zwischen Sitzungen erhalten.',
      mobileSwipeRegister: 'Registrieren',
      mobileSwipeSkip: 'Lieber klassische Liste'
    },
    at: {} as any,
    pl: {
      eyebrow: 'Wyszukiwanie',
      title: 'Oferty dopasowane do twojej sytuacji',
      body: 'Role, filtry oparte na realnym życiu i mądrzejszy wstępny wybór w jednym miejscu.',
      toolbarSearch: 'Szukaj ofert, firm, typów pracy lub ważnych sygnałów',
      toolbarLocation: 'Miasto, region, zdalnie',
      search: 'Szukaj',
      location: 'Miejsce',
      laneChallenges: 'Wyzwania',
      laneImports: 'Importowane oferty',
      results: 'wyników',
      filters: 'Filtry dopasowane do życia',
      cockpitTitle: 'Mądry wstępny wybór',
      cockpitBody: 'Ustawienia zamieniają twoją sytuację życiową w praktyczne wyszukiwanie. Efektem nie jest nieskończona lista, ale użyteczny wybór.',
      firstContactTitle: 'Pierwszy kontakt zamiast ślepego CV',
      firstContactBody: 'Pierwszym krokiem nie jest wrzucenie dokumentu, ale krótka odpowiedź na sytuację, którą zespół naprawdę rozwiązuje.',
      lifeFiltersTitle: 'Filtry według realnego życia',
      lifeFiltersBody: 'Pogranicze, IČO, język ogłoszenia, dojazd albo biuro przyjazne psom. Wyszukiwanie dopasowuje się do rzeczywistości.',
      laneBadge: lane === 'imports' ? 'Importowane oferty' : 'Własne wyzwania',
      laneBody: lane === 'imports' ? 'Szerszy importowany przegląd, nadal czytany przez pryzmat tego, co naprawdę trzeba ogarnąć.' : 'Własne wyzwania uzupełnione importami tam, gdzie brakuje dokładniejszego opisu pracy.',
      personalPresets: 'Ustawienia dla mojej sytuacji',
      mySetup: 'Moje ustawienia',
      mySetupBody: 'Przegląd zaczyna się od ról, które pasują do twoich ustawień i bieżących filtrów.',
      mySetupOffBody: 'Przegląd korzysta teraz tylko z twoich ręcznych filtrów i wpisanych słów. Osobiste ustawienia są wyłączone dla tego wyszukiwania.',
      useSetup: 'Używaj moich ustawień',
      disableSetup: 'Szukaj bez ustawień',
      matchesNow: 'Pasuje teraz',
      setupEmpty: 'Dodaj filtry lub preferencje, a przegląd zacznie układać się pod twoją rzeczywistość.',
      setupSection: 'Najbardziej trafne dla ciebie',
      setupSectionBody: 'Role najlepiej dopasowane do twojej branży, docelowej roli i realnej sytuacji.',
      remoteSection: 'Role pokrewne',
      remoteSectionBody: 'Pokrewne kierunki i sąsiednie role, które nadal mają sens dla twojego profilu.',
      dogSection: 'Biura przyjazne psom',
      dogSectionBody: 'Zespoły, w których tryb biurowy nie koliduje z opieką nad psem.',
      moreSection: 'Szerszy rynek w twoim kierunku',
      moreSectionBody: 'Szerszy przegląd rynku po zastosowaniu filtrów i twojej sytuacji życiowej.',
      manualSection: 'Wyniki według twojego wyszukiwania',
      manualSectionBody: 'Role zgodne z wpisanymi słowami i aktualnie włączonymi filtrami.',
      intentPromptTitle: 'Potwierdź branżę i docelową rolę',
      intentPromptBody: 'Mamy wstępną sugestię z profilu lub CV. Wystarczy ją potwierdzić albo poprawić, żeby feed był trafniejszy.',
      intentPromptCta: 'Edytuj profil',
      remote: 'Praca z domu',
      commute: 'Dojazd',
      commuteInactive: 'Bez adresu',
      commuteHint: 'Bez adresu wyliczenie dojazdu pozostaje wyłączone, ale role zdalne nadal pokazują się poprawnie.',
      commuteProfileCta: 'Uzupełnij adres w profilu',
      commuteRegisterCta: 'Zarejestruj się i uzupełnij adres',
      roleScope: 'Zakres roli',
      roleScopeOn: 'Moje ustawienia rozszerzają wyszukiwanie także na role pokrewne w tym samym kierunku.',
      roleScopeOff: 'Bez ustawień wyszukiwanie trzyma się głównie twoich słów i ręcznych filtrów.',
      locationScope: 'Gdzie szukać',
      roleType: 'Forma współpracy',
      experience: 'Doświadczenie',
      remoteLanguages: 'Języki ogłoszenia',
      benefits: 'Benefity',
      minSalary: 'Minimalne wynagrodzenie',
      date: 'Aktualność',
      saveSearches: 'Zapisane wyszukiwania',
      allMarkets: 'Także pobliskie rynki',
      border: 'Zagranica',
      domestic: 'Tylko kraj',
      remoteOnly: 'Tylko praca z domu',
      allWorkModels: 'Wszystkie modele',
      hybridOnly: 'Hybryda',
      onsiteOnly: 'Na miejscu',
      locationAll: 'Wszystko',
      locationBorder: 'Pogranicze',
      workModelMode: 'Gdzie odbywa się praca',
      workModelHint: 'Najpierw określ, czy chcesz tylko role zdalne, czy także oferty z biurem i pracą w terenie.',
      commuteMode: 'Filtruj według odległości od domu',
      commuteEnabledLabel: 'Licz dojazd',
      commuteDisabledLabel: 'Bez filtra dojazdu',
      listingLanguageLabel: 'Język ogłoszenia:',
      listingLanguageDisableTitle: 'Wyłącz automatyczne zawężanie według języka ogłoszenia',
      listingLanguageAutoDisabled: 'Zawężanie języka ogłoszenia na podstawie profilu jest wyłączone.',
      anySalary: 'Bez minimum',
      allDates: 'Dowolnie',
      last3Days: 'Ostatnie 3 dni',
      last7Days: 'Ostatni tydzień',
      last30Days: 'Ostatni miesiąc',
      detail: 'Otwórz szczegóły',
      shortlist: 'Zapisz',
      shortlisted: 'Zapisane',
      sourceImported: 'Import',
      sourceNative: 'Własne wyzwanie',
      fit: 'Dopasowanie JHI',
      workModel: 'Sposób pracy',
      emptyTitle: 'Na razie nic dobrze nie pasuje',
      emptyBody: 'Poszerz zakres, wyłącz część filtrów albo spróbuj innych ustawień. Ta lista ma dawać użyteczny wybór, nie pustkę.',
      loadingTitle: 'Ładowanie ofert według filtrów',
      loadingBody: 'To może chwilę potrwać. Przygotowujemy nowy widok zgodny z twoim wyszukiwaniem i bieżącymi ustawieniami.',
      noNative: 'Własnych wyzwań jest jeszcze mało, dlatego lista uzupełnia się importowanymi ofertami.',
      openPreview: 'Pokaż podgląd',
      selected: 'Wybrane',
      scoreLabel: 'Wynik dopasowania',
      fitNote: 'System podświetla role z największą szansą, że naprawdę będą miały sens.',
      challengeLabel: 'Co trzeba ogarnąć',
      riskLabel: 'Na co uważać',
      openCard: 'Otwórz ofertę',
      slotsTitle: 'Sloty rozmów',
      slotsBody: 'Każda odpowiedź otwiera ograniczoną liczbę aktywnych rozmów. Dzięki temu proces nie zamienia się w nieskończony lejek bez reakcji.',
      slotsEmpty: 'Po zalogowaniu zobaczysz, ile aktywnych rozmów jeszcze ci zostało.',
      slotsLoading: 'Ładowanie pojemności slotów rozmów.',
      slotsUnavailable: 'Nie udało się teraz wczytać pojemności slotów rozmów.',
      slotsValue: '{{active}} / {{limit}} zajęte',
      slotsRemaining: '{{remaining}} wolnych',
      slotsRemainingLabel: 'Wolna pojemność',
      premiumTitle: hasPremiumAccess ? 'Premium jest aktywne' : 'Co odblokowuje premium',
      premiumBody: hasPremiumAccess
        ? 'Masz aktywną rozszerzoną warstwę decyzji z większym wsparciem i większą pojemnością na odpowiedzi.'
        : 'Premium daje więcej miejsca na odpowiedzi, mądrzejsze prowadzenie profilu i trafniejsze rekomendacje względem twojej sytuacji.',
      premiumCta: hasPremiumAccess ? 'Zarządzaj premium' : 'Pokaż premium',
      premiumBullets: [
        'Więcej slotów rozmów dla aktywnych odpowiedzi',
        'Przewodnik AI dla profilu i sytuacji życiowej',
        'Spersonalizowany indeks JHI',
        'Szczegółowy raport JCFPM'
      ],
      mobileSwipeTitle: 'Szybkie przeglądanie ofert',
      mobileSwipe: 'Karty',
      mobileList: 'Lista',
      mobileSwipeBody: 'Na telefonie możesz od razu przeglądać oferty przesunięciem w lewo albo w prawo. Dotknięcie karty otwiera szczegóły.',
      mobileSwipeGuestBody: 'Jeśli się zarejestrujesz, zapisane i odrzucone oferty będą pamiętane między sesjami.',
      mobileSwipeRegister: 'Zarejestruj się',
      mobileSwipeSkip: 'Wolę klasyczną listę'
    },
    en: {
        eyebrow: 'Discovery cockpit',
        title: 'Challenge marketplace built around your life',
        body: 'Challenges, reality filters, and a decision engine in one clean workspace.',
        toolbarSearch: 'Search challenges, teams, role types, or signal words',
        toolbarLocation: 'City, region, remote',
        search: 'Search',
        location: 'Location',
        laneChallenges: 'Challenge marketplace',
        laneImports: 'Imported listings',
        results: 'results',
        filters: 'Reality filters',
        cockpitTitle: 'Decision engine',
        cockpitBody: 'Presets translate real life into filterable scenarios. The output is not just a feed, but a shortlist with the highest chance of actual fit.',
        firstContactTitle: 'First contact instead of a blind CV',
        firstContactBody: 'The first step is not uploading a document, but a short reply to a situation the team is actually dealing with.',
        lifeFiltersTitle: 'Filters shaped by real life',
        lifeFiltersBody: 'Cross-border search, contractor roles, listing language, commute, or dog-friendly offices. Search adapts to real constraints.',
        laneBadge: lane === 'imports' ? 'Imported view' : 'Main view',
        laneBody:
          lane === 'imports'
            ? 'A broader imported feed, still rendered challenge-first.'
            : 'The native challenge lane with imported fallback whenever the market lacks native challenges.',
        personalPresets: 'Presets for my situation',
        mySetup: 'My setup',
        mySetupBody: 'The feed starts with roles that match your setup and current filters.',
        mySetupOffBody: 'The feed now uses only your manual filters and search terms. Personal setup is disabled for this search.',
        useSetup: 'Use my setup',
        disableSetup: 'Search without setup',
        matchesNow: 'Matching now',
        setupEmpty: 'Add filters or preferences and the feed will start shaping around your reality.',
        setupSection: 'Most relevant for you',
        setupSectionBody: 'Roles that best match your domain, target role, and real-life constraints.',
        remoteSection: 'Adjacent roles',
        remoteSectionBody: 'Close role families and neighboring domains that still make sense for your profile.',
        dogSection: 'Dog-friendly offices',
        dogSectionBody: 'Office-based roles that still work with dog care in real life.',
        moreSection: 'Broader market in your direction',
        moreSectionBody: 'A wider market view after applying your filters and life context.',
        manualSection: 'Results for your search',
        manualSectionBody: 'Roles based on your search terms and currently active filters.',
        intentPromptTitle: 'Confirm your domain and target role',
        intentPromptBody: 'We have a first suggestion from your profile or CV. Confirm or adjust it and the feed will get much sharper.',
        intentPromptCta: 'Open profile',
        remote: 'Home office',
        commute: 'Commute',
        commuteInactive: 'No address yet',
        commuteHint: 'Without an address commute heuristics stay off, but remote roles still render correctly.',
        commuteProfileCta: 'Add address to profile',
        commuteRegisterCta: 'Register and add address',
        roleScope: 'Role scope',
        roleScopeOn: 'My setup also broadens the search to adjacent roles in the same direction.',
        roleScopeOff: 'Without setup, search stays close to your query and manual filters.',
        locationScope: 'Where to search',
        roleType: 'Role type',
        experience: 'Experience',
        remoteLanguages: 'Listing languages',
        benefits: 'Benefits',
        minSalary: 'Minimum salary',
        date: 'Freshness',
        saveSearches: 'Saved searches',
        allMarkets: 'Nearby markets too',
        border: 'Abroad',
        domestic: 'Home market only',
        remoteOnly: 'Home office only',
        allWorkModels: 'All work models',
        hybridOnly: 'Hybrid',
        onsiteOnly: 'On-site',
        locationAll: 'All',
        locationBorder: 'Border region',
        workModelMode: 'Where the work happens',
        workModelHint: 'First decide whether you want only home office roles or also roles with office or field work.',
        commuteMode: 'Filter by distance from home',
        commuteEnabledLabel: 'Use commute distance',
        commuteDisabledLabel: 'No commute filter',
        listingLanguageLabel: 'Listing language:',
        listingLanguageDisableTitle: 'Disable automatic narrowing by listing language',
        listingLanguageAutoDisabled: 'Listing language narrowing based on your profile is disabled.',
        anySalary: 'No minimum',
        allDates: 'Any time',
        last3Days: 'Last 3 days',
        last7Days: 'Last week',
        last30Days: 'Last month',
        detail: 'Open detail',
        shortlist: 'Save to shortlist',
        shortlisted: 'Shortlisted',
        sourceImported: 'Imported',
        sourceNative: 'Challenge',
        fit: 'JHI fit',
        workModel: 'Work model',
        emptyTitle: 'Nothing matches the current reality yet',
        emptyBody: 'Broaden the scope, disable some filters, or switch presets. The marketplace should return a realistic shortlist, not noise.',
        loadingTitle: 'Loading roles for your current filters',
        loadingBody: 'This can take a moment. We are refreshing the feed around your search and active setup.',
        noNative: 'There are no native challenges yet, so the marketplace currently uses imported fallback roles.',
        openPreview: 'Open challenge preview',
        selected: 'Selected',
        scoreLabel: 'Decision score',
        fitNote: 'The decision engine preselects roles with the strongest fit signal.',
        challengeLabel: 'Challenge',
        riskLabel: 'Risk',
        openCard: 'Open challenge',
        slotsTitle: 'Dialogue slots',
        slotsBody: 'Each reply opens a limited number of active dialogues, so the process does not turn into an endless funnel with no response.',
        slotsEmpty: 'After signing in, you will see how many active dialogues you still have left.',
        slotsLoading: 'Dialogue slot capacity is loading.',
        slotsUnavailable: 'Dialogue slot capacity could not be loaded right now.',
        slotsValue: '{{active}} / {{limit}} in use',
        slotsRemaining: '{{remaining}} left',
        slotsRemainingLabel: 'Open capacity',
        premiumTitle: hasPremiumAccess ? 'Premium is active' : 'What premium unlocks',
        premiumBody: hasPremiumAccess
          ? 'Your stronger decision layer is active, including deeper support and more room for active replies.'
          : 'Premium adds more room for replies, a smarter life-context guide, and sharper prioritization around your own reality.',
        premiumCta: hasPremiumAccess ? 'Manage premium' : 'See premium',
        premiumBullets: [
          'More dialogue slots for active replies',
          'AI guide for profile and life context',
          'Personalized JHI score',
          'Detailed JCFPM report'
        ],
        mobileSwipeTitle: 'Fast role browsing',
        mobileSwipe: 'Cards',
        mobileList: 'List',
        mobileSwipeBody: 'On mobile you can start browsing roles immediately by swiping left or right. Tap the card to open details.',
        mobileSwipeGuestBody: 'If you register, saved and rejected roles can persist across sessions.',
        mobileSwipeRegister: 'Register',
        mobileSwipeSkip: 'Prefer classic list'
      }
  } as const)[language === 'at' ? 'de' : language];

  const microJobDiscoveryCopy = {
    heroEyebrow: getLocaleLabel({
      cs: 'Mini výzvy',
      sk: 'Mini výzvy',
      de: 'Mini-Aufgaben',
      at: 'Mini-Aufgaben',
      pl: 'Mini wyzwania',
      en: 'Mini challenges'
    }, language),
    heroTitle: getLocaleLabel({
      cs: 'Krátké spolupráce a rychlé výpomoci',
      sk: 'Krátke spolupráce a rýchle výpomoci',
      de: 'Kurze Zusammenarbeit und schnelle Einsätze',
      at: 'Kurze Zusammenarbeit und schnelle Einsätze',
      pl: 'Krótkie współpráce i szybkie projekty',
      en: 'Short collaborations and fast-turn projects'
    }, language),
    heroBody: getLocaleLabel({
      cs: 'Jednorázové tasky, krátké projekty, audity a prototypy s jasným časem, rozpočtem a způsobem spolupráce.',
      sk: 'Jednorazové tasky, krátke projekty, audity a prototypy s jasným časom, rozpočtom a spôsobom spolupráce.',
      de: 'Einmalige Tasks, kurze Projekte, Audits und Prototypen mit klarem Zeitrahmen, Budget und Arbeitsmodus.',
      at: 'Einmalige Tasks, kurze Projekte, Audits und Prototypen mit klarem Zeitrahmen, Budget und Arbeitsmodus.',
      pl: 'Jednorazowe zadania, krótkie projekty, audyty i prototypy z jasnym czasem, budżetem i trybem współpracy.',
      en: 'One-off tasks, short projects, audits, and prototypes with clear time, budget, and collaboration mode.'
    }, language),
    laneBadge: getLocaleLabel({
      cs: 'Přehled mini výzev',
      sk: 'Prehľad mini výziev',
      de: 'Mini-Aufgaben-Feed',
      at: 'Mini-Aufgaben-Feed',
      pl: 'Przegląd mini wyzwań',
      en: 'Mini challenge feed'
    }, language),
    laneTitle: getLocaleLabel({
      cs: 'Mini výzvy',
      sk: 'Mini výzvy',
      de: 'Mini-Aufgaben',
      at: 'Mini-Aufgaben',
      pl: 'Mini wyzwania',
      en: 'Mini challenges'
    }, language),
    laneBody: getLocaleLabel({
      cs: 'Rychlé spolupráce s menším závazkem. Vidíte jen role s krátkým rozsahem, rozpočtem a jasným výstupem.',
      sk: 'Rýchle spolupráce s menším záväzkom. Vidíte len roly s krátkym rozsahom, rozpočtom a jasným výstupom.',
      de: 'Schnelle Zusammenarbeit mit kleinerem Commitment. Sie sehen nur Rollen mit klarem Umfang, Budget und Output.',
      at: 'Schnelle Zusammenarbeit mit kleinerem Commitment. Sie sehen nur Rollen mit klarem Umfang, Budget und Output.',
      pl: 'Szybka współpraca z mniejszym zobowiązaniem. Widać tu tylko role z krótkim zakresem, budżetem i jasnym efektem.',
      en: 'Fast-turn collaboration with lighter commitment. This view shows only roles with short scope, budget, and a clear outcome.'
    }, language),
    laneReadMode: getLocaleLabel({
      cs: 'Krátká spolupráce, ne klasický full-time nábor',
      sk: 'Krátka spolupráca, nie klasický full-time nábor',
      de: 'Kurzprojekt statt klassischem Fulltime-Hiring',
      at: 'Kurzprojekt statt klassischem Fulltime-Hiring',
      pl: 'Krótka współpraca, nie klasyczny rekrutacyjny etat',
      en: 'Short collaboration, not classic full-time hiring'
    }, language),
  };

  const guestOnboardingContent = ({
    cs: {
      readFeed: 'Jak ten feed číst',
      back: 'Zpět',
      next: 'Další',
      showSlide: 'Zobrazit slide',
      slides: [
        {
          icon: ShieldCheck,
          kicker: 'Dialogové sloty',
          title: 'Sloty drží odpovědi v reálné kapacitě',
          body: 'Každý aktivní dialog zabírá slot. Díky tomu nejde o nekonečné rozesílání reakcí bez návratu, ale o řízený počet otevřených konverzací.',
          detail: 'Po přihlášení uvidíš, kolik slotů máš volných, kolik už běží a kdy má smysl otevřít další kontakt.',
          chips: ['omezená kapacita', 'lepší follow-up', 'méně slepých reakcí'],
        },
        {
          icon: Sparkles,
          kicker: 'JHI a finance',
          title: 'JHI a finanční kalkulačka dávají výsledkům kontext',
          body: 'JHI pomáhá řadit role podle toho, co ti sedí profesně i lidsky. Finanční kalkulačka dopočítá, co nabídka znamená v čistém dopadu na rozpočet a dojíždění.',
          detail: 'Nejde jen o titul pozice. Systém skládá dohromady fit, peníze, režim práce a praktický dopad na každodenní život.',
          chips: ['prioritizace', 'čistý dopad', 'lepší rozhodování'],
        },
        {
          icon: SlidersHorizontal,
          kicker: 'Životní situace',
          title: 'Nejen hledání, ale nastavení reality kolem práce',
          body: 'Do výběru vstupuje životní situace: dojíždění, hranice, jazyk, režim práce, rodinná logistika nebo ochota měnit tempo a typ úvazku.',
          detail: 'Proto feed není jen fulltext nad tabulkou nabídek. Je to filtr nad tím, co je pro tebe opravdu průchozí právě teď.',
          chips: ['dojíždění', 'jazyk', 'tempo života'],
        },
        {
          icon: ArrowRight,
          kicker: 'Handshake',
          title: 'První kontakt probíhá jako dialog, ne slepé CV',
          body: 'Místo okamžitého posílání životopisu začíná kontakt krátkou odpovědí na konkrétní situaci nebo výzvu. Tým tak hned vidí způsob uvažování a motivaci.',
          detail: 'Handshake pomáhá odlišit relevantní kandidáty od masových reakcí a dává oběma stranám lepší první signál, jestli má smysl pokračovat.',
          chips: ['první odpověď', 'lepší signál', 'méně šumu'],
        },
      ],
    },
    sk: {
      readFeed: 'Ako čítať tento feed',
      back: 'Späť',
      next: 'Ďalej',
      showSlide: 'Zobraziť slide',
      slides: [
        {
          icon: ShieldCheck,
          kicker: 'Dialógové sloty',
          title: 'Sloty držia odpovede v reálnej kapacite',
          body: 'Každý aktívny dialóg zaberá slot. Vďaka tomu nejde o nekonečné rozosielanie reakcií bez návratu, ale o riadený počet otvorených konverzácií.',
          detail: 'Po prihlásení uvidíš, koľko slotov máš voľných, koľko ich už beží a kedy má zmysel otvoriť ďalší kontakt.',
          chips: ['obmedzená kapacita', 'lepší follow-up', 'menej slepých reakcií'],
        },
        {
          icon: Sparkles,
          kicker: 'JHI a financie',
          title: 'JHI a finančná kalkulačka dávajú výsledkom kontext',
          body: 'JHI pomáha radiť roly podľa toho, čo ti sedí profesijne aj ľudsky. Finančná kalkulačka dopočíta, čo ponuka znamená v čistom dopade na rozpočet a dochádzanie.',
          detail: 'Nejde len o názov pozície. Systém skladá dohromady fit, peniaze, režim práce a praktický dopad na každodenný život.',
          chips: ['prioritizácia', 'čistý dopad', 'lepšie rozhodovanie'],
        },
        {
          icon: SlidersHorizontal,
          kicker: 'Životná situácia',
          title: 'Nielen hľadanie, ale nastavenie reality okolo práce',
          body: 'Do výberu vstupuje životná situácia: dochádzanie, hranice, jazyk, režim práce, rodinná logistika alebo ochota meniť tempo a typ úväzku.',
          detail: 'Preto feed nie je len fulltext nad tabuľkou ponúk. Je to filter nad tým, čo je pre teba naozaj priechodné práve teraz.',
          chips: ['dochádzanie', 'jazyk', 'tempo života'],
        },
        {
          icon: ArrowRight,
          kicker: 'Handshake',
          title: 'Prvý kontakt prebieha ako dialóg, nie slepé CV',
          body: 'Namiesto okamžitého posielania životopisu začína kontakt krátkou odpoveďou na konkrétnu situáciu alebo výzvu. Tím tak hneď vidí spôsob uvažovania a motiváciu.',
          detail: 'Handshake pomáha odlíšiť relevantných kandidátov od masových reakcií a dáva obom stranám lepší prvý signál, či má zmysel pokračovať.',
          chips: ['prvá odpoveď', 'lepší signál', 'menej šumu'],
        },
      ],
    },
    de: {
      readFeed: 'So liest du diesen Feed',
      back: 'Zurück',
      next: 'Weiter',
      showSlide: 'Slide anzeigen',
      slides: [
        {
          icon: ShieldCheck,
          kicker: 'Dialog-Slots',
          title: 'Slots halten Antworten in echter Kapazität',
          body: 'Jeder aktive Dialog belegt einen Slot. So entsteht keine endlose Flut von Reaktionen ohne Rückmeldung, sondern eine gesteuerte Zahl offener Gespräche.',
          detail: 'Nach dem Login siehst du, wie viele Slots frei sind, wie viele bereits laufen und wann ein weiterer Kontakt sinnvoll ist.',
          chips: ['begrenzte Kapazität', 'besseres Follow-up', 'weniger Blindreaktionen'],
        },
        {
          icon: Sparkles,
          kicker: 'JHI und Finanzen',
          title: 'JHI und der Finanzrechner geben Ergebnissen Kontext',
          body: 'JHI hilft dabei, Rollen nach beruflicher und menschlicher Passung zu priorisieren. Der Finanzrechner zeigt, was ein Angebot netto für Budget und Pendeln bedeutet.',
          detail: 'Es geht nicht nur um den Jobtitel. Das System kombiniert Fit, Geld, Arbeitsmodell und Alltagswirkung zu einer Entscheidungsebene.',
          chips: ['Priorisierung', 'Nettoeffekt', 'bessere Entscheidungen'],
        },
        {
          icon: SlidersHorizontal,
          kicker: 'Lebenssituation',
          title: 'Nicht nur Suche, sondern die Realität rund um Arbeit',
          body: 'In die Auswahl fließen Pendeln, Grenzregionen, Sprache, Arbeitsmodell, Familienlogistik und die Bereitschaft ein, Tempo oder Vertragsart zu verändern.',
          detail: 'Darum ist der Feed nicht nur Volltext über Joblisten, sondern ein Filter über Rollen, die jetzt tatsächlich machbar sind.',
          chips: ['Pendeln', 'Sprache', 'Lebensrealität'],
        },
        {
          icon: ArrowRight,
          kicker: 'Handshake',
          title: 'Der Erstkontakt läuft als Dialog, nicht als blindes CV',
          body: 'Statt sofort einen Lebenslauf zu senden, beginnt der Kontakt mit einer kurzen Antwort auf eine konkrete Situation oder Aufgabe. Das Team sieht so sofort Denkweise und Motivation.',
          detail: 'Der Handshake trennt relevante Kandidaten besser von Massenreaktionen und gibt beiden Seiten früher ein stärkeres Signal, ob es weitergehen sollte.',
          chips: ['erste Antwort', 'stärkeres Signal', 'weniger Rauschen'],
        },
      ],
    },
    pl: {
      readFeed: 'Jak czytać ten feed',
      back: 'Wstecz',
      next: 'Dalej',
      showSlide: 'Pokaż slajd',
      slides: [
        {
          icon: ShieldCheck,
          kicker: 'Sloty dialogowe',
          title: 'Sloty utrzymują odpowiedzi w realnej pojemności',
          body: 'Każdy aktywny dialog zajmuje slot. Dzięki temu nie chodzi o nieskończone wysyłanie reakcji bez odpowiedzi, ale o kontrolowaną liczbę otwartych rozmów.',
          detail: 'Po zalogowaniu zobaczysz, ile slotów masz wolnych, ile jest już aktywnych i kiedy warto otworzyć kolejny kontakt.',
          chips: ['ograniczona pojemność', 'lepszy follow-up', 'mniej ślepych reakcji'],
        },
        {
          icon: Sparkles,
          kicker: 'JHI i finanse',
          title: 'JHI i kalkulator finansowy nadają wynikom kontekst',
          body: 'JHI pomaga układać role według dopasowania zawodowego i ludzkiego. Kalkulator finansowy pokazuje, co oferta oznacza netto dla budżetu i dojazdów.',
          detail: 'To nie jest tylko dopasowanie po nazwie stanowiska. System łączy fit, pieniądze, tryb pracy i wpływ na codzienne życie.',
          chips: ['priorytetyzacja', 'wpływ netto', 'lepsze decyzje'],
        },
        {
          icon: SlidersHorizontal,
          kicker: 'Sytuacja życiowa',
          title: 'To nie tylko wyszukiwanie, ale ustawienie realiów pracy',
          body: 'Na wybór wpływają dojazdy, regiony przygraniczne, język, tryb pracy, logistyka rodzinna i gotowość do zmiany tempa lub typu współpracy.',
          detail: 'Dlatego feed nie jest zwykłym fulltextem nad tabelą ofert, ale filtrem tego, co jest dla ciebie realnie wykonalne teraz.',
          chips: ['dojazdy', 'język', 'codzienna rzeczywistość'],
        },
        {
          icon: ArrowRight,
          kicker: 'Handshake',
          title: 'Pierwszy kontakt działa jak dialog, nie ślepe CV',
          body: 'Zamiast od razu wysyłać CV, kontakt zaczyna się od krótkiej odpowiedzi na konkretną sytuację lub wyzwanie. Zespół od razu widzi sposób myślenia i motywację.',
          detail: 'Handshake pomaga odróżnić trafnych kandydatów od masowych reakcji i daje obu stronom lepszy pierwszy sygnał, czy warto iść dalej.',
          chips: ['pierwsza odpowiedź', 'lepszy sygnał', 'mniej szumu'],
        },
      ],
    },
    en: {
      readFeed: 'How to read this feed',
      back: 'Back',
      next: 'Next',
      showSlide: 'Show slide',
      slides: [
        {
          icon: ShieldCheck,
          kicker: 'Dialogue slots',
          title: 'Slots keep replies within real capacity',
          body: 'Each active dialogue takes one slot, so the system favors a manageable number of live conversations instead of endless low-signal applications.',
          detail: 'After sign-in you can see how many slots remain, how many are active, and when it makes sense to open another conversation.',
          chips: ['limited capacity', 'better follow-up', 'less noise'],
        },
        {
          icon: Sparkles,
          kicker: 'JHI and finance',
          title: 'JHI and the financial calculator add decision context',
          body: 'JHI helps rank roles by professional and human fit. The financial calculator shows what an offer means after commute, work mode, and practical budget impact.',
          detail: 'This is not just title matching. The system combines fit, money, work setup, and daily-life tradeoffs into one decision layer.',
          chips: ['prioritization', 'net impact', 'better decisions'],
        },
        {
          icon: SlidersHorizontal,
          kicker: 'Life setup',
          title: 'This is life-setup filtering, not just search',
          body: 'The feed reacts to commuting tolerance, cross-border options, language, work mode, family logistics, and how much change is realistic right now.',
          detail: 'That is why the result is not plain full-text search over listings, but a filtered view of roles that are actually viable.',
          chips: ['commute', 'language', 'daily reality'],
        },
        {
          icon: ArrowRight,
          kicker: 'Handshake',
          title: 'First contact starts as a dialogue, not a blind CV drop',
          body: 'Instead of sending a resume first, the opening step is a short response to a specific situation or challenge so the team sees thinking and intent immediately.',
          detail: 'The handshake creates a stronger first signal and helps both sides decide faster whether the conversation should continue.',
          chips: ['first reply', 'stronger signal', 'less noise'],
        },
      ],
    },
  } as const)[language === 'at' ? 'de' : language];
  const guestOnboardingSlides = guestOnboardingContent.slides;
  const activeGuestOnboardingSlide = guestOnboardingSlides[guestDiscoverySlide] || guestOnboardingSlides[0];

  useEffect(() => {
    let cancelled = false;

    const loadDialogueCapacity = async () => {
      if (!userProfile.isLoggedIn || !userProfile.id) {
        setDialogueCapacity(null);
        setIsDialogueCapacityLoading(false);
        return;
      }
      setIsDialogueCapacityLoading(true);
      try {
        const capacity = await fetchMyDialogueCapacity();
        if (!cancelled) {
          setDialogueCapacity(capacity);
        }
      } finally {
        if (!cancelled) {
          setIsDialogueCapacityLoading(false);
        }
      }
    };

    void loadDialogueCapacity();
    return () => {
      cancelled = true;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  useEffect(() => {
    setGuestDiscoverySlide(0);
  }, [language, userProfile.isLoggedIn]);

  useEffect(() => {
    if (userProfile.isLoggedIn || guestOnboardingSlides.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setGuestDiscoverySlide((current) => (current + 1) % guestOnboardingSlides.length);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [guestOnboardingSlides.length, userProfile.isLoggedIn]);

  const personalPresets = useMemo(
    () => buildCandidateSearchPresets(userProfile, locale),
    [locale, userProfile]
  );
  const resolvedDialogueCapacity = useMemo(() => {
    if (dialogueCapacity && dialogueCapacity.limit > 0) {
      return dialogueCapacity;
    }
    if (userProfile.isLoggedIn && hasPremiumAccess) {
      return {
        active: dialogueCapacity?.active || 0,
        limit: 25,
        remaining: Math.max(0, 25 - (dialogueCapacity?.active || 0)),
      };
    }
    return dialogueCapacity;
  }, [dialogueCapacity, hasPremiumAccess, userProfile.isLoggedIn]);
  const candidateIntent = useMemo(
    () => resolveCandidateIntentProfile(userProfile),
    [userProfile]
  );
  const resolvedSearchProfile = useMemo(
    () => ({
      ...createDefaultCandidateSearchProfile(),
      ...(userProfile.preferences.searchProfile || {}),
    }),
    [userProfile.preferences.searchProfile]
  );
  const personalSetupBootstrappedRef = useRef(false);
  const effectiveCandidateIntent = useMemo(
    () =>
      usePersonalSetup
        ? candidateIntent
        : {
            ...candidateIntent,
            primaryDomain: null,
            secondaryDomains: [],
            targetRole: '',
            seniority: null,
            includeAdjacentDomains: false,
            inferredPrimaryDomain: null,
            inferredTargetRole: '',
            inferenceSource: 'none',
            inferenceConfidence: 0,
            usedManualDomain: false,
            usedManualRole: false,
            usedManualSeniority: false,
          },
    [candidateIntent, usePersonalSetup]
  );
  const [workArrangementFilter, setWorkArrangementFilter] = useState<WorkArrangementFilter>(remoteOnly ? 'remote' : 'all');
  const [geographicScopeFilter, setGeographicScopeFilter] = useState<GeographicScopeFilter>(
    abroadOnly ? 'abroad' : globalSearch ? 'all' : 'domestic'
  );
  const homeCountryCode = useMemo<SupportedCountryCode | null>(() => {
    return normalizeSupportedCountryCode(userProfile.preferredCountryCode || userProfile.taxProfile?.countryCode);
  }, [userProfile.preferredCountryCode, userProfile.taxProfile?.countryCode]);
  const borderCountryCodes = useMemo(() => {
    if (!homeCountryCode) return [] as SupportedCountryCode[];
    return [homeCountryCode, ...(BORDER_COUNTRY_MAP[homeCountryCode] || [])];
  }, [homeCountryCode]);
  const defaultGeographicScope = homeCountryCode ? 'domestic' : 'all';
  const syncGeographicScope = (nextScope: GeographicScopeFilter, source: DiscoveryFilterSource = 'user_toggle') => {
    setGeographicScopeFilter(nextScope);
    if (nextScope === 'domestic') {
      setGlobalSearch(false, source);
      setAbroadOnly(false, source);
      setCountryCodes(homeCountryCode ? [homeCountryCode] : []);
      return;
    }
    if (nextScope === 'border') {
      setGlobalSearch(false, source);
      setAbroadOnly(false, source);
      setCountryCodes(borderCountryCodes);
      return;
    }
    if (nextScope === 'abroad') {
      setGlobalSearch(false, source);
      setAbroadOnly(true, source);
      setCountryCodes([]);
      return;
    }
    setGlobalSearch(true, source);
    setAbroadOnly(false, source);
    setCountryCodes([]);
  };
  const effectiveCommuteEnabled = enableCommuteFilter || (
    usePersonalSetup &&
    !remoteOnly &&
    workArrangementFilter !== 'remote' &&
    resolvedSearchProfile.defaultEnableCommuteFilter
  );
  const effectiveCommuteRadiusKm = enableCommuteFilter
    ? filterMaxDistance
    : (resolvedSearchProfile.defaultMaxDistanceKm || 30);

  const hasActiveFilters = Boolean(
    searchTerm ||
      filterCity ||
      filterMinSalary > 0 ||
      filterBenefits.length > 0 ||
      filterContractType.length > 0 ||
      filterLanguageCodes.length > 0 ||
      effectiveCommuteEnabled ||
      globalSearch ||
      abroadOnly ||
      remoteOnly ||
      workArrangementFilter === 'hybrid' ||
      workArrangementFilter === 'onsite' ||
      geographicScopeFilter === 'border' ||
      filterDate !== 'all' ||
      filterExperience.length > 0
  );

  const uniqueStrings = <T extends string>(items: unknown): T[] => {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const raw of items) {
      const value = String(raw || '').trim();
      if (!value) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      out.push(value as T);
    }
    return out;
  };

  const setCommuteEnabled = (enabled: boolean) => {
    setEnableCommuteFilter(enabled, 'user_toggle');
    if (enabled) {
      // Commute radius and "remote only" are mutually exclusive modes.
      if (remoteOnly) {
        setRemoteOnly(false, 'default');
        recordRuntimeSignal('custom:filter_conflict_auto_resolved', {
          conflict: 'commute_vs_remote_only',
          winner: 'commute',
        }, {
          dedupeKey: 'commute_vs_remote_only',
          throttleMs: 20_000,
        });
      }
    }
  };

  const setRemoteOnlyMode = (enabled: boolean) => {
    setRemoteOnly(enabled, 'user_toggle');
    if (enabled && enableCommuteFilter) {
      setEnableCommuteFilter(false, 'default');
      recordRuntimeSignal('custom:filter_conflict_auto_resolved', {
        conflict: 'remote_only_vs_commute',
        winner: 'remote_only',
      }, {
        dedupeKey: 'remote_only_vs_commute_marketplace',
        throttleMs: 20_000,
      });
    }
  };

  const handleWorkArrangementFilterChange = (nextMode: WorkArrangementFilter) => {
    setWorkArrangementFilter(nextMode);
    setRemoteOnlyMode(nextMode === 'remote');
  };

  const handleGeographicScopeChange = (nextScope: GeographicScopeFilter) => {
    syncGeographicScope(nextScope, 'user_toggle');
  };

  useEffect(() => {
    if (remoteOnly) {
      setWorkArrangementFilter('remote');
      return;
    }
    setWorkArrangementFilter((current) => (current === 'remote' ? 'all' : current));
  }, [remoteOnly]);

  useEffect(() => {
    if (abroadOnly) {
      if (geographicScopeFilter !== 'abroad') {
        setGeographicScopeFilter('abroad');
      }
      setCountryCodes([]);
      return;
    }
    const nextScope = globalSearch ? 'all' : defaultGeographicScope;
    const syncedScope = geographicScopeFilter === 'border' ? 'border' : nextScope;
    setGeographicScopeFilter((current) => {
      if (current === 'border') return current;
      return nextScope;
    });
    if (syncedScope === 'all') {
      setCountryCodes([]);
      return;
    }
    if (syncedScope === 'border') {
      setCountryCodes(borderCountryCodes);
      return;
    }
    setCountryCodes(homeCountryCode ? [homeCountryCode] : countryCodes);
  }, [abroadOnly, borderCountryCodes, countryCodes, defaultGeographicScope, globalSearch, geographicScopeFilter, homeCountryCode, setCountryCodes]);

  useEffect(() => {
    if (!userProfile.isLoggedIn) return;
    setMobileViewMode('swipe');
  }, [userProfile.isLoggedIn]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const syncViewport = () => setIsXlViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (personalSetupBootstrappedRef.current || !usePersonalSetup || hasActiveFilters || remoteOnly) return;
    personalSetupBootstrappedRef.current = true;
    applyDiscoveryDefaults({
      filterContractTypes: resolvedSearchProfile.wantsContractorRoles ? ['ico'] : [],
      filterBenefits: Array.from(new Set(resolvedSearchProfile.preferredBenefitKeys || [])),
      filterLanguageCodes: resolvedSearchProfile.wantsRemoteRoles ? resolvedSearchProfile.remoteLanguageCodes : [],
      enableCommuteFilter: resolvedSearchProfile.defaultEnableCommuteFilter,
      filterMaxDistance: resolvedSearchProfile.defaultEnableCommuteFilter ? (resolvedSearchProfile.defaultMaxDistanceKm || 50) : 50,
      globalSearch: resolvedSearchProfile.nearBorder,
      abroadOnly: false,
    });
    if (resolvedSearchProfile.wantsRemoteRoles) {
      setRemoteOnly(true, 'default');
      setEnableCommuteFilter(false, 'default');
    }
  }, [
    applyDiscoveryDefaults,
    hasActiveFilters,
    remoteOnly,
    resolvedSearchProfile.defaultEnableCommuteFilter,
    resolvedSearchProfile.defaultMaxDistanceKm,
    usePersonalSetup,
    resolvedSearchProfile.nearBorder,
    resolvedSearchProfile.preferredBenefitKeys,
    resolvedSearchProfile.remoteLanguageCodes,
    resolvedSearchProfile.wantsContractorRoles,
    resolvedSearchProfile.wantsRemoteRoles,
    setEnableCommuteFilter,
    setRemoteOnly,
  ]);

  const applyFilterSnapshot = (filters: JobSearchFilters) => {
    const nextRemoteOnly = Boolean(filters.remoteOnly);
    const nextCommuteEnabled = nextRemoteOnly ? false : Boolean(filters.enableCommuteFilter);
    const nextGlobalSearch = Boolean(filters.globalSearch);
    const nextAbroadOnly = nextGlobalSearch ? false : Boolean(filters.abroadOnly);
    const nextWorkArrangement = nextRemoteOnly
      ? 'remote'
      : (filters.filterWorkArrangement || 'all');
    const nextGeographicScope = filters.geographicScope || (nextAbroadOnly ? 'abroad' : nextGlobalSearch ? 'all' : defaultGeographicScope);
    setWorkArrangementFilter(nextWorkArrangement);
    syncGeographicScope(nextGeographicScope, 'user_toggle');
    setSearchTerm(filters.searchTerm || '', 'user_toggle');
    setFilterCity(filters.filterCity || '', 'user_toggle');
    setFilterMinSalary(filters.filterMinSalary || 0, 'user_toggle');
    setFilterBenefits(uniqueStrings(filters.filterBenefits), 'user_toggle');
    setFilterContractType(uniqueStrings(filters.filterContractTypes), 'user_toggle');
    setFilterDate(filters.filterDatePosted || 'all', 'user_toggle');
    setFilterExperience(uniqueStrings(filters.filterExperienceLevels), 'user_toggle');
    setFilterLanguageCodes(uniqueStrings<SearchLanguageCode>(filters.filterLanguageCodes), 'user_toggle');
    setEnableCommuteFilter(nextCommuteEnabled, 'user_toggle');
    setFilterMaxDistance(filters.filterMaxDistance || 50, 'user_toggle');
    setRemoteOnly(nextRemoteOnly, 'user_toggle');
  };

  const jobsInLane = useMemo(() => {
    const nativeJobs = jobs.filter((job) => job.listingKind !== 'imported');
    const importedJobs = jobs.filter((job) => job.listingKind === 'imported');
    const byWorkMode = (items: Job[]) =>
      items.filter((job) => {
        if (workArrangementFilter === 'all') return true;
        if (workArrangementFilter === 'remote') return isRemoteListing(job);
        return getNormalizedWorkArrangement(job) === workArrangementFilter;
      });
    const byGeographicScope = (items: Job[]) =>
      items.filter((job) => {
        const countryCode = normalizeSupportedCountryCode(job.country_code);
        if (!countryCode || !homeCountryCode) return true;
        if (geographicScopeFilter === 'all') return true;
        if (geographicScopeFilter === 'domestic') return countryCode === homeCountryCode;
        if (geographicScopeFilter === 'abroad') return countryCode !== homeCountryCode;
        return borderCountryCodes.includes(countryCode);
      });
    const byCommuteReality = (items: Job[]) =>
      items.filter((job) => {
        if (!effectiveCommuteEnabled || effectiveCommuteRadiusKm <= 0) return true;
        if (isRemoteListing(job)) return true;
        const userLat = userProfile.coordinates?.lat;
        const userLon = userProfile.coordinates?.lon;
        if (userLat == null || userLon == null) return true;
        const explicitDistance = Number((job as any).distance_km ?? (job as any).distanceKm ?? job.distanceKm);
        const computedDistance = (
          typeof job.lat === 'number' &&
          typeof job.lng === 'number'
        ) ? calculateDistanceKm(userLat, userLon, job.lat, job.lng) : null;
        const distanceKm = Number.isFinite(explicitDistance) && explicitDistance >= 0
          ? explicitDistance
          : computedDistance;
        if (distanceKm == null || distanceKm > effectiveCommuteRadiusKm) {
          return false;
        }
        (job as any).distance_km = distanceKm;
        (job as any).distanceKm = distanceKm;
        return true;
      });
    const nativeMatches = byWorkMode(nativeJobs);
    const importedMatches = byWorkMode(importedJobs);
    const nativeScopedMatches = byCommuteReality(byGeographicScope(nativeMatches));
    const importedScopedMatches = byCommuteReality(byGeographicScope(importedMatches));
    if (lane === 'imports') return importedScopedMatches;

    // Challenge lane should prefer native challenges, but avoid feeling empty when the pool is small.
    // If only a handful of native items survive the current filters, mix in imports too so paging
    // still exposes the broader result set the backend already returned.
    if (nativeScopedMatches.length === 0 || !hasNativeChallenges) return importedScopedMatches;
    if (nativeScopedMatches.length < MIN_NATIVE_CHALLENGE_POOL) {
      const seen = new Set(nativeScopedMatches.map((job) => job.id));
      return [
        ...nativeScopedMatches,
        ...importedScopedMatches.filter((job) => !seen.has(job.id)),
      ];
    }
    if (!usePersonalSetup) {
      const seen = new Set(nativeScopedMatches.map((job) => job.id));
      return [
        ...nativeScopedMatches,
        ...importedScopedMatches.filter((job) => !seen.has(job.id)),
      ];
    }
    return nativeScopedMatches;
  }, [
    jobs,
    lane,
    workArrangementFilter,
    geographicScopeFilter,
    homeCountryCode,
    borderCountryCodes,
    hasNativeChallenges,
    usePersonalSetup,
    effectiveCommuteEnabled,
    effectiveCommuteRadiusKm,
    userProfile.coordinates?.lat,
    userProfile.coordinates?.lon,
  ]);

  const effectiveSearchMode = useMemo<SearchMode>(() => {
    if (searchMode === 'manual_query') {
      return 'manual_query';
    }
    if (workArrangementFilter !== 'all' || geographicScopeFilter !== defaultGeographicScope) {
      return 'manual_filters';
    }
    return searchMode;
  }, [defaultGeographicScope, geographicScopeFilter, searchMode, workArrangementFilter]);

  const prioritizedJobsInLane = useMemo(() => {
    if (!usePersonalSetup) {
      return jobsInLane;
    }

    const annotatedJobs = computeCandidateAnnotations(
      jobsInLane,
      userProfile,
      i18n.language
    );

    if (effectiveSearchMode === 'discovery_default') {
      return sortJobsForDiscovery(annotatedJobs);
    }

    return annotatedJobs;
  }, [effectiveSearchMode, i18n.language, jobsInLane, usePersonalSetup, userProfile]);

  const fallbackJobsInLane = useMemo(() => {
    const nativeJobs = jobs.filter((job) => job.listingKind !== 'imported');
    const importedJobs = jobs.filter((job) => job.listingKind === 'imported');

    if (lane === 'imports') {
      return importedJobs.length > 0 ? importedJobs : jobs;
    }

    if (nativeJobs.length === 0 || !hasNativeChallenges) {
      return importedJobs.length > 0 ? importedJobs : jobs;
    }

    if (nativeJobs.length < MIN_NATIVE_CHALLENGE_POOL) {
      const seen = new Set(nativeJobs.map((job) => job.id));
      return [
        ...nativeJobs,
        ...importedJobs.filter((job) => !seen.has(job.id)),
      ];
    }

    return nativeJobs;
  }, [hasNativeChallenges, jobs, lane]);

  const feedJobs = prioritizedJobsInLane.length > 0 ? prioritizedJobsInLane : fallbackJobsInLane;
  const feedFallbackActive = prioritizedJobsInLane.length === 0 && fallbackJobsInLane.length > 0;

  const hasCommuteProfile = Boolean(userProfile.address || userProfile.coordinates?.lat);

  const currentFilters: JobSearchFilters = {
    searchTerm,
    filterCity,
    filterMinSalary,
    filterBenefits,
    filterContractTypes: filterContractType,
    filterDatePosted: filterDate,
    filterExperienceLevels: filterExperience,
    filterLanguageCodes,
    filterMaxDistance,
    enableCommuteFilter,
    globalSearch,
    abroadOnly,
    remoteOnly,
    filterWorkArrangement: workArrangementFilter,
    geographicScope: geographicScopeFilter,
    intentPrimaryDomain: usePersonalSetup ? effectiveCandidateIntent.primaryDomain : null,
    intentTargetRole: usePersonalSetup ? (getCandidateIntentRoleSeedKeyword(effectiveCandidateIntent.targetRole) || undefined) : undefined,
    intentSeniority: usePersonalSetup ? effectiveCandidateIntent.seniority : null
  };

  const setupSignals = useMemo(() => {
    const signals: string[] = [];
    const searchProfile = usePersonalSetup ? resolvedSearchProfile : undefined;
    const activeLanguageCodes = filterLanguageCodes.length > 0 ? filterLanguageCodes : searchProfile?.remoteLanguageCodes || [];
    const preferredBenefits = Array.from(new Set(searchProfile?.preferredBenefitKeys || []));
    const intentSignals = usePersonalSetup ? getCandidateIntentSignals(userProfile, i18n.language) : [];

    intentSignals.forEach((signal) => {
      if (signal) signals.push(signal);
    });

    if (filterContractType.includes('ico') || searchProfile?.wantsContractorRoles) {
      signals.push(getLocaleLabel({
        cs: 'IČO / kontrakt',
        sk: 'IČO / kontrakt',
        de: 'Vertrag / Freelance',
        at: 'Vertrag / Freelance',
        pl: 'B2B / kontrakt',
        en: 'Contract / freelance'
      }, language));
    }
    if (workArrangementFilter === 'remote' || (workArrangementFilter === 'all' && (remoteOnly || searchProfile?.wantsRemoteRoles))) {
      signals.push(copy.remoteOnly);
    } else if (workArrangementFilter === 'hybrid') {
      signals.push(copy.hybridOnly);
    } else if (workArrangementFilter === 'onsite') {
      signals.push(copy.onsiteOnly);
    }
    if (filterBenefits.includes('dog_friendly') || searchProfile?.wantsDogFriendlyOffice) {
      signals.push(getLocaleLabel({
        cs: 'Dog-friendly kancelář',
        sk: 'Dog-friendly kancelária',
        de: 'Hundefreundliches Büro',
        at: 'Hundefreundliches Büro',
        pl: 'Biuro przyjazne psom',
        en: 'Dog-friendly office'
      }, language));
    }
    if (
      filterBenefits.includes('child_friendly') ||
      filterBenefits.includes('childcare_support') ||
      preferredBenefits.includes('child_friendly') ||
      preferredBenefits.includes('childcare_support')
    ) {
      signals.push(getLocaleLabel({
        cs: 'Pro rodiče',
        sk: 'Pre rodičov',
        de: 'Familienfreundlich',
        at: 'Familienfreundlich',
        pl: 'Przyjazne rodzicom',
        en: 'Child-friendly'
      }, language));
    }
    preferredBenefits
      .filter((benefit) => !['dog_friendly', 'child_friendly', 'childcare_support'].includes(benefit))
      .slice(0, 3)
      .forEach((benefitKey) => {
        const labelSource = BENEFIT_FILTERS.find((benefit) => benefit.key === benefitKey)?.labels;
        const label = labelSource ? getLocaleLabel(labelSource, language) : null;
        if (label) signals.push(label);
      });
    if (activeLanguageCodes.length > 0) {
      const formattedLanguages = activeLanguageCodes
        .map((code) => {
          const labelSource = REMOTE_LANGUAGE_OPTIONS.find((option) => option.key === code)?.labels;
          return labelSource ? getLocaleLabel(labelSource, language) : code.toUpperCase();
        })
        .join(' / ');
      signals.push(formattedLanguages);
    }
    if (workArrangementFilter === 'remote') {
      // Remote-first mode should not surface commute as an active reality signal.
    } else if (enableCommuteFilter) {
      signals.push(`≤ ${filterMaxDistance} km`);
    } else if (searchProfile?.defaultEnableCommuteFilter && searchProfile?.defaultMaxDistanceKm) {
      signals.push(`≤ ${searchProfile.defaultMaxDistanceKm} km`);
    }
    if (userProfile.jhiPreferences?.hardConstraints.excludeShift) {
      signals.push(getLocaleLabel({
        cs: 'Bez směn',
        sk: 'Bez zmien',
        de: 'Ohne Schichten',
        at: 'Ohne Schichten',
        pl: 'Bez zmian',
        en: 'No shifts'
      }, language));
    }
    const profileDesiredSalary = usePersonalSetup ? userProfile.preferences.desired_salary_min : 0;
    if (filterMinSalary > 0 || profileDesiredSalary) {
      const salaryFloor = filterMinSalary || profileDesiredSalary || 0;
      signals.push(`≥ ${Number(salaryFloor).toLocaleString(i18n.language)} ${(isCsLike ? 'CZK' : 'EUR')}`);
    }
    if (geographicScopeFilter === 'all') {
      signals.push(copy.locationAll);
    } else if (geographicScopeFilter === 'border') {
      signals.push(copy.locationBorder);
    } else if (geographicScopeFilter === 'abroad' || searchProfile?.nearBorder) {
      signals.push(copy.border);
    }
    if (searchTerm) {
      signals.push(`"${searchTerm}"`);
    }

    return Array.from(new Set(signals)).slice(0, 8);
  }, [
    abroadOnly,
    copy.allMarkets,
    copy.border,
    copy.hybridOnly,
    copy.locationAll,
    copy.locationBorder,
    copy.onsiteOnly,
    copy.remoteOnly,
    enableCommuteFilter,
    filterBenefits,
    filterContractType,
    filterLanguageCodes,
    filterMaxDistance,
    filterMinSalary,
    globalSearch,
    i18n.language,
    isCsLike,
    remoteOnly,
    workArrangementFilter,
    searchTerm,
    userProfile.jhiPreferences?.hardConstraints.excludeShift,
    userProfile.preferences.desired_salary_min,
    usePersonalSetup,
    resolvedSearchProfile,
    userProfile,
    i18n.language,
    geographicScopeFilter
  ]);

  const hasManualIntent = effectiveCandidateIntent.usedManualDomain || effectiveCandidateIntent.usedManualRole || effectiveCandidateIntent.usedManualSeniority;
  const inferredIntentAvailable = Boolean(effectiveCandidateIntent.inferredPrimaryDomain || effectiveCandidateIntent.inferredTargetRole);

  const resetToManualDiscovery = () => {
    // Switching off personal setup should feel like a real reset (no hidden carry-over filters).
    setFilterMinSalary(0);
    setFilterBenefits([]);
    setFilterContractType([]);
    setFilterExperience([]);
    setFilterLanguageCodes([]);
    setFilterDate('all');
    setEnableCommuteFilter(false);
    setFilterMaxDistance(50);
    setRemoteOnly(false);
    setWorkArrangementFilter('all');
    syncGeographicScope(defaultGeographicScope, 'default');
  };

  const feedSections = useMemo(() => {
    const sections: Array<{ key: string; title: string; body: string; jobs: Job[] }> = [];
    if (!usePersonalSetup || effectiveSearchMode !== 'discovery_default') {
      if (feedJobs.length > 0) {
        sections.push({
          key: feedFallbackActive ? 'manual-fallback' : 'manual-search',
          title: copy.manualSection,
          body: copy.manualSectionBody,
          jobs: feedJobs,
        });
      }
      return sections;
    }
    const bestFitJobs = feedJobs.filter((job) => job.matchBucket === 'best_fit');
    const adjacentJobs = feedJobs.filter((job) => job.matchBucket === 'adjacent');
    const broaderJobs = feedJobs.filter((job) => job.matchBucket === 'broader');

    if (bestFitJobs.length > 0) {
      sections.push({ key: 'setup', title: copy.setupSection, body: copy.setupSectionBody, jobs: bestFitJobs });
    }
    if (adjacentJobs.length > 0) {
      sections.push({ key: 'adjacent', title: copy.remoteSection, body: copy.remoteSectionBody, jobs: adjacentJobs });
    }
    if (broaderJobs.length > 0) {
      sections.push({ key: 'broader', title: copy.moreSection, body: copy.moreSectionBody, jobs: broaderJobs });
    }
    if (sections.length === 0 && feedJobs.length > 0) {
      sections.push({ key: 'fallback', title: copy.setupSection, body: copy.setupSectionBody, jobs: feedJobs });
    }

    return sections;
  }, [
    copy.moreSection,
    copy.moreSectionBody,
    copy.manualSection,
    copy.manualSectionBody,
    copy.remoteSection,
    copy.remoteSectionBody,
    copy.setupSection,
    copy.setupSectionBody,
    effectiveSearchMode,
    feedFallbackActive,
    feedJobs,
    usePersonalSetup
  ]);

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));
  const backendResultsCount = Math.max(0, totalCount);
  const hasClientSideResultRefinement = (
    workArrangementFilter !== 'all' ||
    geographicScopeFilter === 'border' ||
    (effectiveCommuteEnabled && !enableCommuteFilter) ||
    lane === 'imports' ||
    (lane === 'challenges' && usePersonalSetup && hasNativeChallenges)
  );
  const displayedResultsCount = hasClientSideResultRefinement
    ? feedJobs.length
    : backendResultsCount;
  const resultsMetricHelper = hasClientSideResultRefinement
    ? getLocaleLabel({
      cs: 'Viditelné teď v tomto feedu',
      sk: 'Viditeľné teraz v tomto feede',
      de: 'Jetzt im Feed sichtbar',
      at: 'Jetzt im Feed sichtbar',
      pl: 'Widoczne teraz w feedzie',
      en: 'Visible now in this feed'
    }, language)
    : undefined;
  const paginationSummary = hasClientSideResultRefinement
    ? getLocaleLabel({
      cs: `Backend strana ${currentPage + 1} z ${totalPages}`,
      sk: `Backend strana ${currentPage + 1} z ${totalPages}`,
      de: `Backend-Seite ${currentPage + 1} von ${totalPages}`,
      at: `Backend-Seite ${currentPage + 1} von ${totalPages}`,
      pl: `Strona backendu ${currentPage + 1} z ${totalPages}`,
      en: `Backend page ${currentPage + 1} of ${totalPages}`
    }, language)
    : getLocaleLabel({
      cs: `Strana ${currentPage + 1} z ${totalPages}`,
      sk: `Strana ${currentPage + 1} z ${totalPages}`,
      de: `Seite ${currentPage + 1} von ${totalPages}`,
      at: `Seite ${currentPage + 1} von ${totalPages}`,
      pl: `Strona ${currentPage + 1} z ${totalPages}`,
      en: `Page ${currentPage + 1} of ${totalPages}`
    }, language);
  const paginationWindow = useMemo(() => {
    const pages = new Set<number>([0, totalPages - 1, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 0 && page < totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const scrollToFirstFeedItem = () => {
    if (typeof window === 'undefined') return;

    const targetId = mobileViewMode === 'swipe'
      ? 'challenge-feed-swipe'
      : (document.getElementById('challenge-feed-section-broader')
        ? 'challenge-feed-section-broader'
        : 'challenge-feed-first-item');
    const target = document.getElementById(targetId);
    if (!target) return;

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

    const headerOffset = parseCssLengthToPx(
      getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset'),
      104
    );
    const targetY = Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerOffset - 12);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const handleSearchSubmit = () => {
    setPendingSearchScroll(true);
    performSearch(searchTerm);
  };

  const showMobileSwipeIntro = mobileViewMode === 'swipe' && (!userProfile.isLoggedIn || !mobileSwipeIntroDismissed);
  const premiumFeatures = useMemo<PremiumFeatureExplainContent[]>(() => {
    if (language === 'cs') {
      return [
        {
          id: 'dialogue_slots',
          label: 'Více dialogových slotů pro aktivní odpovědi',
          title: 'Více dialogových slotů pro aktivní odpovědi',
          summary: 'Sloty určují, kolik skutečně aktivních konverzací můžeš držet najednou bez rozpadnutí pozornosti do desítek slepých vláken.',
          whyTitle: 'Proč to v Shamanovi existuje',
          whyBody: 'Cíl není rozeslat co nejvíc CV, ale vést omezený počet kvalitních dialogů tam, kde je reálná šance na odpověď z obou stran.',
          premiumTitle: 'Co se změní s premium',
          premiumBody: 'Změní se hlavně kapacita a tempo práce s odpověďmi. Discovery se kvůli tomu nechová jinak, ale můžeš bezpečně držet víc otevřených směrů současně.',
          premiumEffects: [
            'Získáš více aktivních dialogových slotů najednou než ve free režimu.',
            'Nemusíš tak rychle zavírat jedno vlákno jen proto, abys mohl otevřít další.',
            'Feed se kvůli slotům nepřerovnává, mění se hlavně to, kolik kvalitních reakcí zvládneš obsloužit paralelně.'
          ],
          premiumActiveNote: 'Slotová vrstva je u vás aktivní. Praktický dopad je hlavně ve vyšší kapacitě aktivních konverzací, ne v marketingovém badge.'
        },
        {
          id: 'ai_guide',
          label: 'AI průvodce profilem a životní situací',
          title: 'AI průvodce profilem a životní situací',
          summary: 'Tahle vrstva pomáhá převést nejasné preference, životní omezení a kariérní směr do konkrétních nastavení a praktičtějšího feedu.',
          whyTitle: 'Proč to v Shamanovi existuje',
          whyBody: 'Lidé často nevědí, jak svůj životní kontext promítnout do filtrů. AI průvodce to překládá do použitelného discovery nastavení bez nutnosti všechno ručně vymýšlet.',
          premiumTitle: 'Co se změní s premium',
          premiumBody: 'Systém dostane víc strukturovaných vstupů o tvé situaci. Praktický dopad je v přesnějším nastavení filtrů a menším množství obecných nebo hraničních doporučení.',
          premiumEffects: [
            'AI průvodce dokáže vyplnit a zpřesnit větší část discovery nastavení bez ručního ladění po jednotlivých filtrech.',
            'Feed pracuje s přesnější interpretací životní situace, ne jen s oborem a lokalitou.',
            'Doporučení se méně často rozšiřují do rolí, které sice vypadají podobně, ale nedávají smysl pro tvoje omezení.'
          ],
          premiumActiveNote: 'AI průvodce je u vás aktivní jako vstup do discovery logiky. Praktický dopad je ve kvalitnějších defaults, ne jen v dalším formuláři.'
        },
        {
          id: 'jhi',
          label: 'Personalizovaný JHI index',
          title: 'Personalizovaný JHI index',
          summary: 'JHI není obecné skóre trhu. Je to osobní vrstva, která váží nabídky podle tvých priorit, reality a kompromisů, které dávají smysl právě tobě.',
          whyTitle: 'Proč to v Shamanovi existuje',
          whyBody: 'Dvě stejně dobré nabídky mohou být pro dva lidi úplně jinak vhodné. JHI se snaží rozhodování přiblížit realitě, ne jen obecným metrikám.',
          premiumTitle: 'Co se změní s premium',
          premiumBody: 'Nejde o to, že by premium přidalo nové nabídky. Mění hlavně prioritu a interpretaci výsledků, takže nahoře častěji zůstávají role, které odpovídají tvým skutečným trade-offům.',
          premiumEffects: [
            'Feed silněji zohlední osobní priority a omezení při řazení výsledků.',
            'U podobně relevantních rolí se výš dostanou ty, které lépe sedí na tvoji realitu, ne jen na obecný match trhu.',
            'Discovery bude méně „ploché“ a víc rozhodovací, hlavně když vybíráš mezi několika podobnými směry.'
          ],
          premiumActiveNote: 'Personalizovaná JHI vrstva je aktivní. Praktický dopad je v pořadí a prioritě rolí, ne v tom, že by systém tvrdě schovával zbytek trhu.'
        },
        {
          id: 'jcfpm',
          label: 'Detailní report JCFPM testu',
          title: 'Detailní report JCFPM testu',
          summary: 'JCFPM report rozebírá osobnostní nastavení do větší hloubky a ukazuje, jak se promítá do stylu práce, rizik i doporučení v systému.',
          whyTitle: 'Proč to v Shamanovi existuje',
          whyBody: 'Nestačí vědět jen co umíš. Důležité je i jak funguješ pod tlakem, v nejistotě nebo v různých typech týmů. Tohle report zpřesňuje.',
          premiumTitle: 'Co se změní s premium',
          premiumBody: 'Hlavní změna je v transparentnosti a hloubce interpretace. Lépe uvidíš, proč systém některé role tlačí výš a kde vidí riziko dlouhodobé nespokojenosti nebo přetížení.',
          premiumEffects: [
            'Místo zkráceného výstupu dostaneš plný report s detailnější interpretací.',
            'Lépe uvidíš, proč systém považuje některé role za dlouhodobě udržitelnější než jiné.',
            'JCFPM slouží víc jako rozhodovací vysvětlení a audit doporučení než jako další samostatný test bez návaznosti.'
          ],
          premiumActiveNote: 'Plný JCFPM výklad je u vás odemčený. Praktický dopad je hlavně v lepší čitelnosti důvodů, proč systém doporučuje právě tyto směry.'
        }
      ];
    }

    if (language === 'sk') {
      return [
        {
          id: 'dialogue_slots',
          label: 'Viac dialógových slotov pre aktívne odpovede',
          title: 'Viac dialógových slotov pre aktívne odpovede',
          summary: 'Sloty určujú, koľko skutočne aktívnych konverzácií môžeš držať naraz bez rozpadu pozornosti do desiatok slepých vlákien.',
          whyTitle: 'Prečo to v Shamanovi existuje',
          whyBody: 'Cieľ nie je rozoslať čo najviac CV, ale viesť obmedzený počet kvalitných dialógov tam, kde je reálna šanca na odpoveď z oboch strán.',
          premiumTitle: 'Čo sa zmení s premium',
          premiumBody: 'Zmení sa hlavne kapacita a tempo práce s odpoveďami. Discovery sa kvôli tomu nespráva inak, ale môžeš bezpečne držať viac otvorených smerov súčasne.',
          premiumEffects: [
            'Získaš viac aktívnych dialógových slotov naraz než vo free režime.',
            'Nemusíš tak rýchlo zatvárať jedno vlákno len preto, aby si mohol otvoriť ďalšie.',
            'Feed sa kvôli slotom nepreusporadúva, mení sa hlavne to, koľko kvalitných reakcií zvládneš obslúžiť paralelne.'
          ],
          premiumActiveNote: 'Slotová vrstva je u vás aktívna. Praktický dopad je hlavne vo vyššej kapacite aktívnych konverzácií, nie v marketingovom badge.'
        },
        {
          id: 'ai_guide',
          label: 'AI sprievodca profilom a životnou situáciou',
          title: 'AI sprievodca profilom a životnou situáciou',
          summary: 'Táto vrstva pomáha previesť nejasné preferencie, životné obmedzenia a kariérny smer do konkrétnych nastavení a praktickejšieho feedu.',
          whyTitle: 'Prečo to v Shamanovi existuje',
          whyBody: 'Ľudia často nevedia, ako svoj životný kontext premietnuť do filtrov. AI sprievodca to prekladá do použiteľného discovery nastavenia bez nutnosti všetko ručne vymýšľať.',
          premiumTitle: 'Čo sa zmení s premium',
          premiumBody: 'Systém dostane viac štruktúrovaných vstupov o tvojej situácii. Praktický dopad je v presnejšom nastavení filtrov a menšom množstve všeobecných alebo hraničných odporúčaní.',
          premiumEffects: [
            'AI sprievodca dokáže vyplniť a spresniť väčšiu časť discovery nastavení bez ručného ladenia po jednotlivých filtroch.',
            'Feed pracuje s presnejšou interpretáciou životnej situácie, nielen s odborom a lokalitou.',
            'Odporúčania sa menej často rozširujú do rolí, ktoré síce vyzerajú podobne, ale nedávajú zmysel pre tvoje obmedzenia.'
          ],
          premiumActiveNote: 'AI sprievodca je u vás aktívny ako vstup do discovery logiky. Praktický dopad je v kvalitnejších defaults, nie len v ďalšom formulári.'
        },
        {
          id: 'jhi',
          label: 'Personalizovaný JHI index',
          title: 'Personalizovaný JHI index',
          summary: 'JHI nie je všeobecné skóre trhu. Je to osobná vrstva, ktorá váži ponuky podľa tvojich priorít, reality a kompromisov, ktoré dávajú zmysel práve tebe.',
          whyTitle: 'Prečo to v Shamanovi existuje',
          whyBody: 'Dve rovnako dobré ponuky môžu byť pre dvoch ľudí úplne inak vhodné. JHI sa snaží priblížiť rozhodovanie realite, nie len všeobecným metrikám.',
          premiumTitle: 'Čo sa zmení s premium',
          premiumBody: 'Nejde o to, že by premium pridalo nové ponuky. Mení hlavne prioritu a interpretáciu výsledkov, takže hore častejšie zostávajú roly, ktoré zodpovedajú tvojim skutočným trade-offom.',
          premiumEffects: [
            'Feed silnejšie zohľadní osobné priority a obmedzenia pri radení výsledkov.',
            'Pri podobne relevantných rolách sa vyššie dostanú tie, ktoré lepšie sedia na tvoju realitu, nie len na všeobecný match trhu.',
            'Discovery bude menej ploché a viac rozhodovacie, hlavne keď vyberáš medzi viacerými podobnými smermi.'
          ],
          premiumActiveNote: 'Personalizovaná JHI vrstva je aktívna. Praktický dopad je v poradí a priorite rolí, nie v tom, že by systém tvrdo skrýval zvyšok trhu.'
        },
        {
          id: 'jcfpm',
          label: 'Detailný report JCFPM testu',
          title: 'Detailný report JCFPM testu',
          summary: 'JCFPM report rozoberá osobnostné nastavenie do väčšej hĺbky a ukazuje, ako sa premieta do štýlu práce, rizík aj odporúčaní v systéme.',
          whyTitle: 'Prečo to v Shamanovi existuje',
          whyBody: 'Nestačí vedieť len čo vieš. Dôležité je aj ako funguješ pod tlakom, v neistote alebo v rôznych typoch tímov. Toto report spresňuje.',
          premiumTitle: 'Čo sa zmení s premium',
          premiumBody: 'Hlavná zmena je v transparentnosti a hĺbke interpretácie. Lepšie uvidíš, prečo systém niektoré roly tlačí vyššie a kde vidí riziko dlhodobej nespokojnosti alebo preťaženia.',
          premiumEffects: [
            'Namiesto skráteného výstupu dostaneš plný report s detailnejšou interpretáciou.',
            'Lepšie uvidíš, prečo systém považuje niektoré roly za dlhodobo udržateľnejšie než iné.',
            'JCFPM slúži viac ako rozhodovacie vysvetlenie a audit odporúčaní než ako ďalší samostatný test bez návaznosti.'
          ],
          premiumActiveNote: 'Plný JCFPM výklad je u vás odomknutý. Praktický dopad je hlavne v lepšej čitateľnosti dôvodov, prečo systém odporúča práve tieto smery.'
        }
      ];
    }

    if (language === 'de' || language === 'at') {
      return [
        {
          id: 'dialogue_slots',
          label: 'Mehr Dialog-Slots für aktive Antworten',
          title: 'Mehr Dialog-Slots für aktive Antworten',
          summary: 'Slots bestimmen, wie viele wirklich aktive Gespräche du gleichzeitig führen kannst, ohne deine Aufmerksamkeit auf dutzende blinde Threads zu verteilen.',
          whyTitle: 'Warum es das in Shaman gibt',
          whyBody: 'Das Ziel ist nicht, möglichst viele CVs zu versenden, sondern eine begrenzte Zahl hochwertiger Dialoge dort zu führen, wo auf beiden Seiten realistisch eine Antwort zu erwarten ist.',
          premiumTitle: 'Was sich mit Premium ändert',
          premiumBody: 'Vor allem ändern sich Kapazität und Arbeitstempo bei Antworten. Discovery rankt dadurch nicht anders, aber du kannst mehrere Richtungen gleichzeitig offen halten.',
          premiumEffects: [
            'Du erhältst mehr aktive Dialog-Slots gleichzeitig als im Free-Tier.',
            'Du musst einen Thread nicht so schnell schließen, nur um einen anderen öffnen zu können.',
            'Der Feed selbst wird dadurch nicht neu priorisiert; geändert wird vor allem, wie viele ernsthafte Antworten du parallel handhaben kannst.'
          ],
          premiumActiveNote: 'Diese Slot-Ebene ist bei dir aktiv. Der praktische Effekt liegt vor allem in höherer Gesprächskapazität, nicht in einem Marketing-Badge.'
        },
        {
          id: 'ai_guide',
          label: 'KI-Guide für Profil und Lebenssituation',
          title: 'KI-Guide für Profil und Lebenssituation',
          summary: 'Diese Ebene übersetzt vage Präferenzen, Lebensumstände und Karriererichtung in konkrete Einstellungen und einen präziseren Discovery-Feed.',
          whyTitle: 'Warum es das in Shaman gibt',
          whyBody: 'Viele Menschen kennen ihre Situation, wissen aber nicht, wie sie diese in Filter übersetzen sollen. Der KI-Guide macht daraus praktisch nutzbare Discovery-Einstellungen.',
          premiumTitle: 'Was sich mit Premium ändert',
          premiumBody: 'Das System erhält mehr strukturierte Signale über deinen Kontext. Praktisch bedeutet das präzisere Defaults und weniger generische oder grenzwertige Empfehlungen.',
          premiumEffects: [
            'Der KI-Guide kann mehr von deinem Discovery-Setup ohne manuelles Feinjustieren ableiten und schärfen.',
            'Der Feed arbeitet mit einer stärkeren Interpretation deiner realen Situation, nicht nur mit Rolle und Ort.',
            'Empfehlungen driften seltener in Rollen ab, die auf dem Papier ähnlich wirken, aber nicht zu deinen echten Einschränkungen passen.'
          ],
          premiumActiveNote: 'Der KI-Guide ist für dich als Input-Layer in die Discovery-Logik aktiv. Der praktische Effekt sind bessere Defaults, nicht einfach ein weiteres Formular.'
        },
        {
          id: 'jhi',
          label: 'Personalisierter JHI-Index',
          title: 'Personalisierter JHI-Index',
          summary: 'JHI ist kein generischer Marktscore. Es ist eine persönliche Entscheidungsschicht, die Rollen anhand deiner Prioritäten, Trade-offs und Realität gewichtet.',
          whyTitle: 'Warum es das in Shaman gibt',
          whyBody: 'Zwei gleich starke Rollen können für zwei Menschen völlig unterschiedlich passen. JHI versucht, reale Entscheidungslogik abzubilden und nicht nur allgemeines Ranking.',
          premiumTitle: 'Was sich mit Premium ändert',
          premiumBody: 'Premium erzeugt keine neuen Jobs. Es verändert vor allem die Priorisierung der Ergebnisse, sodass oben häufiger Rollen stehen, die besser zu deinen echten Trade-offs passen.',
          premiumEffects: [
            'Der Feed gewichtet persönliche Prioritäten und Einschränkungen bei der Reihenfolge stärker.',
            'Wenn mehrere Rollen ähnlich relevant sind, steigen die hoch, die besser zu deiner Realität passen.',
            'Discovery wird weniger flach und stärker entscheidungsorientiert, besonders wenn du zwischen nahen Richtungen abwägst.'
          ],
          premiumActiveNote: 'Die personalisierte JHI-Schicht ist aktiv. Der praktische Effekt liegt in Reihenfolge und Priorisierung, nicht darin, dass der Rest des Marktes hart ausgeblendet wird.'
        },
        {
          id: 'jcfpm',
          label: 'Detaillierter JCFPM-Bericht',
          title: 'Detaillierter JCFPM-Bericht',
          summary: 'Der JCFPM-Bericht geht tiefer in Persönlichkeitsmuster hinein und zeigt, wie sie Arbeitsstil, Risikoprofile und Systemempfehlungen beeinflussen.',
          whyTitle: 'Warum es das in Shaman gibt',
          whyBody: 'Es reicht nicht zu wissen, was du kannst. Wichtig ist auch, wie du unter Druck, Unsicherheit oder in unterschiedlichen Teamkontexten funktionierst. Genau das schärft dieser Bericht.',
          premiumTitle: 'Was sich mit Premium ändert',
          premiumBody: 'Der Hauptunterschied liegt in Tiefe und Transparenz. Du siehst klarer, warum das System manche Rollen höher priorisiert und wo es langfristige Risiken oder Nachhaltigkeit erkennt.',
          premiumEffects: [
            'Du erhältst den vollständigen Bericht statt einer gekürzten Fassung.',
            'Du kannst besser nachvollziehen, warum bestimmte Richtungen langfristig tragfähiger erscheinen als andere.',
            'JCFPM dient stärker als Erklärungs- und Audit-Schicht für Empfehlungen statt als isolierter Zusatztest.'
          ],
          premiumActiveNote: 'Die vollständige JCFPM-Interpretation ist für dich freigeschaltet. Der praktische Effekt liegt in klarerer Begründung der Empfehlungen, nicht in mehr Interface-Lärm.'
        }
      ];
    }

    if (language === 'pl') {
      return [
        {
          id: 'dialogue_slots',
          label: 'Więcej slotów dialogowych dla aktywnych odpowiedzi',
          title: 'Więcej slotów dialogowych dla aktywnych odpowiedzi',
          summary: 'Sloty określają, ile naprawdę aktywnych rozmów możesz prowadzić jednocześnie bez rozpraszania uwagi na dziesiątki pustych wątków.',
          whyTitle: 'Dlaczego to istnieje w Shamanie',
          whyBody: 'Celem nie jest rozesłanie jak największej liczby CV, ale prowadzenie ograniczonej liczby jakościowych dialogów tam, gdzie szansa na odpowiedź jest realna po obu stronach.',
          premiumTitle: 'Co zmienia premium',
          premiumBody: 'Zmienia się głównie pojemność i tempo pracy z odpowiedziami. Discovery nie rankuje inaczej z powodu slotów, ale możesz bezpiecznie utrzymać więcej otwartych kierunków naraz.',
          premiumEffects: [
            'Otrzymujesz więcej aktywnych slotów dialogowych jednocześnie niż w wersji free.',
            'Nie musisz tak szybko zamykać jednego wątku tylko po to, aby otworzyć kolejny.',
            'Feed nie jest przez to przestawiany; zmienia się głównie to, ile poważnych odpowiedzi możesz obsłużyć równolegle.'
          ],
          premiumActiveNote: 'Warstwa slotów jest już u Ciebie aktywna. Praktyczny efekt to przede wszystkim większa pojemność aktywnych rozmów, a nie marketingowa odznaka.'
        },
        {
          id: 'ai_guide',
          label: 'AI przewodnik po profilu i sytuacji życiowej',
          title: 'AI przewodnik po profilu i sytuacji życiowej',
          summary: 'Ta warstwa pomaga przełożyć niejasne preferencje, ograniczenia życiowe i kierunek kariery na konkretne ustawienia oraz bardziej praktyczny feed.',
          whyTitle: 'Dlaczego to istnieje w Shamanie',
          whyBody: 'Ludzie często wiedzą, jaka jest ich sytuacja, ale nie wiedzą, jak przełożyć ją na filtry. AI przewodnik zamienia to w użyteczne ustawienia discovery.',
          premiumTitle: 'Co zmienia premium',
          premiumBody: 'System dostaje więcej uporządkowanych sygnałów o Twoim kontekście. W praktyce oznacza to dokładniejsze ustawienia domyślne i mniej ogólnych lub granicznych rekomendacji.',
          premiumEffects: [
            'AI przewodnik potrafi uzupełnić i doprecyzować większą część discovery bez ręcznego strojenia każdego filtra.',
            'Feed pracuje z silniejszą interpretacją Twojej sytuacji życiowej, a nie tylko z rolą i lokalizacją.',
            'Rekomendacje rzadziej odpływają w role, które wyglądają podobnie na papierze, ale nie pasują do Twoich realnych ograniczeń.'
          ],
          premiumActiveNote: 'AI przewodnik jest u Ciebie aktywny jako warstwa wejściowa do logiki discovery. Praktyczny efekt to lepsze defaults, a nie po prostu kolejny formularz.'
        },
        {
          id: 'jhi',
          label: 'Spersonalizowany indeks JHI',
          title: 'Spersonalizowany indeks JHI',
          summary: 'JHI nie jest ogólnym wynikiem rynku. To osobista warstwa decyzyjna, która waży role przez pryzmat Twoich priorytetów, kompromisów i realiów.',
          whyTitle: 'Dlaczego to istnieje w Shamanie',
          whyBody: 'Dwie równie dobre role mogą być zupełnie inaczej dopasowane dla dwóch różnych osób. JHI stara się odzwierciedlać realne decyzje, a nie tylko ogólny ranking.',
          premiumTitle: 'Co zmienia premium',
          premiumBody: 'Premium nie tworzy nowych ofert. Zmienia głównie priorytet i interpretację wyników, więc na górze częściej zostają role lepiej pasujące do Twoich realnych trade-offów.',
          premiumEffects: [
            'Feed silniej uwzględnia osobiste priorytety i ograniczenia podczas rankingu wyników.',
            'Gdy kilka ról jest podobnie trafnych, wyżej trafiają te, które lepiej pasują do Twojej rzeczywistości.',
            'Discovery staje się mniej płaskie i bardziej decyzyjne, zwłaszcza gdy porównujesz kilka bliskich kierunków.'
          ],
          premiumActiveNote: 'Spersonalizowana warstwa JHI jest aktywna. Praktyczny efekt dotyczy kolejności i priorytetu ról, a nie twardego ukrywania reszty rynku.'
        },
        {
          id: 'jcfpm',
          label: 'Szczegółowy raport JCFPM',
          title: 'Szczegółowy raport JCFPM',
          summary: 'Raport JCFPM głębiej opisuje ustawienie osobowościowe i pokazuje, jak wpływa ono na styl pracy, wzorce ryzyka i rekomendacje systemu.',
          whyTitle: 'Dlaczego to istnieje w Shamanie',
          whyBody: 'Nie wystarczy wiedzieć tylko, co potrafisz. Ważne jest także to, jak działasz pod presją, w niepewności i w różnych typach zespołów. Właśnie to ten raport doprecyzowuje.',
          premiumTitle: 'Co zmienia premium',
          premiumBody: 'Główna różnica to głębia i transparentność. Lepiej widzisz, dlaczego system wypycha niektóre role wyżej i gdzie widzi ryzyko długoterminowego przeciążenia lub niedopasowania.',
          premiumEffects: [
            'Otrzymujesz pełny raport zamiast skróconego wyniku.',
            'Możesz lepiej zrozumieć, dlaczego niektóre kierunki system uznaje za bardziej zrównoważone długoterminowo.',
            'JCFPM działa bardziej jako warstwa wyjaśnienia i audytu rekomendacji niż jako kolejny oderwany test.'
          ],
          premiumActiveNote: 'Pełna interpretacja JCFPM jest już u Ciebie odblokowana. Praktyczny efekt to czytelniejsze uzasadnienie rekomendacji, a nie więcej szumu w interfejsie.'
        }
      ];
    }

    return [
      {
        id: 'dialogue_slots',
        label: 'More dialogue slots for active replies',
        title: 'More dialogue slots for active replies',
        summary: 'Slots define how many real conversations you can keep active at once without turning discovery into a chaotic pile of threads.',
        whyTitle: 'Why this exists in Shaman',
        whyBody: 'The goal is not to spray applications everywhere, but to keep a focused number of high-quality dialogues where both sides are likely to respond.',
        premiumTitle: 'What changes with premium',
        premiumBody: 'This mainly changes capacity and operating tempo. Discovery does not rank differently because of slots, but you can keep more live directions open at the same time.',
        premiumEffects: [
          'You get more active dialogue slots at once than in the free tier.',
          'You do not need to close one thread as quickly just to open another one.',
          'The feed itself is not re-ranked by slots; the change is mostly in how many serious responses you can manage in parallel.'
        ],
        premiumActiveNote: 'This layer is already active for you. The practical effect is higher conversation capacity, not a cosmetic premium badge.'
      },
      {
        id: 'ai_guide',
        label: 'AI guide for profile and life context',
        title: 'AI guide for profile and life context',
        summary: 'This layer turns fuzzy preferences, life constraints, and career direction into concrete settings and a sharper discovery feed.',
        whyTitle: 'Why this exists in Shaman',
        whyBody: 'People often know their situation but not how to translate it into filters. The AI guide converts that context into practical discovery settings.',
        premiumTitle: 'What changes with premium',
        premiumBody: 'The system receives more structured input about your context. The practical effect is more precise defaults and fewer generic or borderline recommendations.',
        premiumEffects: [
          'The AI guide can fill in and refine more of your discovery setup without manual filter tuning.',
          'The feed works with a stronger interpretation of your real-life context, not only your role and location.',
          'Recommendations are less likely to drift into roles that look adjacent on paper but do not fit your actual constraints.'
        ],
        premiumActiveNote: 'The AI guide is active for you as an input layer into discovery. Its practical effect is better defaults, not just another form.'
      },
      {
        id: 'jhi',
        label: 'Personalized JHI score',
        title: 'Personalized JHI score',
        summary: 'JHI is not a generic market score. It is a personal decision layer that weighs roles through your own priorities, tradeoffs, and reality.',
        whyTitle: 'Why this exists in Shaman',
        whyBody: 'Two equally strong roles can be a very different fit for two different people. JHI tries to reflect real-life decision making, not only generic ranking.',
        premiumTitle: 'What changes with premium',
        premiumBody: 'Premium does not create new jobs. It changes how results are prioritized, so the top of the feed more often reflects your actual trade-offs instead of a flatter market ranking.',
        premiumEffects: [
          'The feed weighs personal priorities and constraints more strongly during ranking.',
          'When several roles are similarly relevant, the ones that better fit your reality rise higher.',
          'Discovery becomes less flat and more decision-oriented, especially when you compare several adjacent directions.'
        ],
        premiumActiveNote: 'The personalized JHI layer is active for you. The practical effect is in result ordering and prioritization, not in hard-hiding the rest of the market.'
      },
      {
        id: 'jcfpm',
        label: 'Detailed JCFPM report',
        title: 'Detailed JCFPM report',
        summary: 'The JCFPM report goes deeper into personality setup and shows how it affects work style, risk patterns, and system recommendations.',
        whyTitle: 'Why this exists in Shaman',
        whyBody: 'It is not enough to know only what you can do. It also matters how you operate under pressure, uncertainty, and in different team environments.',
        premiumTitle: 'What changes with premium',
        premiumBody: 'The main change is depth and transparency. You can see more clearly why the system pushes some roles higher and where it sees long-term risk or sustainability.',
        premiumEffects: [
          'You get the full report instead of the shortened output.',
          'You can inspect why the system considers some directions more sustainable over time than others.',
          'JCFPM acts more like an explanation and audit layer for recommendations, not just another isolated test.'
        ],
        premiumActiveNote: 'The full JCFPM interpretation is already unlocked for you. The practical effect is clearer reasoning behind recommendations, not more interface noise.'
      }
    ];
  }, [isCsLike]);

  const mobileSwipeStateStorageKey = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    const normalizedCity = String(filterCity || '').trim().toLowerCase();
    const languageKey = [...filterLanguageCodes].sort().join(',');
    const contractKey = [...filterContractType].sort().join(',');
    const benefitsKey = [...filterBenefits].sort().join(',');
    const experienceKey = [...filterExperience].sort().join(',');
    return [
      'marketplace-v2',
      lane,
      workArrangementFilter,
      geographicScopeFilter,
      normalizedSearch || 'no-search',
      normalizedCity || 'no-city',
      enableCommuteFilter ? `commute-${filterMaxDistance}` : 'no-commute',
      filterMinSalary > 0 ? `salary-${filterMinSalary}` : 'no-salary',
      filterDate || 'all',
      languageKey || 'no-languages',
      contractKey || 'no-contract',
      benefitsKey || 'no-benefits',
      experienceKey || 'no-experience',
      usePersonalSetup ? 'setup-on' : 'setup-off',
    ].join(':');
  }, [
    enableCommuteFilter,
    filterBenefits,
    filterCity,
    filterContractType,
    filterDate,
    filterExperience,
    filterLanguageCodes,
    filterMaxDistance,
    filterMinSalary,
    geographicScopeFilter,
    lane,
    searchTerm,
    usePersonalSetup,
    workArrangementFilter,
  ]);

  useEffect(() => {
    if (!pendingSearchScroll || loading) return;
    if (prioritizedJobsInLane.length === 0) return;

    const rafId = window.requestAnimationFrame(() => {
      scrollToFirstFeedItem();
      setPendingSearchScroll(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loading, pendingSearchScroll, prioritizedJobsInLane.length, mobileViewMode]);

  return (
    <section className="space-y-5">
      {!userProfile.isLoggedIn ? (
      <div className="hidden md:block">
        <PageHeader
          eyebrow={microJobsOnly ? microJobDiscoveryCopy.heroEyebrow : copy.eyebrow}
          title={microJobsOnly ? microJobDiscoveryCopy.heroTitle : copy.title}
          body={microJobsOnly ? microJobDiscoveryCopy.heroBody : copy.body}
          className="p-4 sm:p-5 md:p-6"
        >
          {!userProfile.isLoggedIn ? (
            <div className="flex min-h-[360px] flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="min-h-[210px] space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(var(--accent-rgb),0.2)] bg-white/84 text-[var(--accent)] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.4)] dark:bg-[rgba(15,23,42,0.82)]">
                      {React.createElement(activeGuestOnboardingSlide.icon, { size: 16 })}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        {activeGuestOnboardingSlide.kicker}
                      </div>
                      <h2 className="text-xl font-semibold tracking-[-0.035em] text-[var(--text-strong)] sm:text-[1.4rem]">
                        {activeGuestOnboardingSlide.title}
                      </h2>
                    </div>
                  </div>
                  <p className="max-w-3xl text-sm leading-5 text-[var(--text-muted)]">{activeGuestOnboardingSlide.body}</p>
                  <p className="max-w-3xl text-sm leading-5 text-[var(--text-muted)]">{activeGuestOnboardingSlide.detail}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeGuestOnboardingSlide.chips.map((chip) => (
                    <div
                      key={chip}
                      className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/78 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)] dark:bg-[rgba(15,23,42,0.72)]"
                    >
                      {chip}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    {guestOnboardingSlides.map((slide, index) => (
                      <button
                        key={slide.title}
                        type="button"
                        onClick={() => setGuestDiscoverySlide(index)}
                        className={cn(
                          'h-2.5 rounded-full transition',
                          guestDiscoverySlide === index
                            ? 'w-8 bg-[var(--accent)]'
                            : 'w-2.5 bg-[rgba(var(--accent-rgb),0.24)] hover:bg-[rgba(var(--accent-rgb),0.4)]'
                        )}
                        aria-label={`${guestOnboardingContent.showSlide} ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGuestDiscoverySlide((current) => (current === 0 ? guestOnboardingSlides.length - 1 : current - 1))}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white/70 px-2.5 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <ArrowRight size={14} className="rotate-180" />
                      {guestOnboardingContent.back}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestDiscoverySlide((current) => (current + 1) % guestOnboardingSlides.length)}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.1)] px-2.5 py-1.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[rgba(var(--accent-rgb),0.16)]"
                    >
                      {guestOnboardingContent.next}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex min-h-[280px] min-w-[160px] flex-col gap-2.5">
                <MetricTile
                  label={copy.results}
                  value={displayedResultsCount}
                  helper={resultsMetricHelper}
                  className="border-[rgba(var(--accent-rgb),0.14)] bg-white/84 dark:bg-[rgba(15,23,42,0.78)]"
                />
                <SurfaceCard className="space-y-2 border-[rgba(var(--accent-rgb),0.14)] bg-white/84 p-3 dark:bg-[rgba(15,23,42,0.78)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    {guestOnboardingContent.readFeed}
                  </div>
                  <p className="text-sm leading-5 text-[var(--text-muted)]">{copy.fitNote}</p>
                </SurfaceCard>
              </div>
            </div>
          ) : null}
        </PageHeader>
      </div>
      ) : null}

      {setupSignals.length > 0 ? (
        <>
          <div id="challenge-why-roles">
            <SurfaceCard className="space-y-3 lg:rounded-b-none lg:border-b-0 lg:pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-strong)]">
                    {getLocaleLabel({
                      cs: 'Proč se Vám ukazují tyto role',
                      sk: 'Prečo sa Vám ukazujú tieto roly',
                      de: 'Warum Ihnen diese Rollen angezeigt werden',
                      at: 'Warum Ihnen diese Rollen angezeigt werden',
                      pl: 'Dlaczego widzi Pan/Pani te role',
                      en: 'Why these roles show up'
                    }, language)}
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    {getLocaleLabel({
                      cs: 'Rychlý souhrn signálů, které právě teď nejvíc formují Váš feed.',
                      sk: 'Rýchly súhrn signálov, ktoré práve teraz najviac formujú Váš feed.',
                      de: 'Eine kurze Zusammenfassung der Signale, die den Feed gerade am stärksten prägen.',
                      at: 'Eine kurze Zusammenfassung der Signale, die den Feed gerade am stärksten prägen.',
                      pl: 'Krótki przegląd sygnałów, które w tej chwili najmocniej kształtują feed.',
                      en: 'A quick summary of the signals shaping the feed right now.'
                    }, language)}
                  </p>
                </div>
                {!hasManualIntent && inferredIntentAvailable ? (
                  <button type="button" className="app-button-secondary" onClick={onOpenProfile}>
                    {copy.intentPromptCta}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:hidden">
                {setupSignals.map((signal) => (
                  <FilterChip key={`why-${signal}`} active className="justify-start">
                    {signal}
                  </FilterChip>
                ))}
              </div>
            </SurfaceCard>
          </div>
          <div className="hidden lg:sticky lg:top-[calc(var(--app-toolbar-offset)+6px)] lg:z-20 lg:block">
            <div className="-mt-px app-surface rounded-[var(--radius-md)] border border-t-0 p-3 shadow-[var(--shadow-soft)] lg:rounded-t-none lg:bg-[rgba(255,255,255,0.9)] lg:backdrop-blur dark:lg:bg-[rgba(15,23,42,0.82)]">
              <div className="flex flex-wrap gap-2">
                {setupSignals.map((signal) => (
                  <FilterChip key={`why-sticky-${signal}`} active className="justify-start">
                    {signal}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* AppHeader already renders the discovery search on lg+; keep this one for mobile/tablet only. */}
      <PublicActivityPanel mode="discovery" className="border-[rgba(var(--accent-rgb),0.12)]" />

      {/* AppHeader already renders the discovery search on lg+; keep this one for mobile/tablet only. */}
      <Toolbar className="space-y-4 lg:hidden">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_auto]">
          <div className="app-command-field">
            <Search size={16} className="text-[var(--text-faint)]" />
            <input
              id="challenge-discovery-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearchSubmit();
              }}
              placeholder={copy.toolbarSearch}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          <div className="app-command-field">
            <MapPin size={16} className="text-[var(--text-faint)]" />
            <input
              value={filterCity}
              onChange={(event) => setFilterCity(event.target.value)}
              placeholder={copy.toolbarLocation}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          <button type="button" onClick={handleSearchSubmit} className="app-button-primary min-w-[130px]">
            <Search size={16} />
            {copy.search}
          </button>
        </div>
      </Toolbar>

      {/* Quick toggles are useful on smaller screens; on XL they duplicate the left filter column. */}
      <Toolbar sticky className="xl:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {!microJobsOnly ? (
            <>
              <FilterChip active={lane === 'challenges'} onClick={() => setLane('challenges')}>
                {copy.laneChallenges}
              </FilterChip>
              <FilterChip active={lane === 'imports'} onClick={() => setLane('imports')}>
                {copy.laneImports}
              </FilterChip>
            </>
          ) : null}
          <FilterChip active={workArrangementFilter === 'remote'} onClick={() => handleWorkArrangementFilterChange(workArrangementFilter === 'remote' ? 'all' : 'remote')}>
            {copy.remoteOnly}
          </FilterChip>
          <FilterChip active={enableCommuteFilter} onClick={() => setCommuteEnabled(!enableCommuteFilter)}>
            <TrainFront size={14} />
            {copy.commute}
          </FilterChip>
          <FilterChip active={geographicScopeFilter === 'all'} onClick={() => handleGeographicScopeChange(geographicScopeFilter === 'all' ? 'domestic' : 'all')}>
            <Globe size={14} />
            {copy.locationAll}
          </FilterChip>
          <FilterChip active={geographicScopeFilter === 'abroad'} onClick={() => handleGeographicScopeChange(geographicScopeFilter === 'abroad' ? 'domestic' : 'abroad')}>
            {copy.border}
          </FilterChip>
        </div>
      </Toolbar>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden xl:block xl:sticky xl:top-[calc(var(--app-toolbar-offset)+4.75rem+6px)] xl:self-start">
          <div className="space-y-5 xl:max-h-[calc(100dvh-var(--app-toolbar-offset)-4.75rem-1.5rem-6px)] xl:overflow-y-auto xl:pr-2 xl:pb-4 [&_.app-filter-chip]:!rounded-[0.95rem]">
            <SurfaceCard className="space-y-5">
              <FilterSection title={getLocaleLabel({
                cs: 'Režim hledání',
                sk: 'Režim hľadania',
                de: 'Suchmodus',
                at: 'Suchmodus',
                pl: 'Tryb wyszukiwania',
                en: 'Search mode'
              }, language)}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={usePersonalSetup}
                      onClick={() => {
                        setUsePersonalSetup(true);
                        if (!remoteOnly && resolvedSearchProfile.defaultEnableCommuteFilter) {
                          setCommuteEnabled(true);
                          setFilterMaxDistance(resolvedSearchProfile.defaultMaxDistanceKm || 50);
                        }
                      }}
                    >
                      {copy.useSetup}
                    </FilterChip>
                    <FilterChip
                      active={!usePersonalSetup}
                      onClick={() => {
                        setUsePersonalSetup(false);
                        resetToManualDiscovery();
                      }}
                    >
                      {copy.disableSetup}
                    </FilterChip>
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    {usePersonalSetup
                      ? getLocaleLabel({
                        cs: 'Feed bere v úvahu i Váš profil, situaci a intent.',
                        sk: 'Feed berie do úvahy aj Váš profil, situáciu a intent.',
                        de: 'Der Feed berücksichtigt auch Ihr Profil, Ihren Kontext und Ihren Intent.',
                        at: 'Der Feed berücksichtigt auch Ihr Profil, Ihren Kontext und Ihren Intent.',
                        pl: 'Feed uwzględnia też Twój profil, kontekst i intencję.',
                        en: 'The feed also uses your profile, context, and intent.'
                      }, language)
                      : getLocaleLabel({
                        cs: 'Feed jede čistě podle hledání a ručních filtrů.',
                        sk: 'Feed ide čisto podľa hľadania a ručných filtrov.',
                        de: 'Der Feed läuft rein auf Suchbegriff und manuellen Filtern.',
                        at: 'Der Feed läuft rein auf Suchbegriff und manuellen Filtern.',
                        pl: 'Feed działa wyłącznie na podstawie wyszukiwania i ręcznych filtrów.',
                        en: 'The feed runs purely on search and manual filters.'
                      }, language)}
                  </p>
                </div>
              </FilterSection>

              <div id="challenge-commute-section">
              <FilterSection title={copy.workModel}>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {copy.workModelMode}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <FilterChip active={workArrangementFilter === 'remote'} onClick={() => handleWorkArrangementFilterChange('remote')}>
                        {copy.remoteOnly}
                      </FilterChip>
                      <FilterChip active={workArrangementFilter === 'hybrid'} onClick={() => handleWorkArrangementFilterChange('hybrid')}>
                        {copy.hybridOnly}
                      </FilterChip>
                      <FilterChip active={workArrangementFilter === 'onsite'} onClick={() => handleWorkArrangementFilterChange('onsite')}>
                        {copy.onsiteOnly}
                      </FilterChip>
                      <FilterChip active={workArrangementFilter === 'all'} onClick={() => handleWorkArrangementFilterChange('all')}>
                        {copy.allWorkModels}
                      </FilterChip>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {copy.commuteMode}
                    </div>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={enableCommuteFilter} onClick={() => setCommuteEnabled(true)}>
                      {copy.commuteEnabledLabel}
                    </FilterChip>
                    <FilterChip active={!enableCommuteFilter} onClick={() => setCommuteEnabled(false)}>
                      {hasCommuteProfile ? copy.commuteDisabledLabel : copy.commuteInactive}
                    </FilterChip>
                  </div>
                  {enableCommuteFilter ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {filterMaxDistance} km
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={200}
                        step={5}
                        value={filterMaxDistance}
                        onChange={(event) => setFilterMaxDistance(Number(event.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                  ) : !hasCommuteProfile ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.commuteHint}</p>
                      <button
                        type="button"
                        onClick={userProfile.isLoggedIn ? onOpenProfile : onOpenAuth}
                        className="app-button-secondary"
                      >
                        {userProfile.isLoggedIn ? copy.commuteProfileCta : copy.commuteRegisterCta}
                      </button>
                    </div>
                  ) : null}
                  </div>
                </div>
              </FilterSection>
              </div>

              <div id="challenge-location-scope-section">
              <FilterSection title={copy.locationScope}>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={geographicScopeFilter === 'domestic'} onClick={() => handleGeographicScopeChange('domestic')}>
                    {copy.domestic}
                  </FilterChip>
                  <FilterChip
                    active={geographicScopeFilter === 'border'}
                    onClick={() => handleGeographicScopeChange('border')}
                    className="justify-start"
                  >
                    {copy.locationBorder}
                  </FilterChip>
                  <FilterChip
                    active={geographicScopeFilter === 'abroad'}
                    onClick={() => handleGeographicScopeChange('abroad')}
                    className="justify-start"
                  >
                    {copy.border}
                  </FilterChip>
                  <FilterChip
                    active={geographicScopeFilter === 'all'}
                    onClick={() => handleGeographicScopeChange('all')}
                    className="justify-start"
                  >
                    {copy.locationAll}
                  </FilterChip>
                </div>
              </FilterSection>
              </div>

              <FilterSection title={copy.remoteLanguages}>
                <div className="space-y-3">
                  {implicitLanguageCodesApplied.length > 0 ? (
                    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                          {getLocaleLabel({
                            cs: 'Automaticky omezeno',
                            sk: 'Automaticky obmedzené',
                            de: 'Automatisch eingeschränkt',
                            at: 'Automatisch eingeschränkt',
                            pl: 'Automatyczne ograniczenie',
                            en: 'Auto constraints'
                          }, language)}
                        </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <FilterChip active className="justify-start">
                          {copy.listingLanguageLabel}{' '}
                          {implicitLanguageCodesApplied
                            .map((code) => {
                              const labelSource = REMOTE_LANGUAGE_OPTIONS.find((opt) => opt.key === code)?.labels;
                              return labelSource ? getLocaleLabel(labelSource, language) : String(code).toUpperCase();
                            })
                            .join(' / ')}
                        </FilterChip>
                        <button
                          type="button"
                          className="app-button-secondary !px-3 !py-2"
                          onClick={() => setEnableAutoLanguageGuard(false)}
                          title={copy.listingLanguageDisableTitle}
                        >
                          {getLocaleLabel({ cs: 'Vypnout', sk: 'Vypnúť', de: 'Deaktivieren', at: 'Deaktivieren', pl: 'Wyłącz', en: 'Disable' }, language)}
                        </button>
                      </div>
                    </div>
                  ) : (!enableAutoLanguageGuard && filterLanguageCodes.length === 0 && !globalSearch ? (
                    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {getLocaleLabel({
                          cs: 'Automatika vypnuta',
                          sk: 'Automatika vypnutá',
                          de: 'Automatik aus',
                          at: 'Automatik aus',
                          pl: 'Automatyka wyłączona',
                          en: 'Auto disabled'
                        }, language)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[var(--text-muted)]">
                          {copy.listingLanguageAutoDisabled}
                        </span>
                        <button
                          type="button"
                          className="app-button-secondary !px-3 !py-2"
                          onClick={() => setEnableAutoLanguageGuard(true)}
                        >
                          {getLocaleLabel({ cs: 'Zapnout', sk: 'Zapnúť', de: 'Aktivieren', at: 'Aktivieren', pl: 'Włącz', en: 'Enable' }, language)}
                        </button>
                      </div>
                    </div>
                  ) : null)}
                  <div className="flex flex-wrap gap-2">
                    {REMOTE_LANGUAGE_OPTIONS.map((option) => {
                      const active = filterLanguageCodes.includes(option.key);
                      return (
                        <FilterChip
                          key={option.key}
                          active={active}
                          onClick={() =>
                            setFilterLanguageCodes(
                              active
                                ? filterLanguageCodes.filter((code) => code !== option.key)
                                : [...filterLanguageCodes, option.key]
                            )
                          }
                        >
                          {getLocaleLabel(option.labels, language)}
                        </FilterChip>
                      );
                    })}
                  </div>
                </div>
              </FilterSection>

              <FilterSection title={copy.roleType}>
                <div className="flex flex-wrap gap-2">
                  {ROLE_TYPES.map((type) => (
                    <FilterChip
                      key={type.key}
                      active={filterContractType.includes(type.key)}
                      onClick={() => toggleContractTypeFilter(type.key)}
                    >
                      {getLocaleLabel(type.labels, language)}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.minSalary}>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    {filterMinSalary > 0 ? filterMinSalary.toLocaleString(i18n.language) : copy.anySalary}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={250000}
                    step={5000}
                    value={filterMinSalary}
                    onChange={(event) => setFilterMinSalary(Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
              </FilterSection>

              <FilterSection title={copy.experience}>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <FilterChip
                      key={level.key}
                      active={filterExperience.includes(level.key)}
                      onClick={() =>
                        setFilterExperience(
                          filterExperience.includes(level.key)
                            ? filterExperience.filter((item) => item !== level.key)
                            : [...filterExperience, level.key]
                        )
                      }
                    >
                      {getLocaleLabel(level.labels, language)}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.benefits}>
                <div className="flex flex-wrap gap-2">
                  {BENEFIT_FILTERS.map((benefit) => (
                    <FilterChip
                      key={benefit.key}
                      active={filterBenefits.includes(benefit.key)}
                      onClick={() => toggleBenefitFilter(benefit.key)}
                    >
                      {getLocaleLabel(benefit.labels, language)}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.date}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: copy.allDates },
                    { key: '3d', label: copy.last3Days },
                    { key: '7d', label: copy.last7Days },
                    { key: '30d', label: copy.last30Days }
                  ].map((option) => (
                    <FilterChip key={option.key} active={filterDate === option.key} onClick={() => setFilterDate(option.key)}>
                      {option.label}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>
            </SurfaceCard>

            <div id="challenge-marketplace-setup-card">
            <SurfaceCard className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--accent)]" />
                  <div className="text-sm font-semibold text-[var(--text-strong)]">
                    {usePersonalSetup ? copy.mySetup : copy.manualSection}
                  </div>
                </div>
              </div>
              {usePersonalSetup ? (
                <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile label={copy.matchesNow} value={feedJobs.length} tone="accent" />
                  <MetricTile
                    label={copy.remoteSection}
                    value={prioritizedJobsInLane.filter((job) => job.matchBucket === 'adjacent').length}
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricTile
                    label={copy.results}
                    value={displayedResultsCount}
                    helper={resultsMetricHelper}
                    tone="accent"
                  />
                  <MetricTile
                    label={copy.filters}
                    value={hasActiveFilters ? (isCsLike ? 'Zapnuté' : 'On') : (isCsLike ? 'Vypnuté' : 'Off')}
                  />
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-[var(--accent)]" />
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.personalPresets}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {personalPresets.map((preset) => (
                    <FilterChip key={preset.id} onClick={() => applyFilterSnapshot(preset.filters)} className="justify-start">
                      {preset.name}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <SavedFiltersMenu onLoadFilter={applyFilterSnapshot} currentFilters={currentFilters} hasActiveFilters={hasActiveFilters} />
            </SurfaceCard>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {userProfile.isLoggedIn ? (
          <Toolbar className="xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--text-strong)]">
                {copy.mobileSwipeTitle}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={mobileViewMode === 'swipe'} onClick={() => setMobileViewMode('swipe')}>
                  {copy.mobileSwipe}
                </FilterChip>
                <FilterChip active={mobileViewMode === 'list'} onClick={() => setMobileViewMode('list')}>
                  {copy.mobileList}
                </FilterChip>
              </div>
            </div>
          </Toolbar>
          ) : (
          <SurfaceCard className="space-y-4 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.mobileSwipeTitle}</div>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.mobileSwipeBody}</p>
                {!userProfile.isLoggedIn && showMobileSwipeIntro ? (
                  <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.mobileSwipeGuestBody}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={mobileViewMode === 'swipe'} onClick={() => setMobileViewMode('swipe')}>
                  {copy.mobileSwipe}
                </FilterChip>
                <FilterChip active={mobileViewMode === 'list'} onClick={() => setMobileViewMode('list')}>
                  {copy.mobileList}
                </FilterChip>
              </div>
            </div>
            {!userProfile.isLoggedIn && showMobileSwipeIntro ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="app-button-primary justify-center"
                  onClick={onOpenAuth}
                >
                  <Sparkles size={16} />
                  {copy.mobileSwipeRegister}
                </button>
                <button
                  type="button"
                  className="app-button-secondary justify-center"
                  onClick={() => {
                    setMobileSwipeIntroDismissed(true);
                    setMobileViewMode('list');
                  }}
                >
                  {copy.mobileSwipeSkip}
                </button>
              </div>
            ) : null}
          </SurfaceCard>
          )}

          {mobileViewMode === 'swipe' && !isXlViewport ? (
            <div id="challenge-feed-swipe" className="xl:hidden">
              <MobileSwipeJobBrowser
                jobs={prioritizedJobsInLane}
                swipeStateStorageKey={mobileSwipeStateStorageKey}
                savedJobIds={savedJobIds}
                onToggleSave={handleToggleSave}
                onRejectJob={(jobId) => applyInteractionState(jobId, 'swipe_left')}
                onOpenDetails={handleJobSelect}
                onSwitchToList={() => {
                  setMobileSwipeIntroDismissed(true);
                  setMobileViewMode('list');
                }}
                isLoadingMore={loadingMore}
                isLoading={loading}
                hasMore={hasMore}
                onLoadMore={loadMoreJobs}
                theme={theme}
                fullscreen={userProfile.isLoggedIn}
              />
            </div>
          ) : null}

          {!hasPremiumAccess ? (
          <SurfaceCard className="hidden overflow-hidden border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(249,250,251,0.96))] shadow-[0_30px_70px_-52px_rgba(15,23,42,0.35)] lg:block dark:bg-[linear-gradient(145deg,rgba(17,24,39,0.96),rgba(15,23,42,0.94))]">
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:p-5">
              <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="space-y-4">
                  <div className="app-eyebrow w-fit">
                    <Sparkles size={12} />
                    {copy.premiumTitle}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                      {{
                        cs: 'Víc prostoru pro odpovědi, jasnější vedení a silnější rozhodovací vrstvu',
                        sk: 'Viac priestoru na odpovede, jasnejšie vedenie a silnejšia rozhodovacia vrstva',
                        de: 'Mehr Raum für Antworten, klarere Führung und eine stärkere Entscheidungsebene',
                        at: 'Mehr Raum für Antworten, klarere Führung und eine stärkere Entscheidungsebene',
                        pl: 'Więcej przestrzeni na odpowiedzi, jaśniejsze prowadzenie i silniejsza warstwa decyzyjna',
                        en: 'More room for replies, clearer guidance, and a stronger decision layer'
                      }[language]}
                    </h3>
                    <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.premiumBody}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {premiumFeatures.map((feature) => (
                      <button
                        key={feature.id}
                        type="button"
                        id={feature.id === 'jcfpm' ? 'challenge-premium-feature-jcfpm' : undefined}
                        onClick={() => setSelectedPremiumFeature(feature)}
                        className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-left text-sm font-medium text-[var(--text-strong)] transition hover:-translate-y-[1px] hover:border-[rgba(var(--accent-rgb),0.24)] hover:bg-[var(--surface)]"
                      >
                        {feature.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    {!hasPremiumAccess ? (
                      <button
                        type="button"
                        className="app-button-primary justify-center"
                        onClick={() => onOpenPremium(copy.premiumTitle)}
                      >
                        <Sparkles size={16} />
                        {copy.premiumCta}
                      </button>
                    ) : (
                      <div className="rounded-[var(--radius-lg)] border border-emerald-200/70 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {isCsLike ? 'Premium je aktivní' : 'Premium is active'}
                      </div>
                    )}
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {isCsLike ? 'Sloty • AI průvodce • JHI • JCFPM' : 'Slots • AI guide • JHI • JCFPM'}
                    </p>
                  </div>
                </div>
              </div>
              <div id="challenge-slots-card" className="rounded-[var(--radius-xl)] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.08),rgba(255,255,255,0.96))] p-5 shadow-[var(--shadow-soft)] dark:bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.14),rgba(17,24,39,0.94))]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[var(--accent)]" />
                    <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.slotsTitle}</div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.slotsBody}</p>
                  {resolvedDialogueCapacity ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <MetricTile
                        label={copy.slotsTitle}
                        value={copy.slotsValue
                          .replace('{{active}}', String(resolvedDialogueCapacity.active))
                          .replace('{{limit}}', String(resolvedDialogueCapacity.limit))}
                        tone="accent"
                      />
                      <MetricTile
                        label={copy.slotsRemainingLabel}
                        value={copy.slotsRemaining.replace('{{remaining}}', String(resolvedDialogueCapacity.remaining))}
                        className="bg-[var(--surface)]"
                      />
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                      {!userProfile.isLoggedIn || !userProfile.id
                        ? copy.slotsEmpty
                        : isDialogueCapacityLoading
                          ? copy.slotsLoading
                          : copy.slotsUnavailable}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SurfaceCard>
          ) : null}

          <div className={cn(mobileViewMode === 'swipe' && 'hidden xl:block')}>
          <SurfaceCard className="space-y-4 border-[rgba(var(--accent-rgb),0.2)] bg-[linear-gradient(135deg,rgba(255,252,245,0.98),rgba(255,255,255,0.98)_46%,rgba(245,250,255,0.98))] shadow-[0_24px_70px_-52px_rgba(15,23,42,0.3)] dark:bg-[linear-gradient(135deg,rgba(41,30,8,0.34),rgba(15,23,42,0.96)_48%,rgba(17,24,39,0.98))]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="app-eyebrow w-fit !bg-[rgba(var(--accent-rgb),0.12)] !text-[var(--accent)]">
                  <Briefcase size={12} />
                  {microJobsOnly ? microJobDiscoveryCopy.laneBadge : copy.laneBadge}
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)]">
                  {microJobsOnly ? microJobDiscoveryCopy.laneTitle : (lane === 'imports' ? copy.laneImports : copy.laneChallenges)}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {microJobsOnly ? microJobDiscoveryCopy.laneBody : copy.laneBody}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/78 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] dark:bg-[rgba(15,23,42,0.72)]">
                  {microJobsOnly
                    ? microJobDiscoveryCopy.laneReadMode
                    : (isCsLike ? 'Čteno jako výzvy, ne jen seznam pozic' : 'Read as challenges, not just listings')}
                </div>
              </div>
              <div className="flex min-w-[160px] flex-col gap-3">
                <MetricTile
                  label={copy.results}
                  value={`${displayedResultsCount}`}
                  helper={resultsMetricHelper}
                  className="border-[rgba(var(--accent-rgb),0.14)] bg-white/84 dark:bg-[rgba(15,23,42,0.78)]"
                />
                {hasPremiumAccess && resolvedDialogueCapacity ? (
                  <MetricTile
                    label={copy.slotsTitle}
                    value={copy.slotsValue
                      .replace('{{active}}', String(resolvedDialogueCapacity.active))
                      .replace('{{limit}}', String(resolvedDialogueCapacity.limit))}
                    className="border-[rgba(var(--accent-rgb),0.14)] bg-white/84 dark:bg-[rgba(15,23,42,0.78)]"
                  />
                ) : null}
              </div>
            </div>
            {hasPremiumAccess && resolvedDialogueCapacity ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/78 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] dark:bg-[rgba(15,23,42,0.72)]">
                  <ShieldCheck size={12} />
                  {copy.slotsRemaining.replace('{{remaining}}', String(resolvedDialogueCapacity.remaining))}
                </div>
              </div>
            ) : null}
          </SurfaceCard>

          {loading && feedJobs.length === 0 ? (
            <SurfaceCard className="space-y-4">
              <div className="space-y-2">
                <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{copy.loadingTitle}</div>
                <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{copy.loadingBody}</p>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`feed-loading-${index}`}
                    className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5"
                  >
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 w-32 rounded-full bg-[var(--border-subtle)]" />
                      <div className="h-8 w-4/5 rounded-[var(--radius-md)] bg-[var(--border-subtle)]" />
                      <div className="h-20 rounded-[var(--radius-lg)] bg-[var(--surface)]" />
                      <div className="flex flex-wrap gap-2">
                        <div className="h-8 w-28 rounded-full bg-[var(--surface)]" />
                        <div className="h-8 w-24 rounded-full bg-[var(--surface)]" />
                        <div className="h-8 w-32 rounded-full bg-[var(--surface)]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : feedJobs.length === 0 ? (
            <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
          ) : (
            <div className="space-y-4">
              {feedSections.map((section) => (
                <div key={section.key} id={section.key === 'broader' ? 'challenge-feed-section-broader' : undefined}>
                <SurfaceCard className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{section.title}</h3>
                      <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{section.body}</p>
                    </div>
                    <div className="text-sm font-medium text-[var(--text-faint)]">{section.jobs.length}</div>
                  </div>

                  <div className="space-y-3">
                    {section.jobs.map((job) => {
                      const isSaved = savedJobIds.includes(job.id);
                      const isSelected = selectedJobId === job.id;
                      const experienceLabel = getExperienceLabel(job, isCsLike);
                      const ageLabel = getJobAgeLabel(job, i18n.language);
                      const sourceBadge = job.listingKind === 'imported' ? copy.sourceImported : copy.sourceNative;
                      const microJobBadge = isMicroJob(job) ? getMicroJobBadge(language) : null;
                      const microJobKind = isMicroJob(job) ? getMicroJobKindLabel(job.micro_job_kind, language) : null;
                      const microJobCollaboration = isMicroJob(job)
                        ? getMicroJobCollaborationLabel(job.micro_job_collaboration_modes, language)
                        : null;
                      const microJobLongTermPotential = isMicroJob(job)
                        ? getMicroJobLongTermPotentialLabel(job.micro_job_long_term_potential, language)
                        : null;
                      return (
                        <article
                          key={job.id}
                          id={section.key === feedSections[0]?.key && job.id === section.jobs[0]?.id ? 'challenge-feed-first-item' : undefined}
                          onClick={() => handleJobSelect(job.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleJobSelect(job.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'app-surface w-full rounded-[var(--radius-xl)] border p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-[1px] hover:shadow-[var(--shadow-card)]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
                            isSelected && 'border-[rgba(var(--accent-rgb),0.26)] bg-[var(--accent-soft)]'
                          )}
                        >
                            <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)] md:text-lg">
                                  {job.title}
                                </div>
                                <div className="mt-1 text-sm text-[var(--text-muted)]">{job.company}</div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <span className="app-eyebrow !py-1">{sourceBadge}</span>
                                {microJobBadge ? (
                                  <span className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                                    {microJobBadge}
                                  </span>
                                ) : null}
                                {isSelected ? (
                                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                                    {copy.selected}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                  {copy.challengeLabel}
                                </div>
                                <h4 className="mt-2 max-w-3xl text-lg font-semibold leading-snug tracking-[-0.03em] text-[var(--text-strong)] md:text-[1.35rem]">
                                  {getChallengePreview(job)}
                                </h4>
                              </div>
                            </div>

                            {job.matchReasons && job.matchReasons.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {job.matchReasons.map((reason) => (
                                  <MetaBadge key={`${job.id}-${reason}`} tone="accent">
                                    {reason}
                                  </MetaBadge>
                                ))}
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                              <MetaBadge>{job.location || (isCsLike ? 'Lokalita TBD' : 'Location TBD')}</MetaBadge>
                              <MetaBadge>{formatSalary(job, i18n.language, isCsLike)}</MetaBadge>
                              {job.micro_job_time_estimate ? <MetaBadge tone="accent">{job.micro_job_time_estimate}</MetaBadge> : null}
                              {microJobKind ? <MetaBadge tone="accent">{microJobKind}</MetaBadge> : null}
                              {microJobCollaboration ? <MetaBadge>{microJobCollaboration}</MetaBadge> : null}
                              {microJobLongTermPotential ? <MetaBadge tone="accent">{microJobLongTermPotential}</MetaBadge> : null}
                              {ageLabel ? <MetaBadge>{ageLabel}</MetaBadge> : null}
                              <MetaBadge tone="accent">{copy.fit} {Math.round(job.jhi?.score || 0)}</MetaBadge>
                              <MetaBadge>{getWorkModel(job, isCsLike)}</MetaBadge>
                              {experienceLabel ? <MetaBadge>{experienceLabel}</MetaBadge> : null}
                              {job.url ? <MetaBadge>{copy.openPreview}</MetaBadge> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
                              <button
                                type="button"
                                className="app-button-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleJobSelect(job.id);
                                }}
                              >
                                {copy.openCard}
                                <ArrowRight size={15} />
                              </button>
                              <button
                                type="button"
                                className="app-button-secondary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleSave(job.id);
                                }}
                              >
                                <Bookmark size={15} className={isSaved ? 'fill-current' : ''} />
                                {isSaved ? copy.shortlisted : copy.shortlist}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </SurfaceCard>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  className="app-button-secondary"
                  disabled={loading || currentPage === 0}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  {getLocaleLabel({
                    cs: 'Předchozí',
                    sk: 'Predošlá',
                    de: 'Zurück',
                    at: 'Zurück',
                    pl: 'Poprzednia',
                    en: 'Previous'
                  }, language)}
                </button>
                {paginationWindow.map((page, index) => {
                  const prevPage = paginationWindow[index - 1];
                  const needsGap = index > 0 && prevPage != null && page - prevPage > 1;
                  return (
                    <React.Fragment key={`page-fragment-${page}`}>
                      {needsGap ? (
                        <div className="px-1 text-sm text-[var(--text-faint)]">…</div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => goToPage(page)}
                        disabled={loading && page === currentPage}
                        className={cn(
                          'inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-medium transition',
                          page === currentPage
                            ? 'border-[rgba(var(--accent-rgb),0.3)] bg-[rgba(var(--accent-rgb),0.12)] text-[var(--text-strong)]'
                            : 'border-[var(--border-subtle)] bg-white/70 text-[var(--text)] hover:bg-white dark:bg-white/5 dark:hover:bg-white/10'
                        )}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page + 1}
                      </button>
                    </React.Fragment>
                  );
                })}
                <button
                  type="button"
                  className="app-button-secondary"
                  disabled={loading || currentPage >= totalPages - 1 || (!hasMore && currentPage >= totalPages - 1)}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  {getLocaleLabel({
                    cs: 'Další',
                    sk: 'Ďalšia',
                    de: 'Weiter',
                    at: 'Weiter',
                    pl: 'Następna',
                    en: 'Next'
                  }, language)}
                </button>
                <div className="w-full text-center text-sm text-[var(--text-faint)]">
                  {paginationSummary}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      <PremiumFeatureExplainModal
        open={selectedPremiumFeature !== null}
        feature={selectedPremiumFeature}
        userProfile={userProfile}
        onClose={() => setSelectedPremiumFeature(null)}
        onOpenPremium={onOpenPremium}
      />
    </section>
  );
};

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
    {children}
  </section>
);

const MetaBadge: React.FC<{ children: React.ReactNode; tone?: 'default' | 'accent' }> = ({ children, tone = 'default' }) => (
  <span
    className={cn(
      'rounded-full px-3 py-1 text-xs font-medium',
      tone === 'accent'
        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
        : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
    )}
  >
    {children}
  </span>
);

export default ChallengeMarketplace;
