import type { CompanyProfile, CVDocument, UserProfile } from '../types';
import ApiService from './apiService';
import { getSupabaseClient } from './supabaseClient';
import { uploadV2Asset } from './v2AssetService';

const PENDING_AUTH_CONSENT_KEY = 'jobshaman_v2_pending_auth_consent';

const toProfile = (payload: any): UserProfile | null => {
  const user = payload?.data?.user;
  const profile = payload?.data?.profile;
  if (!user) return null;

  let preferences = profile?.preferences;
  if (typeof preferences === 'string') {
    try {
      preferences = JSON.parse(preferences);
    } catch {
      preferences = {};
    }
  }
  const migrated = preferences?.v2_migration?.legacy_profile || {};

  return {
    id: user.supabase_id || user.id,
    email: user.email || '',
    name: profile?.full_name || user.email || '',
    role: user.role === 'recruiter' ? 'recruiter' : 'candidate',
    isLoggedIn: true,
    transportMode: 'public',
    slots: 5,
    activeHandshakes: [],
    address: profile?.location || '',
    bio: profile?.bio || '',
    story: profile?.bio || '',
    jobTitle: migrated.job_title || '',
    phone: migrated.phone || '',
    cvText: migrated.cv_text || '',
    cvAiText: migrated.cv_ai_text || '',
    cvUrl: migrated.cv_url || '',
    skills: Array.isArray(profile?.skills) ? profile.skills : tryParseJsonArray(profile?.skills),
    workHistory: Array.isArray(migrated.work_history) ? migrated.work_history : [],
    education: Array.isArray(migrated.education) ? migrated.education : [],
    strengths: Array.isArray(migrated.strengths) ? migrated.strengths : [],
    values: Array.isArray(migrated.values) ? migrated.values : [],
    motivations: Array.isArray(migrated.motivations) ? migrated.motivations : [],
    workPreferences: Array.isArray(migrated.work_preferences) ? migrated.work_preferences : [],
    inferredSkills: Array.isArray(migrated.inferred_skills) ? migrated.inferred_skills : [],
    photo: profile?.avatar_url || '',
    preferences: preferences || {},
    taxProfile: preferences?.taxProfile,
    jhiPreferences: preferences?.jhiPreferences,
  } as unknown as UserProfile;
};

const tryParseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const verifyAuthSession = async (_context?: string): Promise<{ isValid: boolean }> => {
  const supabase = getSupabaseClient();
  const session = await supabase?.auth.getSession();
  return { isValid: Boolean(session?.data?.session?.access_token) };
};

export const signInWithEmail = async (email: string, pass: string) => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase auth is not configured');
  return supabase.auth.signInWithPassword({ email, password: pass });
};

export const signUpWithEmail = async (
  email: string,
  pass: string,
  fullName?: string,
  _role?: UserProfile['role'],
  _timezone?: string,
  consent?: Record<string, unknown>,
) => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase auth is not configured');
  savePendingAuthConsent(consent || {});
  return supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
};

export const signInWithOAuthProvider = async (provider: 'google' | 'linkedin_oidc') => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase auth is not configured');
  return supabase.auth.signInWithOAuth({ provider });
};

export const signOut = async () => {
  const supabase = getSupabaseClient();
  await supabase?.auth.signOut();
};

export const getUserProfile = async (_userId: string): Promise<UserProfile | null> => {
  try {
    const payload = await ApiService.get<any>('/candidate/profile/me');
    return toProfile(payload);
  } catch (error) {
    console.warn('Failed to load V2 profile', error);
    return null;
  }
};

export const updateUserProfile = async (_userId: string, updates: Partial<UserProfile>): Promise<void> => {
  await ApiService.patch('/candidate/profile/me', updates);
};

export const createBaseProfile = async (
  _userId: string,
  email: string,
  name: string,
  role: UserProfile['role'] = 'candidate',
) => {
  await ApiService.patch('/candidate/profile/me', { email, name, role });
};

export const isSupabaseNetworkCooldownActive = () => false;

export const savePendingAuthConsent = (consent: Record<string, unknown>) => {
  try {
    window.localStorage.setItem(PENDING_AUTH_CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // Consent metadata is best-effort until the profile API can persist it.
  }
};

export const consumePendingAuthConsent = async (_userId: string): Promise<boolean> => {
  try {
    const raw = window.localStorage.getItem(PENDING_AUTH_CONSENT_KEY);
    if (!raw) return false;
    window.localStorage.removeItem(PENDING_AUTH_CONSENT_KEY);
    await ApiService.patch('/candidate/profile/me', { authConsent: JSON.parse(raw) });
    return true;
  } catch {
    return false;
  }
};

export const getRecruiterCompany = async (_userId: string): Promise<CompanyProfile | null> => {
  const response = await ApiService.get<any>('/company/me');
  return response?.data || null;
};

export const createCompany = async (companyData: any, _userId?: string): Promise<any> => {
  const response = await ApiService.post<any>('/company', companyData);
  return response?.data || null;
};

export const updateCompanyProfile = async (companyId: string, updates: Partial<Record<string, any>>) => {
  const response = await ApiService.patch<any>(`/company/${encodeURIComponent(companyId)}`, updates);
  return response?.data || null;
};

export const getUserCVDocuments = async (_userId: string): Promise<CVDocument[]> => {
  const response = await ApiService.get<any>('/candidate/cv');
  return Array.isArray(response?.data) ? response.data : [];
};

export const updateUserCVSelection = async (_userId: string, cvId: string): Promise<boolean> => {
  await ApiService.patch(`/candidate/cv/${encodeURIComponent(cvId)}`, { isActive: true });
  return true;
};

export const deleteCVDocument = async (_userId: string, cvId: string): Promise<boolean> => {
  await ApiService.delete(`/candidate/cv/${encodeURIComponent(cvId)}`);
  return true;
};

export const updateCVDocumentParsedData = async (
  _userId: string,
  cvId: string,
  updates: Partial<CVDocument> | Record<string, unknown>,
): Promise<boolean> => {
  await ApiService.patch(`/candidate/cv/${encodeURIComponent(cvId)}`, { parsedData: updates });
  return true;
};

export const uploadApplicationMessageAttachment = async (_userId?: string, _file?: File) => {
  if (!_file) throw new Error('Missing attachment file');
  return uploadV2Asset(_file, {
    kind: 'dialogue_attachment',
    usage: 'application_message_attachment',
    visibility: 'private',
  });
};

export const uploadUserProfilePhoto = async (_userId?: string, _file?: File) => {
  if (!_file) throw new Error('Missing profile photo');
  const asset = await uploadV2Asset(_file, {
    kind: 'profile_photo',
    usage: 'candidate_profile_avatar',
    visibility: 'private',
  });
  return asset.url;
};
