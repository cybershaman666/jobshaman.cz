// CSRF Token Management Service
import { BACKEND_URL } from '../constants';
import { supabase } from './supabaseClient';
import { recordRuntimeSignal } from './runtimeSignals';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';
const CSRF_TOKEN_COOLDOWN_MS = 60_000;
const BACKEND_OPTIONAL_COOLDOWN_MS = 60_000;
const REQUEST_LOG_THROTTLE_MS = 15_000;
const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const CSRF_FETCH_TIMEOUT_MS = 35_000;
const HYBRID_FETCH_TIMEOUT_MS = 25_000;
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 20_000;
const INTERACTION_FETCH_TIMEOUT_MS = 15_000;
const INVITATIONS_FETCH_TIMEOUT_MS = 20_000;
const DIALOGUES_FETCH_TIMEOUT_MS = 15_000;
const AI_FETCH_TIMEOUT_MS = 120_000;
const ADMIN_FETCH_TIMEOUT_MS = 90_000;

let csrfTokenCooldownUntil = 0;
const csrfFetchInFlight = new Map<string, Promise<string | null>>();
let lastRequestTimeoutLogAt = 0;
let lastMissingCsrfLogAt = 0;
const backendOptionalCooldownUntilByOrigin = new Map<string, number>();

type AuthTokenCache = { token: string | null; expMs: number; checkedAtMs: number };
let authTokenCache: AuthTokenCache = { token: null, expMs: 0, checkedAtMs: 0 };
const AUTH_TOKEN_RECHECK_MS = 60_000;
const AUTH_TOKEN_EXPIRY_SAFETY_MS = 30_000;

const clearCachedAuthToken = (): void => {
    authTokenCache = { token: null, expMs: 0, checkedAtMs: 0 };
    try {
        localStorage.removeItem('auth_token');
    } catch {}
};

const isLikelyNetworkError = (error: unknown): boolean => {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
};

const isAbortError = (error: unknown): boolean => {
    return error instanceof Error && error.name === 'AbortError';
};

const shouldEmitThrottledLog = (lastAt: number, intervalMs: number = REQUEST_LOG_THROTTLE_MS): boolean => {
    return Date.now() - lastAt > intervalMs;
};

const getRequestPath = (url: string): string => {
    try {
        return new URL(url, window.location.origin).pathname || '';
    } catch {
        return '';
    }
};

const resolveRequestTimeoutMs = (url: string): number => {
    const path = getRequestPath(url);
    if (path === '/csrf-token') return CSRF_FETCH_TIMEOUT_MS;
    if (path.startsWith('/admin/stats') || path.startsWith('/admin/ai-quality') || path.startsWith('/admin/notifications')) {
        return ADMIN_FETCH_TIMEOUT_MS;
    }
    if (path === '/jobs/interactions') return INTERACTION_FETCH_TIMEOUT_MS;
    if (path === '/jobs/interactions/state') return 12_000;
    if (path === '/dialogues/me') return DIALOGUES_FETCH_TIMEOUT_MS;
    if (path.startsWith('/dialogues/')) return DIALOGUES_FETCH_TIMEOUT_MS;
    if (/^\/jobs\/[^/]+\/application-draft$/.test(path)) return AI_FETCH_TIMEOUT_MS;
    if (path === '/assessments/invitations') return INVITATIONS_FETCH_TIMEOUT_MS;
    if (path.startsWith('/assessments/invitations/')) return INVITATIONS_FETCH_TIMEOUT_MS;
    if (path === '/jobs/hybrid-search' || path === '/jobs/hybrid-search-v2') return HYBRID_FETCH_TIMEOUT_MS;
    if (path === '/subscription-status') return SUBSCRIPTION_FETCH_TIMEOUT_MS;
    if (path.startsWith('/ai/')) return AI_FETCH_TIMEOUT_MS;
    return DEFAULT_FETCH_TIMEOUT_MS;
};

const getRequestOrigin = (url: string): string | null => {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin;
    } catch {
        return null;
    }
};

const isBackendOptionalCooldownEligiblePath = (path: string): boolean => {
    return (
        path === '/csrf-token' ||
        path === '/subscription-status' ||
        path === '/jobs/interactions' ||
        path === '/jobs/interactions/state/sync' ||
        path === '/jobs/external/cached-feed' ||
        path === '/analytics/track'
    );
};

const isBackendOptionalCooldownEligibleUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        return isBackendOptionalCooldownEligiblePath(parsed.pathname || '');
    } catch {
        return false;
    }
};

const getBackendOptionalCooldownUntil = (origin: string | null): number => {
    if (!origin) return 0;
    return backendOptionalCooldownUntilByOrigin.get(origin) || 0;
};

const markBackendOptionalUnavailable = (origin: string | null): void => {
    if (!origin) return;
    backendOptionalCooldownUntilByOrigin.set(origin, Date.now() + BACKEND_OPTIONAL_COOLDOWN_MS);
};

const isAuthOptionalRequest = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || '';
        return (
            path === '/jobs/hybrid-search' ||
            path === '/jobs/hybrid-search-v2' ||
            path === '/jobs/external/cached-feed'
        );
    } catch {
        return false;
    }
};

const endpointDoesNotRequireCsrf = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || '';
        return (
            path === '/jobs/analyze' ||
            path === '/jobs/hybrid-search' ||
            path === '/jobs/hybrid-search-v2' ||
            path === '/jobs/interactions' ||
            path === '/jobs/interactions/state/sync' ||
            path.startsWith('/ai/') ||
            path === '/verify-billing' ||
            path === '/subscription-status' ||
            path.startsWith('/assessments/invitations/')
        );
    } catch {
        return false;
    }
};

/**
 * Generate and fetch a new CSRF token from the backend
 * Must be called after successful authentication
 */
export const fetchCsrfToken = async (authToken: string, backendBaseUrl: string = BACKEND_URL): Promise<string | null> => {
    const csrfFetchKey = backendBaseUrl || BACKEND_URL;
    const backendOrigin = getRequestOrigin(`${backendBaseUrl}/csrf-token`);
    if (csrfFetchInFlight.has(csrfFetchKey)) {
        return csrfFetchInFlight.get(csrfFetchKey)!;
    }
    if (Date.now() < csrfTokenCooldownUntil) {
        return null;
    }
    if (Date.now() < getBackendOptionalCooldownUntil(backendOrigin)) {
        return null;
    }

    const run = (async () => {
    // Validate authToken before attempting to fetch
    if (!authToken || typeof authToken !== 'string' || authToken.length === 0) {
        console.warn('⚠️ Invalid auth token provided to fetchCsrfToken - cannot fetch CSRF token');
        return null;
    }

    // CRITICAL: Clear any existing token to prevent race conditions
    // This ensures we don't use a stale token while a new one is being fetched
    clearCsrfToken();
    // console.log('🔄 Fetching fresh CSRF token...');

    const maxRetries = 2;
    let lastError: any = null;
    const csrfTokenUrl = `${backendBaseUrl}/csrf-token`;
    const csrfTimeoutMs = resolveRequestTimeoutMs(csrfTokenUrl);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // console.log(`🔄 Fetching fresh CSRF token (attempt ${attempt}/${maxRetries})...`);

            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                if (shouldEmitThrottledLog(lastRequestTimeoutLogAt)) {
                    console.warn(`⏱️ CSRF fetch attempt ${attempt} timed out after ${Math.round(csrfTimeoutMs / 1000)}s.`);
                    lastRequestTimeoutLogAt = Date.now();
                }
                recordRuntimeSignal('request_timeout', {
                    path: '/csrf-token',
                    method: 'GET',
                    timeout_ms: csrfTimeoutMs,
                    attempt
                }, {
                    dedupeKey: '/csrf-token',
                    throttleMs: 15_000
                });
                controller.abort('csrf-timeout');
            }, csrfTimeoutMs);

            const response = await fetch(csrfTokenUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const statusText = response.statusText;
                const status = response.status;
                console.warn(`⚠️ Failed to fetch CSRF token (Attempt ${attempt}): ${status} ${statusText}`);

                // If it's a server error (5xx), we might want to retry
                if (status >= 500) {
                    markBackendOptionalUnavailable(backendOrigin);
                    lastError = new Error(`Server error: ${status}`);
                    if (attempt < maxRetries) {
                        const delay = Math.pow(2, attempt) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                } else if (status === 401 && attempt < maxRetries) {
                    const freshToken = await getFreshAuthToken();
                    if (freshToken) {
                        authToken = freshToken;
                        continue;
                    }
                } else {
                    return null;
                }
            }

            const data = await response.json();

            if (!data.csrf_token) {
                console.warn('No CSRF token in response');
                return null;
            }

            // Store token with expiry time
            setCsrfToken(data.csrf_token, data.expiry || 3600);
            // console.log(`✅ CSRF token obtained successfully`);

            return data.csrf_token;
        } catch (error) {
            lastError = error;
            const isAborted = isAbortError(error);
            const isConnectivityIssue = isLikelyNetworkError(error) || isAborted;

            if (isConnectivityIssue) {
                csrfTokenCooldownUntil = Date.now() + CSRF_TOKEN_COOLDOWN_MS;
                markBackendOptionalUnavailable(backendOrigin);
                recordRuntimeSignal('csrf_fetch_unavailable', {
                    attempt,
                    aborted: isAborted,
                    error: isAborted ? 'csrf-timeout' : String((error as any)?.message || '')
                }, {
                    dedupeKey: isAborted ? 'timeout' : 'network',
                    throttleMs: 15_000
                });
                console.warn(`⚠️ CSRF fetch unavailable (attempt ${attempt}).`);
            } else {
                console.error(`❌ Error fetching CSRF token (Attempt ${attempt}):`, error);
            }

            if (attempt < maxRetries) {
                if (Date.now() < csrfTokenCooldownUntil) {
                    break;
                }
                const delay = Math.pow(2, attempt) * 1000;
                // console.log(`🔄 Retrying in ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    if (!isLikelyNetworkError(lastError) && !isAbortError(lastError)) {
        console.error('❌ Failed to fetch CSRF token after multiple attempts:', lastError);
    }
    return null;
    })();
    csrfFetchInFlight.set(csrfFetchKey, run);

    try {
        return await run;
    } finally {
        csrfFetchInFlight.delete(csrfFetchKey);
    }
};

/**
 * Store CSRF token in sessionStorage with expiry tracking
 */
export const setCsrfToken = (token: string, expiryInSeconds: number = 3600): void => {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);

    // Store expiry time
    const expiryTime = Date.now() + (expiryInSeconds * 1000);
    sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, expiryTime.toString());
};

/**
 * Get current CSRF token from sessionStorage
 * Returns null if token is missing or expired
 */
export const getCsrfToken = (): string | null => {
    const token = sessionStorage.getItem(CSRF_TOKEN_KEY);
    const expiryStr = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);

    if (!token || !expiryStr) {
        return null;
    }

    // Check if token is expired
    const expiryTime = parseInt(expiryStr, 10);
    if (Date.now() > expiryTime) {
        console.warn('⚠️ CSRF token expired');
        clearCsrfToken();
        return null;
    }

    return token;
};

/**
 * Clear CSRF token from sessionStorage
 */
export const clearCsrfToken = (): void => {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
    sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);
};

/**
 * Check if CSRF token exists and is valid
 */
export const hasCsrfToken = (): boolean => {
    return getCsrfToken() !== null;
};

/**
 * Get time remaining for CSRF token (in seconds)
 */
export const getCsrfTokenTimeRemaining = (): number => {
    const expiryStr = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
    if (!expiryStr) return 0;

    const expiryTime = parseInt(expiryStr, 10);
    const remaining = Math.max(0, (expiryTime - Date.now()) / 1000);

    return Math.floor(remaining);
};

/**
 * Refresh CSRF token if it's expiring soon (less than 10 minutes remaining)
 */
export const refreshCsrfTokenIfNeeded = async (authToken: string): Promise<string | null> => {
    const timeRemaining = getCsrfTokenTimeRemaining();

    // If less than 10 minutes remaining, refresh
    if (timeRemaining < 600) {
        // console.log('🔄 Refreshing CSRF token...');
        return fetchCsrfToken(authToken);
    }

    return getCsrfToken();
};

const decodeJwtExpMs = (token: string): number => {
    try {
        const parts = String(token || '').split('.');
        if (parts.length < 2) return 0;
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadB64.padEnd(payloadB64.length + (4 - (payloadB64.length % 4 || 4)) % 4, '=');
        const json = JSON.parse(atob(padded));
        const expSeconds = Number(json?.exp || 0);
        if (!expSeconds || !Number.isFinite(expSeconds)) return 0;
        return expSeconds * 1000;
    } catch {
        return 0;
    }
};

const readCachedAuthToken = (): string | null => {
    const now = Date.now();
    if (authTokenCache.token && authTokenCache.expMs > (now + AUTH_TOKEN_EXPIRY_SAFETY_MS)) {
        return authTokenCache.token;
    }

    const stored = localStorage.getItem('auth_token');
    if (stored) {
        const expMs = decodeJwtExpMs(stored);
        if (expMs > (now + AUTH_TOKEN_EXPIRY_SAFETY_MS)) {
            authTokenCache = { token: stored, expMs, checkedAtMs: now };
            return stored;
        }
    }

    return null;
};

/**
 * Get the current auth token from Supabase session
 * This is the source of truth for the user's authentication token
 */
export const getCurrentAuthToken = async (): Promise<string | null> => {
    try {
        if (!supabase) {
            console.warn('⚠️ Supabase not initialized');
            return null;
        }

        const cached = readCachedAuthToken();
        if (cached) return cached;
        if (Date.now() - authTokenCache.checkedAtMs < AUTH_TOKEN_RECHECK_MS) {
            return null;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('⚠️ Failed to get session:', error);
            return null;
        }

        if (!session || !session.access_token) {
            console.warn('⚠️ No active session or access token');
            return null;
        }

        const token = session.access_token;
        const expMs = (session.expires_at ? Number(session.expires_at) * 1000 : decodeJwtExpMs(token));
        authTokenCache = { token, expMs, checkedAtMs: Date.now() };
        try { localStorage.setItem('auth_token', token); } catch { }
        return token;
    } catch (error) {
        console.warn('⚠️ Error retrieving auth token:', error);
        return null;
    }
};

const getFreshAuthToken = async (): Promise<string | null> => {
    try {
        clearCachedAuthToken();
        if (!supabase) {
            return null;
        }

        try {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            const refreshedToken = refreshed?.session?.access_token || null;
            if (!refreshError && refreshedToken) {
                const expMs = (refreshed.session?.expires_at ? Number(refreshed.session.expires_at) * 1000 : decodeJwtExpMs(refreshedToken));
                authTokenCache = { token: refreshedToken, expMs, checkedAtMs: Date.now() };
                try { localStorage.setItem('auth_token', refreshedToken); } catch {}
                return refreshedToken;
            }
        } catch {}

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.access_token) {
            return null;
        }

        const token = session.access_token;
        const expMs = (session.expires_at ? Number(session.expires_at) * 1000 : decodeJwtExpMs(token));
        authTokenCache = { token, expMs, checkedAtMs: Date.now() };
        try { localStorage.setItem('auth_token', token); } catch {}
        return token;
    } catch {
        return null;
    }
};

/**
 * Silent variant for endpoints that allow anonymous access.
 */
export const getCurrentAuthTokenSilently = async (): Promise<string | null> => {
    try {
        if (!supabase) {
            return null;
        }

        const cached = readCachedAuthToken();
        if (cached) return cached;
        if (Date.now() - authTokenCache.checkedAtMs < AUTH_TOKEN_RECHECK_MS) {
            return null;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session || !session.access_token) {
            return null;
        }

        const token = session.access_token;
        const expMs = (session.expires_at ? Number(session.expires_at) * 1000 : decodeJwtExpMs(token));
        authTokenCache = { token, expMs, checkedAtMs: Date.now() };
        try { localStorage.setItem('auth_token', token); } catch { }
        return token;
    } catch {
        return null;
    }
};

/**
 * Wait for a session to be available (with timeout)
 * Useful during page initialization when Supabase might still be loading
 */
export const waitForSession = async (maxWaitMs: number = 5000): Promise<string | null> => {
    const startTime = Date.now();
    const pollInterval = 100; // Check every 100ms

    while (Date.now() - startTime < maxWaitMs) {
        const token = await getCurrentAuthToken();
        if (token) {
            return token;
        }

        // Wait before trying again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    console.warn(`⚠️ Session not available after ${maxWaitMs}ms`);
    return null;
};

/**
 * Helper function for making authenticated requests with CSRF protection
 * Automatically includes CSRF token for POST/PUT/DELETE requests
 */
export const authenticatedFetch = async (
    url: string,
    options: RequestInit = {},
    authToken?: string
): Promise<Response> => {
    const method = (options.method || 'GET').toUpperCase();
    const requestPath = getRequestPath(url) || 'unknown';
    const requestOrigin = getRequestOrigin(url);
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const requiresCsrf = isStateChanging && !endpointDoesNotRequireCsrf(url);
    const eligibleForBackendCooldown = isBackendOptionalCooldownEligibleUrl(url);

    if (eligibleForBackendCooldown && Date.now() < getBackendOptionalCooldownUntil(requestOrigin)) {
        return new Response(JSON.stringify({ detail: 'backend_optional_cooldown_active' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const authOptional = isAuthOptionalRequest(url);
    let resolvedAuthToken = authToken
        || (authOptional ? await getCurrentAuthTokenSilently() : await getCurrentAuthToken())
        || localStorage.getItem('auth_token')
        || null;
    if (!resolvedAuthToken && !authOptional) {
        console.warn('⚠️ No authentication token available for request to:', url);
    }

    const performRequest = async (forceFreshCsrf: boolean): Promise<Response> => {
        const headers = new Headers(options.headers || {});
        const requestTimeoutMs = resolveRequestTimeoutMs(url);
        const callerSignal = options.signal;
        let abortedByCaller = !!callerSignal?.aborted;
        let csrfTokenWasAttached = false;

        if (resolvedAuthToken) {
            headers.set('Authorization', `Bearer ${resolvedAuthToken}`);
        }

        if (requiresCsrf) {
            let csrfToken = forceFreshCsrf ? null : getCsrfToken();
            if (!csrfToken && resolvedAuthToken) {
                const requestOrigin = getRequestOrigin(url);
                csrfToken = await fetchCsrfToken(
                    resolvedAuthToken,
                    requestOrigin || BACKEND_URL
                );
            }

            if (csrfToken) {
                headers.set('X-CSRF-Token', csrfToken);
                csrfTokenWasAttached = true;
            } else {
                if (shouldEmitThrottledLog(lastMissingCsrfLogAt)) {
                    console.warn(`⚠️ No valid CSRF token found for ${method} request`);
                    lastMissingCsrfLogAt = Date.now();
                }
            }
        }

        const controller = new AbortController();
        let cleanupCallerAbortListener: (() => void) | null = null;
        if (callerSignal) {
            const onCallerAbort = () => {
                abortedByCaller = true;
                controller.abort();
            };
            if (callerSignal.aborted) {
                onCallerAbort();
            } else {
                callerSignal.addEventListener('abort', onCallerAbort, { once: true });
                cleanupCallerAbortListener = () => callerSignal.removeEventListener('abort', onCallerAbort);
            }
        }
        const timeoutId = setTimeout(() => {
            if (shouldEmitThrottledLog(lastRequestTimeoutLogAt)) {
                console.warn(`⏱️ Authenticated fetch to ${url} timed out after ${Math.round(requestTimeoutMs / 1000)}s.`);
                lastRequestTimeoutLogAt = Date.now();
            }
            recordRuntimeSignal('request_timeout', {
                path: requestPath,
                method,
                timeout_ms: requestTimeoutMs
            }, {
                dedupeKey: `${method}:${requestPath}`,
                throttleMs: 15_000
            });
            controller.abort();
        }, requestTimeoutMs);

        try {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers,
                    signal: controller.signal
                });
                if (eligibleForBackendCooldown && response.status >= 500) {
                    markBackendOptionalUnavailable(requestOrigin);
                }
                return response;
            } catch (error) {
                if (eligibleForBackendCooldown && (isLikelyNetworkError(error) || (isAbortError(error) && !abortedByCaller))) {
                    markBackendOptionalUnavailable(requestOrigin);
                }
                if (url.includes('/csrf-token') && (isLikelyNetworkError(error) || (isAbortError(error) && !abortedByCaller))) {
                    csrfTokenCooldownUntil = Date.now() + CSRF_TOKEN_COOLDOWN_MS;
                }
                throw error;
            }
        } finally {
            // Backend CSRF tokens are single-use. Clear any attached token after the request
            // so the next state-changing call fetches a fresh token instead of first hitting 403.
            if (csrfTokenWasAttached && requiresCsrf) {
                clearCsrfToken();
            }
            if (cleanupCallerAbortListener) {
                cleanupCallerAbortListener();
            }
            clearTimeout(timeoutId);
        }
    };

    let response = await performRequest(false);

    // CSRF tokens are single-use on backend. If we hit CSRF 403, refresh token and retry once.
    if (requiresCsrf && response.status === 403) {
        const text = await response.clone().text().catch(() => '');
        const looksLikeCsrfError = text.toLowerCase().includes('csrf');
        if (looksLikeCsrfError) {
            console.warn(`⚠️ CSRF rejected for ${method} ${url}. Refreshing token and retrying once.`);
            clearCsrfToken();
            response = await performRequest(true);
        }
    }

    if (response.status === 401 && !authOptional) {
        console.warn(`⚠️ Received 401 Unauthorized from ${url}. Retrying once with a fresh session token.`);
        clearCsrfToken();
        const freshToken = await getFreshAuthToken();
        if (freshToken && freshToken !== resolvedAuthToken) {
            resolvedAuthToken = freshToken;
            response = await performRequest(false);
        }
    }

    if (response.status === 401) {
        console.warn(`⚠️ Received 401 Unauthorized from ${url}. This may indicate an invalid or missing authentication token.`);
    }

    return response;
};
