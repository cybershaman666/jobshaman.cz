import { shouldPreserveBrowseResultsOnEmptyRefresh } from './discoveryFeedResilience';

describe('discovery feed resilience', () => {
  test('preserves populated browse feed when a later page-0 refresh becomes suspiciously empty', () => {
    expect(shouldPreserveBrowseResultsOnEmptyRefresh({
      page: 0,
      isLoadMore: false,
      searchMode: 'discovery_default',
      searchTerm: '',
      filterCity: '',
      previousJobsCount: 50,
      nextJobsCount: 0,
      backendResultCount: 300,
      totalCount: 966,
    })).toBe(true);
  });

  test('does not preserve a genuinely empty explicit search result', () => {
    expect(shouldPreserveBrowseResultsOnEmptyRefresh({
      page: 0,
      isLoadMore: false,
      searchMode: 'manual_query',
      searchTerm: 'kuryr',
      filterCity: '',
      previousJobsCount: 50,
      nextJobsCount: 0,
      backendResultCount: 0,
      totalCount: 0,
    })).toBe(false);
  });

  test('does not preserve when there was no previously rendered feed', () => {
    expect(shouldPreserveBrowseResultsOnEmptyRefresh({
      page: 0,
      isLoadMore: false,
      searchMode: 'discovery_default',
      searchTerm: '',
      filterCity: '',
      previousJobsCount: 0,
      nextJobsCount: 0,
      backendResultCount: 250,
      totalCount: 250,
    })).toBe(false);
  });

  test('does not preserve successful non-empty refreshes', () => {
    expect(shouldPreserveBrowseResultsOnEmptyRefresh({
      page: 0,
      isLoadMore: false,
      searchMode: 'discovery_default',
      searchTerm: '',
      filterCity: '',
      previousJobsCount: 50,
      nextJobsCount: 12,
      backendResultCount: 300,
      totalCount: 300,
    })).toBe(false);
  });

  test('does not preserve empty refreshes outside default discovery mode', () => {
    expect(shouldPreserveBrowseResultsOnEmptyRefresh({
      page: 0,
      isLoadMore: false,
      searchMode: 'manual_filters',
      searchTerm: '',
      filterCity: '',
      previousJobsCount: 50,
      nextJobsCount: 0,
      backendResultCount: 0,
      totalCount: 0,
    })).toBe(false);
  });
});
