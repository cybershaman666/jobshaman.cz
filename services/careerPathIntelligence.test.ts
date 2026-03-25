import { buildCareerPathClusters } from '../src/app/careeros/model/careerPathIntelligence';
import type { Job, UserProfile } from '../types';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  company_id: 'company-1',
  title: 'Customer Support Specialist',
  company: 'Support Forge',
  location: 'Prague',
  type: 'Hybrid',
  description: 'Help customers solve booking and account issues across email and chat.',
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
    marketAvgSalary: 60000,
    percentile: 68,
    inDemandSkills: ['Customer communication', 'CRM'],
  },
  tags: ['Customer support'],
  benefits: ['Remote days'],
  required_skills: ['Customer communication', 'CRM', 'English', 'German'],
  challenge: 'Guide customers through booking issues and product questions.',
  risk: 'Handle live issues while maintaining calm under pressure.',
  firstStepPrompt: 'How do you de-escalate an unhappy customer?',
  companyGoal: 'Improve the speed and quality of customer resolution.',
  listingKind: 'challenge',
  salaryRange: '55 000 - 70 000 CZK',
  matchedDomains: ['customer_support'],
  ...overrides,
});

const makeHotelReceptionist = (): UserProfile => ({
  name: 'Eva Novak',
  email: 'eva@example.com',
  isLoggedIn: true,
  address: 'Prague',
  transportMode: 'public',
  jobTitle: 'Hotel Receptionist',
  skills: ['Customer service', 'Reservations', 'English', 'German'],
  inferredSkills: ['Guest communication', 'Booking systems', 'Front desk operations'],
  strengths: ['Calm under pressure', 'People communication'],
  workHistory: [
    {
      id: 'work-1',
      role: 'Hotel Receptionist',
      company: 'Grand Aurora Hotel',
      duration: '3 years',
      description: 'Handled check-ins, guest requests, booking systems and multilingual communication.',
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
      remoteLanguageCodes: ['en', 'de'],
      preferredBenefitKeys: [],
      defaultEnableCommuteFilter: false,
      defaultMaxDistanceKm: 30,
      primaryDomain: 'hospitality',
      secondaryDomains: ['customer_support', 'operations'],
      avoidDomains: [],
      targetRole: '',
      seniority: 'medior',
      includeAdjacentDomains: true,
      inferredPrimaryDomain: 'hospitality',
      inferredTargetRole: 'Hotel Receptionist',
      inferenceSource: 'history',
      inferenceConfidence: 0.82,
    },
  },
});

const makeHotelOperationsManager = (): UserProfile => ({
  ...makeHotelReceptionist(),
  jobTitle: 'Hotel Operations Manager',
  inferredSkills: ['Guest communication', 'Scheduling', 'Team leadership', 'Operations management'],
  workHistory: [
    {
      id: 'work-ops-1',
      role: 'Hotel Operations Manager',
      company: 'Grand Aurora Hotel',
      duration: '4 years',
      description: 'Led front office, service operations, staffing and daily process quality across the property.',
    },
  ],
  preferences: {
    ...makeHotelReceptionist().preferences,
    searchProfile: {
      ...makeHotelReceptionist().preferences.searchProfile!,
      primaryDomain: 'operations',
      secondaryDomains: ['hospitality', 'customer_support'],
      targetRole: '',
      inferredPrimaryDomain: 'operations',
      inferredTargetRole: 'Hotel Operations Manager',
      seniority: 'lead',
    },
  },
});

describe('careerPathIntelligence', () => {
  it('creates logical bridge and progression clusters for a hotel receptionist profile', () => {
    const jobs = [
      makeJob(),
      makeJob({
        id: 'job-2',
        title: 'Front Office Manager',
        company: 'Riverside Hotel',
        description: 'Lead the reception team, own shift planning and service quality.',
        required_skills: ['Guest experience', 'Scheduling', 'Team leadership'],
        tags: ['Front office'],
        matchedDomains: ['hospitality', 'operations'],
      }),
      makeJob({
        id: 'job-3',
        title: 'HR Coordinator',
        company: 'People Harbor',
        description: 'Coordinate interviews, onboarding and candidate communication.',
        required_skills: ['Communication', 'Onboarding', 'Scheduling'],
        tags: ['HR'],
        matchedDomains: ['operations'],
      }),
    ];

    const clusters = buildCareerPathClusters({
      jobs,
      userProfile: makeHotelReceptionist(),
    });

    const titles = clusters.map((cluster) => cluster.title);
    expect(titles).toContain('Customer Support Specialist');
    expect(titles).toContain('Front Office Manager');
    expect(titles).toContain('HR & People Coordinator');

    expect(clusters.find((cluster) => cluster.title === 'Customer Support Specialist')?.challengeIds).toContain('job-1');
    expect(clusters.find((cluster) => cluster.title === 'Front Office Manager')?.challengeIds).toContain('job-2');
    expect(clusters.find((cluster) => cluster.title === 'HR & People Coordinator')?.challengeIds).toContain('job-3');
  });

  it('groups related support roles under one path instead of raw offer titles', () => {
    const jobs = [
      makeJob(),
      makeJob({
        id: 'job-4',
        title: 'Customer Success Associate',
        company: 'Signal Dock',
        description: 'Own onboarding and support for business customers.',
        required_skills: ['Customer communication', 'CRM', 'Onboarding'],
        tags: ['Customer success'],
      }),
    ];

    const clusters = buildCareerPathClusters({
      jobs,
      userProfile: makeHotelReceptionist(),
    });

    const supportCluster = clusters.find((cluster) => cluster.title === 'Customer Support Specialist');
    expect(supportCluster?.challengeIds).toEqual(expect.arrayContaining(['job-1', 'job-4']));
    expect(supportCluster?.preview).toBe('Tady zúročíš komunikaci, klid a cit pro lidi.');
  });

  it('avoids recommending narrower step-back roles for an operations manager background', () => {
    const jobs = [
      makeJob({
        id: 'job-5',
        title: 'Front Office Manager',
        company: 'Riverside Hotel',
        description: 'Lead the reception team and own shift quality.',
        required_skills: ['Guest experience', 'Scheduling', 'Team leadership'],
        tags: ['Front office'],
        matchedDomains: ['hospitality', 'operations'],
      }),
      makeJob({
        id: 'job-6',
        title: 'Customer Support Specialist',
        company: 'Support Forge',
      }),
      makeJob({
        id: 'job-7',
        title: 'Operations Manager',
        company: 'Service Harbor',
        description: 'Own business operations, process quality and service delivery for a multi-site team.',
        required_skills: ['Operations management', 'Process improvement', 'Leadership'],
        tags: ['Operations'],
        matchedDomains: ['operations'],
      }),
    ];

    const clusters = buildCareerPathClusters({
      jobs,
      userProfile: makeHotelOperationsManager(),
    });

    const titles = clusters.map((cluster) => cluster.title);
    expect(titles[0]).toBe('Operations Manager');
    expect(titles).not.toContain('Front Office Manager');
    expect(clusters.find((cluster) => cluster.title === 'Operations Manager')?.challengeIds).toContain('job-7');
  });

  it('does not group unrelated technical or sales roles into a hospitality management cluster', () => {
    const jobs = [
      makeJob({
        id: 'job-8',
        title: 'Front Office Manager',
        company: 'Riverside Hotel',
        description: 'Lead the reception team and own shift quality.',
        required_skills: ['Guest experience', 'Scheduling', 'Team leadership'],
        tags: ['Front office'],
        matchedDomains: ['hospitality', 'operations'],
      }),
      makeJob({
        id: 'job-9',
        title: 'DevOps Engineer',
        company: 'Infra Spark',
        description: 'Own CI/CD pipelines, infrastructure and cloud reliability.',
        required_skills: ['AWS', 'Kubernetes', 'Terraform'],
        tags: ['DevOps'],
        matchedDomains: ['it'],
      }),
      makeJob({
        id: 'job-10',
        title: 'Obchodní zástupce',
        company: 'Sales Dock',
        description: 'Build relationships and close new business.',
        required_skills: ['Sales', 'Prospecting', 'Negotiation'],
        tags: ['Sales'],
        matchedDomains: ['sales'],
      }),
    ];

    const clusters = buildCareerPathClusters({
      jobs,
      userProfile: makeHotelReceptionist(),
    });

    const frontOfficeCluster = clusters.find((cluster) => cluster.title === 'Front Office Manager');
    expect(frontOfficeCluster?.challengeIds).toEqual(['job-8']);
  });
});
