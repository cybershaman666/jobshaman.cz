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
    const searchBase = normalizeBackendBaseUrl(SEARCH_BACKEND_URL);
    const coreBase = normalizeBackendBaseUrl(BACKEND_URL);

    // Dedicated Northflank search runtime should be authoritative for search telemetry.
    if (searchBase && coreBase && searchBase !== coreBase) {
        return [searchBase];
    }

    const bases = [searchBase, coreBase].filter((base): base is string => !!base);
    return Array.from(new Set(bases));
};

const INTERACTION_BACKEND_COOLDOWN_MS = 20_000;
const interactionBackendCooldownByHost = new Map<string, number>();
const interactionBackendFailureCountByHost = new Map<string, number>();

const isInteractionBackendCooldownActive = (baseUrl: string): boolean =>
    Date.now() < (interactionBackendCooldownByHost.get(baseUrl) || 0);

const markInteractionBackendCooldown = (baseUrl: string): void => {
    interactionBackendCooldownByHost.set(baseUrl, Date.now() + INTERACTION_BACKEND_COOLDOWN_MS);
};

const clearInteractionBackendCooldown = (baseUrl: string): void => {
    interactionBackendCooldownByHost.delete(baseUrl);
    interactionBackendFailureCountByHost.delete(baseUrl);
};

export const trackJobInteraction = async (payload: JobInteractionPayload): Promise<void> => {
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
