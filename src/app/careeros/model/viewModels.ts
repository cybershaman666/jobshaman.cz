import type {
  CandidateDomainKey,
  CompanyProfile,
  Job,
  SearchDiagnosticsMeta,
  UserProfile,
} from '../../../../types';
import { resolveJobDomain } from '../../../../utils/domainAccents';
import { getStockCoverForDomain } from '../../../../utils/domainCoverImages';
import { getFallbackCompanyAvatarUrl } from '../../../../utils/companyStockAvatars';

export type CareerOSLayer =
  | 'career_path'
  | 'marketplace'
  | 'job_offers'
  | 'learning_path'
  | 'mini_challenges'
  | 'market_trends';

export interface CareerOSChallenge {
  id: string;
  title: string;
  companyId: string | null;
  company: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  location: string;
  salary: string;
  sourceLabel: string;
  listingKind: 'challenge' | 'imported';
  challengeSummary: string;
  riskSummary: string;
  firstStepPrompt: string;
  companyGoal: string;
  jhiScore: number;
  requiredSkills: string[];
  topTags: string[];
  matchedDomains: CandidateDomainKey[];
  isSaved: boolean;
  isSelected: boolean;
}

export interface CareerOSCandidateWorkspace {
  greeting: string;
  userLabel: string;
  headline: string;
  subheadline: string;
  activeFilters: Array<{ label: string; value: string }>;
  layers: Array<{ id: CareerOSLayer; label: string; count?: number }>;
  highlights: Array<{ label: string; value: string }>;
  candidateSignals: Array<{ label: string; value: string; tone: 'accent' | 'success' | 'warning' }>;
  learningSignals: Array<{ label: string; value: string; tone: 'accent' | 'success' | 'warning' }>;
  miniChallengeSignals: Array<{ label: string; value: string }>;
  selectedChallenge: CareerOSChallenge | null;
  challenges: CareerOSChallenge[];
  searchDiagnosticsLabel: string | null;
}

export interface CareerOSCompanySpace {
  id: string | null;
  name: string;
  website: string;
  location: string;
  description: string;
  philosophy: string;
  tone: string;
  values: string[];
  openChallengesLabel: string;
  challenges: CareerOSChallenge[];
}

export interface CareerOSCompanyWorkspace {
  companyName: string;
  subscriptionLabel: string;
  activeTab: string;
  metrics: Array<{ label: string; value: string }>;
  statusLine: string;
}

export interface CareerOSHandshakeThread {
  challengeId: string;
  company: string;
  mode: 'native' | 'imported';
  companyGoal: string;
  firstStepPrompt: string;
  reactionWindowLabel: string;
}

const compact = (value: unknown, fallback = ''): string => String(value || '').trim() || fallback;

const shortText = (value: unknown, limit: number, fallback = ''): string => {
  const text = compact(value, fallback).replace(/\s+/g, ' ');
  if (!text) return fallback;
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(1, limit - 1)).trim()}…`;
};

const salaryLabelForJob = (job: Job): string => {
  if (compact(job.salaryRange)) return compact(job.salaryRange);
  const from = Number(job.salary_from || job.aiEstimatedSalary?.min || 0);
  const to = Number(job.salary_to || job.aiEstimatedSalary?.max || 0);
  const currency = compact((job as any).salary_currency || job.aiEstimatedSalary?.currency, 'CZK');
  if (from > 0 && to > 0 && from !== to) {
    return `${from.toLocaleString()} - ${to.toLocaleString()} ${currency}`;
  }
  if (to > 0) {
    return `${to.toLocaleString()} ${currency}`;
  }
  return 'Mzda neuvedena';
};

const sourceLabelForJob = (job: Job): string => {
  if (job.listingKind === 'imported') return 'Převzatá nabídka';
  if (job.challenge_format === 'micro_job' || job.micro_job_kind) return 'Mini výzva';
  return 'Vlastní výzva';
};

const topTagsForJob = (job: Job): string[] =>
  Array.from(
    new Set(
      [...(Array.isArray(job.tags) ? job.tags : []), ...(Array.isArray(job.benefits) ? job.benefits : [])]
        .map((item) => compact(item))
        .filter(Boolean),
    ),
  ).slice(0, 3);

const companyAvatarForJob = (job: Job): string | null => {
  const logo = compact(job.companyProfile?.logo_url);
  if (logo) return logo;
  return getFallbackCompanyAvatarUrl(compact(job.company, 'Company'));
};

const coverImageForJob = (job: Job): string | null => {
  const gallery = Array.isArray(job.companyProfile?.gallery_urls)
    ? job.companyProfile?.gallery_urls.map((value) => compact(value)).filter(Boolean)
    : [];
  if (gallery.length > 0) return gallery[0];

  const domain = resolveJobDomain(job);
  return getStockCoverForDomain(domain, `${job.id || ''}-${job.company || ''}-${job.title || ''}`);
};

export const mapJobToCareerOSChallenge = (
  job: Job,
  options?: {
    isSaved?: boolean;
    isSelected?: boolean;
  },
): CareerOSChallenge => ({
  id: compact(job.id),
  title: compact(job.title, 'Neoznačená role'),
  companyId: compact(job.company_id) || null,
  company: compact(job.company, 'Neznámá firma'),
  avatarUrl: companyAvatarForJob(job),
  coverImageUrl: coverImageForJob(job),
  location: compact(job.location, 'Lokalita podle dohody'),
  salary: salaryLabelForJob(job),
  sourceLabel: sourceLabelForJob(job),
  listingKind: job.listingKind === 'imported' ? 'imported' : 'challenge',
  challengeSummary: shortText(job.challenge || job.aiAnalysis?.summary || job.description, 168, 'Shrnutí role zatím není k dispozici.'),
  riskSummary: shortText(job.risk || job.aiAnalysis?.culturalFit, 132, 'Praktická realita se ukáže po otevření detailu.'),
  firstStepPrompt: shortText(job.firstStepPrompt, 120, 'Otevřete detail a uvidíte první krok k navázání kontaktu.'),
  companyGoal: shortText(job.companyGoal, 120, 'Firma zatím cíl role neupřesnila.'),
  jhiScore: Math.max(0, Math.min(100, Math.round(Number(job.jhi?.score || 0)))),
  requiredSkills: Array.isArray(job.required_skills)
    ? job.required_skills.map((skill) => compact(skill)).filter(Boolean).slice(0, 8)
    : [],
  topTags: topTagsForJob(job),
  matchedDomains: Array.isArray(job.matchedDomains) ? job.matchedDomains.slice(0, 3) : [],
  isSaved: Boolean(options?.isSaved),
  isSelected: Boolean(options?.isSelected),
});

export const mapJobsToCareerOSCandidateWorkspace = (input: {
  jobs: Job[];
  userProfile: UserProfile;
  savedJobIds: string[];
  selectedJobId?: string | null;
  remoteOnly?: boolean;
  enableCommuteFilter?: boolean;
  filterMinSalary?: number;
  filterBenefits?: string[];
  discoveryMode?: 'all' | 'micro_jobs';
  totalCount?: number;
  searchDiagnostics?: SearchDiagnosticsMeta | null;
}): CareerOSCandidateWorkspace => {
  const {
    jobs,
    userProfile,
    savedJobIds,
    selectedJobId,
    remoteOnly,
    enableCommuteFilter,
    filterMinSalary,
    filterBenefits,
    discoveryMode,
    totalCount,
    searchDiagnostics,
  } = input;
  const locale = String(userProfile.preferredLocale || 'cs').split('-')[0].toLowerCase();
  const isCzechUi = locale === 'cs' || locale === 'sk';

  const selectedId = compact(selectedJobId);
  const mapped = jobs.map((job) =>
    mapJobToCareerOSChallenge(job, {
      isSaved: savedJobIds.includes(job.id),
      isSelected: selectedId === job.id,
    }),
  );
  const selectedChallenge =
    mapped.find((item) => item.id === selectedId)
    || mapped[0]
    || null;

  const domainLabel = compact(userProfile.preferences?.searchProfile?.primaryDomain || userProfile.preferences?.desired_role);
  const searchModeLabel = searchDiagnostics?.search_mode
    ? String(searchDiagnostics.search_mode).replace(/_/g, ' ')
    : null;

  return {
    greeting: userProfile.isLoggedIn ? (isCzechUi ? 'Kariérní mapa' : 'CareerOS 2.0') : (isCzechUi ? 'Mapa bez přihlášení' : 'CareerOS guest mode'),
    userLabel: compact(
      userProfile.name || userProfile.email,
      userProfile.isLoggedIn
        ? (isCzechUi ? 'Váš prostor' : 'Your workspace')
        : (isCzechUi ? 'Otevřete si svůj prostor' : 'Open candidate workspace'),
    ),
    headline: domainLabel
      ? (isCzechUi
          ? `Kam dál v oblasti ${domainLabel.replace(/_/g, ' ')}`
          : `Map the next move for ${domainLabel.replace(/_/g, ' ')}`)
      : (isCzechUi ? 'Najděte další krok dřív, než někam pošlete životopis' : 'Map the next move before you send a CV'),
    subheadline: isCzechUi
      ? 'Jedna mapa pro směry, konkrétní role, mini výzvy i další rozvoj.'
      : 'One map for paths, concrete roles, mini challenges and further growth.',
    activeFilters: [
      { label: 'Remote', value: remoteOnly ? 'Zapnuto' : 'Vypnuto' },
      { label: 'Dojezd', value: enableCommuteFilter ? 'Vyhodnocuje se' : 'Nevyhodnocuje se' },
      { label: 'Min. odměna', value: filterMinSalary ? filterMinSalary.toLocaleString() : 'Bez minima' },
      { label: 'Benefity', value: Array.isArray(filterBenefits) && filterBenefits.length > 0 ? `${filterBenefits.length} vybráno` : 'Bez omezení' },
      { label: 'Režim', value: discoveryMode === 'micro_jobs' ? 'Mini výzvy' : 'Všechny role' },
    ],
    layers: [
      { id: 'career_path', label: 'Kariérní mapa', count: mapped.length },
      { id: 'marketplace', label: 'Seznam rolí', count: totalCount || mapped.length },
      { id: 'job_offers', label: 'Konkrétní nabídky', count: totalCount || mapped.length },
      { id: 'learning_path', label: 'Rozvojová cesta' },
      { id: 'mini_challenges', label: 'Mini výzvy' },
      { id: 'market_trends', label: 'Tržní signál' },
    ],
    highlights: [
      { label: 'Aktivní role', value: String(totalCount || mapped.length) },
      { label: 'Uloženo', value: String(savedJobIds.length) },
      { label: 'Nejvyšší JHI', value: mapped.length > 0 ? `${Math.max(...mapped.map((item) => item.jhiScore))}` : '0' },
    ],
    candidateSignals: [
      {
        label: 'JHI weight',
        value: `${Math.round(Number(userProfile.jhiPreferences?.pillarWeights?.growth || 0) * 100)}% growth`,
        tone: 'accent',
      },
      {
        label: 'Preferred mode',
        value: userProfile.preferences?.searchProfile?.preferredWorkArrangement || (remoteOnly ? 'remote' : 'flex'),
        tone: 'success',
      },
      {
        label: 'Profile visibility',
        value: compact(userProfile.preferences?.profile_visibility, 'recruiter'),
        tone: 'warning',
      },
    ],
    learningSignals: [
      {
        label: 'Target role',
        value: compact(userProfile.preferences?.searchProfile?.targetRole || userProfile.preferences?.desired_role, 'Role není nastavená'),
        tone: 'accent',
      },
      {
        label: 'Primary domain',
        value: domainLabel ? domainLabel.replace(/_/g, ' ') : 'Obecný směr',
        tone: 'success',
      },
      {
        label: 'Format',
        value: remoteOnly ? 'Vhodné pro remote' : 'Kombinovaný formát',
        tone: 'warning',
      },
    ],
    miniChallengeSignals: Array.from(
      new Set(
        jobs
          .map((job) => compact(job.company))
          .filter(Boolean),
      ),
    )
      .slice(0, 5)
      .map((company) => ({
        label: company,
        value: `${jobs.filter((job) => compact(job.company) === company).length} aktivních výzev`,
      })),
    selectedChallenge,
    challenges: mapped,
    searchDiagnosticsLabel: searchModeLabel,
  };
};

export const mapCompanyToCareerOSSpace = (
  company: Partial<CompanyProfile> | null | undefined,
  jobs: Job[],
): CareerOSCompanySpace => ({
  id: compact(company?.id) || null,
  name: compact(company?.name, 'Firemní prostor'),
  website: compact(company?.website, 'Web zatím není uvedený'),
  location: compact(company?.address || company?.legal_address, 'Lokalita zatím není sdílená'),
  description: shortText(company?.description, 240, 'Veřejné představení firmy zatím není k dispozici.'),
  philosophy: shortText(company?.philosophy, 180, 'Firemní přístup zatím není popsaný.'),
  tone: compact(company?.tone, 'Lidský, srozumitelný a otevřený'),
  values: Array.from(new Set((Array.isArray(company?.values) ? company?.values : []).map((value) => compact(value)).filter(Boolean))).slice(0, 6),
  openChallengesLabel: `${jobs.length} aktivní${jobs.length === 1 ? ' výzva' : ' výzvy'}`,
  challenges: jobs.map((job) => mapJobToCareerOSChallenge(job)),
});

export const mapCompanyProfileToCareerOSCompanyWorkspace = (input: {
  companyProfile: CompanyProfile;
  activeTab: string;
  visibleJobs: number;
  openApplications: number;
  assessmentLibrary: number;
  candidates: number;
}): CareerOSCompanyWorkspace => {
  const { companyProfile, activeTab, visibleJobs, openApplications, assessmentLibrary, candidates } = input;
  const tier = compact(companyProfile.subscription?.tier, 'free');
  return {
    companyName: compact(companyProfile.name, 'Company'),
    subscriptionLabel: tier.charAt(0).toUpperCase() + tier.slice(1),
    activeTab,
    metrics: [
      { label: 'Open roles', value: String(visibleJobs) },
      { label: 'Dialogues', value: String(openApplications) },
      { label: 'Assessments', value: String(assessmentLibrary) },
      { label: 'Candidates', value: String(candidates) },
    ],
    statusLine: `${compact(companyProfile.industry, 'Hiring workspace')} · ${compact(companyProfile.tone, 'Tón není nastavený')}`,
  };
};

export const mapJobToCareerOSHandshakeThread = (job: Job): CareerOSHandshakeThread => ({
  challengeId: compact(job.id),
  company: compact(job.company, 'Unknown company'),
  mode: job.listingKind === 'imported' ? 'imported' : 'native',
  companyGoal: shortText(job.companyGoal || job.challenge, 120, 'Company goal will appear after the challenge loads.'),
  firstStepPrompt: shortText(job.firstStepPrompt, 120, 'Open the detail to prepare the first handshake reply.'),
  reactionWindowLabel: Number(job.reaction_window_hours || 0) > 0
    ? `${Math.round(Number(job.reaction_window_hours || 0))}h response window`
    : Number(job.reaction_window_days || 0) > 0
      ? `${Math.round(Number(job.reaction_window_days || 0))}d response window`
      : 'Window not published',
});
