// CSRF Token Management Service
import { BACKEND_URL } from '../constants';
import { supabase } from './supabaseClient';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';

/**
 * Generate and fetch a new CSRF token from the backend
 * Must be called after successful authentication
 */
export const fetchCsrfToken = async (authToken: string): Promise<string | null> => {
    // Validate authToken before attempting to fetch
    if (!authToken || typeof authToken !== 'string' || authToken.length === 0) {
        console.warn('⚠️ Invalid auth token provided to fetchCsrfToken - cannot fetch CSRF token');
        return null;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/csrf-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        
        if (!data.csrf_token) {
            console.warn('No CSRF token in response');
            return null;
        }

        // Store token with expiry time
        setCsrfToken(data.csrf_token, data.expiry || 3600);
        console.log('✅ CSRF token obtained successfully');
        
        return data.csrf_token;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return null;
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
        console.log('🔄 Refreshing CSRF token...');
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
    const headers = new Headers(options.headers || {});

    // Add CSRF token for state-changing requests
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        } else {
            console.warn('⚠️ No valid CSRF token found for ' + method + ' request');
        }
    }

    // Add auth header if provided or available
    if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
    } else {
        // First try to get token from Supabase session (the primary source)
        let token = await getCurrentAuthToken();
        
        // Fallback to legacy localStorage key if Supabase doesn't have it
        if (!token) {
            token = localStorage.getItem('auth_token');
        }
        
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            console.warn('⚠️ No authentication token available for request to:', url);
        }
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Log authentication errors for debugging
    if (response.status === 401) {
        console.warn(`⚠️ Received 401 Unauthorized from ${url}. This may indicate an invalid or missing authentication token.`);
    }

    return response;
};
