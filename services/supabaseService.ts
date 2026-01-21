import { createClient } from '@supabase/supabase-js';
import { UserProfile, CompanyProfile, LearningResource, BenefitValuation, AssessmentResult, Job } from '../types';

// Safe environment access helper
const getEnv = (key: string, fallback: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {
    // Ignore error in environments where process is not defined
  }
  return fallback;
};

// Configuration provided by user
const supabaseUrl = getEnv('SUPABASE_URL', 'https://frquoinhhxkxnvcyomtr.supabase.co');
const supabaseKey = getEnv('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycXVvaW5oaHhreG52Y3lvbXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4ODMyMzUsImV4cCI6MjA4NDQ1OTIzNX0.cJyu1wUtcCjzWkd_MfXJhrF5d0XV0i622PrpbzM3lWs');

// Create a single supabase client for interacting with your database
// WRAPPED IN TRY-CATCH TO PREVENT WHITE SCREEN OF DEATH ON INIT
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

// --- AUTH SERVICES ---

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
            data: { full_name: fullName }
        }
    });

    if (error) return { data, error };

    // 2. Manual Profile Creation (Fallback if triggers are missing)
    if (data.user) {
        await createBaseProfile(data.user.id, email, fullName);
    }

    return { data, error };
};

const createBaseProfile = async (userId: string, email: string, fullName: string) => {
    if (!supabase) return;
    try {
        // Try inserting into profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ id: userId, email: email, full_name: fullName, role: 'candidate' });
            
        if (profileError) console.warn("Failed to create base profile:", profileError);

        // Try inserting into candidate_profiles
        const { error: candidateError } = await supabase
            .from('candidate_profiles')
            .upsert({ id: userId });

        if (candidateError) console.warn("Failed to create candidate profile:", candidateError);
    } catch (e) {
        console.error("Profile creation exception:", e);
    }
};

export const signOut = async () => {
    if (!supabase) return;
    return await supabase.auth.signOut();
};

export const getUserProfile = async (userId: string): Promise<Partial<UserProfile> | null> => {
    if (!supabase) return null;

    try {
        // 1. Fetch Base Profile
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) {
            // If base profile is missing, return null so we can create it
            return null;
        }

        // 2. Fetch Candidate Details
        const { data: candidateData, error: candidateError } = await supabase
            .from('candidate_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        // If no candidate profile exists yet (rare), just return base
        if (candidateError && candidateError.code !== 'PGRST116') { // Ignore 'row not found' error code
             console.warn("Candidate profile missing or error", candidateError);
        }

        // 3. Fetch CV URL from the new table
        const { data: cvUrlData, error: cvUrlError } = await supabase
            .from('public_candidate_cv_urls')
            .select('url')
            .eq('candidate_id', userId)
            .single();

        let cvUrl = '';
        if (cvUrlError && cvUrlError.code !== 'PGRST116') { // Ignore 'row not found' error code
            console.warn("CV URL fetch error:", cvUrlError);
        } else if (cvUrlData) {
            cvUrl = cvUrlData.url;
        }

        return {
            id: profileData.id,
            name: profileData.full_name,
            email: profileData.email,
            role: profileData.role,
            // Candidate specific
            address: candidateData?.address || '',
            cvText: candidateData?.cv_text || '',
            cvUrl: cvUrl,
            transportMode: candidateData?.transport_mode || 'public',
            preferences: candidateData?.preferences || {
                workLifeBalance: 50,
                financialGoals: 50,
                commuteTolerance: 45,
                priorities: []
            },
            skills: candidateData?.skills || [],
            workHistory: candidateData?.work_history || [],
            education: candidateData?.education || [],
            isLoggedIn: true
        };

    } catch (error) {
        console.error("Error loading user profile:", error);
        return null;
    }
};

export const uploadCVFile = async (userId: string, file: File): Promise<string | null> => {
    if (!supabase) return null;

    try {
        // Generate unique filename with user ID for better organization
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${userId}/cv-${Date.now()}-${sanitizedName}`;

        console.log("Uploading CV file:", fileName, "Size:", file.size, "Type:", file.type);

        // First, ensure user profile exists to avoid RLS issues
        try {
            const { error: profileCheckError } = await supabase
                .from('candidate_profiles')
                .select('id')
                .eq('id', userId)
                .single();
                
            if (profileCheckError && profileCheckError.code === 'PGRST116') {
                // Profile doesn't exist, create it first
                console.log("Creating candidate profile for user:", userId);
                const { error: createError } = await supabase
                    .from('candidate_profiles')
                    .insert({ id: userId });
                    
                if (createError) {
                    console.error("Failed to create candidate profile:", createError);
                    // Continue with upload anyway - storage might have different policies
                }
            }
        } catch (profileError) {
            console.warn("Profile check failed, continuing with upload:", profileError);
        }

        // Upload to Supabase Storage with better error handling
        const { data, error } = await supabase.storage
            .from('cvs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true, // Allow overwriting to avoid conflicts
                contentType: file.type
            });

        if (error) {
            console.error("CV upload error:", error);
            
            // More specific error handling
            if (error.message.includes('Bucket not found') || error.message.includes('storage')) {
                console.warn("Storage bucket not available, using fallback");
                return null; // Silent fail for storage issues
            }
            
            if (error.message.includes('row-level security') || error.message.includes('policy')) {
                console.warn("RLS policy prevented upload, this might be expected");
                return null; // Silent fail for RLS issues
            }
            
            // For other errors, still try to continue
            console.warn("Upload failed, but continuing with CV processing");
            return null;
        }

        console.log("CV upload successful:", data);

        // Get public URL with error handling
        const { data: urlData } = supabase.storage
            .from('cvs')
            .getPublicUrl(fileName);

        if (urlData && urlData.publicUrl) {
            console.log("CV public URL:", urlData.publicUrl);
            return urlData.publicUrl;
        } else {
            console.warn("Could not get public URL, but upload succeeded");
            return null;
        }
    } catch (e) {
        console.error("Failed to upload CV:", e);
        // Don't show alert for storage issues, just log and continue
        return null;
    }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
    if (!supabase) return;

    // Split updates between 'profiles' table and 'candidate_profiles' table
    const baseUpdates: any = {};
    if (updates.name) baseUpdates.full_name = updates.name;
    if (updates.email) baseUpdates.email = updates.email;
    if (updates.phone) baseUpdates.phone = updates.phone;
    if (updates.jobTitle) baseUpdates.job_title = updates.jobTitle;
    if (updates.photo) baseUpdates.photo = updates.photo;

    const candidateUpdates: any = {};
    if (updates.address !== undefined) candidateUpdates.address = updates.address;
    if (updates.cvText !== undefined) candidateUpdates.cv_text = updates.cvText;
    // Note: cvUrl is handled separately in public_candidate_cv_urls table
    if (updates.transportMode !== undefined) candidateUpdates.transport_mode = updates.transportMode;
    if (updates.preferences !== undefined) candidateUpdates.preferences = updates.preferences;
    if (updates.skills !== undefined) {
        // Handle both array and string formats
        candidateUpdates.skills = Array.isArray(updates.skills) 
            ? updates.skills.join(', ') 
            : updates.skills;
    }
    if (updates.workHistory !== undefined) {
        candidateUpdates.work_history = JSON.stringify(updates.workHistory);
    }
    if (updates.education !== undefined) {
        candidateUpdates.education = JSON.stringify(updates.education);
    }

    const promises = [];
    if (Object.keys(baseUpdates).length > 0) {
        promises.push(supabase.from('profiles').update(baseUpdates).eq('id', userId));
    }
    if (Object.keys(candidateUpdates).length > 0) {
        // Use UPSERT instead of UPDATE to ensure row creation if missing
        promises.push(supabase.from('candidate_profiles').upsert({ 
            id: userId, 
            ...candidateUpdates,
            updated_at: new Date().toISOString()
        }));
    }
    
    // Handle CV URL update in the new table
    if (updates.cvUrl !== undefined) {
        if (updates.cvUrl) {
            // If CV URL is provided, upsert it to the new table
            promises.push(supabase.from('public_candidate_cv_urls').upsert({
                candidate_id: userId,
                url: updates.cvUrl,
                updated_at: new Date().toISOString()
            }));
        } else {
            // If CV URL is null/empty, delete it from the table
            promises.push(supabase.from('public_candidate_cv_urls').delete().eq('candidate_id', userId));
        }
    }

    try {
        await Promise.all(promises);
        console.log("Profile updated successfully", { baseUpdates, candidateUpdates });
    } catch (e) {
        console.error("Failed to update profile", e);
        throw e;
    }
};

// --- COMPANY SERVICES ---

export const createCompany = async (profile: CompanyProfile, recruiterId: string) => {
    if (!supabase) return null;

    // 1. Insert Company
    const { data: company, error } = await supabase
        .from('companies')
        .insert({
            name: profile.name,
            ico: profile.ico,
            dic: profile.dic,
            address: profile.address,
            description: profile.description,
            industry: profile.industry,
            tone: profile.tone,
            owner_id: recruiterId,
            values: profile.values,
            philosophy: profile.philosophy
        })
        .select()
        .single();

    if (error) throw error;

    // 2. Link Recruiter to Company
    await supabase
        .from('recruiter_profiles')
        .insert({
            id: recruiterId,
            company_id: company.id
        });

    return company;
};

export const getRecruiterCompany = async (userId: string): Promise<CompanyProfile | null> => {
    if (!supabase) return null;

    // Get company ID from recruiter_profiles
    const { data: link } = await supabase
        .from('recruiter_profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

    if (!link) return null;

    const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', link.company_id)
        .single();

    if (!company) return null;

    return {
        id: company.id,
        name: company.name,
        ico: company.ico,
        dic: company.dic,
        address: company.address,
        description: company.description,
        industry: company.industry,
        tone: company.tone,
        values: company.values || [],
        philosophy: company.philosophy
    };
};

// New functions for Career Pathfinder AI
export const fetchLearningResources = async (skillTags?: string[]): Promise<LearningResource[]> => {
    if (!supabase) return [];

    try {
        let query = supabase
            .from('learning_resources')
            .select('*')
            .order('rating', { ascending: false })
            .order('reviews_count', { ascending: false });

        // Filter by skill tags if provided
        if (skillTags && skillTags.length > 0) {
            query = query.or(
                skillTags.map(skill => `skill_tags.cs.{${skill.toLowerCase()}}`).join(',')
            );
        }

        const { data, error } = await query.limit(50);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching learning resources:', error);
        return [];
    }
};

export const fetchBenefitValuations = async (): Promise<BenefitValuation[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('benefit_valuations')
            .select('*')
            .order('monetary_value', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching benefit valuations:', error);
        return [];
    }
};

export const fetchAssessmentResults = async (candidateId: string): Promise<AssessmentResult[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('assessment_results')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('completed_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching assessment results:', error);
        return [];
    }
};

// Check if company has active assessment module
export const checkCompanyAssessment = async (companyId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const { data, error } = await supabase
            .from('companies')
            .select('has_assessment_module')
            .eq('id', companyId)
            .single();

        if (error) return false;
        return data?.has_assessment_module || false;
    } catch (error) {
        console.error('Error checking company assessment:', error);
        return false;
    }
};

// Enhanced job fetching with new fields
export const fetchJobsWithDetails = async (limit: number = 50): Promise<Job[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('jobs')
            .select(`
                *,
                company:companies(*)
            `)
            .eq('is_active', true)
            .order('scraped_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        
        // Process jobs to include new fields
        return (data || []).map(job => ({
            ...job,
            required_skills: job.required_skills || [],
            lat: job.lat,
            lng: job.lng,
            salary_from: job.salary_from,
            salary_to: job.salary_to,
        }));
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return [];
    }
};