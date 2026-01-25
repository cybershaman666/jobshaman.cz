// Updated Supabase service functions for new paywall schema
import { supabase } from './supabaseClient';
export { supabase };
import { UserProfile, CompanyProfile, LearningResource, BenefitValuation, AssessmentResult, Job, CVDocument } from '../types';

export const resetUserRoleToCandidate = async (userId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'candidate' })
        .eq('id', userId);
    
    if (error) throw error;
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
    
    try {
        // Try to get current user first
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Error getting current user:', error);
            
            // If it's a refresh token error, try to refresh the session
            if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
                console.log('Attempting to refresh session...');
                const { refreshSession } = await import('./supabaseClient');
                
                const refreshedSession = await refreshSession();
                if (refreshedSession) {
                    // Retry getting the user after refresh
                    const { data: { user: refreshedUser }, error: retryError } = await supabase.auth.getUser();
                    if (!retryError && refreshedUser) {
                        return refreshedUser;
                    }
                }
            }
            
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Current user fetch error:', error);
        return null;
    }
};

export const createBaseProfile = async (userId: string, email: string, name: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            email,
            full_name: name,
            role: 'candidate',
            subscription_tier: 'free',
            created_at: new Date().toISOString(),
        });
    
    if (error) throw error;

    // Also create candidate_profiles entry
    const { error: candidateError } = await supabase
        .from('candidate_profiles')
        .insert({
            id: userId,
            created_at: new Date().toISOString(),
        });
    
    if (candidateError) {
        console.error('Failed to create candidate profile:', candidateError);
        // Don't throw here as profiles was created successfully
    }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    
    // Fetch from profiles table
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
            id,
            email,
            full_name,
            avatar_url,
            role,
            created_at,
            updated_at,
            subscription_tier,
            usage_stats,
            has_assessment
        `)
        .eq('id', userId)
        .single();
    
    if (profileError) {
        console.error('Profile fetch error:', profileError);
        return null;
    }
    
    // Fetch from candidate_profiles table
    const { data: candidateData, error: _candidateError } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    // If candidate profile doesn't exist, that's ok, we'll use defaults
    
    // Map to UserProfile structure
    return {
        id: profileData.id,
        email: profileData.email,
        name: profileData.full_name || '',
        jobTitle: candidateData?.job_title || '',
        phone: candidateData?.phone || '',
        photo: profileData.avatar_url,
        isLoggedIn: true,
        address: candidateData?.address || '',
        coordinates: candidateData?.lat && candidateData?.lng ? { lat: candidateData.lat, lon: candidateData.lng } : undefined,
        transportMode: (candidateData?.transport_mode as any) || 'public',
        cvText: candidateData?.cv_text || '',
        cvUrl: candidateData?.cv_url || '',
        skills: candidateData?.skills || [],
        workHistory: candidateData?.work_history || [],
        education: candidateData?.education || [],
        preferences: candidateData?.preferences || {
            workLifeBalance: 50,
            financialGoals: 50,
            commuteTolerance: 45,
            priorities: []
        },
        cvAnalysis: undefined,
        currentCVId: undefined,
        cvs: [],
        subscription: {
            tier: profileData.subscription_tier || 'free',
            expiresAt: undefined,
            usage: {
                cvOptimizationsUsed: (profileData.usage_stats as any)?.cvOptimizationsUsed || 0,
                coverLettersGenerated: (profileData.usage_stats as any)?.coverLettersGenerated || 0,
                atcHacksUsed: (profileData.usage_stats as any)?.atcHacksUsed || 0
            }
        },
        hasAssessment: profileData.has_assessment || false,
        role: profileData.role
    };
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    // Update profiles table
    const profileUpdates: any = {};
    if (updates.email !== undefined) profileUpdates.email = updates.email;
    if (updates.name !== undefined) profileUpdates.full_name = updates.name;
    if (updates.photo !== undefined) profileUpdates.avatar_url = updates.photo;
    if (updates.role !== undefined) profileUpdates.role = updates.role;
    if (updates.subscription?.tier !== undefined) profileUpdates.subscription_tier = updates.subscription.tier;
    if (updates.hasAssessment !== undefined) profileUpdates.has_assessment = updates.hasAssessment;
    
    if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userId);
        if (profileError) throw profileError;
    }
    
    // Update candidate_profiles table
    const candidateUpdates: any = {};
    if (updates.jobTitle !== undefined) candidateUpdates.job_title = updates.jobTitle;
    if (updates.phone !== undefined) candidateUpdates.phone = updates.phone;
    if (updates.address !== undefined) candidateUpdates.address = updates.address;
    if (updates.coordinates !== undefined) {
        candidateUpdates.lat = updates.coordinates.lat;
        candidateUpdates.lng = updates.coordinates.lon;
    }
    if (updates.transportMode !== undefined) candidateUpdates.transport_mode = updates.transportMode;
    if (updates.cvText !== undefined) candidateUpdates.cv_text = updates.cvText;
    if (updates.cvUrl !== undefined) candidateUpdates.cv_url = updates.cvUrl;
    if (updates.skills !== undefined) candidateUpdates.skills = updates.skills;
    if (updates.workHistory !== undefined) candidateUpdates.work_history = updates.workHistory;
    if (updates.education !== undefined) candidateUpdates.education = updates.education;
    if (updates.preferences !== undefined) candidateUpdates.preferences = updates.preferences;
    
    if (Object.keys(candidateUpdates).length > 0) {
        // First check if candidate profile exists
        const { data: existing } = await supabase
            .from('candidate_profiles')
            .select('id')
            .eq('id', userId)
            .single();
        
        if (existing) {
            // Update existing
            const { error: candidateError } = await supabase
                .from('candidate_profiles')
                .update(candidateUpdates)
                .eq('id', userId);
            if (candidateError) throw candidateError;
        } else {
            // Insert new
            const { error: candidateError } = await supabase
                .from('candidate_profiles')
                .insert({ id: userId, ...candidateUpdates });
            if (candidateError) throw candidateError;
        }
    }
};

export const getCompanyProfile = async (userId: string): Promise<CompanyProfile | null> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('companies')
        .select(`
            id,
            name,
            ico,
            dic,
            address,
            description,
            industry,
            website,
            logo_url,
            tone,
            values,
            philosophy,
            created_at,
            owner_id,
            turnover_rate,
            ghosting_rate,
            lat,
            lng,
            created_by,
            subscription_tier,
            usage_stats
        `)
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Company profile fetch error:', error);
        return null;
    }

    // Map to CompanyProfile with subscription object
    return {
        ...data,
        subscription: {
            tier: data.subscription_tier || 'basic',
            expiresAt: undefined, // Not stored in companies table
            usage: data.usage_stats ? {
                activeJobsCount: data.usage_stats.activeJobsCount || 0,
                aiAssessmentsUsed: data.usage_stats.aiAssessmentsUsed || 0,
                adOptimizationsUsed: data.usage_stats.adOptimizationsUsed || 0
            } : undefined
        }
    } as CompanyProfile;
};

export const getRecruiterCompany = async (userId: string): Promise<any> => {
    if (!supabase) return null;
    
    console.log('🔍 Looking for company for userId:', userId);
    
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();
    
    console.log('📊 Company query result:', { data: data?.id || 'none', error: error || 'none' });
    
    if (error) {
        console.error('Recruiter company fetch error:', error);
        return null;
    }
    
    if (!data) {
        console.log('No company found for userId:', userId);
        return null;
    }

    // Get subscription details using new structure
    const subscriptionData = await getCompanySubscription(data.id);
    const usageData = await getUsageSummary(data.id);

    // Build the expected nested structure that components expect
    const subscription = subscriptionData ? {
        tier: subscriptionData.tier,
        expiresAt: subscriptionData.current_period_end,
        status: subscriptionData.status,
        usage: usageData ? {
            activeJobsCount: usageData.active_jobs_count || 0,
            aiAssessmentsUsed: usageData.ai_assessments_used || 0,
            adOptimizationsUsed: usageData.ad_optimizations_used || 0
        } : {
            activeJobsCount: 0,
            aiAssessmentsUsed: 0,
            adOptimizationsUsed: 0
        }
    } : null;

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
            .select('id, ai_assessments_used')
            .eq('subscription_id', company.subscription_id)
            .order('period_end', { ascending: false })
            .limit(1)
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
            .eq('id', currentUsage.id);
            
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
            .select('id, ad_optimizations_used')
            .eq('subscription_id', company.subscription_id)
            .order('period_end', { ascending: false })
            .limit(1)
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
            .eq('id', currentUsage.id);
            
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
            .select('id, active_jobs_count')
            .eq('subscription_id', company.subscription_id)
            .order('period_end', { ascending: false })
            .limit(1)
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
            .eq('id', currentUsage.id);
            
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
        .order('period_end', { ascending: false })
        .limit(1)
        .single();
    
    return usage as any;
};

// Legacy functions - keeping them for compatibility
export const createCandidateProfile = async (userId: string, profileData: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('candidate_profiles')
        .insert({
            id: userId,
            ...profileData,
            created_at: new Date().toISOString(),
        });
    
    if (error) throw error;
};

export const updateCandidateProfile = async (userId: string, updates: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('candidate_profiles')
        .update(updates)
        .eq('id', userId);
    
    if (error) throw error;
};

export const getCandidateProfile = async (userId: string): Promise<any> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Candidate profile fetch error:', error);
        return null;
    }
    
    return data;
};

export const createCompany = async (companyData: any, userId?: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('companies')
        .insert({
            ...companyData,
            owner_id: userId,
            created_by: userId,
            created_at: new Date().toISOString(),
        })
        .select('*')
        .single();
    
    if (error) throw error;
    
    return data;
};

export const updateCompany = async (companyId: string, updates: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId);
    
    if (error) throw error;
};

export const getJobs = async (filters?: any): Promise<Job[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('jobs').select('*');
    
    if (filters) {
        if (filters.location) {
            query = query.ilike('location', `%${filters.location}%`);
        }
        if (filters.contract_type) {
            query = query.eq('contract_type', filters.contract_type);
        }
        if (filters.work_type) {
            query = query.eq('work_type', filters.work_type);
        }
        if (filters.salary_from) {
            query = query.gte('salary_from', filters.salary_from);
        }
        if (filters.salary_to) {
            query = query.lte('salary_to', filters.salary_to);
        }
    }
    
    const { data, error } = await query.order('scraped_at', { ascending: false });
    
    if (error) {
        console.error('Jobs fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const getJob = async (jobId: number): Promise<Job | null> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();
    
    if (error) {
        console.error('Job fetch error:', error);
        return null;
    }
    
    return data;
};

export const createJob = async (jobData: any): Promise<number> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('jobs')
        .insert({
            ...jobData,
            scraped_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const updateJob = async (jobId: number, updates: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', jobId);
    
    if (error) throw error;
};

export const deleteJob = async (jobId: number): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
    
    if (error) throw error;
};

export const getLearningResources = async (skillName?: string): Promise<LearningResource[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('learning_resources').select('*');
    
    if (skillName) {
        query = query.contains('skill_name', [skillName]);
    }
    
    const { data, error } = await query.order('relevance_score', { ascending: false });
    
    if (error) {
        console.error('Learning resources fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createLearningResource = async (resourceData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('learning_resources')
        .insert({
            ...resourceData,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getBenefitValuations = async (): Promise<BenefitValuation[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('benefit_valuations')
        .select('*')
        .order('monthly_value_czk', { ascending: false });
    
    if (error) {
        console.error('Benefit valuations fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createBenefitValuation = async (valuationData: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('benefit_valuations')
        .insert(valuationData);
    
    if (error) throw error;
};

export const getAssessmentResults = async (candidateId?: string, jobId?: number): Promise<AssessmentResult[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('assessment_results').select('*');
    
    if (candidateId) {
        query = query.eq('candidate_id', candidateId);
    }
    
    if (jobId) {
        query = query.eq('job_id', jobId);
    }
    
    const { data, error } = await query.order('completed_at', { ascending: false });
    
    if (error) {
        console.error('Assessment results fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createAssessmentResult = async (resultData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('assessment_results')
        .insert({
            ...resultData,
            completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getCVDocuments = async (userId?: string): Promise<CVDocument[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('cv_documents').select('*');
    
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('uploaded_at', { ascending: false });
    
    if (error) {
        console.error('CV documents fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createCVDocument = async (documentData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('cv_documents')
        .insert({
            ...documentData,
            uploaded_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getJobCandidateMatches = async (jobId?: number, candidateId?: string): Promise<any[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('job_candidate_matches').select('*');
    
    if (jobId) {
        query = query.eq('job_id', jobId);
    }
    
    if (candidateId) {
        query = query.eq('candidate_id', candidateId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('Job candidate matches fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createJobCandidateMatch = async (matchData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('job_candidate_matches')
        .insert({
            ...matchData,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getCareerTracks = async (candidateId?: string): Promise<any[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('career_tracks').select('*');
    
    if (candidateId) {
        query = query.eq('candidate_id', candidateId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('Career tracks fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createCareerTrack = async (trackData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('career_tracks')
        .insert({
            ...trackData,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const updateCareerTrack = async (trackId: string, updates: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('career_tracks')
        .update(updates)
        .eq('id', trackId);
    
    if (error) throw error;
};

export const getMarketplacePartners = async (): Promise<any[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('marketplace_partners')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Marketplace partners fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createMarketplacePartner = async (partnerData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('marketplace_partners')
        .insert({
            ...partnerData,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getResourceReviews = async (resourceId?: string): Promise<any[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('resource_reviews').select('*');
    
    if (resourceId) {
        query = query.eq('resource_id', resourceId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('Resource reviews fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createResourceReview = async (reviewData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('resource_reviews')
        .insert({
            ...reviewData,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getCompanyMembers = async (companyId?: string): Promise<any[]> => {
    if (!supabase) return [];
    
    let query = supabase.from('company_members').select('*');
    
    if (companyId) {
        query = query.eq('company_id', companyId);
    }
    
    const { data, error } = await query.order('joined_at', { ascending: false });
    
    if (error) {
        console.error('Company members fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const createCompanyMember = async (memberData: any): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase
        .from('company_members')
        .insert({
            ...memberData,
            invited_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    
    if (error) throw error;
    
    return data.id;
};

export const getRecruiterProfile = async (userId: string): Promise<any> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('recruiter_profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Recruiter profile fetch error:', error);
        return null;
    }
    
    return data;
};

export const createRecruiterProfile = async (profileData: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { error } = await supabase
        .from('recruiter_profiles')
        .insert(profileData);
    
    if (error) throw error;
};

// Missing functions from imports
export const inviteRecruiter = async (companyId: string, email: string, invitedBy: string): Promise<boolean> => {
    if (!supabase) return false;
    
    try {
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();
        
        const userId = existingUser?.id;
        
        const { error } = await supabase
            .from('company_members')
            .insert({
                company_id: companyId,
                user_id: userId || null,
                role: 'recruiter',
                invited_by: invitedBy,
                invited_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('Failed to invite recruiter:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Invite recruiter error:', error);
        return false;
    }
};

export const uploadCVFile = async (_userId: string, file: File): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const fileName = `uploads/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from('cvs')
        .upload(fileName, file);
    
    if (error) throw error;
    
    return data.path;
};

export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    
    const fileName = `${userId}/${Date.now()}-${file.name}`;
    const { data: _uploadData, error } = await supabase.storage
        .from('profile_photos')
        .upload(fileName, file);
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('profile_photos')
        .getPublicUrl(fileName);
    
    return publicUrl;
};

export const checkCompanyAssessment = async (companyId: string): Promise<boolean> => {
    if (!supabase) return false;
    
    const { data, error } = await supabase
        .from('assessment_results')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);
    
    if (error) {
        console.error('Check company assessment error:', error);
        return false;
    }
    
    return (data && data.length > 0);
};

export const fetchLearningResources = async (skillName?: string) => {
    if (!supabase) return [];
    
    let query = supabase.from('learning_resources').select('*');
    
    if (skillName) {
        query = query.contains('skill_name', [skillName]);
    }
    
    const { data, error } = await query.order('relevance_score', { ascending: false });
    
    if (error) {
        console.error('Learning resources fetch error:', error);
        return [];
    }
    
    return data || [];
};

export const fetchBenefitValuations = async () => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('benefit_valuations')
        .select('*')
        .order('monthly_value_czk', { ascending: false });
    
    return data || [];
};

// ========================================
// CV DOCUMENT MANAGEMENT
// ========================================

export const getUserCVDocuments = async (userId: string): Promise<CVDocument[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('cv_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching CV documents:', error);
        return [];
    }
    
    return (data || []).map((doc: any) => ({
        id: doc.id,
        userId: doc.user_id,
        fileName: doc.file_name,
        originalName: doc.original_name,
        fileUrl: doc.file_url,
        fileSize: doc.file_size,
        contentType: doc.content_type,
        isActive: doc.is_active || false,
        parsedData: doc.parsed_data,
        uploadedAt: doc.uploaded_at,
        lastUsed: doc.last_used
    }));
};

export const uploadCVDocument = async (userId: string, file: File): Promise<CVDocument | null> => {
    if (!supabase) return null;
    
    try {
        // First, upload the file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { data: _uploadData, error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('File upload error:', uploadError);
            throw uploadError;
        }
        
        // Get the public URL
        const { data: urlData } = supabase.storage
            .from('cvs')
            .getPublicUrl(fileName);
        
        // Insert record into cv_documents table
        const { data, error } = await supabase
            .from('cv_documents')
            .insert({
                user_id: userId,
                file_name: fileName,
                original_name: file.name,
                file_url: urlData.publicUrl,
                file_size: file.size,
                content_type: file.type,
                is_active: false
            })
            .select()
            .single();
        
        if (error) {
            console.error('Database insert error:', error);
            throw error;
        }
        
        return {
            id: data.id,
            userId: data.user_id,
            fileName: data.file_name,
            originalName: data.original_name,
            fileUrl: data.file_url,
            fileSize: data.file_size,
            contentType: data.content_type,
            isActive: data.is_active || false,
            parsedData: data.parsed_data,
            uploadedAt: data.uploaded_at,
            lastUsed: data.last_used
        };
    } catch (error) {
        console.error('CV upload failed:', error);
        return null;
    }
};

export const updateUserCVSelection = async (userId: string, cvId: string): Promise<boolean> => {
    if (!supabase) return false;
    
    try {
        // First, set all CVs for this user to inactive
        await supabase
            .from('cv_documents')
            .update({ is_active: false })
            .eq('user_id', userId);
        
        // Then set the selected CV to active
        const { error } = await supabase
            .from('cv_documents')
            .update({ 
                is_active: true,
                last_used: new Date().toISOString()
            })
            .eq('id', cvId)
            .eq('user_id', userId);
        
        if (error) {
            console.error('CV selection update error:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('CV selection failed:', error);
        return false;
    }
};

export const deleteCVDocument = async (userId: string, cvId: string): Promise<boolean> => {
    if (!supabase) return false;
    
    try {
        // First, get the file name to delete from storage
        const { data: cvData, error: fetchError } = await supabase
            .from('cv_documents')
            .select('file_name')
            .eq('id', cvId)
            .eq('user_id', userId)
            .single();
        
        if (fetchError) {
            console.error('CV fetch error:', fetchError);
            return false;
        }
        
        // Delete from storage
        if (cvData?.file_name) {
            await supabase.storage
                .from('cvs')
                .remove([cvData.file_name]);
        }
        
        // Delete from database
        const { error } = await supabase
            .from('cv_documents')
            .delete()
            .eq('id', cvId)
            .eq('user_id', userId);
        
        if (error) {
            console.error('CV deletion error:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('CV deletion failed:', error);
        return false;
    }
};