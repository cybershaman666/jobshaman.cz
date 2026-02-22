// Singleton Supabase client to prevent multiple instances and token conflicts
import { createClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseInstance: any = null;
const PASSWORD_RECOVERY_PENDING_KEY = 'jobshaman_password_recovery_pending';

// Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

export const getSupabaseClient = () => {
    if (supabaseInstance) {
        return supabaseInstance;
    }

    if (!supabaseUrl || !supabaseKey) {
        console.warn("Supabase credentials missing");
        return null;
    }

    try {
        if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
            try {
                window.sessionStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, '1');
            } catch (error) {
                console.warn('Failed to persist password recovery flag from URL hash:', error);
            }
        }

        supabaseInstance = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: typeof window !== 'undefined' ? window.localStorage : undefined,
                storageKey: 'sb-auth-token'
            }
        });

        // Set up auth state change listener to handle token refresh
        supabaseInstance.auth.onAuthStateChange((event: any, _session: any) => {
            if (event === 'PASSWORD_RECOVERY') {
                try {
                    window.sessionStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, '1');
                } catch (error) {
                    console.warn('Failed to persist password recovery flag from auth event:', error);
                }
            }
            if (event === 'TOKEN_REFRESHED') {
                console.log('Token refreshed successfully');
            }
        });

        return supabaseInstance;
    } catch (error) {
        console.error("Supabase initialization error:", error);
        return null;
    }
};

// Export the singleton instance for backward compatibility
export const supabase = getSupabaseClient();

export const isSupabaseConfigured = (): boolean => {
    return !!supabase;
};

// Helper function to safely get current session
export const getCurrentSession = async () => {
    if (!supabase) return null;

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting session:', error);
            return null;
        }
        return session;
    } catch (error) {
        console.error('Session fetch error:', error);
        return null;
    }
};

// Helper function to safely refresh session
export const refreshSession = async () => {
    if (!supabase) return null;

    try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) {
            console.error('Error refreshing session:', error);
            return null;
        }
        console.log('Session refreshed successfully');
        return session;
    } catch (error) {
        console.error('Session refresh error:', error);
        return null;
    }
};

const SUPABASE_STORAGE_PREFIXES = [
    'sb-auth-token',
    'supabase.auth.token',
    'sb-'
];

export const clearSupabaseAuthStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (!key) continue;
            if (SUPABASE_STORAGE_PREFIXES.some(prefix => key === prefix || key.startsWith(prefix))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
        console.warn('Failed to clear Supabase auth storage:', error);
    }
};

export const isPasswordRecoveryPending = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(PASSWORD_RECOVERY_PENDING_KEY) === '1';
    } catch {
        return false;
    }
};

export const clearPasswordRecoveryPending = (): void => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY);
    } catch (error) {
        console.warn('Failed to clear password recovery flag:', error);
    }
};
