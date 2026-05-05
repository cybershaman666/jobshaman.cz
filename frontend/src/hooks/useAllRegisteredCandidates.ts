import { useEffect, useState } from 'react';
import type { Candidate } from '../types';
import ApiService from '../services/apiService';

export const useAllRegisteredCandidates = (companyId?: string | null) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCandidates = async () => {
    if (!companyId) {
      setCandidates([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await ApiService.get<{ status?: string; data?: Candidate[] }>(
        `/company/${encodeURIComponent(companyId)}/talent-pool?limit=500`,
      );
      setCandidates(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.warn('Failed to load V2 talent pool', error);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCandidates();
  }, [companyId]);

  return {
    candidates,
    isLoading,
    refreshCandidates,
  };
};
