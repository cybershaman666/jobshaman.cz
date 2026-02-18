// CSRF Token Management Service
import { BACKEND_URL } from '../constants';
import { supabase } from './supabaseClient';
import { recordRuntimeSignal } from './runtimeSignals';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';
const BACKEND_NETWORK_COOLDOWN_MS = 60_000;
const CSRF_TOKEN_COOLDOWN_MS = 60_000;
const REQUEST_LOG_THROTTLE_MS = 15_000;
const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const CSRF_FETCH_TIMEOUT_MS = 15_000;
const HYBRID_FETCH_TIMEOUT_MS = 25_000;
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 20_000;
const INTERACTION_FETCH_TIMEOUT_MS = 8_000;
const AI_FETCH_TIMEOUT_MS = 90_000;

let backendNetworkCooldownUntil = 0;
let csrfTokenCooldownUntil = 0;
let csrfFetchInFlight: Promise<string | null> | null = null;
let lastCsrfNetworkLogAt = 0;
let lastRequestTimeoutLogAt = 0;
let lastMissingCsrfLogAt = 0;

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
    if (path === '/jobs/interactions') return INTERACTION_FETCH_TIMEOUT_MS;
    if (path === '/jobs/hybrid-search' || path === '/jobs/hybrid-search-v2') return HYBRID_FETCH_TIMEOUT_MS;
    if (path === '/subscription-status') return SUBSCRIPTION_FETCH_TIMEOUT_MS;
    if (path.startsWith('/ai/')) return AI_FETCH_TIMEOUT_MS;
    return DEFAULT_FETCH_TIMEOUT_MS;
};

const isBackendUrlRequest = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const backend = new URL(BACKEND_URL, window.location.origin);
        return parsed.origin === backend.origin;
    } catch {
        return false;
    }
};

const shouldBypassBackendCooldown = (path: string): boolean => {
    return (
        path === '/jobs/hybrid-search' ||
        path === '/jobs/hybrid-search-v2' ||
        path === '/jobs/interactions'
    );
};

const isAuthOptionalRequest = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || '';
        return (
            path === '/jobs/hybrid-search' ||
            path === '/jobs/hybrid-search-v2'
        );
    } catch {
        return false;
    }
};

export const isBackendNetworkCooldownActive = (): boolean => Date.now() < backendNetworkCooldownUntil;

const endpointDoesNotRequireCsrf = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || '';
        return (
            path === '/jobs/analyze' ||
            path === '/jobs/hybrid-search' ||
            path === '/jobs/hybrid-search-v2' ||
            path === '/jobs/interactions' ||
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
export const fetchCsrfToken = async (authToken: string): Promise<string | null> => {
    if (csrfFetchInFlight) {
        return csrfFetchInFlight;
    }
    if (Date.now() < csrfTokenCooldownUntil || Date.now() < backendNetworkCooldownUntil) {
        return null;
    }

    csrfFetchInFlight = (async () => {
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
    const csrfTokenUrl = `${BACKEND_URL}/csrf-token`;
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
                controller.abort();
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
                    lastError = new Error(`Server error: ${status}`);
                    if (attempt < maxRetries) {
                        const delay = Math.pow(2, attempt) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
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
                backendNetworkCooldownUntil = Date.now() + BACKEND_NETWORK_COOLDOWN_MS;
                recordRuntimeSignal('csrf_fetch_unavailable', {
                    attempt,
                    aborted: isAborted,
                    error: String((error as any)?.message || '')
                }, {
                    dedupeKey: isAborted ? 'timeout' : 'network',
                    throttleMs: 15_000
                });
                const now = Date.now();
                if (now - lastCsrfNetworkLogAt > REQUEST_LOG_THROTTLE_MS) {
                    console.warn(`⚠️ CSRF fetch unavailable (attempt ${attempt}), backend cooldown enabled.`);
                    lastCsrfNetworkLogAt = now;
                }
            } else {
                console.error(`❌ Error fetching CSRF token (Attempt ${attempt}):`, error);
            }

            if (attempt < maxRetries) {
                if (Date.now() < csrfTokenCooldownUntil || Date.now() < backendNetworkCooldownUntil) {
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

    try {
        return await csrfFetchInFlight;
    } finally {
        csrfFetchInFlight = null;
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

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('⚠️ Failed to get session:', error);
            return null;
        }

        if (!session || !session.access_token) {
            console.warn('⚠️ No active session or access token');
            return null;
        }

        return session.access_token;
    } catch (error) {
        console.warn('⚠️ Error retrieving auth token:', error);
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

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session || !session.access_token) {
            return null;
        }

        return session.access_token;
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
    if (
        isBackendUrlRequest(url) &&
        Date.now() < backendNetworkCooldownUntil &&
        !shouldBypassBackendCooldown(requestPath)
    ) {
        recordRuntimeSignal('request_blocked_by_cooldown', {
            path: requestPath,
            method
        }, {
            dedupeKey: `${method}:${requestPath}`,
            throttleMs: 20_000,
            sendAnalytics: false
        });
        throw new Error('Backend temporarily unreachable (cooldown active)');
    }
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const requiresCsrf = isStateChanging && !endpointDoesNotRequireCsrf(url);

    const authOptional = isAuthOptionalRequest(url);
    const resolvedAuthToken = authToken
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

        if (resolvedAuthToken) {
            headers.set('Authorization', `Bearer ${resolvedAuthToken}`);
        }

        if (requiresCsrf) {
            let csrfToken = forceFreshCsrf ? null : getCsrfToken();
            if (!csrfToken && resolvedAuthToken) {
                csrfToken = await fetchCsrfToken(resolvedAuthToken);
            }

            if (csrfToken) {
                headers.set('X-CSRF-Token', csrfToken);
            } else if (!isBackendUrlRequest(url) || Date.now() >= backendNetworkCooldownUntil) {
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
                return await fetch(url, {
                    ...options,
                    headers,
                    signal: controller.signal
                });
            } catch (error) {
                const shouldTriggerCooldown = (isLikelyNetworkError(error) || (isAbortError(error) && !abortedByCaller)) && isBackendUrlRequest(url);
                if (shouldTriggerCooldown) {
                    const cooldownWasActive = Date.now() < backendNetworkCooldownUntil;
                    backendNetworkCooldownUntil = Date.now() + BACKEND_NETWORK_COOLDOWN_MS;
                    // CSRF endpoint often fails first during backend outages.
                    if (url.includes('/csrf-token')) {
                        csrfTokenCooldownUntil = Date.now() + CSRF_TOKEN_COOLDOWN_MS;
                    }
                    if (!cooldownWasActive) {
                        recordRuntimeSignal('backend_cooldown_entered', {
                            path: requestPath,
                            method,
                            reason: isAbortError(error) && !abortedByCaller ? 'timeout' : 'network'
                        }, {
                            dedupeKey: requestPath,
                            throttleMs: 20_000
                        });
                    }
                }
                throw error;
            }
        } finally {
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

    if (response.status === 401) {
        console.warn(`⚠️ Received 401 Unauthorized from ${url}. This may indicate an invalid or missing authentication token.`);
    }

    return response;
};
