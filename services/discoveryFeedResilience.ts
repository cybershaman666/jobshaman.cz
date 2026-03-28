interface ShouldPreserveBrowseResultsOnEmptyRefreshArgs {
  page: number;
  isLoadMore: boolean;
  searchTerm?: string;
  filterCity?: string;
  previousJobsCount: number;
  nextJobsCount: number;
  backendResultCount: number;
  totalCount: number;
}

export const shouldPreserveBrowseResultsOnEmptyRefresh = ({
  page,
  isLoadMore,
  searchTerm,
  filterCity,
  previousJobsCount,
  nextJobsCount,
  backendResultCount,
  totalCount,
}: ShouldPreserveBrowseResultsOnEmptyRefreshArgs): boolean => {
  if (isLoadMore || page !== 0) return false;
  if (previousJobsCount <= 0 || nextJobsCount !== 0) return false;
  if (String(searchTerm || '').trim() || String(filterCity || '').trim()) return false;

  return backendResultCount > 0 || totalCount > 0;
};
