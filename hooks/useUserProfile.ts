import { useState, useRef } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import {
    signOut,
    getUserProfile,
    getRecruiterCompany,
    updateUserProfile as updateUserProfileService,
    createCompany,
    verifyAuthSession,
    createBaseProfile,
    isSupabaseNetworkCooldownActive
} from '../services/supabaseService';
import { refreshCsrfTokenIfNeeded, clearCsrfToken, authenticatedFetch, isBackendNetworkCooldownActive } from '../services/csrfService';
import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { supabase } from '../services/supabaseClient';
import { clearSupabaseAuthStorage } from '../services/supabaseClient';
import { createDefaultJHIPreferences, createDefaultTaxProfileByCountry } from '../services/profileDefaults';

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
    id: undefined,
    isLoggedIn: false,
    name: '',
    email: '',
    address: '',
    transportMode: 'public',
    preferences: {
        workLifeBalance: 50,
        financialGoals: 50,
        commuteTolerance: 45,
        priorities: []
    },
    taxProfile: createDefaultTaxProfileByCountry('CZ'),
    jhiPreferences: createDefaultJHIPreferences()
};

const normalizeOrigin = (value: string): string => {
    try {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(withProtocol).origin;
    } catch {
        return '';
    }
};

const hasDedicatedSearchRuntime = (): boolean => {
    const searchOrigin = normalizeOrigin(SEARCH_BACKEND_URL || '');
    const coreOrigin = normalizeOrigin(BACKEND_URL || '');
    return !!searchOrigin && !!coreOrigin && searchOrigin !== coreOrigin;
};

const isExternalProfilePhotoUrl = (url?: string | null): boolean => {
    if (!url) return false;
    const value = url.toLowerCase();
    if (value.includes('/profile-photos/')) return false;
    if (value.includes('/avatars/')) return false;
    return value.startsWith('http://') || value.startsWith('https://');
};

const isLegacyFreelancerResidueCompany = (company: any | null | undefined): boolean => {
    if (!company) return false;
    const industry = String(company?.industry || '').trim().toLowerCase();
    const name = String(company?.name || '').trim().toLowerCase();
    const hasLegacyIndustry = industry === 'freelancer' || industry === 'freelance';
    const hasLegacyName = name.includes('freelancer') || name.includes('freelance');
    const hasNoRealBusinessSignals = !company?.website && !company?.ico && !company?.description;
    return (hasLegacyIndustry || hasLegacyName) && hasNoRealBusinessSignals;
};

export const useUserProfile = () => {
    const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LIST);

    // Track in-progress session restoration to prevent duplicates
    const restorationInProgressRef = useRef<string | null>(null);
    // Avoid repeated restore runs for the same user caused by INITIAL_SESSION + SIGNED_IN bursts.
    const lastSuccessfulRestorationRef = useRef<{ userId: string; at: number } | null>(null);
    const RESTORATION_DEDUPE_WINDOW_MS = 60_000;
    const attemptedPhotoImportsRef = useRef<Set<string>>(new Set());

    const importProfilePhotoFromUrl = async (url: string): Promise<string | null> => {
        if (!url || attemptedPhotoImportsRef.current.has(url)) return null;
        attemptedPhotoImportsRef.current.add(url);
        try {
            const response = await authenticatedFetch(`${BACKEND_URL}/profile/photo/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json().catch(() => ({}));
            return data.photo_url || null;
        } catch (err) {
            console.warn('⚠️ Profile photo import failed:', err);
            return null;
        }
    };

    // Session restoration and profile management
    const handleSessionRestoration = async (userId: string) => {
        // Double check we have a userId
        if (!userId) {
            console.error('❌ handleSessionRestoration called without userId');
            return;
        }

        // Deduplicate: if already restoring this user, skip
        if (restorationInProgressRef.current === userId) {
            console.log('⏭️ Session restoration already in progress for', userId);
            return;
        }

        // Deduplicate: if same user was already restored very recently, skip redundant run.
        if (
            lastSuccessfulRestorationRef.current?.userId === userId &&
            (Date.now() - lastSuccessfulRestorationRef.current.at) < RESTORATION_DEDUPE_WINDOW_MS
        ) {
            console.log('⏭️ Session restoration skipped (recently completed) for', userId);
            return;
        }

        restorationInProgressRef.current = userId;
        try {
            console.log(`🔄 [SessionRestoration] Starting for user: ${userId}`);

            // 1. Verify session state first
            const { isValid, error: authError } = await verifyAuthSession('handleSessionRestoration');
            if (!isValid) {
                const authErrorMsg = String(authError || '').toLowerCase();
                const isCooldownSkip = authErrorMsg.includes('cooldown') || authErrorMsg.includes('network');
                if (!isCooldownSkip) {
                    console.warn(`🟠 [SessionRestoration] Skipped for ${userId}: ${authError}`);
                }
                restorationInProgressRef.current = null;
                return;
            }

            // Block unconfirmed emails from entering the app
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser && !authUser.email_confirmed_at) {
                console.warn('🟠 [SessionRestoration] Email not confirmed. Signing out.');
                await signOut();
                setUserProfile(DEFAULT_USER_PROFILE);
                setCompanyProfile(null);
                setViewState(ViewState.LIST);
                restorationInProgressRef.current = null;
                return;
            }

            // 2. Try to fetch profile
            let profile = await getUserProfile(userId);

            // Fallback: If profile doesn't exist but we have a session (e.g., DB trigger lag), create it now.
            if (!profile && supabase) {
                if (isSupabaseNetworkCooldownActive()) {
                    restorationInProgressRef.current = null;
                    return;
                }
                console.warn(`⚠️ [SessionRestoration] Profile not found for ${userId}. Retrying after short delay...`);

                // Wait briefly for triggers
                await new Promise(resolve => setTimeout(resolve, 1000));
                profile = await getUserProfile(userId);

                if (!profile) {
                    console.warn('⚠️ [SessionRestoration] Profile still missing. Attempting to create fallback profile...');

                    const { data: { user } } = await supabase.auth.getUser();
                    if (user && user.email) {
                        try {
                            // Do not trust auth metadata role here.
                            // This fallback path is for missing-profile recovery and must avoid
                            // resurrecting stale recruiter flags from legacy accounts.
                            const role: UserProfile['role'] = 'candidate';
                            const name = user.user_metadata?.full_name || user.email.split('@')[0];

                            await createBaseProfile(
                                userId,
                                user.email,
                                name,
                                role,
                                user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined
                            );
                            profile = await getUserProfile(userId); // Retry fetch
                            console.log('✅ [SessionRestoration] Fallback profile created and loaded:', profile?.id);
                        } catch (createErr) {
                            console.error('❌ [SessionRestoration] Failed to create fallback profile:', createErr);
                        }
                    } else {
                        console.error('❌ [SessionRestoration] Cannot create fallback: User data missing');
                    }
                }
            }

            console.log('[SessionRestoration] Result:', {
                found: !!profile,
                id: profile?.id,
                isLoggedIn: profile?.isLoggedIn
            });

            if (profile) {
                console.log('Setting user profile with id:', profile.id);
                setUserProfile(prev => {
                    const updated = {
                        ...prev,
                        ...profile,
                        isLoggedIn: true
                    };
                    console.log('Updated profile state - id now:', updated.id);
                    return updated;
                });

                // CSRF: Fetch CSRF token after successful session restoration
                try {
                    // With dedicated search runtime, avoid eager CSRF prefetch against the core backend.
                    // CSRF token will be fetched lazily only for endpoints that require it.
                    if (!hasDedicatedSearchRuntime()) {
                        if (isBackendNetworkCooldownActive()) {
                            throw new Error('Backend cooldown active');
                        }
                        // Get the session and validate the access token
                        const session = await supabase?.auth.getSession();
                        let accessToken = session?.data?.session?.access_token;

                        // If no token yet, that's okay - session might still be loading
                        // The authenticatedFetch function will handle getting it when needed
                        if (accessToken && typeof accessToken === 'string') {
                            console.log('Fetching CSRF token for authenticated session...');
                            await refreshCsrfTokenIfNeeded(accessToken);
                        } else {
                            console.log('Access token not yet available - skipping CSRF fetch');
                            // This is not an error - the app will fetch CSRF token on first state-changing request
                        }
                    } else {
                        console.log('Dedicated search backend detected - skipping eager CSRF prefetch.');
                    }
                } catch (csrfError) {
                    console.warn('⚠️ Could not fetch CSRF token:', csrfError);
                    // Don't fail session restoration if CSRF fetch fails
                    // The application can still work without CSRF token for GET requests
                }

                // --- PREPARE METADATA FIELDS ---
                let metaRole = null;
                let metaCompany = null;
                let metaIco = null;
                let metaWebsite = null;

                if (authUser) {
                    metaRole = authUser.user_metadata?.role;
                    metaCompany = authUser.user_metadata?.company_name;
                    metaIco = authUser.user_metadata?.ico;
                    metaWebsite = authUser.user_metadata?.website;
                    console.log("📋 [Metadata] Extracted:", {
                        metaRole,
                        metaCompany,
                        allMetadata: authUser.user_metadata
                    });
                }

                // IMPORTANT: Do not auto-overwrite DB role from auth metadata.
                // Legacy metadata (e.g. old recruiter residue) can be stale and
                // should not force candidate profiles back to recruiter on every login.
                if (metaRole === 'recruiter' && profile.role !== 'recruiter') {
                    console.log("ℹ️ Metadata role= re recruiter detected, but preserving DB profile role:", profile.role);
                }

                // Auto-fill missing profile fields from LinkedIn OAuth metadata
                try {
                    const provider = authUser?.app_metadata?.provider;
                    const isLinkedInProvider = provider === 'linkedin_oidc';
                    if (isLinkedInProvider && authUser?.user_metadata) {
                        const meta = authUser.user_metadata as Record<string, unknown>;
                        const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
                        const fallbackName = [clean(meta.given_name), clean(meta.family_name)].filter(Boolean).join(' ');
                        const fullName = clean(meta.full_name) || clean(meta.name) || fallbackName;
                        const avatarUrl = clean(meta.avatar_url) || clean(meta.picture);
                        const headline = clean(meta.headline) || clean(meta.title) || clean(meta.job_title);

                        const updates: Partial<UserProfile> = {};
                        if (fullName && (!profile.name || !profile.name.trim())) updates.name = fullName;
                        if (avatarUrl && (!profile.photo || !profile.photo.trim())) {
                            const importedUrl = isExternalProfilePhotoUrl(avatarUrl)
                                ? await importProfilePhotoFromUrl(avatarUrl)
                                : null;
                            updates.photo = importedUrl || avatarUrl;
                        }
                        if (headline && (!profile.jobTitle || !profile.jobTitle.trim())) updates.jobTitle = headline;

                        if (Object.keys(updates).length > 0) {
                            await updateUserProfileService(userId, updates);
                            profile = { ...profile, ...updates };
                            setUserProfile(prev => ({ ...prev, ...updates }));
                            console.log('✅ LinkedIn metadata applied to profile.');
                        }
                    }
                } catch (err) {
                    console.warn('⚠️ LinkedIn metadata sync failed:', err);
                }

                // Attempt to import external profile photo (Google/LinkedIn) into our storage
                if (profile.photo && isExternalProfilePhotoUrl(profile.photo)) {
                    const importedUrl = await importProfilePhotoFromUrl(profile.photo);
                    if (importedUrl) {
                        try {
                            await updateUserProfileService(userId, { photo: importedUrl });
                            profile = { ...profile, photo: importedUrl };
                            setUserProfile(prev => ({ ...prev, photo: importedUrl }));
                            console.log('✅ External profile photo imported.');
                        } catch (err) {
                            console.warn('⚠️ Failed to persist imported profile photo:', err);
                        }
                    }
                }

                // If they are a recruiter (or just became one), but have no company, check metadata for company name and create it.
                let company: any = null; // Declare company at function scope so it can be used later
                if (profile.role === 'recruiter') {
                    company = await getRecruiterCompany(userId);

                    if (!company && metaCompany) {
                        console.log("🛠️ Recruiter has no company, but metadata has company_name. Auto-creating company...");
                        try {
                            const newCompanyData = {
                                name: metaCompany,
                                // Use metadata values if available
                                ico: metaIco || '',
                                address: '',
                                description: '',
                                contact_email: supabase ? (await supabase.auth.getUser()).data.user?.email : undefined,
                                contact_phone: '',
                                website: metaWebsite || '',
                                // Do not infer industry from legacy auth metadata flags.
                                industry: '',
                                logo_url: ''
                            };

                            // createCompany in supabaseService now handles duplicates by ICO/owner_id
                            company = await createCompany(newCompanyData, userId);
                            console.log("✅ Company auto-created or retrieved from metadata:", company?.id);
                        } catch (err) {
                            console.error("❌ Failed to auto-create company from metadata:", err);
                        }
                    }

                    if (company) {
                        setCompanyProfile(company);
                    }
                }

                // Legacy cleanup: some candidate accounts were historically auto-linked to
                // placeholder "Freelancer" companies. Treat these as candidate accounts.
                if (profile.role === 'recruiter' && isLegacyFreelancerResidueCompany(company)) {
                    console.warn('🧹 Legacy freelancer company residue detected. Reverting user role to candidate.');
                    profile = { ...profile, role: 'candidate' };
                    setCompanyProfile(null);
                    setUserProfile(prev => ({ ...prev, role: 'candidate' }));
                    try {
                        await updateUserProfileService(userId, { role: 'candidate' });
                    } catch (err) {
                        console.warn('⚠️ Failed to persist role reset to candidate:', err);
                    }
                    company = null;
                }

                // Auto-Upgrade Logic for Admin Tester - REMOVED for Strict Separation conformance
                // Admin can manually switch roles if needed via DB or specific admin tool, 
                // but should not auto-convert when testing as candidate.


                // Auto-enable commute filter on restore if address exists
                if (profile.address) {
                    // Note: This will be handled by the useAppFilters hook
                }

                // --- SET VIEW STATE FOR RECRUITER ---
                // At this point profile.role is corrected and company is loaded.
                if (profile.role === 'recruiter') {
                    // User is a recruiter
                    const supported = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
                    const parts = window.location.pathname.split('/').filter(Boolean);
                    if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
                    const base = parts[0] || '';
                    const isJobDetail = base === 'jobs' && !!parts[1];
                    const isBlogDetail = base === 'blog' && !!parts[1];
                    const isExternalPage = base === 'podminky-uziti'
                        || base === 'ochrana-osobnich-udaju'
                        || base === 'enterprise'
                        || base === 'assessment';
                    const isNonDashboardRoute = base === 'ulozene'
                        || base === 'assessment-centrum'
                        || base === 'profil'
                        || base === 'pro-firmy'
                        || base === 'company-dashboard'
                        || base === 'dashboard'
                        || isBlogDetail;

                    // Only set dashboard view if we're on the root route (no explicit page)
                    if (!isJobDetail && !isExternalPage && !isNonDashboardRoute && parts.length === 0) {
                        console.log("🔍 [ViewState Decision] company.industry:", company?.industry);
                        
                        // Do not auto-navigate on login; stay on current view.
                        if (company) {
                            console.log("✅ Recruiter logged in, keeping current view (no auto navigation).");
                        } else {
                            console.log("✅ Recruiter without company, keeping current view (no auto onboarding).");
                        }
                    } else {
                        console.log("🔗 Logged in on explicit route, maintaining current view.");
                    }
                } else {
                    // Candidate: no company profile, no dashboard
                    setCompanyProfile(null);
                    // Ensure view state isn't stuck on dashboard
                    if (viewState === ViewState.COMPANY_DASHBOARD) {
                        setViewState(ViewState.LIST);
                    }
                    console.log("✅ Candidate logged in, keeping current view.");
                }

                lastSuccessfulRestorationRef.current = { userId, at: Date.now() };
            }
        } catch (error) {
            console.error('Session restoration failed:', error);
        } finally {
            restorationInProgressRef.current = null;
        }
    };

    const updateUserProfileState = (updates: Partial<UserProfile>) => {
        setUserProfile(prev => ({ ...prev, ...updates }));
    };

    const signOutUser = async () => {
        console.log('🚪 signing out user...');
        try {
            await signOut();
            console.log('✅ Supabase signout successful');
        } catch (error: any) {
            console.error('❌ Supabase signout failed:', error);
            // If it's a refresh token error, we MUST clear local storage manually
            // to prevent the client from trying to use the invalid token again.
            if (error?.message?.includes('Refresh Token') || error?.message?.includes('Invalid Refresh Token')) {
                console.log('🧹 Manual storage cleanup due to refresh token error');
                clearSupabaseAuthStorage();
            }
        } finally {
            clearCsrfToken();  // Clear CSRF token on logout
            setUserProfile(DEFAULT_USER_PROFILE);
            setCompanyProfile(null);
            setViewState(ViewState.LIST);
            lastSuccessfulRestorationRef.current = null;

            // Final safety net: clear the specific Supabase storage key if it still exists
            clearSupabaseAuthStorage();

            console.log('🧹 Local auth state and storage cleared');
        }
    };

    const deleteAccount = async () => {
        console.log('🗑️ Attempting to delete account...');
        try {
            const response = await authenticatedFetch(`${BACKEND_URL}/account`, {
                method: 'DELETE'
            });

            if (response.ok) {
                console.log('✅ Account successfully deleted on backend');
                await signOutUser();
                return true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Account deletion failed:', errorData);
                return false;
            }
        } catch (error) {
            console.error('❌ Error during account deletion:', error);
            return false;
        }
    };

    return {
        userProfile,
        companyProfile,
        viewState,
        setViewState,
        setUserProfile: updateUserProfileState,
        setCompanyProfile,
        signOut: signOutUser,
        deleteAccount,
        handleSessionRestoration
    };
};
