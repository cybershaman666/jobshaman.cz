import type { UserProfile } from '../types';
import {
  buildCareerNavigationRoute,
  inferCareerNavigationGoal,
  type CareerNavigationLearningSignal,
  type CareerNavigationMiniChallengeOption,
  type CareerNavigationPathOption,
} from '../src/app/careeros/model/careerNavigation';

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Eva Novak',
  email: 'eva@example.com',
  isLoggedIn: true,
  address: 'Prague',
  transportMode: 'public',
  jobTitle: 'Customer Support Specialist',
  skills: ['Customer communication', 'CRM', 'English'],
  inferredSkills: ['Ticketing', 'De-escalation'],
  workHistory: [
    {
      id: 'work-1',
      role: 'Customer Support Specialist',
      company: 'Support Forge',
      duration: '3 years',
      description: 'Handled customer issues across chat and email.',
    },
  ],
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
      primaryDomain: 'customer_support',
      secondaryDomains: ['operations'],
      avoidDomains: [],
      targetRole: '',
      seniority: 'medior',
      includeAdjacentDomains: true,
      inferredPrimaryDomain: 'customer_support',
      inferredTargetRole: 'Customer Support Specialist',
      inferenceSource: 'history',
      inferenceConfidence: 0.82,
    },
  },
  ...overrides,
});

const pathOptions: CareerNavigationPathOption[] = [
  {
    id: 'support',
    title: 'Customer Support Specialist',
    summary: 'Solve customer problems in real time.',
    preview: 'Communication and calm under pressure.',
    primaryDomain: 'customer_support',
    challengeIds: ['job-1'],
    x: 240,
    y: -70,
    roleOptions: [
      { id: 'role-support', title: 'Customer Support Specialist', challengeIds: ['job-1'] },
      { id: 'role-success', title: 'Customer Success Manager', challengeIds: ['job-2'] },
    ],
    topSkills: ['Customer communication', 'CRM', 'Onboarding'],
  },
  {
    id: 'operations',
    title: 'Operations Coordinator',
    summary: 'Coordinate teams, processes, and service quality.',
    preview: 'Execution and ownership across workflow.',
    primaryDomain: 'operations',
    challengeIds: ['job-3'],
    x: 310,
    y: 180,
    roleOptions: [
      { id: 'role-ops', title: 'Operations Coordinator', challengeIds: ['job-3'] },
      { id: 'role-ops-manager', title: 'Operations Manager', challengeIds: ['job-4'] },
    ],
    topSkills: ['Operations', 'Scheduling', 'Process improvement'],
  },
  {
    id: 'hr',
    title: 'HR & People Coordinator',
    summary: 'Own onboarding, candidate communication, and people operations.',
    preview: 'A people-focused coordination lane.',
    primaryDomain: 'operations',
    challengeIds: ['job-5'],
    x: -320,
    y: 210,
    roleOptions: [
      { id: 'role-hr', title: 'HR & People Coordinator', challengeIds: ['job-5'] },
    ],
    topSkills: ['Onboarding', 'Interview coordination', 'Communication'],
  },
  {
    id: 'marketing',
    title: 'Marketing Manager',
    summary: 'Own campaigns, brand growth, and acquisition.',
    preview: 'Growth planning and marketing execution.',
    primaryDomain: 'marketing',
    challengeIds: ['job-6'],
    x: -180,
    y: -220,
    roleOptions: [
      { id: 'role-marketing-manager', title: 'Marketing Manager', challengeIds: ['job-6'] },
    ],
    topSkills: ['Campaigns', 'Brand', 'Growth'],
  },
];

const makeLearning = (overrides: Partial<CareerNavigationLearningSignal> = {}): CareerNavigationLearningSignal => ({
  currentRole: 'Customer Support Specialist',
  targetRole: 'Customer Success Manager',
  targetDomainLabel: 'Customer Support',
  intentReady: true,
  skillDataReady: true,
  currentSkills: ['Customer communication', 'CRM'],
  targetSkills: ['Customer communication', 'CRM', 'Onboarding'],
  missingSkills: ['Onboarding'],
  hasResourceMatches: true,
  ...overrides,
});

const miniChallenges: CareerNavigationMiniChallengeOption[] = [
  { id: 'mini-1', title: 'Support workflow audit', summary: 'Short real collaboration to prove adjacent readiness.' },
];

describe('careerNavigation', () => {
  it('creates a short direct route for a strong support -> customer success move', () => {
    const profile = makeProfile();
    const goal = inferCareerNavigationGoal({
      goalText: 'Customer Success Manager',
      userProfile: profile,
      pathOptions,
      locale: 'en',
    });

    const route = buildCareerNavigationRoute({
      goal,
      userProfile: profile,
      pathOptions,
      learning: makeLearning(),
      miniChallenges,
      useMarketPreferences: true,
      locale: 'en',
    });

    expect(route.targetPathId).toBe('support');
    expect(route.steps.some((step) => step.kind === 'bridge_role')).toBe(false);
    expect(route.steps.some((step) => step.kind === 'offer_activation')).toBe(true);
  });

  it('inserts a bridge role for an adjacent hospitality -> people ops move', () => {
    const profile = makeProfile({
      jobTitle: 'Hotel Receptionist',
      skills: ['Customer service', 'Reservations', 'English'],
      preferences: {
        ...makeProfile().preferences,
        searchProfile: {
          ...makeProfile().preferences.searchProfile!,
          primaryDomain: 'hospitality',
          secondaryDomains: ['operations', 'customer_support'],
          inferredPrimaryDomain: 'hospitality',
          inferredTargetRole: 'Hotel Receptionist',
        },
      },
    });

    const goal = inferCareerNavigationGoal({
      goalText: 'HR coordinator',
      userProfile: profile,
      pathOptions,
      locale: 'en',
    });

    const route = buildCareerNavigationRoute({
      goal,
      userProfile: profile,
      pathOptions,
      learning: makeLearning({
        currentRole: 'Hotel Receptionist',
        targetRole: 'HR & People Coordinator',
        targetDomainLabel: 'Operations',
        missingSkills: ['Onboarding', 'Interview coordination'],
      }),
      miniChallenges,
      useMarketPreferences: true,
      locale: 'en',
    });

    expect(route.steps.some((step) => step.kind === 'bridge_role')).toBe(true);
  });

  it('adds profile fill when the current profile signal is too weak', () => {
    const profile = makeProfile({
      jobTitle: '',
      skills: [],
      inferredSkills: [],
      workHistory: [],
    });

    const goal = inferCareerNavigationGoal({
      goalText: 'Operations manager',
      userProfile: profile,
      pathOptions,
      locale: 'en',
    });

    const route = buildCareerNavigationRoute({
      goal,
      userProfile: profile,
      pathOptions,
      learning: makeLearning({
        currentRole: 'Current profile',
        targetRole: 'Operations Manager',
        targetDomainLabel: 'Operations',
        missingSkills: ['Operations', 'Process improvement'],
      }),
      miniChallenges,
      useMarketPreferences: true,
      locale: 'en',
    });

    expect(route.steps.some((step) => step.kind === 'profile_fill')).toBe(true);
  });

  it('does not fabricate a learning step when there are no matched resources', () => {
    const profile = makeProfile();
    const goal = inferCareerNavigationGoal({
      goalText: 'Operations manager',
      userProfile: profile,
      pathOptions,
      locale: 'en',
    });

    const route = buildCareerNavigationRoute({
      goal,
      userProfile: profile,
      pathOptions,
      learning: makeLearning({
        targetRole: 'Operations Manager',
        targetDomainLabel: 'Operations',
        missingSkills: ['Operations', 'Process improvement'],
        hasResourceMatches: false,
      }),
      miniChallenges,
      useMarketPreferences: true,
      locale: 'en',
    });

    expect(route.steps.some((step) => step.kind === 'skill_gap')).toBe(true);
    expect(route.steps.some((step) => step.kind === 'learning_step')).toBe(false);
  });

  it('returns clarification suggestions for vague goals', () => {
    const goal = inferCareerNavigationGoal({
      goalText: 'something better',
      userProfile: makeProfile(),
      pathOptions,
      locale: 'en',
    });

    expect(goal.status).toBe('needs_clarification');
    expect(goal.alternatives.length).toBeGreaterThan(0);
  });

  it('keeps an explicit AI Product Manager goal instead of relabeling it to a generic manager match', () => {
    const profile = makeProfile({
      jobTitle: 'Product Analyst',
      skills: ['Product discovery', 'User research', 'AI tooling'],
      inferredSkills: ['Roadmapping', 'Experimentation'],
      preferences: {
        ...makeProfile().preferences,
        searchProfile: {
          ...makeProfile().preferences.searchProfile!,
          primaryDomain: 'product_management',
          secondaryDomains: ['ai_data', 'it'],
          inferredPrimaryDomain: 'product_management',
          inferredTargetRole: 'Product Analyst',
        },
      },
    });

    const goal = inferCareerNavigationGoal({
      goalText: 'AI Product Manager',
      userProfile: profile,
      pathOptions,
      locale: 'en',
    });

    const route = buildCareerNavigationRoute({
      goal,
      userProfile: profile,
      pathOptions,
      learning: makeLearning({
        currentRole: 'Product Analyst',
        targetRole: 'AI Product Manager',
        targetDomainLabel: 'Product',
        missingSkills: ['Roadmapping', 'AI product sense'],
      }),
      miniChallenges,
      useMarketPreferences: true,
      locale: 'en',
    });

    expect(route.destinationLabel).toBe('AI Product Manager');
    expect(route.summary).toContain('AI Product Manager');
    expect(route.summary).toContain('closest available layer');
  });
});
