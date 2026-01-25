// Updated Supabase service functions for new paywall schema
import { createClient } from '@supabase/supabase-js';
import { UserProfile, CompanyProfile, CandidateSubscriptionTier, CompanyServiceTier, CompanyUsageStats } from '../types';

// Configuration provided by user
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

// Create a single supabase client for interacting with your database
let client = null;
try {
    if (supabaseUrl && supabaseKey) {
        client = createClient(supabaseUrl, supabaseKey);
    } else {
        console.warn("Supabase credentials missing");
    }
} catch (error) {
    console.error("Supabase initialization error:", error);
}

export const supabase = client;

export const isSupabaseConfigured = (): boolean => {
    return !!supabase;
};

// ========================================
// AUTH SERVICES (unchanged)
// ========================================

export const signInWithEmail = async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    const result = await supabase.auth.signInWithPassword({ email, password: pass });

    // Explicitly check for profile existence after login to fix missing profile issues
    if (result.data.user) {
        const profile = await getUserProfile(result.data.user.id);
        if (!profile) {
            await createBaseProfile(result.data.user.id, email, email.split('@')[0]);
        }
    }

    return result;
};

export const signUpWithEmail = async (email: string, pass: string, fullName: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    // 1. Sign Up
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                full_name: fullName,
            }
        }
    });

    if (error) throw error;

    // 2. Create Base Profile
    if (data.user) {
        await createBaseProfile(data.user.id, email, fullName);
    }

    return { data, error };
};

export const signOut = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const createBaseProfile = async (userId: string, email: string, name: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            email,
            name,
            subscription_tier: 'free',
            created_at: new Date().toISOString(),
        });
    
    if (error) throw error;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            id,
            email,
            name,
            address,
            transport_mode,
            preferences,
            subscription_tier,
            has_assessment,
            is_admin_tester,
            created_at,
            updated_at
        `)
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Profile fetch error:', error);
        return null;
    }
    
        // Transform subscription_tier to subscription object for compatibility
    const subscription = data.subscription_tier ? {
        tier: data.subscription_tier as CandidateSubscriptionTier,
        usage: undefined,
        expiresAt: undefined
    } : undefined;

    return {
        ...data,
        subscription,
        isPremium: subscription?.tier === 'premium',
        isLoggedIn: true
    };
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const updateData: any = { ...updates };
    
    // Handle subscription tier updates separately
    if (updates.subscription?.tier) {
        // Update subscription table
        const { error: subError } = await supabase
            .from('subscriptions')
            .update({ 
                tier: updates.subscription.tier,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', userId); // Note: This assumes user = company for simplicity
            
        if (subError) console.error('Subscription update error:', subError);
        
        // Don't include subscription in profile update
        delete updateData.subscription;
    }
    
    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
    
    if (error) throw error;
};

export const getCompanyProfile = async (userId: string): Promise<CompanyProfile | null> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('companies')
        .select(`
            id,
            name,
            email,
            website,
            description,
            address,
            members,
            subscription_id,
            created_at,
            updated_at
        `)
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Company profile fetch error:', error);
        return null;
    }

    // Fetch subscription details
    let subscription: { tier: CompanyServiceTier; expiresAt: string; usage?: CompanyUsageStats } | undefined = undefined;
    
    if (data.subscription_id) {
        const { data: subData, error: subError } = await supabase
            .from('subscriptions')
            .select(`
                tier,
                status,
                current_period_start,
                current_period_end,
                cancel_at_period_end,
                created_at,
                updated_at
            `)
            .eq('id', data.subscription_id)
            .single();
            
        if (subError) {
            console.error('Subscription fetch error:', subError);
        } else if (subData) {
            subscription = {
                tier: subData.tier as CompanyServiceTier,
                expiresAt: subData.current_period_end
            };

            // Fetch current usage
            const { data: usageData, error: usageError } = await supabase
                .from('subscription_usage')
                .select(`
                    active_jobs_count,
                    ai_assessments_used,
                    ad_optimizations_used,
                    last_reset_at
                `)
                .eq('subscription_id', data.subscription_id)
                .single();
                
            if (usageError) {
                console.error('Usage fetch error:', usageError);
            } else if (usageData) {
                subscription.usage = {
                    activeJobsCount: usageData.active_jobs_count || 0,
                    aiAssessmentsUsed: usageData.ai_assessments_used || 0,
                    adOptimizationsUsed: usageData.ad_optimizations_used || 0
                };
            }
            }
        }
    }
    
    return {
        ...data,
        subscription
    };
};

// ========================================
// UPDATED USAGE TRACKING SERVICES
// ========================================

export const incrementAssessmentUsage = async (companyId: string): Promise<void> => {
    if (!supabase) return;
    
    try {
        // Get current subscription and usage
        const { data: company } = await supabase
            .from('companies')
            .select('subscription_id')
            .eq('id', companyId)
            .single();
            
        if (!company?.subscription_id) {
            console.warn('No subscription found for company:', companyId);
            return;
        }

        // Get current usage period
        const { data: currentUsage } = await supabase
            .from('subscription_usage')
            .select('ai_assessments_used, period_start, period_end')
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')')
            .single();
            
        if (!currentUsage) {
            console.warn('No usage record found for company:', companyId);
            return;
        }

        // Increment usage
        const newUsage = (currentUsage.ai_assessments_used || 0) + 1;
        
        // Update usage record
        const { error } = await supabase
            .from('subscription_usage')
            .update({ ai_assessments_used: newUsage })
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')');
            
        if (error) {
            console.error('Failed to increment assessment usage:', error);
        } else {
            console.log(`✅ Assessment usage incremented for company ${companyId}. New total: ${newUsage}`);
        }
    } catch (error) {
        console.error('Assessment usage tracking error:', error);
    }
};

export const incrementAdOptimizationUsage = async (companyId: string): Promise<void> => {
    if (!supabase) return;
    
    try {
        // Get current subscription and usage
        const { data: company } = await supabase
            .from('companies')
            .select('subscription_id')
            .eq('id', companyId)
            .single();
            
        if (!company?.subscription_id) {
            console.warn('No subscription found for company:', companyId);
            return;
        }

        // Get current usage period
        const { data: currentUsage } = await supabase
            .from('subscription_usage')
            .select('ad_optimizations_used, period_start, period_end')
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')')
            .single();
            
        if (!currentUsage) {
            console.warn('No usage record found for company:', companyId);
            return;
        }

        // Increment usage
        const newUsage = (currentUsage.ad_optimizations_used || 0) + 1;
        
        // Update usage record
        const { error } = await supabase
            .from('subscription_usage')
            .update({ ad_optimizations_used: newUsage })
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')');
            
        if (error) {
            console.error('Failed to increment ad optimization usage:', error);
        } else {
            console.log(`✅ Ad optimization usage incremented for company ${companyId}. New total: ${newUsage}`);
        }
    } catch (error) {
        console.error('Ad optimization usage tracking error:', error);
    }
};

export const incrementJobPosting = async (companyId: string): Promise<void> => {
    if (!supabase) return;
    
    try {
        // Get current subscription and usage
        const { data: company } = await supabase
            .from('companies')
            .select('subscription_id')
            .eq('id', companyId)
            .single();
            
        if (!company?.subscription_id) {
            console.warn('No subscription found for company:', companyId);
            return;
        }

        // Get current usage period
        const { data: currentUsage } = await supabase
            .from('subscription_usage')
            .select('active_jobs_count, period_start, period_end')
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')')
            .single();
            
        if (!currentUsage) {
            console.warn('No usage record found for company:', companyId);
            return;
        }

        // Increment usage
        const newUsage = (currentUsage.active_jobs_count || 0) + 1;
        
        // Update usage record
        const { error } = await supabase
            .from('subscription_usage')
            .update({ active_jobs_count: newUsage })
            .eq('subscription_id', company.subscription_id)
            .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')');
            
        if (error) {
            console.error('Failed to increment job posting usage:', error);
        } else {
            console.log(`✅ Job posting usage incremented for company ${companyId}. New total: ${newUsage}`);
        }
    } catch (error) {
        console.error('Job posting usage tracking error:', error);
    }
};

// ========================================
// ANALYTICS SERVICES
// ========================================

export const trackAnalyticsEvent = async (event: {
    event_type: string;
    user_id?: string;
    company_id?: string;
    feature?: string;
    tier?: string;
    metadata?: any;
}): Promise<void> => {
    if (!supabase) return;
    
    try {
        const { error } = await supabase
            .from('analytics_events')
            .insert({
                event_type: event.event_type,
                user_id: event.user_id || null,
                company_id: event.company_id || null,
                feature: event.feature || null,
                tier: event.tier || null,
                metadata: event.metadata || {},
                created_at: new Date().toISOString()
            });
            
        if (error) {
            console.error('Failed to track analytics event:', error);
        }
    } catch (error) {
        console.error('Analytics tracking error:', error);
    }
};

export const trackUpgradeTrigger = async (data: {
    company_id?: string;
    feature: string;
    current_tier: string;
    reason: string;
    metadata?: any;
}) => {
    await trackAnalyticsEvent({
        event_type: 'upgrade_triggered',
        company_id: data.company_id,
        feature: data.feature,
        tier: data.current_tier,
        metadata: {
            reason: data.reason,
            ...data.metadata
        }
    });
};

export const trackFeatureUsage = async (data: {
    company_id?: string;
    feature: string;
    tier: string;
}) => {
    await trackAnalyticsEvent({
        event_type: 'feature_used',
        company_id: data.company_id,
        feature: data.feature,
        tier: data.tier
    });
};

// ========================================
// ENTERPRISE LEAD SERVICES
// ========================================

export const createEnterpriseLead = async (leadData: {
    company_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone?: string;
    company_size?: string;
    industry?: string;
    current_challenges?: string;
    expected_hires?: string;
    timeline?: string;
}): Promise<void> => {
    if (!supabase) return;
    
    try {
        const { error } = await supabase
            .from('enterprise_leads')
            .insert({
                ...leadData,
                status: 'new',
                created_at: new Date().toISOString()
            });
            
        if (error) {
            console.error('Failed to create enterprise lead:', error);
            throw error;
        }
    } catch (error) {
        console.error('Enterprise lead creation error:', error);
        throw error;
    }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

export const getCompanySubscription = async (companyId: string) => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            tier,
            status,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            stripe_subscription_id,
            created_at
        `)
        .eq('company_id', companyId)
        .single();
    
    if (error) {
        console.error('Subscription fetch error:', error);
        return null;
    }
    
    return data as any;
};

export const updateSubscriptionStatus = async (companyId: string, status: string) => {
    if (!supabase) return;
    
    const { data: company } = await supabase
        .from('companies')
        .select('subscription_id')
        .eq('id', companyId)
        .single();
        
    if (!company?.subscription_id) return;
    
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', company.subscription_id);
        
    if (error) {
        console.error('Subscription status update error:', error);
        throw error;
    }
};

export const getUsageSummary = async (companyId: string) => {
    if (!supabase) return null;
    
    const { data: company } = await supabase
        .from('companies')
        .select('subscription_id')
        .eq('id', companyId)
        .single();
        
    if (!company?.subscription_id) return null;
    
    const { data: usage } = await supabase
        .from('subscription_usage')
        .select(`
            active_jobs_count,
            ai_assessments_used,
            ad_optimizations_used,
            period_start,
            period_end,
            last_reset_at
        `)
        .eq('subscription_id', company.subscription_id)
        .eq('period_end', '(SELECT MAX(period_end) FROM subscription_usage WHERE subscription_id = ' + company.subscription_id + ')')
        .single();
    
    return usage as any;
};

// Legacy compatibility functions - keeping original working versions
// New functions above replace the ones that were causing type conflicts