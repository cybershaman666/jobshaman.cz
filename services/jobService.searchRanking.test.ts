import { jest } from '@jest/globals';
import type { Job } from '../types';

jest.unstable_mockModule('./supabaseService', () => ({
  supabase: null,
  isSupabaseConfigured: () => true,
  isSupabaseNetworkCooldownActive: () => false,
  noteSupabaseNetworkFailure: () => undefined,
  trackAnalyticsEvent: () => Promise.resolve(),
}));

jest.unstable_mockModule('./supabaseClient', () => ({
  supabase: null,
  refreshSession: () => Promise.resolve(null),
  clearSupabaseAuthStorage: () => undefined,
}));

jest.unstable_mockModule('../constants', () => ({
  BACKEND_URL: 'http://localhost:8000',
  SEARCH_BACKEND_URL: 'http://localhost:8001',
}));

const { applyExternalTopCap, rankJobsForSearchMode } = await import('./jobService');

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

const matcher = {
  normalizedQuery: 'react developer',
  requiredTokens: ['react', 'developer'],
  optionalTokens: [],
  queryTokens: ['react', 'developer'],
};

describe('search ranking helpers', () => {
  test('manual query keeps strong title match above generic high-jhi role', () => {
    const genericHighJhi = baseJob({
      id: 'generic',
      title: 'IT Specialist',
      description: 'Broad IT support role touching many tools including React.',
      jhi: {
        score: 95,
        baseScore: 95,
        personalizedScore: 95,
        financial: 0,
        timeCost: 0,
        mentalLoad: 0,
        growth: 0,
        values: 0,
        explanations: [],
      },
      searchDiagnostics: { source: 'native', backendScore: 90, external: false },
    });
    const exactMatch = baseJob({
      id: 'exact',
      title: 'React Developer',
      description: 'Product team looking for a React developer.',
      jhi: {
        score: 35,
        baseScore: 35,
        personalizedScore: 35,
        financial: 0,
        timeCost: 0,
        mentalLoad: 0,
        growth: 0,
        values: 0,
        explanations: [],
      },
      searchDiagnostics: { source: 'native', backendScore: 40, external: false },
    });

    const ranked = rankJobsForSearchMode(
      [genericHighJhi, exactMatch],
      'default',
      'manual_query',
      matcher
    );

    expect(ranked[0].id).toBe('exact');
    expect(ranked[0].searchDiagnostics?.titleMatchScore).toBeGreaterThan(
      ranked[1].searchDiagnostics?.titleMatchScore || 0
    );
  });

  test('external top cap keeps at most two external results inside the first eight', () => {
    const jobs = [
      baseJob({ id: 'ext-1', title: 'React Developer', listingKind: 'imported', searchDiagnostics: { source: 'live_external', external: true } }),
      baseJob({ id: 'ext-2', title: 'Senior React Developer', listingKind: 'imported', searchDiagnostics: { source: 'live_external', external: true } }),
      baseJob({ id: 'ext-3', title: 'Lead React Developer', listingKind: 'imported', searchDiagnostics: { source: 'cached_external', external: true } }),
      baseJob({ id: 'native-1', title: 'React Developer', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-2', title: 'Frontend React Developer', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-3', title: 'React UI Developer', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-4', title: 'React Engineer', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-5', title: 'React Platform Developer', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-6', title: 'React Product Developer', searchDiagnostics: { source: 'native', external: false } }),
    ];

    const ranked = rankJobsForSearchMode(jobs, 'default', 'manual_query', matcher);
    const topEightExternal = ranked
      .slice(0, 8)
      .filter((job: Job) => job.searchDiagnostics?.external);

    expect(topEightExternal).toHaveLength(2);
  });

  test('applyExternalTopCap preserves all jobs while pushing overflow external jobs below the top window', () => {
    const capped = applyExternalTopCap([
      baseJob({ id: 'ext-a', listingKind: 'imported', searchDiagnostics: { source: 'live_external', external: true } }),
      baseJob({ id: 'ext-b', listingKind: 'imported', searchDiagnostics: { source: 'live_external', external: true } }),
      baseJob({ id: 'ext-c', listingKind: 'imported', searchDiagnostics: { source: 'cached_external', external: true } }),
      baseJob({ id: 'native-a', searchDiagnostics: { source: 'native', external: false } }),
      baseJob({ id: 'native-b', searchDiagnostics: { source: 'native', external: false } }),
    ], 4, 2);

    expect(capped.map((job: Job) => job.id)).toEqual(['ext-a', 'ext-b', 'native-a', 'native-b', 'ext-c']);
  });
});
