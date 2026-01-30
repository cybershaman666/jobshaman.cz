// Singleton Supabase client to prevent multiple instances and token conflicts
import { createClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseInstance: any = null;

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
        supabaseInstance.auth.onAuthStateChange((event: any, session: any) => {
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