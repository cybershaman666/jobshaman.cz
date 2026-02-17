import { getCookiePreferences } from './cookieConsentService';
import { trackAnalyticsEvent } from './supabaseService';

export type RuntimeSignalName =
    | 'search_hybrid_unavailable'
    | 'search_rpc_overload'
    | 'search_strict_fallback'
    | 'search_backend_meta_fallback'
    | 'csrf_fetch_unavailable'
    | 'request_timeout'
    | 'backend_cooldown_entered'
    | 'request_blocked_by_cooldown'
    | 'interaction_tracking_degraded'
    | 'interaction_tracking_skipped'
    | `custom:${string}`;

export interface RuntimeSignalEvent {
    id: string;
    name: RuntimeSignalName;
    key: string;
    dedupeKey: string;
    countForKey: number;
    epochMs: number;
    timestamp: string;
    metadata: Record<string, unknown>;
}

export interface RuntimeSignalSnapshot {
    generatedAt: string;
    totals: Record<string, number>;
    recent: RuntimeSignalEvent[];
}

interface RuntimeSignalOptions {
    dedupeKey?: string;
    throttleMs?: number;
    analyticsSampleWindowMs?: number;
    sendAnalytics?: boolean;
    emitConsole?: boolean;
}

const SIGNAL_STORAGE_KEY = 'js_runtime_signals_v1';
const SIGNAL_MAX_EVENTS = 120;
const DEFAULT_THROTTLE_MS = 15_000;
const DEFAULT_ANALYTICS_SAMPLE_WINDOW_MS = 120_000;

const signalCounters = new Map<string, number>();
const lastSignalLoggedAt = new Map<string, number>();
const lastAnalyticsSentAt = new Map<string, number>();
const recentSignals: RuntimeSignalEvent[] = [];

let initialized = false;

declare global {
    interface Window {
        __jobshamanRuntimeSignals?: RuntimeSignalSnapshot;
    }
}

const normalizeMetadata = (metadata: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata || {})) {
        if (typeof value === 'string') {
            out[key] = value.length > 240 ? `${value.slice(0, 237)}...` : value;
        } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
            out[key] = value;
        } else if (Array.isArray(value)) {
            out[key] = value.slice(0, 10).map((item) => {
                if (typeof item === 'string') return item.length > 120 ? `${item.slice(0, 117)}...` : item;
                if (typeof item === 'number' || typeof item === 'boolean' || item === null) return item;
                return '[complex]';
            });
        } else if (value instanceof Error) {
            out[key] = value.message;
        } else if (value && typeof value === 'object') {
            out[key] = '[object]';
        } else if (value !== undefined) {
            out[key] = String(value);
        }
    }
    return out;
};

const canSendAnalyticsSignal = (): boolean => {
    try {
        const prefs = getCookiePreferences();
        return Boolean(prefs?.analytics);
    } catch {
        return false;
    }
};

const buildSnapshot = (): RuntimeSignalSnapshot => {
    const totals: Record<string, number> = {};
    for (const [key, count] of signalCounters.entries()) {
        totals[key] = count;
    }
    return {
        generatedAt: new Date().toISOString(),
        totals,
        recent: [...recentSignals]
    };
};

const persistSnapshot = (): void => {
    if (typeof window === 'undefined') return;
    try {
        const snapshot = buildSnapshot();
        sessionStorage.setItem(SIGNAL_STORAGE_KEY, JSON.stringify(snapshot));
        window.__jobshamanRuntimeSignals = snapshot;
    } catch {
        // Ignore storage errors in private mode / quota limits.
    }
};

const ensureInitialized = (): void => {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    try {
        const raw = sessionStorage.getItem(SIGNAL_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<RuntimeSignalSnapshot>;
        if (parsed?.totals && typeof parsed.totals === 'object') {
            for (const [key, count] of Object.entries(parsed.totals)) {
                if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
                    signalCounters.set(key, count);
                }
            }
        }
        if (Array.isArray(parsed?.recent)) {
            const sanitizedRecent = parsed.recent
                .filter((event) => !!event && typeof event === 'object')
                .slice(-SIGNAL_MAX_EVENTS) as RuntimeSignalEvent[];
            recentSignals.push(...sanitizedRecent);
        }
        window.__jobshamanRuntimeSignals = buildSnapshot();
    } catch {
        // Ignore corrupted snapshots.
    }
};

const createSignalEvent = (
    name: RuntimeSignalName,
    key: string,
    dedupeKey: string,
    countForKey: number,
    metadata: Record<string, unknown>,
    epochMs: number
): RuntimeSignalEvent => {
    return {
        id: `${key}:${epochMs}`,
        name,
        key,
        dedupeKey,
        countForKey,
        epochMs,
        timestamp: new Date(epochMs).toISOString(),
        metadata
    };
};

export const recordRuntimeSignal = (
    name: RuntimeSignalName,
    metadata: Record<string, unknown> = {},
    options: RuntimeSignalOptions = {}
): void => {
    ensureInitialized();

    const dedupeKey = String(options.dedupeKey || 'global');
    const key = `${name}:${dedupeKey}`;
    const now = Date.now();
    const normalized = normalizeMetadata(metadata);
    const countForKey = (signalCounters.get(key) || 0) + 1;
    signalCounters.set(key, countForKey);

    const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    const lastLoggedAt = lastSignalLoggedAt.get(key) || 0;
    if (now - lastLoggedAt < throttleMs) {
        return;
    }
    lastSignalLoggedAt.set(key, now);

    const event = createSignalEvent(name, key, dedupeKey, countForKey, normalized, now);
    recentSignals.push(event);
    if (recentSignals.length > SIGNAL_MAX_EVENTS) {
        recentSignals.splice(0, recentSignals.length - SIGNAL_MAX_EVENTS);
    }
    persistSnapshot();

    if (options.emitConsole !== false) {
        console.warn(`[runtime] ${name} (${dedupeKey})`, normalized);
    }

    const sendAnalytics = options.sendAnalytics ?? true;
    if (!sendAnalytics || !canSendAnalyticsSignal()) {
        return;
    }

    const sampleWindowMs = options.analyticsSampleWindowMs ?? DEFAULT_ANALYTICS_SAMPLE_WINDOW_MS;
    const lastAnalyticsAt = lastAnalyticsSentAt.get(key) || 0;
    if (now - lastAnalyticsAt < sampleWindowMs) {
        return;
    }
    lastAnalyticsSentAt.set(key, now);

    void trackAnalyticsEvent({
        event_type: 'runtime_signal',
        feature: 'search_runtime',
        metadata: {
            signal_name: name,
            signal_key: key,
            signal_dedupe_key: dedupeKey,
            count_for_key: countForKey,
            ...normalized
        }
    });
};

export const getRuntimeSignalSnapshot = (): RuntimeSignalSnapshot => {
    ensureInitialized();
    return buildSnapshot();
};

export const clearRuntimeSignalSnapshot = (): void => {
    signalCounters.clear();
    lastSignalLoggedAt.clear();
    lastAnalyticsSentAt.clear();
    recentSignals.length = 0;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem(SIGNAL_STORAGE_KEY);
        } catch {
            // Ignore storage errors.
        }
        window.__jobshamanRuntimeSignals = buildSnapshot();
    }
};

