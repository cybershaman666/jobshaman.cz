import React from 'react';
import { decideV2CompanyHandshake, fetchV2CompanyHandshakeReadout } from '../../../../services/companyDashboardService';

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

const normalizeReadout = (payload: Record<string, any> | null, fallbackHandshakeId: string): HandshakeReadout | null => {
  if (!payload) return null;
  const readout = payload.readout || payload;
  const session = payload.session || {};
  const scorecards = Array.isArray(readout.scorecards) ? readout.scorecards : [];
  const evidenceSections = Array.isArray(readout.evidence_sections) ? readout.evidence_sections : [];
  const answers = evidenceSections.length
    ? Object.fromEntries(evidenceSections.map((section: any) => [
        String(section?.id || section?.title || 'answer'),
        {
          title: section?.title,
          prompt: section?.prompt,
          body: section?.body,
          updated_at: section?.updated_at,
          elapsed_ms: section?.elapsed_ms,
        },
      ]))
    : (readout.answers || session.answers || {});
  const matchScore = scorecards.length
    ? Math.round(scorecards.reduce((sum: number, item: any) => sum + Number(item?.score || 0), 0) / scorecards.length)
    : Number(readout.match_score || readout.score || 0);
  const identity = readout.identity || {};
  const profileSummary = readout.profile_summary || {};
  return {
    handshakeId: String(readout.handshake_id || payload.handshake_id || fallbackHandshakeId),
    candidateName: identity.name || profileSummary.name || identity.alias || 'Anonymous candidate',
    candidateHeadline: readout.headline || profileSummary.headline,
    status: session.status || readout.status || 'in_progress',
    matchScore,
    answers,
    feedback: readout.recommended_next_step,
    messages: readout.messages || [],
  };
};

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
        setReadout(normalizeReadout(data, handshakeId));
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
          setReadout(normalizeReadout(result, handshakeId) || {
            ...readout,
            status: action,
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
