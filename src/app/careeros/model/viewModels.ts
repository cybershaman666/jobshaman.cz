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
  return 'Comp hidden';
};

const sourceLabelForJob = (job: Job): string => {
  if (job.listingKind === 'imported') return 'Imported';
  if (job.challenge_format === 'micro_job' || job.micro_job_kind) return 'Micro challenge';
  return 'Native challenge';
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
  title: compact(job.title, 'Untitled challenge'),
  companyId: compact(job.company_id) || null,
  company: compact(job.company, 'Unknown company'),
  avatarUrl: companyAvatarForJob(job),
  coverImageUrl: coverImageForJob(job),
  location: compact(job.location, 'Location flexible'),
  salary: salaryLabelForJob(job),
  sourceLabel: sourceLabelForJob(job),
  listingKind: job.listingKind === 'imported' ? 'imported' : 'challenge',
  challengeSummary: shortText(job.challenge || job.aiAnalysis?.summary || job.description, 168, 'Mission not loaded yet.'),
  riskSummary: shortText(job.risk || job.aiAnalysis?.culturalFit, 132, 'Reality notes will appear here once the detail is opened.'),
  firstStepPrompt: shortText(job.firstStepPrompt, 120, 'Open the challenge to see the first handshake step.'),
  companyGoal: shortText(job.companyGoal, 120, 'Company goal not provided.'),
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
    greeting: userProfile.isLoggedIn ? 'CareerOS 2.0' : 'CareerOS guest mode',
    userLabel: compact(userProfile.name || userProfile.email, userProfile.isLoggedIn ? 'Your workspace' : 'Open candidate workspace'),
    headline: domainLabel
      ? `Map the next move for ${domainLabel.replace(/_/g, ' ')}`
      : 'Map the next move before you send a CV',
    subheadline: 'One shell for career path, live challenges, learning paths and mini work.',
    activeFilters: [
      { label: 'Remote', value: remoteOnly ? 'On' : 'Off' },
      { label: 'Commute', value: enableCommuteFilter ? 'Active' : 'Hidden' },
      { label: 'Min comp', value: filterMinSalary ? filterMinSalary.toLocaleString() : 'Any' },
      { label: 'Benefits', value: Array.isArray(filterBenefits) && filterBenefits.length > 0 ? `${filterBenefits.length} selected` : 'All' },
      { label: 'Mode', value: discoveryMode === 'micro_jobs' ? 'Micro jobs' : 'All challenges' },
    ],
    layers: [
      { id: 'career_path', label: 'Career Path', count: mapped.length },
      { id: 'marketplace', label: 'Marketplace', count: totalCount || mapped.length },
      { id: 'job_offers', label: 'Job Offers', count: totalCount || mapped.length },
      { id: 'learning_path', label: 'Learning Path' },
      { id: 'mini_challenges', label: 'Mini Challenges' },
      { id: 'market_trends', label: 'Market Trends' },
    ],
    highlights: [
      { label: 'Live challenges', value: String(totalCount || mapped.length) },
      { label: 'Saved', value: String(savedJobIds.length) },
      { label: 'Best JHI', value: mapped.length > 0 ? `${Math.max(...mapped.map((item) => item.jhiScore))}` : '0' },
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
        value: compact(userProfile.preferences?.searchProfile?.targetRole || userProfile.preferences?.desired_role, 'Role not set'),
        tone: 'accent',
      },
      {
        label: 'Primary domain',
        value: domainLabel ? domainLabel.replace(/_/g, ' ') : 'Generalist path',
        tone: 'success',
      },
      {
        label: 'Format',
        value: remoteOnly ? 'Remote-friendly' : 'Mixed format',
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
        value: `${jobs.filter((job) => compact(job.company) === company).length} open challenges`,
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
  name: compact(company?.name, 'Company space'),
  website: compact(company?.website, 'Website hidden'),
  location: compact(company?.address || company?.legal_address, 'Location not shared yet'),
  description: shortText(company?.description, 240, 'Public company description not available yet.'),
  philosophy: shortText(company?.philosophy, 180, 'Mission statement not available yet.'),
  tone: compact(company?.tone, 'Human, direct and transparent'),
  values: Array.from(new Set((Array.isArray(company?.values) ? company?.values : []).map((value) => compact(value)).filter(Boolean))).slice(0, 6),
  openChallengesLabel: `${jobs.length} live challenge${jobs.length === 1 ? '' : 's'}`,
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
    statusLine: `${compact(companyProfile.industry, 'Hiring workspace')} · ${compact(companyProfile.tone, 'Tone not configured')}`,
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
