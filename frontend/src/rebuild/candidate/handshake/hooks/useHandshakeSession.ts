import React, { useCallback, useEffect, useRef } from 'react';
import { patchHandshakeAnswer } from '../../../../services/v2HandshakeService';
import type { CandidateJourneySession } from '../../../models';

export interface UseHandshakeSessionOptions {
  onAutoSaveError?: (error: Error) => void;
  autoSaveDelay?: number;
}

/**
 * Hook for managing handshake session state with auto-save
 * Handles:
 * - Answer updates
 * - Debounced auto-save
 * - Dirty state tracking
 * - Step navigation
 */
export const useHandshakeSession = (
  handshakeId: string,
  initialSession: CandidateJourneySession,
  options: UseHandshakeSessionOptions = {}
) => {
  const { onAutoSaveError, autoSaveDelay = 800 } = options;

  const [session, setSession] = React.useState<CandidateJourneySession>(initialSession);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const lastSavedAnswersRef = useRef<string>(JSON.stringify(initialSession.answers || {}));
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Update answer for a specific step
   */
  const updateAnswer = useCallback((stepId: string, value: unknown) => {
    setSession((prev) => ({
      ...prev,
      answers: {
        ...(prev.answers as Record<string, string | string[]>),
        [stepId]: String(value),
      },
    } as CandidateJourneySession));
    setIsDirty(true);
  }, []);

  /**
   * Navigate to specific step
   */
  const navigateToStep = useCallback((stepId: string) => {
    setSession((prev) => ({
      ...prev,
      currentStepId: stepId,
    }));
  }, []);

  /**
   * Manual save trigger
   */
  const saveAnswers = useCallback(async () => {
    if (!isDirty || !handshakeId) return;

    const serialized = JSON.stringify(session.answers || {});
    if (serialized === lastSavedAnswersRef.current) return;

    try {
      setIsSaving(true);
      const previous = lastSavedAnswersRef.current 
        ? JSON.parse(lastSavedAnswersRef.current) as Record<string, unknown>
        : {};

      const changedEntries = Object.entries(session.answers || {}).filter(
        ([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value)
      );

      if (changedEntries.length > 0) {
        await Promise.all(
          changedEntries.map(([stepId, answer]) =>
            patchHandshakeAnswer(handshakeId, stepId, answer, stepId)
          )
        );
      }

      lastSavedAnswersRef.current = serialized;
      setIsDirty(false);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to auto-save handshake answers', err);
      onAutoSaveError?.(err);
    } finally {
      setIsSaving(false);
    }
  }, [handshakeId, session.answers, isDirty, onAutoSaveError]);

  /**
   * Auto-save effect - debounced
   */
  useEffect(() => {
    if (!isDirty) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      void saveAnswers();
    }, autoSaveDelay);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, saveAnswers, autoSaveDelay]);

  /**
   * Force save on unmount if dirty
   */
  useEffect(() => {
    return () => {
      if (isDirty) {
        void saveAnswers();
      }
    };
  }, [isDirty, saveAnswers]);

  return {
    session,
    setSession,
    updateAnswer,
    navigateToStep,
    saveAnswers,
    isDirty,
    isSaving,
  };
};
