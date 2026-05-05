import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchJobInteractionState, flushInteractionStateSyncQueue, syncJobInteractionState, updateInteractionStateCache } from '../services/jobInteractionService';
import { recordRuntimeSignal } from '../services/runtimeSignals';
import type { Job, UserProfile } from '../types';

const LEGACY_SAVED_JOBS_KEY = 'savedJobIds';
const SAVED_JOBS_CACHE_PREFIX = 'jobshaman_saved_jobs_cache';
const SAVED_JOB_IDS_PREFIX = 'savedJobIds';
const DISMISSED_JOB_IDS_PREFIX = 'dismissedJobIds';

interface UseJobInteractionStateProps {
    enabled: boolean;
    userProfile: UserProfile;
}

const normalizeIds = (list: string[]) => Array.from(new Set(list.map((id) => String(id)))).sort();

export const useJobInteractionState = ({ enabled, userProfile }: UseJobInteractionStateProps) => {
    const savedJobStorageKey = `${SAVED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;
    const dismissedJobStorageKey = `${DISMISSED_JOB_IDS_PREFIX}:${userProfile.id || 'guest'}`;

    const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
    const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);
    const savedJobIdsRef = useRef<Set<string>>(new Set());
    const dismissedJobIdsRef = useRef<Set<string>>(new Set());
    const interactionStateHydratedRef = useRef(false);
    const lastInteractionSyncSignatureRef = useRef<string>('');
    const interactionSyncTimerRef = useRef<number | null>(null);

    useEffect(() => {
        savedJobIdsRef.current = new Set(savedJobIds);
    }, [savedJobIds]);

    useEffect(() => {
        dismissedJobIdsRef.current = new Set(dismissedJobIds);
    }, [dismissedJobIds]);

    const filterDismissedJobs = useCallback((list: Job[]) => {
        const dismissed = dismissedJobIdsRef.current;
        if (!dismissed.size || !list.length) return list;
        const filtered = list.filter((job) => !dismissed.has(job.id));
        if (filtered.length === 0 && list.length > 0) {
            recordRuntimeSignal('custom:dismissed_feed_fail_open', {
                original_count: list.length,
                dismissed_count: dismissed.size,
            }, {
                dedupeKey: `dismissed-feed-fail-open:${list.length}:${dismissed.size}`,
                throttleMs: 30_000,
            });
            return list;
        }
        return filtered;
    }, []);

    useEffect(() => {
        const readIds = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return [];
                return parsed.map((id: unknown) => String(id));
            } catch {
                return [];
            }
        };

        const readSavedJobIdsFromCache = (key: string): string[] => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return [];
                return Object.keys(parsed).map((id) => String(id)).filter(Boolean);
            } catch {
                return [];
            }
        };

        const saved = readIds(savedJobStorageKey);
        const dismissed = readIds(dismissedJobStorageKey);
        const cachedSaved = readSavedJobIdsFromCache(`${SAVED_JOBS_CACHE_PREFIX}:${userProfile.id || 'guest'}`);
        const mergedSaved = saved.length > 0 ? saved : cachedSaved;

        if (!userProfile.id && saved.length === 0) {
            const legacy = readIds(LEGACY_SAVED_JOBS_KEY);
            const legacyMerged = legacy.length > 0 ? legacy : cachedSaved;
            setSavedJobIds(Array.from(new Set(legacyMerged)).filter((id) => !dismissed.includes(id)));
        } else {
            setSavedJobIds(Array.from(new Set(mergedSaved)).filter((id) => !dismissed.includes(id)));
        }

        setDismissedJobIds(Array.from(new Set(dismissed)));
    }, [dismissedJobStorageKey, savedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(savedJobStorageKey, JSON.stringify(savedJobIds));
            if (!userProfile.id) {
                localStorage.setItem(LEGACY_SAVED_JOBS_KEY, JSON.stringify(savedJobIds));
            }
        } catch (error) {
            console.error('Error saving jobs to localStorage:', error);
        }
    }, [savedJobIds, savedJobStorageKey, userProfile.id]);

    useEffect(() => {
        try {
            localStorage.setItem(dismissedJobStorageKey, JSON.stringify(dismissedJobIds));
        } catch (error) {
            console.error('Error saving dismissed jobs to localStorage:', error);
        }
    }, [dismissedJobIds, dismissedJobStorageKey]);

    useEffect(() => {
        updateInteractionStateCache({
            savedJobIds,
            dismissedJobIds,
        });
    }, [dismissedJobIds, savedJobIds]);

    useEffect(() => {
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;
        if (!interactionStateHydratedRef.current) return;

        const nextSaved = normalizeIds(savedJobIds);
        const nextDismissed = normalizeIds(dismissedJobIds).filter((id) => !nextSaved.includes(id));
        const signature = JSON.stringify({ saved: nextSaved, dismissed: nextDismissed });
        if (signature === lastInteractionSyncSignatureRef.current) return;

        if (interactionSyncTimerRef.current) {
            window.clearTimeout(interactionSyncTimerRef.current);
        }

        interactionSyncTimerRef.current = window.setTimeout(() => {
            void (async () => {
                const payload = {
                    savedJobIds: nextSaved,
                    dismissedJobIds: nextDismissed,
                    clientUpdatedAt: new Date().toISOString(),
                    source: 'client_state_sync',
                };
                const result = await syncJobInteractionState(payload);
                if (result) {
                    const canonicalSaved = normalizeIds(result.savedJobIds || []);
                    const canonicalDismissed = normalizeIds(result.dismissedJobIds || []).filter((id) => !canonicalSaved.includes(id));
                    const canonicalSignature = JSON.stringify({ saved: canonicalSaved, dismissed: canonicalDismissed });
                    lastInteractionSyncSignatureRef.current = canonicalSignature;
                    if (canonicalSignature !== signature) {
                        setSavedJobIds(canonicalSaved);
                        setDismissedJobIds(canonicalDismissed);
                    }
                } else {
                    lastInteractionSyncSignatureRef.current = signature;
                }
            })();
        }, 800);

        return () => {
            if (interactionSyncTimerRef.current) {
                window.clearTimeout(interactionSyncTimerRef.current);
            }
        };
    }, [dismissedJobIds, enabled, savedJobIds, userProfile.id, userProfile.isLoggedIn]);

    useEffect(() => {
        let cancelled = false;
        if (!enabled) return;
        if (!userProfile.isLoggedIn || !userProfile.id) return;

        void (async () => {
            try {
                const state = await fetchJobInteractionState(20000);
                if (cancelled) return;

                const mergedSavedSet = new Set<string>([
                    ...Array.from(savedJobIdsRef.current),
                    ...state.savedJobIds.map((id) => String(id)),
                ]);
                const mergedDismissedSet = new Set<string>([
                    ...Array.from(dismissedJobIdsRef.current),
                    ...state.dismissedJobIds.map((id) => String(id)),
                ]);

                const nextSaved = Array.from(mergedSavedSet);
                const nextDismissed = Array.from(mergedDismissedSet).filter((id) => !mergedSavedSet.has(id));

                setSavedJobIds(nextSaved);
                setDismissedJobIds(nextDismissed);
            } catch (error) {
                if (!cancelled) {
                    console.warn('Failed to hydrate interaction state from backend:', error);
                }
            } finally {
                if (!cancelled) {
                    interactionStateHydratedRef.current = true;
                    void flushInteractionStateSyncQueue();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, userProfile.id, userProfile.isLoggedIn]);

    const applyInteractionState = useCallback((
        jobId: string,
        eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave'
    ) => {
        const normalizedId = String(jobId);
        if (!normalizedId) return;

        if (eventType === 'save' || eventType === 'swipe_right') {
            setSavedJobIds((prev) => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
            setDismissedJobIds((prev) => prev.filter((id) => id !== normalizedId));
            return;
        }

        setSavedJobIds((prev) => prev.filter((id) => id !== normalizedId));
        if (eventType === 'swipe_left') {
            setDismissedJobIds((prev) => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
        }
    }, []);

    const setSavedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setSavedJobIds((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    const setDismissedJobIdsWithDedupe = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        setDismissedJobIds((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            return Array.from(new Set(next.map((id) => String(id))));
        });
    }, []);

    return {
        applyInteractionState,
        dismissedJobIds,
        filterDismissedJobs,
        savedJobIds,
        setDismissedJobIds: setDismissedJobIdsWithDedupe,
        setSavedJobIds: setSavedJobIdsWithDedupe,
    };
};

export default useJobInteractionState;
