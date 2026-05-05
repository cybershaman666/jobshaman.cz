import { useEffect, useState } from 'react';
import type { Candidate, CandidateBenchmarkMetrics } from '../types';

type TranslateFn = (key: string, options?: any) => string;

export const useCompanyCandidatesData = (
  companyId: string | undefined,
  activeTab: string,
  selectedJobId: string,
  _t: TranslateFn,
) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateBenchmarks, setCandidateBenchmarks] = useState<CandidateBenchmarkMetrics | null>(null);
  const [isLoadingCandidateBenchmarks, setIsLoadingCandidateBenchmarks] = useState(false);
  const [lastCandidatesSyncAt, setLastCandidatesSyncAt] = useState<string | null>(null);

  const refreshCandidateBenchmarks = async () => {
    if (!companyId || (activeTab !== 'candidates' && activeTab !== 'overview' && activeTab !== 'problem_map')) return;
    setIsLoadingCandidateBenchmarks(true);
    try {
      void selectedJobId;
      setCandidateBenchmarks(null);
      setLastCandidatesSyncAt(new Date().toISOString());
    } finally {
      setIsLoadingCandidateBenchmarks(false);
    }
  };

  const refreshCandidates = async () => {
    if (!companyId || (activeTab !== 'candidates' && activeTab !== 'overview' && activeTab !== 'problem_map')) {
      setCandidates([]);
      return;
    }

    setCandidates([]);
    setLastCandidatesSyncAt(new Date().toISOString());
  };

  useEffect(() => {
    void refreshCandidateBenchmarks();
  }, [companyId, activeTab, selectedJobId]);

  useEffect(() => {
    void refreshCandidates();
  }, [companyId, activeTab]);

  return {
    candidates,
    candidateBenchmarks,
    isLoadingCandidateBenchmarks,
    lastCandidatesSyncAt,
    refreshCandidates,
    refreshCandidateBenchmarks,
  };
};
