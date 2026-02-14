import { supabase } from './supabaseService';

interface AnalyticsEvent {
    event: string;
    userId?: string;
    companyId?: string;
    feature?: string;
    tier?: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

// ===== FILTER ANALYTICS TYPES =====
export interface FilterAnalytics {
    filterCity?: string;
    filterContractTypes?: string[];
    filterBenefits?: string[];
    filterMinSalary?: number;
    filterDatePosted?: string;
    filterExperienceLevels?: string[];
    radiusKm?: number;
    hasDistanceFilter?: boolean;
    resultCount?: number;
}

export interface PopularFilterCombination {
    combinationKey: string;
    usageCount: number;
    avgResults: number;
    filters: {
        filterCity?: string;
        filterContractTypes?: string[];
        filterBenefits?: string[];
        filterMinSalary?: number;
    };
}

class AnalyticsService {
    private static events: AnalyticsEvent[] = [];

    /**
     * Track upgrade trigger event
     */
    static trackUpgradeTrigger(data: {
        userId?: string;
        companyId?: string;
        feature: string;
        currentTier: string;
        reason: string;
        metadata?: Record<string, any>;
    }) {
        const event: AnalyticsEvent = {
            event: 'upgrade_triggered',
            userId: data.userId,
            companyId: data.companyId,
            feature: data.feature,
            tier: data.currentTier,
            timestamp: Date.now(),
            metadata: {
                reason: data.reason,
                ...data.metadata
            }
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Track successful upgrade
     */
    static trackUpgradeSuccess(data: {
        userId?: string;
        companyId?: string;
        newTier: string;
        paymentType: 'subscription' | 'one_time';
        amount?: number;
    }) {
        const event: AnalyticsEvent = {
            event: 'upgrade_success',
            userId: data.userId,
            companyId: data.companyId,
            tier: data.newTier,
            timestamp: Date.now(),
            metadata: {
                paymentType: data.paymentType,
                amount: data.amount
            }
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Track feature usage
     */
    static trackFeatureUsage(data: {
        userId?: string;
        companyId?: string;
        feature: string;
        tier: string;
    }) {
        const event: AnalyticsEvent = {
            event: 'feature_used',
            userId: data.userId,
            companyId: data.companyId,
            feature: data.feature,
            tier: data.tier,
            timestamp: Date.now()
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Log event to console (in production, send to analytics backend)
     */
    private static logEvent(event: AnalyticsEvent) {
        console.log('📊 Analytics Event:', {
            event: event.event,
            userId: event.userId,
            companyId: event.companyId,
            feature: event.feature,
            tier: event.tier,
            timestamp: new Date(event.timestamp).toISOString(),
            metadata: event.metadata
        });

        // In production, send to analytics endpoint:
        // fetch('/api/analytics', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(event)
        // });
    }

    /**
     * Get all events (for debugging/reporting)
     */
    static getEvents(): AnalyticsEvent[] {
        return [...this.events];
    }

    /**
     * Get upgrade trigger analytics
     */
    static getUpgradeAnalytics(): {
        totalTriggers: number;
        featureBreakdown: Record<string, number>;
        tierBreakdown: Record<string, number>;
        recentTriggers: AnalyticsEvent[];
    } {
        const upgradeTriggers = this.events.filter(e => e.event === 'upgrade_triggered');

        const featureBreakdown: Record<string, number> = {};
        const tierBreakdown: Record<string, number> = {};

        upgradeTriggers.forEach(trigger => {
            if (trigger.feature) {
                featureBreakdown[trigger.feature] = (featureBreakdown[trigger.feature] || 0) + 1;
            }
            if (trigger.tier) {
                tierBreakdown[trigger.tier] = (tierBreakdown[trigger.tier] || 0) + 1;
            }
        });

        return {
            totalTriggers: upgradeTriggers.length,
            featureBreakdown,
            tierBreakdown,
            recentTriggers: upgradeTriggers.slice(-10).reverse()
        };
    }

    // ===== FILTER ANALYTICS METHODS =====

    /**
     * Track filter usage analytics (non-blocking, fire-and-forget)
     * This helps us understand which filters are most popular
     */
    static async trackFilterUsage(analytics: FilterAnalytics): Promise<void> {
        if (!supabase) {
            console.warn('Supabase not configured, skipping filter analytics');
            return;
        }

        try {
            // Get current user (if logged in)
            const { data: { user } } = await supabase.auth.getUser();

            // Insert analytics record (non-blocking)
            const { error } = await supabase.from('filter_analytics').insert({
                user_id: user?.id || null,
                filter_city: analytics.filterCity || null,
                filter_contract_types: analytics.filterContractTypes || null,
                filter_benefits: analytics.filterBenefits || null,
                filter_min_salary: analytics.filterMinSalary || null,
                filter_date_posted: analytics.filterDatePosted || null,
                filter_experience_levels: analytics.filterExperienceLevels || null,
                radius_km: analytics.radiusKm || null,
                has_distance_filter: analytics.hasDistanceFilter || false,
                result_count: analytics.resultCount || 0
            });

            if (error) {
                console.warn('Failed to track filter analytics:', error);
            }
        } catch (error) {
            // Silent failure - don't disrupt user experience
            console.warn('Error tracking filter analytics:', error);
        }
    }

    /**
     * Get popular filter combinations from the last 30 days
     */
    static async getPopularFilterCombinations(limit: number = 5): Promise<PopularFilterCombination[]> {
        if (!supabase) {
            console.warn('Supabase not configured');
            return [];
        }

        try {
            const { data, error } = await supabase.rpc('get_popular_filter_combinations', {
                limit_count: limit
            });

            if (error) {
                console.error('Failed to fetch popular filters:', error);
                return [];
            }

            return (data || []).map((item: any) => ({
                combinationKey: item.combination_key,
                usageCount: item.usage_count,
                avgResults: item.avg_results,
                filters: item.filters
            }));
        } catch (error) {
            console.error('Error fetching popular filters:', error);
            return [];
        }
    }

    /**
     * Get user-specific popular filter combinations from the last 30 days
     * Falls back to empty if user is not authenticated
     */
    static async getUserPopularFilterCombinations(limit: number = 5): Promise<PopularFilterCombination[]> {
        if (!supabase) {
            console.warn('Supabase not configured');
            return [];
        }

        try {
            const { data, error } = await supabase.rpc('get_user_popular_filter_combinations', {
                limit_count: limit
            });

            if (error) {
                console.error('Failed to fetch user popular filters:', error);
                return [];
            }

            return (data || []).map((item: any) => ({
                combinationKey: item.combination_key,
                usageCount: item.usage_count,
                avgResults: item.avg_results,
                filters: item.filters
            }));
        } catch (error) {
            console.error('Error fetching user popular filters:', error);
            return [];
        }
    }

    /**
     * Format filter combination as human-readable text
     */
    static formatFilterCombination(filters: PopularFilterCombination['filters']): string {
        const parts: string[] = [];

        if (filters.filterCity) {
            parts.push(filters.filterCity);
        }

        if (filters.filterContractTypes && filters.filterContractTypes.length > 0) {
            parts.push(filters.filterContractTypes.join(' + '));
        }

        if (filters.filterBenefits && filters.filterBenefits.length > 0) {
            parts.push(filters.filterBenefits.join(' + '));
        }

        if (filters.filterMinSalary) {
            parts.push(`${filters.filterMinSalary}+ Kč`);
        }

        return parts.join(' • ') || 'Popular search';
    }
}

export default AnalyticsService;
