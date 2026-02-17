// Updated Supabase service functions for new paywall schema
import { refreshSession, supabase } from './supabaseClient';
import { calculateDistanceKm } from './commuteService';
import { geocodeWithCaching } from './geocodingService';
export { supabase };
import { UserProfile, CompanyProfile, CVDocument } from '../types';

const SUPABASE_NETWORK_COOLDOWN_MS = 60_000;
let supabaseNetworkCooldownUntil = 0;
let lastSupabaseNetworkLogAt = 0;
let lastProfileMissingWarnAt = 0;

const isLikelySupabaseNetworkError = (error: any): boolean => {
    const msg = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    return (
        msg.includes('networkerror') ||
        msg.includes('failed to fetch') ||
        msg.includes('fetch resource') ||
        msg.includes('cors') ||
        msg.includes('statement timeout') ||
        code === '57014' ||
        status >= 500
    );
};

export const isSupabaseNetworkCooldownActive = (): boolean => Date.now() < supabaseNetworkCooldownUntil;

export const noteSupabaseNetworkFailure = (context: string, error: any): void => {
    if (!isLikelySupabaseNetworkError(error)) return;
    supabaseNetworkCooldownUntil = Date.now() + SUPABASE_NETWORK_COOLDOWN_MS;
    const now = Date.now();
    if (now - lastSupabaseNetworkLogAt > 15_000) {
        console.warn(`⚠️ Supabase network unavailable (${context}). Entering cooldown.`);
        lastSupabaseNetworkLogAt = now;
    }
};

// Test account detection - gives premium access to test/demo accounts
// SECURITY: Only use in development. Production should use proper subscriptions.
const getTestAccountTier = (email: string | undefined): 'premium' | null => {
    if (!email) return null;

    // Only allow test accounts in development mode
    if (import.meta.env.MODE !== 'development') {
        return null;
    }

    // Read test emails from environment variable for better security
    const testEmailsEnv = import.meta.env.VITE_TEST_PREMIUM_EMAILS || '';
    const testEmails = testEmailsEnv.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);

    return testEmails.includes(email.toLowerCase()) ? 'premium' : null;
};

export const isSupabaseConfigured = (): boolean => {
    return !!supabase;
};

// Runtime guard for deployments where freelancer tables were removed.
let freelancerSchemaAvailable: boolean | null = null;

const isFreelancerSchemaMissingError = (error: any): boolean => {
    if (!error || error.code !== 'PGRST205') return false;
    const message = String(error.message || '').toLowerCase();
    return message.includes('freelancer_');
};

const markFreelancerSchemaUnavailable = (context: string, error: any) => {
    if (!isFreelancerSchemaMissingError(error)) return;
    if (freelancerSchemaAvailable === false) return;
    freelancerSchemaAvailable = false;
    console.warn(`Freelancer schema unavailable (${context}); freelancer features disabled.`);
};

/**
 * Diagnostic helper to verify if the Supabase client has a valid session token.
 * This is crucial for fixing 401 errors on RLS-protected tables.
 */
export const verifyAuthSession = async (context: string) => {
    if (!supabase) return { isValid: false, error: 'Supabase not configured' };
    if (isSupabaseNetworkCooldownActive()) {
        return { isValid: false, error: 'Supabase network cooldown active' };
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            if (isLikelySupabaseNetworkError(error)) {
                noteSupabaseNetworkFailure(`verifyAuthSession:${context}`, error);
                return { isValid: false, error: 'Supabase network unavailable' };
            }
            console.error(`🔴 Auth verify error [${context}]:`, error);
            return { isValid: false, error: error.message };
        }

        if (!session) {
            console.warn(`🟠 No active session found [${context}]. Requests will be sent as 'anon'.`);
            return { isValid: false, error: 'No active session' };
        }

        // Check if token is potentially expired (though getSession usually refreshes)
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt < now + 10) { // 10s buffer
            console.warn(`🟠 Session token near expiry [${context}]. Attempting refresh...`);
            const { data: { session: refreshed }, error: refreshErr } = await supabase.auth.refreshSession();
            if (refreshErr || !refreshed) {
                console.error(`🔴 Session refresh failed [${context}]:`, refreshErr);
                return { isValid: false, error: 'Session expired/refresh failed' };
            }
            return { isValid: true, session: refreshed };
        }

        console.log(`🟢 Verified valid session [${context}] for user:`, session.user?.id);
        return { isValid: true, session };
    } catch (err) {
        noteSupabaseNetworkFailure(`verifyAuthSession:${context}`, err);
        console.error(`🔴 Unexpected auth check error [${context}]:`, err);
        return { isValid: false, error: String(err) };
    }
};



// ========================================
// AUTH SERVICES (unchanged)
// ========================================

export const signInWithEmail = async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    const result = await supabase.auth.signInWithPassword({ email, password: pass });

    if (result.data.user && !result.data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error('Email not confirmed. Please confirm your email before signing in.');
    }

    // Explicitly check for profile existence after login to fix missing profile issues
    if (result.data.user && result.data.session) {
        const profile = await getUserProfile(result.data.user.id);
        if (!profile) {
            console.log('👤 Profile not found for signed-in user, creating base profile...');
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

    // 2. Create Base Profile (ONLY if session is established - i.e. no email confirmation)
    if (data.user && data.session) {
        console.log('👤 Session established after signUp, creating profile...');
        await createBaseProfile(data.user.id, email, fullName);
    } else if (data.user) {
        console.log('📧 Email confirmation required. Profile will be created on first login.');
    }

    return { data, error };
};

export const signOut = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    await supabase.auth.signOut();
};

export const signInWithOAuthProvider = async (provider: 'google' | 'linkedin_oidc') => {
    if (!supabase) throw new Error("Supabase not configured");

    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const options = redirectTo ? { redirectTo } : undefined;
    const attempt = async (prov: 'google' | 'linkedin_oidc') => {
        return await supabase.auth.signInWithOAuth({
            provider: prov,
            options
        });
    };

    const { data, error } = await attempt(provider);
    if (error) throw error;
    return { data, error };
};

export const getCurrentUser = async () => {
    if (!supabase) return null;
    if (isSupabaseNetworkCooldownActive()) return null;

    try {
        // Try to get current user first
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            console.error('Error getting current user:', error);

            // If it's a refresh token error, try to refresh the session
            if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
                console.log('Attempting to refresh session...');

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
        noteSupabaseNetworkFailure('getCurrentUser', error);
        console.error('Current user fetch error:', error);
        return null;
    }
};

export const createBaseProfile = async (userId: string, email: string, name: string, role: string = 'candidate') => {
    if (!supabase) throw new Error("Supabase not configured");

    console.log(`👤 Attempting to create base profile for ${userId} (${email})...`);

    // VERIFY SESSION FIRST
    const { isValid, error: authError } = await verifyAuthSession('createBaseProfile');
    if (!isValid) {
        const msg = `❌ Cannot create profile: Auth verification failed (${authError}). This will likely result in a 401.`;
        console.error(msg);
        // We throw here to be caught by the caller's UI logic
        throw new Error(msg);
    }

    const { error } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            email,
            full_name: name,
            role,
            subscription_tier: 'free',
            created_at: new Date().toISOString(),
        });

    if (error) {
        console.error('🔴 Error inserting into profiles:', error);
        throw error;
    }

    console.log('✅ Base profile created successfully.');

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
    if (isSupabaseNetworkCooldownActive()) return null;

    if (import.meta.env.DEV) {
        console.log(`🔍 Fetching profile for ${userId}...`);
    }

    // Diagnostic: check if session exists before fetching. 
    // We don't throw for GET requests as some profiles might be public in future, 
    // but right now they are RLS-protected.
    await verifyAuthSession('getUserProfile');

    // Fetch from profiles table with candidate_profiles join
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
            has_assessment,
            candidate_profiles (*)
        `)
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        noteSupabaseNetworkFailure('getUserProfile', profileError);
        if (isLikelySupabaseNetworkError(profileError)) {
            return null;
        }
        console.error('🔴 Profile fetch error:', profileError);
        return null;
    }

    if (!profileData) {
        const now = Date.now();
        if (now - lastProfileMissingWarnAt > 15_000) {
            console.warn('⚠️ Profile not found for userId:', userId);
            lastProfileMissingWarnAt = now;
        }
        return null;
    }

    // candidateData could be an object (1:1) or an array of 1 object depending on join type/Supabase version
    const candidateData = Array.isArray(profileData.candidate_profiles)
        ? profileData.candidate_profiles[0]
        : profileData.candidate_profiles;

    // Map to UserProfile structure - ENSURE id is always included
    const userProfile: UserProfile = {
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
        cvAiText: candidateData?.cv_ai_text || '',
        skills: candidateData?.skills || [],
        workHistory: candidateData?.work_history || [],
        education: candidateData?.education || [],
        story: candidateData?.story || '',
        hobbies: candidateData?.hobbies || [],
        volunteering: candidateData?.volunteering || [],
        leadership: candidateData?.leadership || [],
        strengths: candidateData?.strengths || [],
        values: candidateData?.values || [],
        inferredSkills: candidateData?.inferred_skills || [],
        awards: candidateData?.awards || [],
        certifications: candidateData?.certifications || [],
        sideProjects: candidateData?.side_projects || [],
        motivations: candidateData?.motivations || [],
        workPreferences: candidateData?.work_preferences || [],
        preferences: candidateData?.preferences || {
            workLifeBalance: 50,
            financialGoals: 50,
            commuteTolerance: 45,
            priorities: []
        },
        cvAnalysis: undefined,
        subscription: {
            tier: getTestAccountTier(profileData.email) || profileData.subscription_tier || 'free',
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

    return userProfile;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");

    let resolvedCoords: { lat: number; lng: number } | null | undefined = undefined;
    if (updates.address !== undefined) {
        const trimmed = typeof updates.address === 'string' ? updates.address.trim() : '';
        if (!trimmed) {
            resolvedCoords = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    resolvedCoords = { lat: geo.lat, lng: geo.lon };
                }
            } catch (e) {
                console.warn('Candidate address geocoding failed:', e);
            }
        }
    }

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
    if (resolvedCoords !== undefined) {
        if (resolvedCoords === null) {
            candidateUpdates.lat = null;
            candidateUpdates.lng = null;
        } else {
            candidateUpdates.lat = resolvedCoords.lat;
            candidateUpdates.lng = resolvedCoords.lng;
        }
    } else if (updates.coordinates !== undefined) {
        candidateUpdates.lat = updates.coordinates.lat;
        candidateUpdates.lng = updates.coordinates.lon;
    }
    if (updates.transportMode !== undefined) candidateUpdates.transport_mode = updates.transportMode;
    if (updates.cvText !== undefined) candidateUpdates.cv_text = updates.cvText;
    if (updates.cvUrl !== undefined) candidateUpdates.cv_url = updates.cvUrl;
    if (updates.cvAiText !== undefined) candidateUpdates.cv_ai_text = updates.cvAiText;
    if (updates.skills !== undefined) candidateUpdates.skills = updates.skills;
    if (updates.workHistory !== undefined) candidateUpdates.work_history = updates.workHistory;
    if (updates.education !== undefined) candidateUpdates.education = updates.education;
    if (updates.story !== undefined) candidateUpdates.story = updates.story;
    if (updates.hobbies !== undefined) candidateUpdates.hobbies = updates.hobbies;
    if (updates.volunteering !== undefined) candidateUpdates.volunteering = updates.volunteering;
    if (updates.leadership !== undefined) candidateUpdates.leadership = updates.leadership;
    if (updates.strengths !== undefined) candidateUpdates.strengths = updates.strengths;
    if (updates.values !== undefined) candidateUpdates.values = updates.values;
    if (updates.inferredSkills !== undefined) candidateUpdates.inferred_skills = updates.inferredSkills;
    if (updates.awards !== undefined) candidateUpdates.awards = updates.awards;
    if (updates.certifications !== undefined) candidateUpdates.certifications = updates.certifications;
    if (updates.sideProjects !== undefined) candidateUpdates.side_projects = updates.sideProjects;
    if (updates.motivations !== undefined) candidateUpdates.motivations = updates.motivations;
    if (updates.workPreferences !== undefined) candidateUpdates.work_preferences = updates.workPreferences;
    if (updates.preferences !== undefined) candidateUpdates.preferences = updates.preferences;

    if (Object.keys(candidateUpdates).length > 0) {
        // First check if candidate profile exists
        const { data: existing } = await supabase
            .from('candidate_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

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

export const ensureCandidateProfile = async (userId: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase
        .from('candidate_profiles')
        .upsert({ id: userId, created_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw error;
};

export const getCompanyProfile = async (userId: string): Promise<CompanyProfile | null> => {
    if (!supabase) return null;
    if (isSupabaseNetworkCooldownActive()) return null;

    const { data, error } = await supabase
        .from('companies')
        .select(`
            id,
            name,
            ico,
            dic,
            address,
            legal_address,
            registry_info,
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
        noteSupabaseNetworkFailure('getCompanyProfile', error);
        if (isLikelySupabaseNetworkError(error)) return null;
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

export const getCompanyPublicInfo = async (companyId: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('companies')
        .select('id, name, ico, dic, address, legal_address, registry_info, website')
        .eq('id', companyId)
        .maybeSingle();

    if (error) {
        console.error('Company public info fetch error:', error);
        return null;
    }

    return data;
};

export const getRecruiterCompany = async (userId: string): Promise<any> => {
    if (!supabase) {
        console.warn('⚠️ Supabase not initialized');
        return null;
    }
    if (isSupabaseNetworkCooldownActive()) return null;

    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
        try {
            // Combined query for company -> subscriptions (using explicit FK)
            const { data, error } = await supabase
                .from('companies')
                .select(`
                    *,
                    subscriptions:subscriptions!companies_subscription_id_fkey (
                        *
                    )
                `)
                .eq('owner_id', userId);

            if (error) {
                // ... same error handling as before ...
                noteSupabaseNetworkFailure('getRecruiterCompany', error);
                if (isLikelySupabaseNetworkError(error)) {
                    return null;
                }
                if (retryCount < maxRetries && (error.message?.includes('NetworkError') || error.message?.includes('fetch'))) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 800 * retryCount));
                    continue;
                }
                console.error('Recruiter company fetch error:', error);
                return null;
            }

            if (!data || data.length === 0) return null;

            const company = data[0];
            const rawSubscription = company.subscriptions?.[0];

            // Step 2: Fetch usage separately if subscription exists
            let rawUsage = null;
            if (rawSubscription?.id) {
                const { data: usageData } = await supabase
                    .from('subscription_usage')
                    .select('*')
                    .eq('subscription_id', rawSubscription.id)
                    .order('period_end', { ascending: false })
                    .limit(1)
                    .single();

                rawUsage = usageData;
            }

            const subscription = rawSubscription ? {
                tier: rawSubscription.tier,
                expiresAt: rawSubscription.current_period_end,
                status: rawSubscription.status,
                usage: rawUsage ? {
                    activeJobsCount: rawUsage.active_jobs_count || 0,
                    aiAssessmentsUsed: rawUsage.ai_assessments_used || 0,
                    adOptimizationsUsed: rawUsage.ad_optimizations_used || 0
                } : {
                    activeJobsCount: 0,
                    aiAssessmentsUsed: 0,
                    adOptimizationsUsed: 0
                }
            } : null;

            return {
                ...company,
                subscription
            };
        } catch (error: any) {
            noteSupabaseNetworkFailure('getRecruiterCompany.catch', error);
            if (isLikelySupabaseNetworkError(error)) return null;
            if (retryCount < maxRetries && (error.message?.includes('NetworkError') || error.name === 'TypeError')) {
                retryCount++;
                console.warn(`🔄 Retrying company fetch after exception (attempt ${retryCount}/ ${maxRetries}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, 800 * retryCount));
                continue;
            }
            console.error('Error in getRecruiterCompany:', error);
            return null;
        }
    }
    return null;
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
        const { data: { user } } = await supabase.auth.getUser();
        const safeUserId = user?.id || null;
        const { error } = await supabase
            .from('analytics_events')
            .insert({
                event_type: event.event_type,
                user_id: safeUserId,
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

    try {
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
            .maybeSingle();

        if (error) {
            console.warn('⚠️ Subscription fetch error:', error);
            // Return default free tier on error to unblock UI
            return {
                tier: 'free',
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: null,
                cancel_at_period_end: false,
                stripe_subscription_id: null,
                created_at: new Date().toISOString()
            };
        }

        if (!data) {
            try {
                // AUTO-HEALING: Create the missing subscription
                const newSub = await initializeCompanySubscription(companyId);
                if (newSub) {
                    return newSub;
                }
            } catch (healError) {
                console.error('Failed to auto-heal subscription:', healError);
            }

            // Fallback if healing fails
            return {
                tier: 'free',
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: null,
                cancel_at_period_end: false,
                stripe_subscription_id: null,
                created_at: new Date().toISOString()
            };
        }

        return data as any;
    } catch (error) {
        console.warn('⚠️ Exception fetching company subscription:', error);
        // Fallback
        return {
            tier: 'free',
            status: 'active',
            current_period_start: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
    }
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

export const initializeCompanySubscription = async (companyId: string): Promise<any> => {
    if (!supabase) return;

    // Create TRIAL subscription record (Business features for 14 days)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    const { data, error } = await supabase
        .from('subscriptions')
        .insert({
            company_id: companyId,
            tier: 'trial',
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString(),
            stripe_subscription_id: `trial_${companyId.substring(0, 8)}`
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to initialize subscription:', error);
        throw error; // Throw instead of silent return so caller knows it failed
    }

    // Initialize usage stats
    if (data) {
        const { error: usageError } = await supabase
            .from('subscription_usage')
            .insert({
                subscription_id: data.id,
                period_start: new Date().toISOString(),
                period_end: null, // No period end
                active_jobs_count: 0,
                ai_assessments_used: 0,
                ad_optimizations_used: 0,
                last_reset_at: new Date().toISOString()
            });

        if (usageError) {
            console.error('❌ Failed to create subscription_usage record:', usageError);
            // Don't throw - subscription was created, we can retry usage creation later
        } else {
            console.log('✅ Created subscription_usage record');
        }

        // CRITICAL: Link subscription to company
        const { error: linkError } = await supabase
            .from('companies')
            .update({ subscription_id: data.id })
            .eq('id', companyId);

        if (linkError) {
            console.error('❌ Failed to link subscription to company:', linkError);
        } else {
            console.log('✅ Linked subscription to company');
        }

        console.log(`✅ Activated 14-day BUSINESS trial for company ${companyId}`);
        return data as any;
    }

    return undefined;

};

export const getUsageSummary = async (companyId: string) => {
    if (!supabase) return null;

    try {
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('subscription_id')
            .eq('id', companyId)
            .single();

        if (companyError || !company?.subscription_id) {
            console.warn('⚠️ Could not get company subscription_id:', companyError);
            return null;
        }

        const { data: usage, error: usageError } = await supabase
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
            .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

        if (usageError) {
            console.warn('⚠️ Usage summary fetch error:', usageError);
            return null;
        }

        if (!usage) {
            console.warn('⚠️ No usage record found for subscription:', company.subscription_id);
            // Return default empty usage instead of null
            return {
                active_jobs_count: 0,
                ai_assessments_used: 0,
                ad_optimizations_used: 0,
                period_start: new Date().toISOString(),
                period_end: new Date().toISOString(),
                last_reset_at: new Date().toISOString()
            };
        }


        return usage as any;
    } catch (error) {
        console.warn('⚠️ Exception fetching usage summary:', error);
        return null;
    }
};



export const createCompany = async (companyData: any, userId?: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase not configured");

    // Check for existing company by ICO if provided
    if (companyData.ico) {
        const { data: existingICO } = await supabase
            .from('companies')
            .select('id')
            .eq('ico', companyData.ico)
            .maybeSingle();

        if (existingICO) {
            console.log("ℹ️ Company with this ICO already exists, fetching existing record.");
            return getCompanyProfile(existingICO.id);
        }
    }

    // Check for existing company by owner_id
    if (userId) {
        const { data: existingOwner } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle();

        if (existingOwner) {
            console.log("ℹ️ User already owns a company, fetching existing record.");
            return getCompanyProfile(existingOwner.id);
        }
    }

    let payload: any = { ...companyData };
    if (payload.address !== undefined) {
        const trimmed = typeof payload.address === 'string' ? payload.address.trim() : '';
        if (!trimmed) {
            payload.lat = null;
            payload.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    payload.lat = geo.lat;
                    payload.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Company address geocoding failed during create:', e);
            }
        }
    }

    const { data, error } = await supabase
        .from('companies')
        .insert({
            ...payload,
            owner_id: userId,
            created_by: userId,
            created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    if (error) throw error;

    return data;
};

// Update company industry (used for fixing freelancer companies without proper industry flag)
export const updateCompanyIndustry = async (companyId: string, industry: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
        .from('companies')
        .update({ industry })
        .eq('id', companyId)
        .select('*')
        .single();

    if (error) throw error;

    return data;
};

export const createMarketplacePartner = async (payload: {
    name: string;
    contact_email?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    website?: string | null;
    address?: string | null;
    description?: string | null;
    offer?: string | null;
    course_categories?: string[] | null;
    commission_rate?: number | null;
    partner_type?: string | null;
    owner_id?: string | null;
}) => {
    if (!supabase) throw new Error('Supabase not configured');

    const record: any = {
        name: payload.name,
        contact_email: payload.contact_email ?? null,
        contact_name: payload.contact_name ?? null,
        contact_phone: payload.contact_phone ?? null,
        website: payload.website ?? null,
        address: payload.address ?? null,
        description: payload.description ?? null,
        offer: payload.offer ?? null,
        course_categories: payload.course_categories ?? null,
        commission_rate: payload.commission_rate ?? null,
        partner_type: payload.partner_type ?? null,
        owner_id: payload.owner_id ?? null
    };

    if (payload.address !== undefined) {
        const trimmed = typeof payload.address === 'string' ? payload.address.trim() : '';
        if (!trimmed) {
            record.lat = null;
            record.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    record.lat = geo.lat;
                    record.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Marketplace partner address geocoding failed:', e);
            }
        }
    }

    const { data, error } = await supabase
        .from('marketplace_partners')
        .insert(record)
        .select()
        .single();

    if (error) {
        console.error('Marketplace partner create error:', error);
        throw error;
    }

    return data;
};

export const getMarketplacePartnerByOwner = async (ownerId: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('marketplace_partners')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

    if (error) {
        console.error('Marketplace partner fetch error:', error);
        return null;
    }

    return data;
};

export const updateMarketplacePartner = async (partnerId: string, updates: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');

    const payload: any = { ...updates };
    if (updates.address !== undefined) {
        const trimmed = typeof updates.address === 'string' ? updates.address.trim() : '';
        if (!trimmed) {
            payload.lat = null;
            payload.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    payload.lat = geo.lat;
                    payload.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Marketplace partner address geocoding failed:', e);
            }
        }
    }

    const { data, error } = await supabase
        .from('marketplace_partners')
        .update(payload)
        .eq('id', partnerId)
        .select()
        .single();

    if (error) {
        console.error('Marketplace partner update error:', error);
        throw error;
    }

    return data;
};

// ========================================
// FREELANCER / MARKETPLACE HELPERS
// ========================================

export const createFreelancerProfile = async (userId: string, payload: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (freelancerSchemaAvailable === false) return null;

    await verifyAuthSession('createFreelancerProfile');

    let resolvedCoords: { lat: number; lng: number } | null | undefined = undefined;
    if (payload.address !== undefined) {
        const trimmed = typeof payload.address === 'string' ? payload.address.trim() : '';
        if (!trimmed) {
            resolvedCoords = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    resolvedCoords = { lat: geo.lat, lng: geo.lon };
                }
            } catch (e) {
                console.warn('Freelancer address geocoding failed during create:', e);
            }
        }
    }

    const record = {
        id: userId,
        headline: payload.headline || null,
        bio: payload.bio || null,
        presentation: payload.presentation || null,
        hourly_rate: payload.hourly_rate ?? null,
        currency: payload.currency || 'CZK',
        skills: payload.skills || [],
        tags: payload.tags || [],
        portfolio: payload.portfolio || [],
        work_type: payload.work_type || 'remote',
        availability: payload.availability || null,
        address: payload.address || null,
        lat: resolvedCoords ? resolvedCoords.lat : (resolvedCoords === null ? null : (payload.lat ?? null)),
        lng: resolvedCoords ? resolvedCoords.lng : (resolvedCoords === null ? null : (payload.lng ?? null)),
        website: payload.website || null,
        contact_email: payload.contact_email || null,
        contact_phone: payload.contact_phone || null,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('freelancer_profiles')
        .upsert(record, { onConflict: 'id', returning: 'representation' })
        .select()
        .maybeSingle();

    if (error) {
        markFreelancerSchemaUnavailable('createFreelancerProfile', error);
        if (isFreelancerSchemaMissingError(error)) {
            return null;
        }
        console.error('Failed to upsert freelancer_profile:', error);
        throw error;
    }

    freelancerSchemaAvailable = true;
    return data;
};

export const updateFreelancerProfile = async (userId: string, updates: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (freelancerSchemaAvailable === false) return null;

    await verifyAuthSession('updateFreelancerProfile');

    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    let resolvedCoords: { lat: number; lng: number } | null | undefined = undefined;
    if (updates.address !== undefined) {
        const trimmed = typeof updates.address === 'string' ? updates.address.trim() : '';
        if (!trimmed) {
            resolvedCoords = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    resolvedCoords = { lat: geo.lat, lng: geo.lon };
                }
            } catch (e) {
                console.warn('Freelancer address geocoding failed during update:', e);
            }
        }
    }
    if (resolvedCoords !== undefined) {
        if (resolvedCoords === null) {
            payload.lat = null;
            payload.lng = null;
        } else {
            payload.lat = resolvedCoords.lat;
            payload.lng = resolvedCoords.lng;
        }
    }

    const { data, error } = await supabase
        .from('freelancer_profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .maybeSingle();

    if (error) {
        markFreelancerSchemaUnavailable('updateFreelancerProfile', error);
        if (isFreelancerSchemaMissingError(error)) {
            return null;
        }
        console.error('Failed to update freelancer_profile:', error);
        throw error;
    }

    freelancerSchemaAvailable = true;
    return data;
};

export const getFreelancerProfile = async (freelancerId: string) => {
    if (!supabase) return null;
    if (freelancerSchemaAvailable === false) return null;

    const { data, error } = await supabase
        .from('freelancer_profiles')
        .select(`*, freelancer_services(*), freelancer_portfolio_items(*), freelancer_skills(*)`)
        .eq('id', freelancerId)
        .maybeSingle();

    if (error) {
        markFreelancerSchemaUnavailable('getFreelancerProfile', error);
        if (isFreelancerSchemaMissingError(error)) {
            return null;
        }
        console.error('Error fetching freelancer profile:', error);
        return null;
    }

    freelancerSchemaAvailable = true;
    return data;
};

export const createFreelancerService = async (freelancerId: string, payload: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');

    await verifyAuthSession('createFreelancerService');

    // Optionally, you can check auth.uid() client-side to ensure the user is the owner.
    const record: any = {
        freelancer_id: freelancerId,
        title: payload.title || null,
        description: payload.description || null,
        price_min: payload.price_min ?? null,
        price_max: payload.price_max ?? null,
        currency: payload.currency || 'CZK',
        is_active: payload.is_active !== undefined ? payload.is_active : true,
        category: payload.category || null,
        tags: payload.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('freelancer_services')
        .insert(record)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Failed to create freelancer service:', error);
        throw error;
    }

    return data;
};

export const updateFreelancerService = async (serviceId: string, updates: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');

    await verifyAuthSession('updateFreelancerService');

    const payload: any = { ...updates, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
        .from('freelancer_services')
        .update(payload)
        .eq('id', serviceId)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Failed to update freelancer service:', error);
        throw error;
    }

    return data;
};

export const deleteFreelancerService = async (serviceId: string) => {
    if (!supabase) throw new Error('Supabase not configured');

    await verifyAuthSession('deleteFreelancerService');

    const { error } = await supabase
        .from('freelancer_services')
        .delete()
        .eq('id', serviceId);

    if (error) {
        console.error('Failed to delete freelancer service:', error);
        throw error;
    }

    return true;
};

/**
 * Search freelancers with optional geo filter. If `location` is provided (lat/lng/radiusMeters),
 * the function will call the RPC `freelancer_search_nearby` (created by migration) which uses PostGIS.
 */
export const searchFreelancers = async (opts: {
    q?: string;
    skills?: string[];
    tags?: string[];
    work_type?: string;
    location?: { lat: number; lng: number; radiusMeters?: number } | null;
    limit?: number;
    offset?: number;
}) => {
    if (!supabase) return [];

    const { q, skills, tags, work_type, location, limit = 20, offset = 0 } = opts;

    try {
        if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
            // Use RPC which returns rows with distance_m when available
            const radius = location.radiusMeters ?? 50000; // default 50km
            const { data, error } = await supabase.rpc('freelancer_search_nearby', {
                p_lat: location.lat,
                p_lng: location.lng,
                p_radius_m: radius,
                p_skills: skills || null,
                p_work_type: work_type || null,
                p_q: q || null,
                p_limit: limit,
                p_offset: offset
            });

            if (error) {
                const isMissingRpc = (error as any)?.code === 'PGRST202'
                    || (error as any)?.message?.includes('Could not find the function public.freelancer_search_nearby');
                if (!isMissingRpc) {
                    console.error('RPC freelancer_search_nearby error:', error);
                    return [];
                }
                console.warn('RPC freelancer_search_nearby missing. Falling back to non-geo search.');

                // Fallback: basic query + client-side distance filtering
                const maxFetch = Math.max(limit * 3, 100);
                let query = supabase
                    .from('freelancer_profiles')
                    .select('id,headline,bio,presentation,hourly_rate,currency,skills,tags,work_type,lat,lng,website,contact_email')
                    .limit(maxFetch)
                    .offset(0);

                if (q) query = query.ilike('headline', `%${q}%`);
                if (skills && skills.length > 0) query = query.contains('skills', skills);
                if (tags && tags.length > 0) query = query.contains('tags', tags);
                if (work_type) query = query.eq('work_type', work_type);

                const { data: fallbackData, error: fallbackError } = await query;
                if (fallbackError) {
                    console.error('searchFreelancers fallback query error:', fallbackError);
                    return [];
                }

                const filtered = (fallbackData || [])
                    .map((row: any) => {
                        if (row.lat == null || row.lng == null) return null;
                        const distanceKm = calculateDistanceKm(location.lat, location.lng, row.lat, row.lng);
                        return { ...row, distance_m: distanceKm * 1000 };
                    })
                    .filter((row: any) => row && row.distance_m <= radius)
                    .sort((a: any, b: any) => a.distance_m - b.distance_m);

                return filtered.slice(0, limit);
            }

            return data || [];
        }

        // Non-geo search using array contains and ilike
        let query = supabase.from('freelancer_profiles').select('id,headline,bio,presentation,hourly_rate,currency,skills,tags,work_type,lat,lng,website,contact_email').limit(limit).offset(offset);

        if (q) {
            query = query.ilike('headline', `%${q}%`);
        }

        if (skills && skills.length > 0) {
            query = query.contains('skills', skills);
        }

        if (tags && tags.length > 0) {
            query = query.contains('tags', tags);
        }

        if (work_type) {
            query = query.eq('work_type', work_type);
        }

        const { data, error } = await query;
        if (error) {
            console.error('searchFreelancers query error:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('searchFreelancers unexpected error:', err);
        return [];
    }
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

    return (data || []).map(mapLearningResourceRow);
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

/**
 * Create an inquiry / contact record for a freelancer/service provider.
 * Allows both logged-in users (company or regular) and anonymous contacts (with email)
 */
export const createServiceInquiry = async (payload: {
    service_id?: string | null;
    freelancer_id?: string | null;
    from_user_id?: string | null;
    from_email?: string | null;
    message?: string | null;
    metadata?: any;
}) => {
    if (!supabase) throw new Error('Supabase not configured');

    let senderProfile: any = null;
    let senderCompany: any = null;
    let resolvedUserId = payload.from_user_id || null;
    let resolvedEmail = payload.from_email || null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            resolvedUserId = resolvedUserId || user.id;
            resolvedEmail = resolvedEmail || user.email || null;

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .eq('id', user.id)
                .single();
            senderProfile = profile || null;

            const { data: membership } = await supabase
                .from('company_members')
                .select('company_id, companies(id, name)')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();
            if (membership?.companies) {
                senderCompany = membership.companies;
            } else if (membership?.company_id) {
                senderCompany = { id: membership.company_id };
            }
        }
    } catch (err) {
        console.warn('Failed to enrich service inquiry sender metadata:', err);
    }

    const record = {
        service_id: payload.service_id || null,
        freelancer_id: payload.freelancer_id || null,
        from_user_id: resolvedUserId,
        from_email: resolvedEmail,
        message: payload.message || null,
        metadata: {
            ...(payload.metadata || {}),
            sender_profile: senderProfile,
            sender_company: senderCompany,
            sender_type: senderCompany ? 'company' : (resolvedUserId ? 'user' : 'anon')
        },
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('service_inquiries')
        .insert(record)
        .select()
        .single();

    if (error) {
        console.error('Failed to create service inquiry:', error);
        throw error;
    }

    return data;
};

export const uploadCVFile = async (_userId: string, file: File): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");

    const sanitizedName = sanitizeFileName(file.name);
    const fileName = `${_userId}/${Date.now()}-${sanitizedName}`;
    const { data, error } = await supabase.storage
        .from('cvs')
        .upload(fileName, file);

    if (error) throw error;

    return data.path;
};

export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");

    const sanitizedName = sanitizeFileName(file.name);
    const fileName = `${userId}/${Date.now()}-${sanitizedName}`;
    const { data: _uploadData, error } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

    return publicUrl;
};

export const uploadCompanyLogo = async (companyId: string, file: File): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");

    const sanitizedName = sanitizeFileName(file.name);
    const fileName = `${companyId}/${Date.now()}-${sanitizedName}`;
    const { error } = await supabase.storage
        .from('logo')
        .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('logo')
        .getPublicUrl(fileName);

    return publicUrl;
};

export const updateCompanyProfile = async (companyId: string, updates: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error("Supabase not configured");

    const { members, subscription, subscriptions, ...rest } = updates as any;
    const payload: any = { ...rest };

    if (payload.address !== undefined) {
        const trimmed = typeof payload.address === 'string' ? payload.address.trim() : '';
        if (!trimmed) {
            payload.lat = null;
            payload.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    payload.lat = geo.lat;
                    payload.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Company address geocoding failed:', e);
            }
        }
    }
    const { data, error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', companyId)
        .select('*')
        .single();

    if (error) {
        console.error('Failed to update company profile:', error);
        throw error;
    }

    return data;
};

export const getCompanyLogoUrl = async (companyId: string): Promise<string | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', companyId)
        .maybeSingle();

    if (error) {
        console.error('Company logo fetch error:', error);
        return null;
    }

    return data?.logo_url || null;
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

const mapLearningResourceRow = (row: any) => {
    const priceEstimate = row?.price_estimate || null;
    return {
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        skill_tags: row.skill_tags || row.skill_name || [],
        url: row.url || row.affiliate_url || '',
        provider: row.provider || '',
        duration_hours: row.duration_hours || 0,
        difficulty: row.difficulty || 'Beginner',
        price: row.price || priceEstimate?.amount || 0,
        currency: row.currency || priceEstimate?.currency || 'CZK',
        rating: row.rating || 0,
        reviews_count: row.reviews_count || 0,
        created_at: row.created_at || new Date().toISOString(),
        is_government_funded: row.is_government_funded || false,
        funding_amount_czk: row.funding_amount_czk || null,
        affiliate_url: row.affiliate_url || null,
        location: row.location || null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        status: row.status || 'active',
        partner_name: row.partner_name || row.provider || null,
        partner_id: row.partner_id || null
    };
};

const applyLearningResourcePayload = (payload: any) => {
    const record: any = { ...payload };
    if (payload.skill_tags && !payload.skill_name) {
        record.skill_name = payload.skill_tags;
        delete record.skill_tags;
    }
    if ((payload.price !== undefined || payload.currency !== undefined) && payload.price_estimate === undefined) {
        const amount = typeof payload.price === 'number' ? payload.price : Number(payload.price || 0);
        record.price_estimate = { amount: Number.isFinite(amount) ? amount : 0, currency: payload.currency || 'CZK' };
        delete record.price;
        delete record.currency;
    }
    return record;
};

export const fetchLearningResourcesByPartner = async (partnerId: string) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('learning_resources')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Learning resources by partner fetch error:', error);
        return [];
    }

    return (data || []).map(mapLearningResourceRow);
};

export const createLearningResource = async (payload: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');

    const record: any = applyLearningResourcePayload(payload);
    if (record.location !== undefined) {
        const trimmed = typeof record.location === 'string' ? record.location.trim() : '';
        if (!trimmed) {
            record.lat = null;
            record.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    record.lat = geo.lat;
                    record.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Learning resource geocoding failed during create:', e);
            }
        }
    }

    const { data, error } = await supabase
        .from('learning_resources')
        .insert(record)
        .select()
        .single();

    if (error) {
        console.error('Learning resource create error:', error);
        throw error;
    }

    return data;
};

export const updateLearningResource = async (resourceId: string, updates: Partial<Record<string, any>>) => {
    if (!supabase) throw new Error('Supabase not configured');

    const payload: any = applyLearningResourcePayload(updates);
    if (updates.location !== undefined) {
        const trimmed = typeof updates.location === 'string' ? updates.location.trim() : '';
        if (!trimmed) {
            payload.lat = null;
            payload.lng = null;
        } else {
            try {
                const geo = await geocodeWithCaching(trimmed);
                if (geo) {
                    payload.lat = geo.lat;
                    payload.lng = geo.lon;
                }
            } catch (e) {
                console.warn('Learning resource geocoding failed during update:', e);
            }
        }
    }

    const { data, error } = await supabase
        .from('learning_resources')
        .update(payload)
        .eq('id', resourceId)
        .select()
        .single();

    if (error) {
        console.error('Learning resource update error:', error);
        throw error;
    }

    return data;
};

export const deleteLearningResource = async (resourceId: string) => {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
        .from('learning_resources')
        .delete()
        .eq('id', resourceId);

    if (error) {
        console.error('Learning resource delete error:', error);
        throw error;
    }

    return true;
};

export const getCourseReviewsForCourses = async (courseIds: string[]) => {
    if (!supabase || courseIds.length === 0) return [];

    const { data, error } = await supabase
        .from('course_reviews')
        .select('id, course_id, reviewer_id, rating, comment, is_verified_graduate, created_at')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Course reviews fetch error:', error);
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
        // SECURITY: Validate file before upload
        const validation = validateFileUpload(file);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        // SECURITY: Generate safe filename
        const fileExt = validation.extension!;
        const safeFileName = generateSafeFileName(userId, file.name, fileExt);

        // SECURITY: Upload with metadata validation
        const { data: _uploadData, error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(safeFileName, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('File upload error:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // SECURITY: Get public URL safely
        const { data: urlData } = supabase.storage
            .from('cvs')
            .getPublicUrl(safeFileName);

        // SECURITY: Insert with additional security checks
        const { data, error } = await supabase
            .from('cv_documents')
            .insert({
                user_id: userId,
                file_name: safeFileName,
                original_name: sanitizeFileName(file.name),
                file_url: urlData.publicUrl,
                file_size: file.size,
                content_type: file.type,
                is_active: false,
                virus_scan_status: 'pending', // Add virus scanning
                upload_ip: null // Could be passed from client for IP tracking
            })
            .select()
            .single();

        if (error) {
            // SECURITY: Cleanup failed upload
            await supabase.storage.from('cvs').remove([safeFileName]);
            throw new Error(`Database error: ${error.message}`);
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
            uploadedAt: data.uploaded_at,
            lastUsed: data.last_used
        };
    } catch (error) {
        console.error('CV upload failed:', error);
        throw error;
    }
}

// SECURITY: File validation function
function validateFileUpload(file: File): { isValid: boolean; extension?: string; error?: string } {
    // SECURITY: File type whitelist
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];

    // SECURITY: File extension whitelist
    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];

    // SECURITY: File size limit (10MB max)
    const maxSizeBytes = 10 * 1024 * 1024;

    // Check file size
    if (file.size > maxSizeBytes) {
        return { isValid: false, error: 'File size exceeds 10MB limit' };
    }

    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
        return { isValid: false, error: 'File type not allowed' };
    }

    // Check extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
        return { isValid: false, error: 'File extension not allowed' };
    }

    // SECURITY: Additional filename checks
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        return { isValid: false, error: 'Invalid filename' };
    }

    return { isValid: true, extension: fileExt };
}

// SECURITY: Generate safe filename
function generateSafeFileName(userId: string, _originalName: string, extension: string): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '');
    return `${sanitizedUserId}/${timestamp}_${randomId}.${extension}`;
}

// SECURITY: Sanitize filename
function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[^a-zA-Z0-9.-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 255); // Limit length
}

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
}

// ========================================
// PORTFOLIO FUNCTIONS (new)
// ========================================

export const uploadPortfolioImage = async (
    freelancerId: string,
    file: File,
    title: string,
    description: string,
    url?: string
) => {
    if (!supabase) throw new Error("Supabase not configured");

    try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
            console.error('Portfolio upload auth error:', authError);
        }
        const authUserId = authData?.user?.id || null;
        if (!authUserId) {
            throw new Error('User is not authenticated');
        }
        if (freelancerId !== authUserId) {
            console.warn('Portfolio upload: freelancerId differs from auth uid, using auth uid', {
                freelancerId,
                authUserId
            });
            freelancerId = authUserId;
        }

        const sanitizeFileName = (name: string) => {
            const normalized = name
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '');
            const parts = normalized.split('.');
            const ext = parts.length > 1 ? parts.pop() : '';
            const base = parts.join('.') || 'portfolio-file';
            const safeBase = base
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9._-]/g, '')
                .replace(/-+/g, '-')
                .replace(/^[-_.]+|[-_.]+$/g, '')
                .toLowerCase() || 'portfolio-file';
            const safeExt = ext ? ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
            return safeExt ? `${safeBase}.${safeExt}` : safeBase;
        };

        // Generate unique filename
        const timestamp = Date.now();
        const safeName = sanitizeFileName(file.name);
        const fileName = `${freelancerId}/${timestamp}-${safeName}`;

        // Upload to 'portfolio' bucket
        const { error: uploadError } = await supabase.storage
            .from('portfolio')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Portfolio upload error:', uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('portfolio')
            .getPublicUrl(fileName);

        // Save portfolio item to database
        const { data: portfolioData, error: dbError } = await supabase
            .from('freelancer_portfolio_items')
            .insert({
                freelancer_id: freelancerId,
                title,
                description,
                url: url || null,
                image_url: publicUrl,
                file_name: fileName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('Portfolio DB error:', dbError);
            // Clean up uploaded file if DB insert fails
            await supabase.storage.from('portfolio').remove([fileName]);
            throw dbError;
        }

        return portfolioData;
    } catch (error) {
        console.error('Portfolio upload failed:', error);
        throw error;
    }
};

export const getPortfolioItems = async (freelancerId: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    try {
        const { data, error } = await supabase
            .from('freelancer_portfolio_items')
            .select('*')
            .eq('freelancer_id', freelancerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Portfolio fetch error:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Portfolio fetch failed:', error);
        return [];
    }
};

export const deletePortfolioItem = async (itemId: string, fileName: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    try {
        // Delete from storage
        if (fileName) {
            const { error: storageError } = await supabase.storage
                .from('portfolio')
                .remove([fileName]);

            if (storageError) {
                console.error('Portfolio file deletion error:', storageError);
            }
        }

        // Delete from database
        const { error: dbError } = await supabase
            .from('freelancer_portfolio_items')
            .delete()
            .eq('id', itemId);

        if (dbError) {
            console.error('Portfolio item deletion error:', dbError);
            throw dbError;
        }

        return true;
    } catch (error) {
        console.error('Portfolio deletion failed:', error);
        throw error;
    }
};

// ========================================
// REVIEWS (COURSES + FREELANCERS)
// ========================================

export const getCourseReviewStats = async (courseIds: string[]) => {
    if (!supabase || courseIds.length === 0) return [];

    const { data, error } = await supabase
        .from('course_review_stats')
        .select('course_id, avg_rating, reviews_count')
        .in('course_id', courseIds);

    if (error) {
        console.error('Course review stats error:', error);
        return [];
    }

    return data || [];
};

export const getCourseReviews = async (courseId: string) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('course_reviews')
        .select('id, course_id, reviewer_id, rating, comment, is_verified_graduate, created_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Course reviews fetch error:', error);
        return [];
    }

    const reviewerIds = (data || []).map((r: any) => r.reviewer_id).filter(Boolean);
    let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};
    if (reviewerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', reviewerIds);
        if (!profilesError && profiles) {
            profileMap = profiles.reduce((acc: any, p: any) => {
                acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
                return acc;
            }, {});
        }
    }

    const reviewIds = (data || []).map((r: any) => r.id).filter(Boolean);
    let voteStatsMap: Record<string, { helpful_count?: number; unhelpful_count?: number }> = {};
    if (reviewIds.length > 0) {
        const { data: voteStats } = await supabase
            .from('course_review_vote_stats')
            .select('review_id, helpful_count, unhelpful_count')
            .in('review_id', reviewIds);
        voteStatsMap = (voteStats || []).reduce((acc: any, s: any) => {
            acc[s.review_id] = { helpful_count: s.helpful_count, unhelpful_count: s.unhelpful_count };
            return acc;
        }, {});
    }

    return (data || []).map((r: any) => ({
        ...r,
        candidate_name: profileMap[r.reviewer_id]?.full_name,
        candidate_avatar: profileMap[r.reviewer_id]?.avatar_url,
        helpful_count: voteStatsMap[r.id]?.helpful_count || 0,
        unhelpful_count: voteStatsMap[r.id]?.unhelpful_count || 0
    }));
};

export const createCourseReview = async (payload: {
    course_id: string;
    reviewer_id: string;
    rating: number;
    comment?: string;
    is_verified_graduate?: boolean;
}) => {
    if (!supabase) throw new Error('Supabase not configured');

    let isVerified = payload.is_verified_graduate ?? false;
    // If course_id is a UUID and the user completed the course (career_tracks), mark as verified
    if (!isVerified) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(payload.course_id)) {
            const { data: ct } = await supabase
                .from('career_tracks')
                .select('id')
                .eq('candidate_id', payload.reviewer_id)
                .eq('resource_id', payload.course_id)
                .limit(1);
            if (ct && ct.length > 0) {
                isVerified = true;
            }
        }
    }

    const { data, error } = await supabase
        .from('course_reviews')
        .insert({
            course_id: payload.course_id,
            reviewer_id: payload.reviewer_id,
            rating: payload.rating,
            comment: payload.comment || null,
            is_verified_graduate: isVerified,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Create course review error:', error);
        throw error;
    }

    return data;
};

export const voteCourseReview = async (payload: { review_id: string; voter_id: string; is_helpful: boolean }) => {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('course_review_votes')
        .upsert({
            review_id: payload.review_id,
            voter_id: payload.voter_id,
            is_helpful: payload.is_helpful,
            created_at: new Date().toISOString()
        }, { onConflict: 'review_id,voter_id' })
        .select()
        .single();

    if (error) {
        console.error('Course review vote error:', error);
        throw error;
    }

    return data;
};

export const getFreelancerReviewStats = async (freelancerIds: string[]) => {
    if (!supabase || freelancerIds.length === 0) return [];

    const { data, error } = await supabase
        .from('freelancer_review_stats')
        .select('freelancer_id, avg_rating, reviews_count')
        .in('freelancer_id', freelancerIds);

    if (error) {
        console.error('Freelancer review stats error:', error);
        return [];
    }

    return data || [];
};

export const getFreelancerReviews = async (freelancerId: string) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('freelancer_reviews')
        .select('id, freelancer_id, reviewer_id, rating, comment, is_verified_customer, created_at')
        .eq('freelancer_id', freelancerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Freelancer reviews fetch error:', error);
        return [];
    }

    const reviewerIds = (data || []).map((r: any) => r.reviewer_id).filter(Boolean);
    let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};
    if (reviewerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', reviewerIds);
        if (!profilesError && profiles) {
            profileMap = profiles.reduce((acc: any, p: any) => {
                acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
                return acc;
            }, {});
        }
    }

    const reviewIds = (data || []).map((r: any) => r.id).filter(Boolean);
    let voteStatsMap: Record<string, { helpful_count?: number; unhelpful_count?: number }> = {};
    if (reviewIds.length > 0) {
        const { data: voteStats } = await supabase
            .from('freelancer_review_vote_stats')
            .select('review_id, helpful_count, unhelpful_count')
            .in('review_id', reviewIds);
        voteStatsMap = (voteStats || []).reduce((acc: any, s: any) => {
            acc[s.review_id] = { helpful_count: s.helpful_count, unhelpful_count: s.unhelpful_count };
            return acc;
        }, {});
    }

    return (data || []).map((r: any) => ({
        ...r,
        candidate_name: profileMap[r.reviewer_id]?.full_name,
        candidate_avatar: profileMap[r.reviewer_id]?.avatar_url,
        helpful_count: voteStatsMap[r.id]?.helpful_count || 0,
        unhelpful_count: voteStatsMap[r.id]?.unhelpful_count || 0
    }));
};

export const createFreelancerReview = async (payload: {
    freelancer_id: string;
    reviewer_id: string;
    rating: number;
    comment?: string;
}) => {
    if (!supabase) throw new Error('Supabase not configured');

    let isVerified = false;
    const { data: inquiries } = await supabase
        .from('service_inquiries')
        .select('id')
        .eq('freelancer_id', payload.freelancer_id)
        .eq('from_user_id', payload.reviewer_id)
        .limit(1);
    if (inquiries && inquiries.length > 0) {
        isVerified = true;
    }

    const { data, error } = await supabase
        .from('freelancer_reviews')
        .insert({
            freelancer_id: payload.freelancer_id,
            reviewer_id: payload.reviewer_id,
            rating: payload.rating,
            comment: payload.comment || null,
            is_verified_customer: isVerified,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Create freelancer review error:', error);
        throw error;
    }

    return data;
};

export const voteFreelancerReview = async (payload: { review_id: string; voter_id: string; is_helpful: boolean }) => {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('freelancer_review_votes')
        .upsert({
            review_id: payload.review_id,
            voter_id: payload.voter_id,
            is_helpful: payload.is_helpful,
            created_at: new Date().toISOString()
        }, { onConflict: 'review_id,voter_id' })
        .select()
        .single();

    if (error) {
        console.error('Freelancer review vote error:', error);
        throw error;
    }

    return data;
};
