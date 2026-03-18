import { useState, type Dispatch, type SetStateAction } from 'react';

import type { Job } from '../../../types';
import { getPathPartsWithoutLocale } from '../../../utils/appRouting';

interface MarketplaceSceneState {
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  selectedBlogPostSlug: string | null;
  setSelectedBlogPostSlug: Dispatch<SetStateAction<string | null>>;
  isBlogOpen: boolean;
  setIsBlogOpen: Dispatch<SetStateAction<boolean>>;
  selectedCompanyId: string | null;
  setSelectedCompanyId: Dispatch<SetStateAction<string | null>>;
  discoveryLane: 'challenges' | 'imports';
  setDiscoveryLane: Dispatch<SetStateAction<'challenges' | 'imports'>>;
  discoveryMode: 'all' | 'micro_jobs';
  setDiscoveryMode: Dispatch<SetStateAction<'all' | 'micro_jobs'>>;
  discoverySearchMode: boolean;
  setDiscoverySearchMode: Dispatch<SetStateAction<boolean>>;
  challengeRemoteOnly: boolean;
  setChallengeRemoteOnly: Dispatch<SetStateAction<boolean>>;
  directlyFetchedJob: Job | null;
  setDirectlyFetchedJob: Dispatch<SetStateAction<Job | null>>;
}

export const useMarketplaceSceneState = (): MarketplaceSceneState => {
  const [selectedJobId, setSelectedJobIdState] = useState<string | null>(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    return parts[0] === 'challenge' || parts[0] === 'vyzva' || parts[0] === 'import' ? parts[1] : null;
  });
  const [selectedBlogPostSlug, setSelectedBlogPostSlug] = useState<string | null>(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    if (parts[0] === 'blog') return parts[1] || null;
    return null;
  });
  const [isBlogOpen, setIsBlogOpen] = useState<boolean>(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    return parts[0] === 'blog';
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    if (parts[0] === 'companies') return parts[1] || null;
    return null;
  });
  const [discoveryLane, setDiscoveryLane] = useState<'challenges' | 'imports'>('challenges');
  const [discoveryMode, setDiscoveryMode] = useState<'all' | 'micro_jobs'>('all');
  const [discoverySearchMode, setDiscoverySearchMode] = useState(false);
  const [challengeRemoteOnly, setChallengeRemoteOnly] = useState(false);
  const [directlyFetchedJob, setDirectlyFetchedJob] = useState<Job | null>(null);

  return {
    selectedJobId,
    setSelectedJobId: (id: string | null) => setSelectedJobIdState(id),
    selectedBlogPostSlug,
    setSelectedBlogPostSlug,
    isBlogOpen,
    setIsBlogOpen,
    selectedCompanyId,
    setSelectedCompanyId,
    discoveryLane,
    setDiscoveryLane,
    discoveryMode,
    setDiscoveryMode,
    discoverySearchMode,
    setDiscoverySearchMode,
    challengeRemoteOnly,
    setChallengeRemoteOnly,
    directlyFetchedJob,
    setDirectlyFetchedJob,
  };
};

export default useMarketplaceSceneState;
