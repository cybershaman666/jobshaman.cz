import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { authenticatedFetch, getCurrentAuthTokenSilently } from './csrfService';
import { recordRuntimeSignal } from './runtimeSignals';

export type JobInteractionEventType =
    | 'impression'
    | 'swipe_left'
    | 'swipe_right'
    | 'open_detail'
    | 'apply_click'
    | 'save'
    | 'unsave';

export interface JobInteractionPayload {
    jobId: string | number;
    eventType: JobInteractionEventType;
    dwellTimeMs?: number;
    sessionId?: string;
    requestId?: string;
    signalValue?: number;
    scrollDepth?: number;
    scoringVersion?: string;
    modelVersion?: string;
    metadata?: Record<string, any>;
}

export interface JobInteractionStateResponse {
    savedJobIds: string[];
    dismissedJobIds: string[];
}

export interface JobInteractionStateSyncPayload {
    savedJobIds: string[];
    dismissedJobIds: string[];
    clientUpdatedAt?: string;
    source?: string;
}

export interface JobInteractionStateSyncResponse {
    savedJobIds: string[];
    dismissedJobIds: string[];
    updatedAt: string;
}

const normalizeBackendBaseUrl = (value?: string): string | null => {
    if (!value) return null;
    try {
        const raw = String(value).trim();
        if (!raw) return null;
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        const url = new URL(withProtocol);
        return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
    } catch {
        return null;
    }
};

const resolveInteractionBackends = (): string[] => {
    const coreBase = normalizeBackendBaseUrl(BACKEND_URL);
    const searchBase = normalizeBackendBaseUrl(SEARCH_BACKEND_URL);

    // Prefer core backend first. Search runtime frequently does not expose
    // /jobs/interactions and can introduce avoidable timeouts.
    const bases = [coreBase, searchBase].filter((base): base is string => !!base);
    return Array.from(new Set(bases));
};

const resolveInteractionStateBackends = (): string[] => {
    // /jobs/interactions/state is currently provided by core backend.
    const coreBase = normalizeBackendBaseUrl(BACKEND_URL);
    if (!coreBase) return [];
    return [coreBase];
};

const INTERACTION_STATE_CACHE_KEY = 'job_interaction_state_cache_v1';
const INTERACTION_STATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INTERACTION_STATE_SYNC_QUEUE_KEY = 'job_interaction_state_sync_queue_v1';
const INTERACTION_STATE_SYNC_MAX_RETRIES = 3;
const INTERACTION_STATE_SYNC_RETRY_MS = 6000;
const INTERACTION_TRACKING_COOLDOWN_MS = 90_000;
let interactionStateSyncInFlight = false;
let interactionStateSyncTimer: number | null = null;
let interactionTrackingDisabledUntil = 0;

const isV2ApiOnly = () => String(BACKEND_URL || '').startsWith('/api/v2') || String(BACKEND_URL || '').includes('/api/v2');

const readInteractionStateCache = (): { savedJobIds: string[]; dismissedJobIds: string[] } | null => {
    try {
        const raw = localStorage.getItem(INTERACTION_STATE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedJobIds?: string[]; dismissedJobIds?: string[]; cachedAt?: string };
        if (!parsed?.cachedAt) return null;
        const cachedAt = new Date(parsed.cachedAt).getTime();
        if (!Number.isFinite(cachedAt)) return null;
        if (Date.now() - cachedAt > INTERACTION_STATE_CACHE_TTL_MS) return null;
        return {
            savedJobIds: Array.isArray(parsed.savedJobIds) ? parsed.savedJobIds.map((id) => String(id)) : [],
            dismissedJobIds: Array.isArray(parsed.dismissedJobIds) ? parsed.dismissedJobIds.map((id) => String(id)) : []
        };
    } catch {
        return null;
    }
};

const writeInteractionStateCache = (payload: { savedJobIds: string[]; dismissedJobIds: string[] }): void => {
    try {
        localStorage.setItem(INTERACTION_STATE_CACHE_KEY, JSON.stringify({
            savedJobIds: payload.savedJobIds,
            dismissedJobIds: payload.dismissedJobIds,
            cachedAt: new Date().toISOString()
        }));
    } catch {
        // ignore storage failures
    }
};

export const updateInteractionStateCache = (payload: { savedJobIds: string[]; dismissedJobIds: string[] }): void => {
    writeInteractionStateCache({
        savedJobIds: Array.from(new Set((payload.savedJobIds || []).map((id) => String(id)))),
        dismissedJobIds: Array.from(new Set((payload.dismissedJobIds || []).map((id) => String(id)))),
    });
};

const readInteractionSyncQueue = (): { payload: JobInteractionStateSyncPayload; attempts: number } | null => {
    try {
        const raw = localStorage.getItem(INTERACTION_STATE_SYNC_QUEUE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.payload) return null;
        return {
            payload: parsed.payload,
            attempts: Math.max(0, Math.floor(parsed.attempts || 0))
        };
    } catch {
        return null;
    }
};

const writeInteractionSyncQueue = (entry: { payload: JobInteractionStateSyncPayload; attempts: number } | null): void => {
    try {
        if (!entry) {
            localStorage.removeItem(INTERACTION_STATE_SYNC_QUEUE_KEY);
            return;
        }
        localStorage.setItem(INTERACTION_STATE_SYNC_QUEUE_KEY, JSON.stringify(entry));
    } catch {
        // ignore storage failures
    }
};

const scheduleInteractionStateSyncRetry = () => {
    if (interactionStateSyncTimer) {
        window.clearTimeout(interactionStateSyncTimer);
    }
    interactionStateSyncTimer = window.setTimeout(() => {
        void flushInteractionStateSyncQueue();
    }, INTERACTION_STATE_SYNC_RETRY_MS);
};

export const trackJobInteraction = async (payload: JobInteractionPayload): Promise<void> => {
    if (isV2ApiOnly()) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'v2_endpoint_not_ready',
            event_type: payload.eventType
        }, {
            dedupeKey: 'v2_endpoint_not_ready',
            throttleMs: 60_000,
            sendAnalytics: false
        });
        return;
    }

    if (interactionTrackingDisabledUntil > Date.now()) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'cooldown_active',
            event_type: payload.eventType
        }, {
            dedupeKey: 'cooldown_active',
            throttleMs: 30_000,
            sendAnalytics: false
        });
        return;
    }

    const authToken = await getCurrentAuthTokenSilently();
    if (!authToken) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'missing_auth',
            event_type: payload.eventType
        }, {
            dedupeKey: 'missing_auth',
            throttleMs: 60_000,
            sendAnalytics: false
        });
        return;
    }

    const backends = resolveInteractionBackends();
    if (!backends.length) return;

    const normalizedJobId = typeof payload.jobId === 'string'
        ? Number.parseInt(payload.jobId, 10)
        : Number(payload.jobId);
    if (!Number.isFinite(normalizedJobId) || normalizedJobId <= 0) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'invalid_job_id',
            event_type: payload.eventType
        }, {
            dedupeKey: 'invalid_job_id',
            throttleMs: 60_000,
            sendAnalytics: false
        });
        return;
    }

    const requestBody = JSON.stringify({
        job_id: normalizedJobId,
        event_type: payload.eventType,
        dwell_time_ms: payload.dwellTimeMs ?? null,
        session_id: payload.sessionId ?? null,
        request_id: payload.requestId ?? null,
        signal_value: payload.signalValue ?? null,
        scroll_depth: payload.scrollDepth ?? null,
        scoring_version: payload.scoringVersion ?? null,
        model_version: payload.modelVersion ?? null,
        metadata: payload.metadata ?? null
    });

    let hasTransientServerFailure = false;
    for (const baseUrl of backends) {
        try {
            const response = await authenticatedFetch(`${baseUrl}/jobs/interactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestBody
            }, authToken);

            if (response.ok) {
                interactionTrackingDisabledUntil = 0;
                return;
            }

            if (response.status >= 500 || response.status === 429) {
                hasTransientServerFailure = true;
                recordRuntimeSignal('interaction_tracking_degraded', {
                    reason: 'server_error',
                    status: response.status,
                    backend: baseUrl
                }, {
                    dedupeKey: `status_${response.status}`,
                    throttleMs: 30_000,
                    sendAnalytics: false
                });
                continue;
            }

            console.warn('⚠️ Failed to track job interaction:', response.status, response.statusText);
            return;
        } catch (error) {
            const msg = String((error as any)?.message || '').toLowerCase();
            const isTransient =
                (error as any)?.name === 'AbortError' ||
                msg.includes('aborted') ||
                msg.includes('networkerror') ||
                msg.includes('failed to fetch') ||
                msg.includes('cors');

            if (isTransient) {
                hasTransientServerFailure = true;
                continue;
            }

            console.warn('⚠️ Error tracking job interaction:', error);
            return;
        }
    }

    if (hasTransientServerFailure) {
        interactionTrackingDisabledUntil = Date.now() + INTERACTION_TRACKING_COOLDOWN_MS;
    }

    recordRuntimeSignal('interaction_tracking_skipped', {
        reason: hasTransientServerFailure ? 'all_backends_unavailable_cooldown' : 'all_backends_unavailable',
        event_type: payload.eventType
    }, {
        dedupeKey: hasTransientServerFailure ? 'all_backends_unavailable_cooldown' : 'all_backends_unavailable',
        throttleMs: 30_000,
        sendAnalytics: false
    });
};

export const syncJobInteractionState = async (
    payload: JobInteractionStateSyncPayload
): Promise<JobInteractionStateSyncResponse | null> => {
    if (isV2ApiOnly()) {
        const result: JobInteractionStateSyncResponse = {
            savedJobIds: Array.from(new Set((payload.savedJobIds || []).map((id) => String(id)))),
            dismissedJobIds: Array.from(new Set((payload.dismissedJobIds || []).map((id) => String(id)))),
            updatedAt: new Date().toISOString(),
        };
        writeInteractionStateCache(result);
        writeInteractionSyncQueue(null);
        return result;
    }

    const authToken = await getCurrentAuthTokenSilently();
    if (!authToken) return null;

    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/jobs/interactions/state/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                saved_job_ids: payload.savedJobIds || [],
                dismissed_job_ids: payload.dismissedJobIds || [],
                client_updated_at: payload.clientUpdatedAt || null,
                source: payload.source || null
            })
        }, authToken);

        if (!response.ok) {
            const status = response.status;
            const isTransient = status >= 500 || status === 429;
            if (isTransient) {
                enqueueInteractionStateSync(payload);
            }
            return null;
        }

        const data = await response.json();
        const result: JobInteractionStateSyncResponse = {
            savedJobIds: Array.isArray(data?.saved_job_ids) ? data.saved_job_ids.map((id: unknown) => String(id)) : [],
            dismissedJobIds: Array.isArray(data?.dismissed_job_ids) ? data.dismissed_job_ids.map((id: unknown) => String(id)) : [],
            updatedAt: String(data?.updated_at || new Date().toISOString())
        };
        writeInteractionStateCache({
            savedJobIds: result.savedJobIds,
            dismissedJobIds: result.dismissedJobIds
        });
        writeInteractionSyncQueue(null);
        return result;
    } catch (error) {
        const msg = String((error as any)?.message || '').toLowerCase();
        const isTransient =
            (error as any)?.name === 'AbortError' ||
            msg.includes('aborted') ||
            msg.includes('networkerror') ||
            msg.includes('failed to fetch') ||
            msg.includes('cors') ||
            msg.includes('timeout');
        if (isTransient) {
            enqueueInteractionStateSync(payload);
        }
        return null;
    }
};

const enqueueInteractionStateSync = (payload: JobInteractionStateSyncPayload) => {
    const existing = readInteractionSyncQueue();
    const attempts = Math.min(INTERACTION_STATE_SYNC_MAX_RETRIES, (existing?.attempts || 0));
    writeInteractionSyncQueue({ payload, attempts });
    scheduleInteractionStateSyncRetry();
};

export const flushInteractionStateSyncQueue = async (): Promise<void> => {
    if (isV2ApiOnly()) {
        writeInteractionSyncQueue(null);
        return;
    }

    if (interactionStateSyncInFlight) return;
    const entry = readInteractionSyncQueue();
    if (!entry) return;

    if (entry.attempts >= INTERACTION_STATE_SYNC_MAX_RETRIES) {
        writeInteractionSyncQueue(null);
        return;
    }

    interactionStateSyncInFlight = true;
    try {
        const result = await syncJobInteractionState(entry.payload);
        if (result) {
            writeInteractionSyncQueue(null);
            return;
        }
        writeInteractionSyncQueue({
            payload: entry.payload,
            attempts: entry.attempts + 1
        });
        scheduleInteractionStateSyncRetry();
    } finally {
        interactionStateSyncInFlight = false;
    }
};

export const fetchJobInteractionState = async (limit: number = 5000): Promise<JobInteractionStateResponse> => {
    const cached = readInteractionStateCache();
    if (cached) {
        return {
            savedJobIds: Array.from(new Set(cached.savedJobIds)),
            dismissedJobIds: Array.from(new Set(cached.dismissedJobIds))
        };
    }
    if (isV2ApiOnly()) {
        return { savedJobIds: [], dismissedJobIds: [] };
    }
    const authToken = await getCurrentAuthTokenSilently();
    if (!authToken) {
        return { savedJobIds: [], dismissedJobIds: [] };
    }

    const backends = resolveInteractionStateBackends();
    if (!backends.length) {
        return { savedJobIds: [], dismissedJobIds: [] };
    }

    const clampedLimit = Math.max(1, Math.min(5_000, Math.floor(limit || 5000)));

    for (const baseUrl of backends) {
        try {
            const response = await authenticatedFetch(
                `${baseUrl}/jobs/interactions/state?limit=${clampedLimit}`,
                { method: 'GET' },
                authToken
            );
            if (!response.ok) continue;

            const payload = await response.json();
            const savedJobIds: string[] = Array.isArray(payload?.saved_job_ids)
                ? payload.saved_job_ids.map((id: unknown) => String(id))
                : [];
            const dismissedJobIds: string[] = Array.isArray(payload?.dismissed_job_ids)
                ? payload.dismissed_job_ids.map((id: unknown) => String(id))
                : [];

            const result: JobInteractionStateResponse = {
                savedJobIds: Array.from(new Set(savedJobIds)),
                dismissedJobIds: Array.from(new Set(dismissedJobIds))
            };
            writeInteractionStateCache(result);
            return result;
        } catch (error) {
            const msg = String((error as any)?.message || '').toLowerCase();
            const isTransient =
                (error as any)?.name === 'AbortError' ||
                msg.includes('aborted') ||
                msg.includes('networkerror') ||
                msg.includes('failed to fetch') ||
                msg.includes('cors');
            if (isTransient) continue;
            break;
        }
    }

    return { savedJobIds: [], dismissedJobIds: [] };
};
