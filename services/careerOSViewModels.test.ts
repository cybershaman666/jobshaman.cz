import {
  mapCompanyProfileToCareerOSCompanyWorkspace,
  mapCompanyToCareerOSSpace,
  mapJobToCareerOSChallenge,
  mapJobToCareerOSHandshakeThread,
  mapJobsToCareerOSCandidateWorkspace,
} from '../src/app/careeros/model/viewModels';
import type { CompanyProfile, Job, UserProfile } from '../types';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  company_id: 'company-1',
  title: 'AI Operations Designer',
  company: 'Career Forge',
  location: 'Prague',
  type: 'Hybrid',
  description: 'Design a better workflow for the hiring team.',
  postedAt: '2026-03-24T10:00:00Z',
  source: 'jobshaman.cz',
  jhi: {
    score: 78,
    baseScore: 72,
    personalizedScore: 78,
    financial: 80,
    timeCost: 64,
    mentalLoad: 71,
    growth: 88,
    values: 75,
  },
  noiseMetrics: {
    score: 20,
    flags: [],
    level: 'low',
    keywords: [],
    tone: 'Professional',
  },
  transparency: {
    turnoverRate: 12,
    avgTenure: 2.3,
    ghostingRate: 8,
    hiringSpeed: 'Fast',
    redFlags: [],
  },
  market: {
    marketAvgSalary: 85000,
    percentile: 70,
    inDemandSkills: ['ops'],
  },
  tags: ['AI', 'Operations'],
  benefits: ['Remote days'],
  required_skills: ['Systems thinking', 'Analytics'],
  challenge: 'Build the operating system for a more human hiring loop.',
  risk: 'The role touches live hiring throughput from day one.',
  firstStepPrompt: 'How would you start untangling the current process?',
  companyGoal: 'Ship a better recruiter workflow before next quarter.',
  listingKind: 'challenge',
  salaryRange: '85 000 - 110 000 CZK',
  matchedDomains: ['operations'],
  ...overrides,
});

const makeUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Alex Harper',
  email: 'alex@example.com',
  isLoggedIn: true,
  address: 'Prague',
  transportMode: 'public',
  preferences: {
    workLifeBalance: 60,
    financialGoals: 55,
    commuteTolerance: 40,
    priorities: [],
    profile_visibility: 'recruiter',
    searchProfile: {
      nearBorder: false,
      dogCount: 0,
      wantsContractorRoles: false,
      wantsDogFriendlyOffice: false,
      wantsRemoteRoles: true,
      preferredWorkArrangement: 'hybrid',
      remoteLanguageCodes: ['en'],
      preferredBenefitKeys: [],
      defaultEnableCommuteFilter: false,
      defaultMaxDistanceKm: 30,
      primaryDomain: 'operations',
      secondaryDomains: [],
      avoidDomains: [],
      targetRole: 'Operations Designer',
      seniority: 'medior',
      includeAdjacentDomains: true,
      inferredPrimaryDomain: 'operations',
      inferredTargetRole: 'Operations Designer',
      inferenceSource: 'profile',
      inferenceConfidence: 0.86,
    },
  },
  jhiPreferences: {
    pillarWeights: {
      financial: 0.25,
      timeCost: 0.2,
      mentalLoad: 0.15,
      growth: 0.3,
      values: 0.1,
    },
    hardConstraints: {
      mustRemote: false,
      maxCommuteMinutes: null,
      minNetMonthly: null,
      excludeShift: false,
      growthRequired: false,
    },
    workStyle: {
      peopleIntensity: 50,
      careerGrowthPreference: 80,
      homeOfficePreference: 65,
    },
  },
  ...overrides,
});

describe('CareerOS view models', () => {
  it('maps job payloads into CareerOS challenge cards', () => {
    const viewModel = mapJobToCareerOSChallenge(makeJob(), { isSaved: true, isSelected: true });
    expect(viewModel.title).toBe('AI Operations Designer');
    expect(viewModel.sourceLabel).toBe('Native challenge');
    expect(viewModel.isSaved).toBe(true);
    expect(viewModel.isSelected).toBe(true);
    expect(viewModel.firstStepPrompt).toContain('start');
  });

  it('builds a candidate workspace with layers, filters and selected challenge', () => {
    const jobs = [makeJob(), makeJob({ id: 'job-2', title: 'Market Signals Analyst', company: 'Signal Dock', jhi: { ...makeJob().jhi, score: 83 } })];
    const workspace = mapJobsToCareerOSCandidateWorkspace({
      jobs,
      userProfile: makeUser(),
      savedJobIds: ['job-2'],
      selectedJobId: 'job-2',
      remoteOnly: true,
      enableCommuteFilter: false,
      filterMinSalary: 90000,
      filterBenefits: ['Remote days'],
      discoveryMode: 'all',
      totalCount: 18,
      searchDiagnostics: { search_mode: 'manual_filters' },
    });

    expect(workspace.layers[0].id).toBe('career_path');
    expect(workspace.selectedChallenge?.id).toBe('job-2');
    expect(workspace.activeFilters.some((item) => item.label === 'Remote' && item.value === 'On')).toBe(true);
    expect(workspace.searchDiagnosticsLabel).toBe('manual filters');
  });

  it('maps public company state into a CareerOS company space', () => {
    const company: CompanyProfile = {
      id: 'company-1',
      name: 'Career Forge',
      industry: 'Future of work',
      tone: 'Direct and kind',
      values: ['Transparency', 'Craft'],
      philosophy: 'Build a calmer hiring system.',
      website: 'https://careerforge.example',
      address: 'Prague',
      description: 'We help teams move faster without turning hiring into spam.',
    };

    const viewModel = mapCompanyToCareerOSSpace(company, [makeJob()]);
    expect(viewModel.name).toBe('Career Forge');
    expect(viewModel.values).toContain('Transparency');
    expect(viewModel.challenges).toHaveLength(1);
  });

  it('maps company dashboard metrics for the internal workspace shell', () => {
    const company: CompanyProfile = {
      id: 'company-1',
      name: 'Career Forge',
      industry: 'Future of work',
      tone: 'Direct and kind',
      values: [],
      philosophy: 'Build a calmer hiring system.',
      subscription: { tier: 'growth' },
    };

    const viewModel = mapCompanyProfileToCareerOSCompanyWorkspace({
      companyProfile: company,
      activeTab: 'applications',
      visibleJobs: 4,
      openApplications: 9,
      assessmentLibrary: 3,
      candidates: 11,
    });

    expect(viewModel.subscriptionLabel).toBe('Growth');
    expect(viewModel.activeTab).toBe('applications');
    expect(viewModel.metrics[0].value).toBe('4');
  });

  it('maps handshake metadata without changing write contracts', () => {
    const thread = mapJobToCareerOSHandshakeThread(makeJob({ reaction_window_hours: 48 }));
    expect(thread.mode).toBe('native');
    expect(thread.reactionWindowLabel).toBe('48h response window');
    expect(thread.firstStepPrompt).toContain('start');
  });
});
