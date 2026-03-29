import { useCallback, useEffect, useMemo, useRef } from 'react';

import { BACKEND_URL, SEARCH_BACKEND_URL } from '../../../constants';
import { usePaginatedJobs } from '../../../hooks/usePaginatedJobs';
import { ViewState, type Job, type UserProfile } from '../../../types';
import { clearJobCache, fetchJobById } from '../../../services/jobService';
import { getDefaultCandidateSearchFilters } from '../../../services/searchProfilePresets';

const DEBUG_DISCOVERY =
  String(import.meta.env.VITE_DEBUG_DISCOVERY || '').toLowerCase() === 'true';

interface UseMarketplaceDiscoveryProps {
  effectiveUserProfile: UserProfile;
  userProfile: UserProfile;
  enabled: boolean;
  discoveryMode: 'all' | 'micro_jobs';
  challengeRemoteOnly: boolean;
  setChallengeRemoteOnly: (value: boolean) => void;
  selectedJobId: string | null;
  setDirectlyFetchedJob: (job: Job | null) => void;
  isAdminRoute: boolean;
  isCompanyProfile: boolean;
  companyCoordinates?: { lat?: number; lon?: number } | null;
  viewState: ViewState;
}

export const useMarketplaceDiscovery = ({
  effectiveUserProfile,
  userProfile,
  enabled,
  discoveryMode,
  challengeRemoteOnly,
  setChallengeRemoteOnly,
  selectedJobId,
  setDirectlyFetchedJob,
  isAdminRoute,
  isCompanyProfile,
  companyCoordinates,
  viewState,
}: UseMarketplaceDiscoveryProps) => {
  const discovery = usePaginatedJobs({
    userProfile: effectiveUserProfile,
    initialPageSize: 500,
    enabled,
    microJobsOnly: discoveryMode === 'micro_jobs',
    remoteOnly: challengeRemoteOnly,
  });

  const {
    jobs,
    loading: isLoadingJobs,
    backendUnreachable,
    loadInitialJobs,
    enableCommuteFilter,
    setEnableCommuteFilter,
  } = discovery;

  const appliedRemoteDefaultsSignatureRef = useRef<string | null>(null);
  const reloadLockRef = useRef(false);
  const backendWakeRetryRef = useRef(false);
  const backendRetryCountRef = useRef(0);
  const backendRetryTimerRef = useRef<number | null>(null);
  const backendRetryStartTimerRef = useRef<number | null>(null);
  const backendRetryStartedAtRef = useRef<number>(0);

  const BACKEND_RETRY_MAX = 6;
  const BACKEND_RETRY_DELAY_MS = 6000;
  const BACKEND_RETRY_INITIAL_DELAY_MS = 4500;
  const BACKEND_RETRY_MAX_WINDOW_MS = 2 * 60 * 1000;

  const loadRealJobs = useCallback(async () => {
    try {
      await loadInitialJobs();
    } catch (error) {
      console.error('Failed to load jobs', error);
    }
  }, [loadInitialJobs]);

  useEffect(() => {
    let cancelled = false;

    const fetchDirectJob = async () => {
      if (!selectedJobId || jobs.find((job) => job.id === selectedJobId) || isLoadingJobs) {
        if (!selectedJobId && !cancelled) {
          setDirectlyFetchedJob(null);
        }
        return;
      }

      if (DEBUG_DISCOVERY) {
        console.log('🔗 Direct link detected, fetching job by ID:', selectedJobId);
      }
      const job = await fetchJobById(selectedJobId);
      if (cancelled) return;

      if (job) {
        setDirectlyFetchedJob(job);
      } else {
        if (DEBUG_DISCOVERY) {
          console.warn('⚠️ Job not found for direct link:', selectedJobId);
        }
        setDirectlyFetchedJob(null);
      }
    };

    void fetchDirectJob();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId, jobs, isLoadingJobs, setDirectlyFetchedJob]);

  useEffect(() => {
    if (isAdminRoute) return;

    const isProfileReady = effectiveUserProfile.isLoggedIn ? !!effectiveUserProfile.id : true;
    if (!isProfileReady) return;
    const defaults = getDefaultCandidateSearchFilters(effectiveUserProfile);
    const nextSignature = JSON.stringify({
      profileId: effectiveUserProfile.id || 'guest',
      remoteOnly: Boolean(defaults.remoteOnly),
      filterWorkArrangement: defaults.filterWorkArrangement || 'all',
    });
    if (appliedRemoteDefaultsSignatureRef.current === nextSignature) return;
    // Keep geography filters independent from profile-level remote preferences.
    return;

    if (DEBUG_DISCOVERY) {
      console.log('🏁 Applying initial remote search default...');
    }
    appliedRemoteDefaultsSignatureRef.current = nextSignature;
    setChallengeRemoteOnly(Boolean(defaults.remoteOnly));
  }, [
    effectiveUserProfile,
    isAdminRoute,
    setChallengeRemoteOnly,
  ]);

  useEffect(() => {
    if (!challengeRemoteOnly || !enableCommuteFilter) return;
    setEnableCommuteFilter(false, 'default');
  }, [challengeRemoteOnly, enableCommuteFilter, setEnableCommuteFilter]);

  useEffect(() => {
    if (isCompanyProfile && viewState === ViewState.LIST && !companyCoordinates && enableCommuteFilter) {
      setEnableCommuteFilter(false, 'default');
    }
  }, [companyCoordinates, enableCommuteFilter, isCompanyProfile, setEnableCommuteFilter, viewState]);

  useEffect(() => {
    if (!userProfile.coordinates?.lat || !userProfile.coordinates?.lon) return;
    if (reloadLockRef.current) return;

    reloadLockRef.current = true;
    Promise.resolve(clearJobCache())
      .catch((error) => console.error('Error during coordinate-triggered cache clear:', error))
      .finally(() => {
        reloadLockRef.current = false;
      });
  }, [userProfile.coordinates?.lat, userProfile.coordinates?.lon]);

  const filteredJobsRef = useRef(jobs);
  useEffect(() => {
    filteredJobsRef.current = jobs;
  }, [jobs]);

  const backendUnreachableRef = useRef(backendUnreachable);
  useEffect(() => {
    backendUnreachableRef.current = backendUnreachable;
  }, [backendUnreachable]);

  const isLoadingJobsRef = useRef(isLoadingJobs);
  useEffect(() => {
    isLoadingJobsRef.current = isLoadingJobs;
  }, [isLoadingJobs]);

  const loadRealJobsRef = useRef(loadRealJobs);
  useEffect(() => {
    loadRealJobsRef.current = loadRealJobs;
  }, [loadRealJobs]);

  const hasDedicatedSearchBackend = useMemo(() => {
    const normalizeOrigin = (value: string): string => {
      try {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(withProtocol).origin;
      } catch {
        return String(value || '').trim();
      }
    };

    const searchOrigin = normalizeOrigin(SEARCH_BACKEND_URL || '');
    const coreOrigin = normalizeOrigin(BACKEND_URL || '');
    return !!searchOrigin && (!coreOrigin || searchOrigin !== coreOrigin);
  }, []);

  useEffect(() => {
    const canPollNow = (): boolean => {
      if (typeof document !== 'undefined') {
        if (document.visibilityState !== 'visible') return false;
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      return true;
    };

    if (hasDedicatedSearchBackend) {
      backendWakeRetryRef.current = false;
      if (backendRetryTimerRef.current) {
        clearTimeout(backendRetryTimerRef.current);
        backendRetryTimerRef.current = null;
      }
      if (backendRetryStartTimerRef.current) {
        clearTimeout(backendRetryStartTimerRef.current);
        backendRetryStartTimerRef.current = null;
      }
      return;
    }

    if (backendWakeRetryRef.current || isLoadingJobsRef.current || filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
      return;
    }

    const runPoll = async () => {
      if (!backendWakeRetryRef.current) return;
      if (!canPollNow()) {
        backendWakeRetryRef.current = false;
        return;
      }
      if (backendRetryStartedAtRef.current && (Date.now() - backendRetryStartedAtRef.current) > BACKEND_RETRY_MAX_WINDOW_MS) {
        if (DEBUG_DISCOVERY) {
          console.log('Backend wake retry: exceeded max polling window, stopping');
        }
        backendWakeRetryRef.current = false;
        return;
      }

      backendRetryCountRef.current += 1;
      if (DEBUG_DISCOVERY) {
        console.log(`Backend wake retry: attempt ${backendRetryCountRef.current}/${BACKEND_RETRY_MAX}`);
      }

      try {
        await loadRealJobsRef.current();
      } catch (error) {
        console.error('Backend wake retry: loadRealJobs error', error);
      }

      if (filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
        if (DEBUG_DISCOVERY) {
          console.log('Backend wake retry: jobs appeared, stopping polling');
        }
        backendWakeRetryRef.current = false;
        return;
      }

      if (backendRetryCountRef.current >= BACKEND_RETRY_MAX) {
        if (DEBUG_DISCOVERY) {
          console.log('Backend wake retry: reached max attempts, stopping');
        }
        backendWakeRetryRef.current = false;
        return;
      }

      const backoffFactor = Math.min(8, Math.pow(2, Math.max(0, backendRetryCountRef.current - 1)));
      const delayMs = Math.min(60_000, BACKEND_RETRY_DELAY_MS * backoffFactor);
      backendRetryTimerRef.current = window.setTimeout(runPoll, delayMs);
    };

    backendRetryStartTimerRef.current = window.setTimeout(() => {
      if (backendWakeRetryRef.current || isLoadingJobsRef.current || filteredJobsRef.current.length > 0 || !backendUnreachableRef.current) {
        return;
      }
      if (!canPollNow()) {
        return;
      }
      if (DEBUG_DISCOVERY) {
        console.log('Backend wake retry: starting polling to wait for backend wake-up');
      }
      backendWakeRetryRef.current = true;
      backendRetryCountRef.current = 0;
      backendRetryStartedAtRef.current = Date.now();
      void runPoll();
    }, BACKEND_RETRY_INITIAL_DELAY_MS);

    return () => {
      if (backendRetryTimerRef.current) {
        clearTimeout(backendRetryTimerRef.current);
        backendRetryTimerRef.current = null;
      }
      if (backendRetryStartTimerRef.current) {
        clearTimeout(backendRetryStartTimerRef.current);
        backendRetryStartTimerRef.current = null;
      }
      backendWakeRetryRef.current = false;
    };
  }, [hasDedicatedSearchBackend]);

  return {
    ...discovery,
    filteredJobs: discovery.jobs,
    isLoadingJobs: discovery.loading,
    loadRealJobs,
  };
};

export default useMarketplaceDiscovery;
