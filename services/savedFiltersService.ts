import { supabase } from './supabaseService';

export interface SavedFilterSet {
    id: string;
    name: string;
    filters: {
        filterCity?: string;
        filterContractTypes?: string[];
        filterBenefits?: string[];
        filterMinSalary?: number;
        filterDatePosted?: string;
        filterExperienceLevels?: string[];
        filterMaxDistance?: number;
        enableCommuteFilter?: boolean;
    };
    isFavorite: boolean;
    usageCount: number;
    createdAt: string;
    lastUsedAt: string;
}

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
        const { data, error } = await supabase
            .from('saved_filter_sets')
            .insert({
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
        const { data, error } = await supabase
            .from('saved_filter_sets')
            .select('*')
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
        const { error } = await supabase
            .from('saved_filter_sets')
            .delete()
            .eq('id', id);

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
            console.warn('Failed to update filter usage:', error);
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
        const { error } = await supabase
            .from('saved_filter_sets')
            .update({ is_favorite: isFavorite })
            .eq('id', id);

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
