// CSRF Token Management Service
import { BACKEND_URL } from '../constants';
import { supabase } from './supabaseClient';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';
const BACKEND_NETWORK_COOLDOWN_MS = 60_000;
const CSRF_TOKEN_COOLDOWN_MS = 60_000;

let backendNetworkCooldownUntil = 0;
let csrfTokenCooldownUntil = 0;
let csrfFetchInFlight: Promise<string | null> | null = null;

const isLikelyNetworkError = (error: unknown): boolean => {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
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

const endpointDoesNotRequireCsrf = (url: string): boolean => {
    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || '';
        return (
            path === '/jobs/analyze' ||
            path === '/jobs/hybrid-search' ||
            path === '/jobs/hybrid-search-v2' ||
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

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // console.log(`🔄 Fetching fresh CSRF token (attempt ${attempt}/${maxRetries})...`);

            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`⏱️ CSRF fetch attempt ${attempt} timed out after 90s. The server might be waking up.`);
                controller.abort();
            }, 90000); // 90 second timeout for Render cold starts

            const response = await fetch(`${BACKEND_URL}/csrf-token`, {
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
            const isAborted = error instanceof Error && error.name === 'AbortError';

            if (isAborted) {
                console.error(`❌ CSRF token fetch ABORTED (timeout) on attempt ${attempt}`);
            } else {
                console.error(`❌ Error fetching CSRF token (Attempt ${attempt}):`, error);
                if (isLikelyNetworkError(error)) {
                    csrfTokenCooldownUntil = Date.now() + CSRF_TOKEN_COOLDOWN_MS;
                    backendNetworkCooldownUntil = Date.now() + BACKEND_NETWORK_COOLDOWN_MS;
                }
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

    console.error('❌ Failed to fetch CSRF token after multiple attempts:', lastError);
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
    if (isBackendUrlRequest(url) && Date.now() < backendNetworkCooldownUntil) {
        throw new Error('Backend temporarily unreachable (cooldown active)');
    }

    const method = (options.method || 'GET').toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const requiresCsrf = isStateChanging && !endpointDoesNotRequireCsrf(url);

    const resolvedAuthToken = authToken || await getCurrentAuthToken() || localStorage.getItem('auth_token') || null;
    if (!resolvedAuthToken) {
        console.warn('⚠️ No authentication token available for request to:', url);
    }

    const performRequest = async (forceFreshCsrf: boolean): Promise<Response> => {
        const headers = new Headers(options.headers || {});

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
            } else {
                console.warn(`⚠️ No valid CSRF token found for ${method} request`);
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.warn(`⏱️ Authenticated fetch to ${url} timed out after 90s. The server might be waking up.`);
            controller.abort();
        }, 90000);

        try {
            try {
                return await fetch(url, {
                    ...options,
                    headers,
                    signal: controller.signal
                });
            } catch (error) {
                if (isLikelyNetworkError(error) && isBackendUrlRequest(url)) {
                    backendNetworkCooldownUntil = Date.now() + BACKEND_NETWORK_COOLDOWN_MS;
                    // CSRF endpoint often fails first during backend outages.
                    if (url.includes('/csrf-token')) {
                        csrfTokenCooldownUntil = Date.now() + CSRF_TOKEN_COOLDOWN_MS;
                    }
                }
                throw error;
            }
        } finally {
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
