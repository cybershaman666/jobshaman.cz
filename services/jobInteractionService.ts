import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { authenticatedFetch, getCurrentAuthTokenSilently, isBackendNetworkCooldownActive } from './csrfService';
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

const INTERACTION_BACKEND_COOLDOWN_MS = 20_000;
const INTERACTION_TRACKING_COOLDOWN_MS = 120_000;
const INTERACTION_STATE_CACHE_KEY = 'job_interaction_state_cache_v1';
const INTERACTION_STATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const interactionBackendCooldownByHost = new Map<string, number>();
const interactionBackendFailureCountByHost = new Map<string, number>();
let interactionTrackingDisabledUntil = 0;

const isInteractionBackendCooldownActive = (baseUrl: string): boolean =>
    Date.now() < (interactionBackendCooldownByHost.get(baseUrl) || 0);

const markInteractionBackendCooldown = (baseUrl: string): void => {
    interactionBackendCooldownByHost.set(baseUrl, Date.now() + INTERACTION_BACKEND_COOLDOWN_MS);
};

const clearInteractionBackendCooldown = (baseUrl: string): void => {
    interactionBackendCooldownByHost.delete(baseUrl);
    interactionBackendFailureCountByHost.delete(baseUrl);
};

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

export const trackJobInteraction = async (payload: JobInteractionPayload): Promise<void> => {
    if (Date.now() < interactionTrackingDisabledUntil) {
        return;
    }
    if (isBackendNetworkCooldownActive()) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'backend_cooldown',
            event_type: payload.eventType
        }, {
            dedupeKey: 'backend_cooldown',
            throttleMs: 60_000,
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
    const activeBackends = backends.filter((baseUrl) => !isInteractionBackendCooldownActive(baseUrl));
    if (!activeBackends.length) {
        recordRuntimeSignal('interaction_tracking_skipped', {
            reason: 'all_backends_in_cooldown',
            event_type: payload.eventType
        }, {
            dedupeKey: 'all_backends_in_cooldown',
            throttleMs: 30_000,
            sendAnalytics: false
        });
        return;
    }

    const requestBody = JSON.stringify({
        job_id: typeof payload.jobId === 'string' ? parseInt(payload.jobId, 10) : payload.jobId,
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

    for (const baseUrl of activeBackends) {
        try {
            const response = await authenticatedFetch(`${baseUrl}/jobs/interactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestBody
            }, authToken);

            if (response.ok) {
                clearInteractionBackendCooldown(baseUrl);
                return;
            }

            if (response.status >= 500 || response.status === 429) {
                markInteractionBackendCooldown(baseUrl);
                interactionBackendFailureCountByHost.delete(baseUrl);
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
                msg.includes('cooldown active') ||
                msg.includes('networkerror') ||
                msg.includes('failed to fetch') ||
                msg.includes('cors');

            if (isTransient) {
                const currentFailures = (interactionBackendFailureCountByHost.get(baseUrl) || 0) + 1;
                interactionBackendFailureCountByHost.set(baseUrl, currentFailures);
                // Avoid aggressive cooldown on single transient timeout.
                if (currentFailures >= 2) {
                    markInteractionBackendCooldown(baseUrl);
                    interactionBackendFailureCountByHost.delete(baseUrl);
                }
                if ((error as any)?.name === 'AbortError') {
                    interactionTrackingDisabledUntil = Date.now() + INTERACTION_TRACKING_COOLDOWN_MS;
                }
                continue;
            }

            console.warn('⚠️ Error tracking job interaction:', error);
            return;
        }
    }

    recordRuntimeSignal('interaction_tracking_skipped', {
        reason: 'all_backends_unavailable',
        event_type: payload.eventType
    }, {
        dedupeKey: 'all_backends_unavailable',
        throttleMs: 30_000,
        sendAnalytics: false
    });
};

export const fetchJobInteractionState = async (limit: number = 5000): Promise<JobInteractionStateResponse> => {
    const cached = readInteractionStateCache();
    if (cached) {
        return {
            savedJobIds: Array.from(new Set(cached.savedJobIds)),
            dismissedJobIds: Array.from(new Set(cached.dismissedJobIds))
        };
    }
    if (isBackendNetworkCooldownActive()) {
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
