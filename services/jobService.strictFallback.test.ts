let resolveStrictFallbackWindow: typeof import('./jobSearchFallbackHeuristics').resolveStrictFallbackWindow;
let shouldRecoverWithStrictClientFallback: typeof import('./jobSearchFallbackHeuristics').shouldRecoverWithStrictClientFallback;

beforeAll(async () => {
  const heuristics = await import('./jobSearchFallbackHeuristics');
  resolveStrictFallbackWindow = heuristics.resolveStrictFallbackWindow;
  shouldRecoverWithStrictClientFallback = heuristics.shouldRecoverWithStrictClientFallback;
});

describe('jobService strict fallback helpers', () => {
  test('keeps browse fallback shallow when there are no active strict filters', () => {
    expect(resolveStrictFallbackWindow({
      page: 0,
      pageSize: 50,
      hasSearchTerm: false,
      hasExpandedFilterCoverage: false,
    })).toBe(200);
  });

  test('widens browse fallback window for filtered discovery pages', () => {
    expect(resolveStrictFallbackWindow({
      page: 0,
      pageSize: 50,
      hasSearchTerm: false,
      hasExpandedFilterCoverage: true,
    })).toBe(1200);

    expect(resolveStrictFallbackWindow({
      page: 1,
      pageSize: 50,
      hasSearchTerm: false,
      hasExpandedFilterCoverage: true,
      preferDeeperScan: true,
    })).toBe(1800);
  });

  test('marks sparse bridge-backed filtered pages for strict recovery', () => {
    expect(shouldRecoverWithStrictClientFallback({
      page: 0,
      pageSize: 50,
      totalCount: 32927,
      rawResultCount: 50,
      finalResultCount: 20,
      hasExpandedFilterCoverage: true,
      backendMetaFallback: 'jobs_postgres_v1_bridge',
    })).toBe(true);
  });

  test('does not trigger strict recovery without expanded filter coverage', () => {
    expect(shouldRecoverWithStrictClientFallback({
      page: 0,
      pageSize: 50,
      totalCount: 32927,
      rawResultCount: 50,
      finalResultCount: 20,
      hasExpandedFilterCoverage: false,
      backendMetaFallback: 'jobs_postgres_v1_bridge',
    })).toBe(false);
  });
});
