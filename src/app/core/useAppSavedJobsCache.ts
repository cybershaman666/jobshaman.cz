import { useState, useEffect, useMemo } from 'react';
import { Job } from '../../../types';
import { fetchJobsByIds } from '../../../services/jobService';

const SAVED_JOBS_CACHE_PREFIX = 'jobshaman_saved_jobs_cache';

export function useAppSavedJobsCache(
    userId: string,
    jobsForDisplay: Job[],
    savedJobIds: string[]
): { savedJobsCache: Record<string, Job>; savedJobs: Job[] } {
    const [savedJobsCache, setSavedJobsCache] = useState<Record<string, Job>>(() => {
        if (typeof window === 'undefined' || !userId) return {};
        try {
            const raw = localStorage.getItem(`${SAVED_JOBS_CACHE_PREFIX}:${userId}`);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    // We keep fallback state for future use when fetched jobs don't cover all saved IDs
    const [_savedJobsFallback, _setSavedJobsFallback] = useState<Job[]>([]);

    // Persist cache to localStorage
    useEffect(() => {
        if (!userId || typeof window === 'undefined') return;
        try {
            localStorage.setItem(`${SAVED_JOBS_CACHE_PREFIX}:${userId}`, JSON.stringify(savedJobsCache));
        } catch { /* quota exceeded, ignore */ }
    }, [savedJobsCache, userId]);

    // Sync cache with current display jobs
    useEffect(() => {
        setSavedJobsCache((prev) => {
            const next = { ...prev };
            for (const job of jobsForDisplay) {
                if (savedJobIds.includes(String(job.id))) {
                    next[String(job.id)] = job;
                }
            }
            // Remove stale entries not in savedJobIds
            for (const key of Object.keys(next)) {
                if (!savedJobIds.includes(key) && !savedJobIds.includes(`db-${key}`)) {
                    delete next[key];
                }
            }
            return next;
        });
    }, [jobsForDisplay, savedJobIds]);

    // Fetch missing saved jobs from DB
    useEffect(() => {
        let cancelled = false;
        const missingIds = savedJobIds.filter((id) => {
            const normalized = id.startsWith('db-') ? id.substring(3) : id;
            return !savedJobsCache[normalized] && !savedJobsCache[id];
        });
        if (missingIds.length === 0) return;

        (async () => {
            try {
                const fetched = await fetchJobsByIds(missingIds);
                if (!cancelled && fetched) {
                    setSavedJobsCache((prev) => {
                        const next = { ...prev };
                        for (const job of fetched) {
                            next[String(job.id)] = job;
                        }
                        return next;
                    });
                }
            } catch (error) {
                console.warn('Failed to fetch saved jobs from DB:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [savedJobIds, savedJobsCache]);

    const savedJobs = useMemo(() => {
        const jobs = savedJobIds
            .map((id) => {
                const normalized = id.startsWith('db-') ? id.substring(3) : id;
                return savedJobsCache[normalized] || savedJobsCache[id] || null;
            })
            .filter((j): j is Job => j !== null);
        return jobs.length > 0 ? jobs : _savedJobsFallback;
    }, [savedJobIds, savedJobsCache, _savedJobsFallback]);

    return { savedJobsCache, savedJobs };
}
