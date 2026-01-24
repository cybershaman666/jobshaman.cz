import { createClient } from '@supabase/supabase-js';
import { UserProfile, CompanyProfile, LearningResource, BenefitValuation, AssessmentResult, Job, CVDocument } from '../types';
import { parseProfileFromCVWithFallback } from './cvParserService';

// Configuration provided by user
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

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

        // 3. CV URL is now part of candidate_profiles table
        let cvUrl = candidateData?.cv_url || '';

        return {
            id: profileData.id,
            name: profileData.full_name,
            email: profileData.email,
            role: profileData.role,
            photo: profileData.avatar_url,
            // Candidate specific
            phone: candidateData?.phone || '',
            jobTitle: candidateData?.job_title || '',
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
            skills: candidateData?.skills ? (typeof candidateData.skills === 'string' ? JSON.parse(candidateData.skills) : candidateData.skills) : [],
            workHistory: candidateData?.work_history ? (typeof candidateData.work_history === 'string' ? JSON.parse(candidateData.work_history) : candidateData.work_history) : [],
            education: candidateData?.education ? (typeof candidateData.education === 'string' ? JSON.parse(candidateData.education) : candidateData.education) : [],
            hasAssessment: profileData?.has_assessment || false,
            isLoggedIn: true
        };

    } catch (error) {
        console.error("Error loading user profile:", error);
        return null;
    }
};

export const uploadProfilePhoto = async (userId: string, file: File): Promise<string | null> => {
    if (!supabase) return null;

    try {
        // Generate unique filename with user ID for better organization
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}/profile-photo-${Date.now()}.${fileExtension}`;

        console.log("Uploading profile photo:", fileName, "Size:", file.size, "Type:", file.type);

        // First, ensure user profile exists to avoid RLS issues
        try {
            const { error: profileCheckError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .single();

            if (profileCheckError && profileCheckError.code === 'PGRST116') {
                // Profile doesn't exist, create it first
                console.log("Creating profile for user:", userId);
                const { error: createError } = await supabase
                    .from('profiles')
                    .insert({ id: userId, email: '', role: 'candidate' });

                if (createError) {
                    console.error("Failed to create profile:", createError);
                    // Continue with upload anyway - storage might have different policies
                }
            }
        } catch (profileError) {
            console.warn("Profile check failed, continuing with upload:", profileError);
        }

        // Upload to Supabase Storage with better error handling and timeout
        console.log("Starting photo upload for:", fileName);

        const uploadPromise = supabase.storage
            .from('profile-photos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true, // Allow overwriting to avoid conflicts
                contentType: file.type
            });

        // Add timeout to prevent hanging uploads
        const { data, error } = await Promise.race([
            uploadPromise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Upload timeout')), 30000) // 30 second timeout
            )
        ]) as any;

        if (error) {
            console.error("Profile photo upload error:", error);

            // More specific error handling
            if (error.message.includes('Bucket not found') || error.message.includes('storage')) {
                console.warn("Storage bucket not available, using fallback");
                return null; // Silent fail for storage issues
            }

            if (error.message.includes('row-level security') || error.message.includes('policy')) {
                console.warn("RLS policy prevented upload, this might be expected");
                return null; // Silent fail for RLS issues
            }

            if (error.message.includes('timeout') || error.message.includes('aborted')) {
                console.warn("Upload timed out or was aborted, this might be a network issue");
                // Try one more time with a smaller timeout
                try {
                    console.log("Retrying photo upload...");
                    const { data: retryData, error: retryError } = await supabase.storage
                        .from('profile-photos')
                        .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true,
                            contentType: file.type
                        });

                    if (retryError) {
                        console.error("Retry upload failed:", retryError);
                        return null;
                    }

                    if (retryData) {
                        console.log("Retry upload successful:", retryData);

                        // Get signed URL (works even for private buckets)
                        const { data: urlData, error: urlError } = await supabase.storage
                            .from('profile-photos')
                            .createSignedUrl(fileName, 31536000); // 1 year expiry

                        if (urlError || !urlData?.signedUrl) {
                            console.error("Failed to create signed URL for retry upload:", urlError);
                            return null;
                        }

                        const publicUrl = urlData.signedUrl;
                        console.log("Profile photo signed URL (retry):", publicUrl);

                        // Update user profile with new photo URL
                        await supabase
                            .from('profiles')
                            .update({ avatar_url: publicUrl })
                            .eq('id', userId);

                        return publicUrl;
                    }
                } catch (retryError) {
                    console.error("Retry upload failed:", retryError);
                    return null;
                }
            }

            // For other errors, still try to continue
            console.warn("Upload failed, but continuing with photo processing");
            return null;
        }

        console.log("Profile photo upload successful:", data);

        // Get signed URL (works even for private buckets)
        const { data: urlData, error: urlError } = await supabase.storage
            .from('profile-photos')
            .createSignedUrl(fileName, 31536000); // 1 year expiry

        if (urlError || !urlData?.signedUrl) {
            console.error("Failed to create signed URL for uploaded photo:", urlError);
            return null;
        }

        const publicUrl = urlData.signedUrl;
        console.log("Profile photo signed URL:", publicUrl);

        // Test if URL is accessible
        try {
            const testResponse = await fetch(publicUrl, { method: 'HEAD' });
            console.log("Photo URL accessibility test:", testResponse.status);
        } catch (fetchError) {
            console.warn("Photo URL not accessible:", fetchError);
        }

        // Update user profile with the new photo URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateError) {
            console.error("Failed to update profile with photo URL:", updateError);
            // Still return the URL since the file was uploaded successfully
        }

        return publicUrl;

    } catch (error) {
        console.error("Error uploading profile photo:", error);
        return null;
    }
};

export const deleteProfilePhoto = async (userId: string, photoUrl: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // Extract file path from URL
        const url = new URL(photoUrl);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const filePath = `${userId}/${fileName}`;

        console.log("Deleting profile photo:", filePath);

        // Delete from storage
        const { error } = await supabase.storage
            .from('profile-photos')
            .remove([filePath]);

        if (error) {
            console.error("Failed to delete profile photo from storage:", error);
            return false;
        }

        // Clear photo URL from profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', userId);

        if (updateError) {
            console.error("Failed to clear photo URL from profile:", updateError);
            return false;
        }

        console.log("Profile photo deleted successfully");
        return true;

    } catch (error) {
        console.error("Error deleting profile photo:", error);
        return false;
    }
};

// CV Management Functions
export const uploadCVDocument = async (userId: string, file: File): Promise<CVDocument | null> => {
    if (!supabase) return null;

    try {
        // Generate unique filename
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        const fileName = `${userId}/cv-${Date.now()}.${fileExtension}`;

        console.log("Uploading CV document:", fileName, "Size:", file.size, "Type:", file.type);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('cvs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type
            });

        if (error) {
            console.error("CV document upload error:", error);
            return null;
        }

        console.log("CV document upload successful:", data);

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('cvs')
            .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
            console.error("Failed to get public URL for uploaded CV");
            return null;
        }

        // Parse CV content
        let parsedData = null;
        try {
            parsedData = await parseProfileFromCVWithFallback(file);
        } catch (parseError) {
            console.warn("CV parsing failed, but continuing with upload:", parseError);
        }

        // Create CV document record
        const cvDocument: CVDocument = {
            id: data.id,
            userId,
            fileName,
            originalName: file.name,
            fileUrl: urlData.publicUrl,
            fileSize: file.size,
            contentType: file.type,
            isActive: true, // Make new CV active by default
            parsedData: parsedData ? {
                name: parsedData.name,
                email: parsedData.email,
                phone: parsedData.phone,
                jobTitle: parsedData.jobTitle,
                skills: parsedData.skills,
                workHistory: parsedData.workHistory,
                education: parsedData.education,
                cvText: parsedData.cvText
            } : undefined,
            uploadedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };

        // Save to database
        const { error: dbError } = await supabase
            .from('cv_documents')
            .insert(cvDocument);

        if (dbError) {
            console.error("Failed to save CV document to database:", dbError);
            return null;
        }

        // Update user's current CV
        await updateUserCVSelection(userId, data.id);

        console.log("CV document saved successfully:", cvDocument);
        return cvDocument;

    } catch (error) {
        console.error("CV document upload failed:", error);
        return null;
    }
};

export const getUserCVDocuments = async (userId: string): Promise<CVDocument[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('cv_documents')
            .select('*')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error("Failed to fetch user CV documents:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Error fetching CV documents:", error);
        return [];
    }
};

export const updateUserCVSelection = async (userId: string, cvId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // First, deactivate all CVs for this user
        await supabase
            .from('cv_documents')
            .update({ is_active: false })
            .eq('user_id', userId);

        // Then activate the selected CV
        const { error } = await supabase
            .from('cv_documents')
            .update({
                is_active: true,
                last_used: new Date().toISOString()
            })
            .eq('id', cvId)
            .eq('user_id', userId);

        if (error) {
            console.error("Failed to update CV selection:", error);
            return false;
        }

        // Update user profile with parsed data from selected CV
        const { data: cvData } = await supabase
            .from('cv_documents')
            .select('parsed_data')
            .eq('id', cvId)
            .single();

        if (cvData?.parsed_data) {
            const parsedData = cvData.parsed_data as any;
            await updateUserProfile(userId, {
                name: parsedData.name,
                email: parsedData.email,
                phone: parsedData.phone,
                jobTitle: parsedData.jobTitle,
                skills: parsedData.skills || [],
                workHistory: parsedData.workHistory || [],
                education: parsedData.education || [],
                cvText: parsedData.cvText
            });
        }

        console.log("CV selection updated successfully:", cvId);
        return true;
    } catch (error) {
        console.error("Error updating CV selection:", error);
        return false;
    }
};

export const deleteCVDocument = async (userId: string, cvId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // Get CV document info first
        const { data: cvDoc } = await supabase
            .from('cv_documents')
            .select('file_url, is_active')
            .eq('id', cvId)
            .eq('user_id', userId)
            .single();

        if (!cvDoc) {
            console.error("CV document not found:", cvId);
            return false;
        }

        // Delete from storage
        const fileName = cvDoc.file_url.split('/').pop();
        if (fileName) {
            await supabase.storage
                .from('cvs')
                .remove([`${userId}/${fileName}`]);
        }

        // Delete from database
        const { error } = await supabase
            .from('cv_documents')
            .delete()
            .eq('id', cvId)
            .eq('user_id', userId);

        if (error) {
            console.error("Failed to delete CV document:", error);
            return false;
        }

        // If this was the active CV, activate another one if available
        if (cvDoc.is_active) {
            const { data: remainingCVs } = await supabase
                .from('cv_documents')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (remainingCVs && remainingCVs.length > 0) {
                await updateUserCVSelection(userId, remainingCVs[0].id);
            }
        }

        console.log("CV document deleted successfully:", cvId);
        return true;
    } catch (error) {
        console.error("Error deleting CV document:", error);
        return false;
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

            // Parse CV content
            try {
                const parsedData = await parseProfileFromCVWithFallback(file);
                console.log("CV parsed successfully:", parsedData);

                // Update user profile with parsed data
                if (parsedData && Object.keys(parsedData).length > 0) {
                    await updateUserProfile(userId, parsedData);
                    console.log("Profile updated with CV data");
                }

                // Return the URL (parsing happens in background and updates DB directly)
                return urlData.publicUrl;
            } catch (parseError) {
                console.warn("CV parsing failed, but upload succeeded:", parseError);
                // Still return the URL even if parsing fails
                return urlData.publicUrl;
            }

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
    if (updates.photo !== undefined) baseUpdates.avatar_url = updates.photo;

    const candidateUpdates: any = {};
    if (updates.phone) candidateUpdates.phone = updates.phone;
    if (updates.jobTitle) candidateUpdates.job_title = updates.jobTitle;
    if (updates.address !== undefined) candidateUpdates.address = updates.address;
    if (updates.cvText !== undefined) candidateUpdates.cv_text = updates.cvText;
    if (updates.transportMode !== undefined) candidateUpdates.transport_mode = updates.transportMode;
    if (updates.preferences !== undefined) candidateUpdates.preferences = updates.preferences;
    if (updates.skills !== undefined) {
        // Always save skills as JSON string for consistency
        candidateUpdates.skills = JSON.stringify(updates.skills);
    }
    if (updates.workHistory !== undefined) {
        candidateUpdates.work_history = JSON.stringify(updates.workHistory);
    }
    if (updates.education !== undefined) {
        candidateUpdates.education = JSON.stringify(updates.education);
    }
    if (updates.hasAssessment !== undefined) {
        baseUpdates.has_assessment = updates.hasAssessment;
    }

    const promises = [];
    if (Object.keys(baseUpdates).length > 0) {
        promises.push(supabase.from('profiles').update(baseUpdates).eq('id', userId));
    }

    // Handle CV URL update - it's part of candidate_profiles table
    if (updates.cvUrl !== undefined) {
        candidateUpdates.cv_url = updates.cvUrl;
    }

    if (Object.keys(candidateUpdates).length > 0) {
        // Use UPSERT instead of UPDATE to ensure row creation if missing
        promises.push(supabase.from('candidate_profiles').upsert({
            id: userId,
            ...candidateUpdates,
            updated_at: new Date().toISOString()
        }));
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

export const createCompany = async (profile: CompanyProfile, creatorId: string) => {
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
            created_by: creatorId,
            values: profile.values,
            philosophy: profile.philosophy
        })
        .select()
        .single();

    if (error) throw error;

    // 2. Link Creator as Admin Member
    await supabase
        .from('company_members')
        .insert({
            company_id: company.id,
            user_id: creatorId,
            role: 'admin',
            joined_at: new Date().toISOString()
        });

    return company;
};

export const getRecruiterCompany = async (userId: string): Promise<CompanyProfile | null> => {
    if (!supabase) return null;

    // Get company ID from company_members
    const { data: link } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    if (!link) return null;

    const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', link.company_id)
        .single();

    if (!company) return null;

    // Fetch members as well
    const { data: members } = await supabase
        .from('company_members')
        .select(`
            id,
            role,
            joined_at,
            profile:profiles(id, full_name, email, avatar_url)
        `)
        .eq('company_id', company.id);

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
        philosophy: company.philosophy,
        members: (members || []).map((m: any) => ({
            id: m.profile.id,
            name: m.profile.full_name,
            email: m.profile.email,
            avatar: m.profile.avatar_url,
            role: m.role,
            joinedAt: m.joined_at
        })),
        subscription: {
            tier: company.subscription_tier || 'basic',
            usage: company.usage_stats || {
                activeJobsCount: 0,
                aiAssessmentsUsed: 0,
                adOptimizationsUsed: 0
            }
        }
    };
};

export const inviteRecruiter = async (companyId: string, email: string, invitedBy: string) => {
    if (!supabase) return null;

    // In a real app we'd first check if user exists. 
    // For this flow, we'll assume we are inviting an existing profile or 
    // creating a pending invite that will be linked on signup.

    // 1. Try to find profile by email
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

    if (profile) {
        return await supabase
            .from('company_members')
            .insert({
                company_id: companyId,
                user_id: profile.id,
                role: 'recruiter',
                invited_by: invitedBy,
                is_active: true // Auto-join if profile exists for demo simplicity
            });
    }

    return null; // Handle non-existent user case (maybe send email invite)
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