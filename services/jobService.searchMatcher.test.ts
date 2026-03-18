import { jest } from '@jest/globals';

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

const { buildSearchMatcher, matchesSearchMatcher } = await import('./jobService');

describe('jobService search matcher', () => {
  test('matches driver query when licence is present as a standalone token', () => {
    const matcher = buildSearchMatcher('řidič b');

    expect(
      matchesSearchMatcher(
        'Řidič dodávky pro rozvoz zásilek. Požadujeme RP B a spolehlivost.',
        matcher
      )
    ).toBe(true);
  });

  test('does not match non-driver roles just because token b is present', () => {
    const matcher = buildSearchMatcher('řidič b');

    expect(
      matchesSearchMatcher(
        'Produktový manažer pro plán B initiative a business growth.',
        matcher
      )
    ).toBe(false);
  });
});
