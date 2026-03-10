import { supabase } from './supabaseService';
import { JobSearchFilters } from '../types';

export interface SavedFilterSet {
    id: string;
    name: string;
    filters: JobSearchFilters;
    isFavorite: boolean;
    usageCount: number;
    createdAt: string;
    lastUsedAt: string;
}

const getCurrentAuthUserId = async (): Promise<string | null> => {
    if (!supabase) return null;
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Failed to resolve current session for saved filters:', error);
            return null;
        }
        return session?.user?.id || null;
    } catch (error) {
        console.error('Error resolving current auth user for saved filters:', error);
        return null;
    }
};

/**
 * Save a new filter set for the current user
 */
export const saveFilterSet = async (
    name: string,
    filters: SavedFilterSet['filters']
): Promise<SavedFilterSet | null> => {
    if (!supabase) {
        console.error('Supabase not configured');
        return null;
    }

    try {
        const userId = await getCurrentAuthUserId();
        if (!userId) {
            console.error('Cannot save filter set without authenticated user');
            return null;
        }

        const { data, error } = await supabase
            .from('saved_filter_sets')
            .insert({
                user_id: userId,
                name,
                filters: filters as any
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to save filter set:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            filters: data.filters,
            isFavorite: data.is_favorite,
            usageCount: data.usage_count,
            createdAt: data.created_at,
            lastUsedAt: data.last_used_at
        };
    } catch (error) {
        console.error('Error saving filter set:', error);
        return null;
    }
};

/**
 * Get all saved filter sets for the current user
 */
export const getSavedFilterSets = async (): Promise<SavedFilterSet[]> => {
    if (!supabase) {
        console.error('Supabase not configured');
        return [];
    }

    try {
        const userId = await getCurrentAuthUserId();
        if (!userId) {
            return [];
        }

        const { data, error } = await supabase
            .from('saved_filter_sets')
            .select('*')
            .eq('user_id', userId)
            .order('last_used_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch saved filters:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            filters: item.filters,
            isFavorite: item.is_favorite,
            usageCount: item.usage_count,
            createdAt: item.created_at,
            lastUsedAt: item.last_used_at
        }));
    } catch (error) {
        console.error('Error fetching saved filters:', error);
        return [];
    }
};

/**
 * Delete a saved filter set
 */
export const deleteFilterSet = async (id: string): Promise<boolean> => {
    if (!supabase) {
        console.error('Supabase not configured');
        return false;
    }

    try {
        const userId = await getCurrentAuthUserId();
        if (!userId) {
            return false;
        }

        const { error } = await supabase
            .from('saved_filter_sets')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('Failed to delete filter set:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error deleting filter set:', error);
        return false;
    }
};

/**
 * Update usage count and last used timestamp for a filter set
 */
export const updateFilterSetUsage = async (id: string): Promise<void> => {
    if (!supabase) return;

    try {
        const { error } = await supabase.rpc('increment_filter_usage', {
            filter_id: id
        });

        if (error) {
            const missingRpc =
                String((error as any)?.code || '').toUpperCase() === 'PGRST202' ||
                String((error as any)?.message || '').toLowerCase().includes('increment_filter_usage');
            if (!missingRpc) {
                console.warn('Failed to update filter usage:', error);
                return;
            }

            const userId = await getCurrentAuthUserId();
            if (!userId) return;

            const { data: current, error: loadError } = await supabase
                .from('saved_filter_sets')
                .select('usage_count')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (loadError) {
                console.warn('Failed to load filter usage fallback:', loadError);
                return;
            }

            const nextUsageCount = Number((current as any)?.usage_count || 0) + 1;
            const { error: updateError } = await supabase
                .from('saved_filter_sets')
                .update({
                    usage_count: nextUsageCount,
                    last_used_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', userId);

            if (updateError) {
                console.warn('Failed to update filter usage fallback:', updateError);
            }
        }
    } catch (error) {
        console.warn('Error updating filter usage:', error);
    }
};

/**
 * Toggle favorite status of a filter set
 */
export const toggleFavorite = async (id: string, isFavorite: boolean): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const userId = await getCurrentAuthUserId();
        if (!userId) {
            return false;
        }

        const { error } = await supabase
            .from('saved_filter_sets')
            .update({ is_favorite: isFavorite })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('Failed to toggle favorite:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error toggling favorite:', error);
        return false;
    }
};
