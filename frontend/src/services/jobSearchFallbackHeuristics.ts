const STRICT_FALLBACK_MULTIPLIER = 4;
const STRICT_FALLBACK_MAX_WINDOW = 400;
const STRICT_FALLBACK_FILTERED_MAX_WINDOW = 2400;
const STRICT_FALLBACK_RECOVERY_MAX_WINDOW = 3600;

export const resolveStrictFallbackWindow = ({
  page,
  pageSize,
  hasSearchTerm,
  hasExpandedFilterCoverage,
  preferDeeperScan = false,
}: {
  page: number;
  pageSize: number;
  hasSearchTerm: boolean;
  hasExpandedFilterCoverage: boolean;
  preferDeeperScan?: boolean;
}): number => {
  const safePage = Math.max(0, Number(page || 0));
  const safePageSize = Math.max(1, Number(pageSize || 50));
  const baseWindow = Math.max(
    safePageSize * STRICT_FALLBACK_MULTIPLIER,
    (safePage + 1) * safePageSize * 2
  );

  if (hasSearchTerm) {
    return Math.min(1200, Math.max(baseWindow, 900));
  }

  if (!hasExpandedFilterCoverage) {
    return Math.min(STRICT_FALLBACK_MAX_WINDOW, baseWindow);
  }

  const floorWindow = preferDeeperScan ? 1800 : 1200;
  const pageCoverageWindow = (safePage + 1) * safePageSize * (preferDeeperScan ? 16 : 12);
  const maxWindow = preferDeeperScan ? STRICT_FALLBACK_RECOVERY_MAX_WINDOW : STRICT_FALLBACK_FILTERED_MAX_WINDOW;

  return Math.min(
    maxWindow,
    Math.max(baseWindow, floorWindow, pageCoverageWindow)
  );
};

export const shouldRecoverWithStrictClientFallback = ({
  page,
  pageSize,
  totalCount,
  rawResultCount,
  finalResultCount,
  hasExpandedFilterCoverage,
  backendMetaFallback,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  rawResultCount: number;
  finalResultCount: number;
  hasExpandedFilterCoverage: boolean;
  backendMetaFallback?: string | null;
}): boolean => {
  if (!hasExpandedFilterCoverage) {
    return false;
  }

  const safePage = Math.max(0, Number(page || 0));
  const safePageSize = Math.max(1, Number(pageSize || 50));
  const safeTotalCount = Math.max(0, Number(totalCount || 0));
  const safeRawCount = Math.max(0, Number(rawResultCount || 0));
  const safeFinalCount = Math.max(0, Number(finalResultCount || 0));
  const bridgeFallbackActive = String(backendMetaFallback || '').trim() === 'jobs_postgres_v1_bridge';
  const sparseVisibleThreshold = Math.min(24, Math.max(8, Math.floor(safePageSize * 0.5)));
  const hugePoolThreshold = Math.max(safePageSize * 20, 1000);
  const sparseVisible = safeFinalCount < sparseVisibleThreshold;
  const severeDrop =
    safeRawCount >= Math.max(20, Math.floor(safePageSize * 0.8)) &&
    safeFinalCount <= Math.floor(safeRawCount * 0.5);
  const hugePool = safeTotalCount >= hugePoolThreshold;
  const emptyLaterPage = safePage > 0 && safeFinalCount === 0 && safeTotalCount > safePage * safePageSize;

  return emptyLaterPage || (hugePool && sparseVisible && (severeDrop || bridgeFallbackActive));
};
