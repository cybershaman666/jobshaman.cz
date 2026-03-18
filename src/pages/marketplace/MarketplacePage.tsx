import React from 'react';

import type { Job, SearchDiagnosticsMeta, UserProfile } from '../../../types';
import ChallengeControlCenter from '../../../components/challenges/ChallengeControlCenter';
import { type DiscoveryMode } from '../../../components/challenges/ChallengeSidebar';

export interface MarketplacePageProps {
  hasNativeChallenges: boolean;
  jobs: Job[];
  selectedJobId: string | null;
  savedJobIds: string[];
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  discoveryMode: DiscoveryMode;
  searchDiagnostics: SearchDiagnosticsMeta | null;
  setDiscoveryMode: (mode: DiscoveryMode) => void;
  setLane: (lane: 'challenges' | 'imports') => void;
  totalCount: number;
  isLoadingJobs: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  loadMoreJobs: () => void;
  goToPage: (page: number) => void;
  onOpenProfile: () => void;
  theme: 'light' | 'dark';
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  filterBenefits: string[];
  setFilterBenefits: (benefits: string[]) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
}

const MarketplacePage: React.FC<MarketplacePageProps> = ({
  jobs,
  selectedJobId,
  savedJobIds,
  userProfile,
  lane,
  discoveryMode,
  searchDiagnostics,
  setDiscoveryMode,
  setLane,
  totalCount,
  isLoadingJobs,
  loadingMore,
  hasMore,
  currentPage,
  pageSize,
  handleJobSelect,
  handleToggleSave,
  loadMoreJobs,
  goToPage,
  onOpenProfile,
  theme,
  filterMinSalary,
  setFilterMinSalary,
  filterBenefits,
  setFilterBenefits,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  onOpenAuth,
}) => {
  return (
    <div className="space-y-5 bg-white dark:bg-slate-950">
      <div id="marketplace-workspace">
        <ChallengeControlCenter
          jobs={jobs}
          userProfile={userProfile}
          lane={lane}
          setLane={setLane}
          discoveryMode={discoveryMode}
          searchDiagnostics={searchDiagnostics}
          setDiscoveryMode={setDiscoveryMode}
          savedJobIds={savedJobIds}
          totalCount={totalCount}
          isLoadingJobs={isLoadingJobs}
          loadingMore={loadingMore}
          hasMore={hasMore}
          currentPage={currentPage}
          pageSize={pageSize}
          handleJobSelect={handleJobSelect}
          handleToggleSave={handleToggleSave}
          loadMoreJobs={loadMoreJobs}
          goToPage={goToPage}
          theme={theme}
          filterMinSalary={filterMinSalary}
          setFilterMinSalary={setFilterMinSalary}
          filterBenefits={filterBenefits}
          setFilterBenefits={setFilterBenefits}
          remoteOnly={remoteOnly}
          setRemoteOnly={setRemoteOnly}
          enableCommuteFilter={enableCommuteFilter}
          setEnableCommuteFilter={setEnableCommuteFilter}
          filterMaxDistance={filterMaxDistance}
          setFilterMaxDistance={setFilterMaxDistance}
          onOpenProfile={onOpenProfile}
          onOpenAuth={onOpenAuth}
          selectedJobId={selectedJobId}
        />
      </div>
    </div>
  );
};

export default MarketplacePage;
