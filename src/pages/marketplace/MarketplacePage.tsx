import React, { useState } from 'react';

import type { Job, JobSearchFilters, SearchDiagnosticsMeta, UserProfile } from '../../../types';
import ChallengeControlCenter from '../../../components/challenges/ChallengeControlCenter';
import { type DiscoveryMode } from '../../../components/challenges/ChallengeSidebar';
import type { ChallengeWorkspaceView } from '../../../components/challenges/challengeWorkspaceTypes';

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
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  loadMoreJobs: () => void;
  goToPage: (page: number) => void;
  onOpenProfile: () => void;
  applyDiscoveryDefaults: (filters: JobSearchFilters, force?: boolean) => void;
  theme: 'light' | 'dark';
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
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
  loadingMore,
  hasMore,
  currentPage,
  pageSize,
  handleJobSelect,
  handleToggleSave,
  loadMoreJobs,
  goToPage,
  onOpenProfile,
  applyDiscoveryDefaults,
  theme,
  filterMinSalary,
  setFilterMinSalary,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  onOpenAuth,
}) => {
  const [workspaceView, setWorkspaceView] = useState<ChallengeWorkspaceView>('feed');

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
          remoteOnly={remoteOnly}
          setRemoteOnly={setRemoteOnly}
          enableCommuteFilter={enableCommuteFilter}
          setEnableCommuteFilter={setEnableCommuteFilter}
          filterMaxDistance={filterMaxDistance}
          setFilterMaxDistance={setFilterMaxDistance}
          applyDiscoveryDefaults={applyDiscoveryDefaults}
          onOpenProfile={onOpenProfile}
          onOpenAuth={onOpenAuth}
          selectedJobId={selectedJobId}
          workspaceView={workspaceView}
          onWorkspaceViewChange={setWorkspaceView}
        />
      </div>
    </div>
  );
};

export default MarketplacePage;
