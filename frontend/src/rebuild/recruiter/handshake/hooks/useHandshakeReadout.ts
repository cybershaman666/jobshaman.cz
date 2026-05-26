import React from 'react';
import { decideV2CompanyHandshake, fetchV2CompanyHandshakeReadout } from '../../../../services/companyDashboardService';
import type { Role } from '../../../models';

export interface HandshakeReadout {
  handshakeId: string;
  candidateName: string;
  candidateHeadline?: string;
  status: string;
  matchScore: number;
  answers: Record<string, any>;
  feedback?: string;
  messages?: any[];
}

export interface UseHandshakeReadoutOptions {
  onError?: (error: Error) => void;
}

/**
 * Hook for managing handshake readout data on recruiter side
 * Handles:
 * - Fetching readout data
 * - Decision submission
 * - Message loading
 */
export const useHandshakeReadout = (
  companyId: string,
  handshakeId: string,
  options: UseHandshakeReadoutOptions = {}
) => {
  const { onError } = options;

  const [readout, setReadout] = React.useState<HandshakeReadout | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeciding, setIsDeciding] = React.useState(false);

  // Fetch readout
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchV2CompanyHandshakeReadout(companyId, handshakeId);
        if (data) {
          // Map API response to our interface
          setReadout({
            handshakeId,
            candidateName: data.candidate_name || 'Unknown',
            candidateHeadline: data.candidate_headline,
            status: data.status || 'in_progress',
            matchScore: data.match_score || 0,
            answers: data.answers || {},
            feedback: data.feedback,
            messages: data.messages || [],
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to fetch handshake readout', err);
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId && handshakeId) {
      void fetchData();
    }
  }, [companyId, handshakeId, onError]);

  // Make decision
  const makeDecision = React.useCallback(
    async (action: 'invite' | 'reject' | 'close', note: string) => {
      if (!companyId || !handshakeId) return;

      try {
        setIsDeciding(true);
        const result = await decideV2CompanyHandshake(companyId, handshakeId, action, note);
        
        // Update local readout with new status
        if (result && readout) {
          setReadout({
            ...readout,
            status: result.status || action,
            feedback: note,
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to make decision', err);
        onError?.(err);
        throw err;
      } finally {
        setIsDeciding(false);
      }
    },
    [companyId, handshakeId, readout, onError]
  );

  return {
    readout,
    isLoading,
    isDeciding,
    makeDecision,
  };
};
