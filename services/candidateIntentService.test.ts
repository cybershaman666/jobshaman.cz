import { annotateJobsForCandidate, computeCandidateAnnotations, sortJobsForDiscovery } from './candidateIntentService';
import type { Job, UserProfile } from '../types';

const baseJob = (overrides: Partial<Job>): Job => ({
  id: 'job-1',
  title: 'Generic Role',
  company: 'Acme',
  location: 'Prague',
  type: 'Hybrid',
  description: 'General job description',
  postedAt: '2026-03-01T00:00:00.000Z',
  scrapedAt: '2026-03-01T00:00:00.000Z',
  source: 'native',
  jhi: {
    score: 40,
    baseScore: 40,
    personalizedScore: 40,
    financial: 0,
    timeCost: 0,
    mentalLoad: 0,
    growth: 0,
    values: 0,
    explanations: [],
  },
  noiseMetrics: {} as Job['noiseMetrics'],
  transparency: {} as Job['transparency'],
  market: {} as Job['market'],
  tags: [],
  benefits: [],
  required_skills: [],
  ...overrides,
});

const candidateProfile = {
  isLoggedIn: true,
  preferences: {
    searchProfile: {
      primaryDomain: 'it',
      targetRole: 'Backend Engineer',
      includeAdjacentDomains: true,
    },
  },
  jhiPreferences: {},
  taxProfile: { countryCode: 'CZ' },
} as UserProfile;

describe('candidate intent discovery helpers', () => {
  test('computeCandidateAnnotations preserves incoming order for manual modes', () => {
    const jobs = [
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ];

    const annotated = computeCandidateAnnotations(jobs, candidateProfile, 'en');

    expect(annotated.map((job) => job.id)).toEqual(['sales', 'backend']);
    expect(annotated[1].searchDiagnostics?.profileBoost).toBeGreaterThan(
      annotated[0].searchDiagnostics?.profileBoost || 0
    );
  });

  test('sortJobsForDiscovery reorders annotated jobs by discovery priority', () => {
    const annotated = computeCandidateAnnotations([
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ], candidateProfile, 'en');

    const sorted = sortJobsForDiscovery(annotated);

    expect(sorted[0].id).toBe('backend');
    expect(sorted[1].id).toBe('sales');
  });

  test('annotateJobsForCandidate remains the discovery-mode composition helper', () => {
    const jobs = [
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ];

    const annotated = annotateJobsForCandidate(jobs, candidateProfile, 'en');
    const recomposed = sortJobsForDiscovery(computeCandidateAnnotations(jobs, candidateProfile, 'en'));

    expect(annotated.map((job) => job.id)).toEqual(recomposed.map((job) => job.id));
  });
});
