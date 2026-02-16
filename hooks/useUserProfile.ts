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
    updateCompanyIndustry,
    getMarketplacePartnerByOwner,
    createMarketplacePartner
} from '../services/supabaseService';
import { fetchCsrfToken, clearCsrfToken, authenticatedFetch } from '../services/csrfService';
import { BACKEND_URL } from '../constants';
import { supabase } from '../services/supabaseClient';

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
    }
};

export const useUserProfile = () => {
    const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LIST);

    // Track in-progress session restoration to prevent duplicates
    const restorationInProgressRef = useRef<string | null>(null);

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

        restorationInProgressRef.current = userId;
        try {
            console.log(`🔄 [SessionRestoration] Starting for user: ${userId}`);

            // 1. Verify session state first
            const { isValid, error: authError } = await verifyAuthSession('handleSessionRestoration');
            if (!isValid) {
                console.warn(`🟠 [SessionRestoration] Skipped for ${userId}: ${authError}`);
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
                console.warn(`⚠️ [SessionRestoration] Profile not found for ${userId}. Retrying after short delay...`);

                // Wait briefly for triggers
                await new Promise(resolve => setTimeout(resolve, 1000));
                profile = await getUserProfile(userId);

                if (!profile) {
                    console.warn('⚠️ [SessionRestoration] Profile still missing. Attempting to create fallback profile...');

                    const { data: { user } } = await supabase.auth.getUser();
                    if (user && user.email) {
                        try {
                            const role = user.user_metadata?.role || 'candidate';
                            const name = user.user_metadata?.full_name || user.email.split('@')[0];

                            await createBaseProfile(userId, user.email, name, role);
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
                    // Get the session and validate the access token
                    const session = await supabase?.auth.getSession();
                    let accessToken = session?.data?.session?.access_token;

                    // If no token yet, that's okay - session might still be loading
                    // The authenticatedFetch function will handle getting it when needed
                    if (accessToken && typeof accessToken === 'string') {
                        console.log('Fetching CSRF token for authenticated session...');
                        await fetchCsrfToken(accessToken);
                    } else {
                        console.log('Access token not yet available - skipping CSRF fetch');
                        // This is not an error - the app will fetch CSRF token on first state-changing request
                    }
                } catch (csrfError) {
                    console.warn('⚠️ Could not fetch CSRF token:', csrfError);
                    // Don't fail session restoration if CSRF fetch fails
                    // The application can still work without CSRF token for GET requests
                }

                // --- PREPARE METADATA FLAGS ---
                // Extract metadata before any logic that depends on it
                let metaIsFreelancer = false;
                let metaIsCourseProvider = false;
                let metaRole = null;
                let metaCompany = null;
                let metaIco = null;
                let metaWebsite = null;

                if (authUser) {
                    metaRole = authUser.user_metadata?.role;
                    metaCompany = authUser.user_metadata?.company_name;
                    metaIco = authUser.user_metadata?.ico;
                    metaWebsite = authUser.user_metadata?.website;
                    metaIsFreelancer = authUser.user_metadata?.is_freelancer === true || authUser.user_metadata?.is_freelancer === 'true';
                    metaIsCourseProvider = authUser.user_metadata?.is_course_provider === true || authUser.user_metadata?.is_course_provider === 'true';
                    console.log("📋 [Metadata] Extracted:", {
                        metaRole,
                        metaCompany,
                        metaIsFreelancer,
                        metaIsCourseProvider,
                        rawIsFreelancer: authUser.user_metadata?.is_freelancer,
                        allMetadata: authUser.user_metadata
                    });
                }

                // If user registered as recruiter (via metadata) but profile says 'candidate' (default trigger), fix it.
                // Guard: only auto-fix when we also have company identifiers to avoid flipping regular users.
                const hasCompanyMeta = !!(metaCompany || metaIco || metaWebsite);
                if (metaRole === 'recruiter' && hasCompanyMeta && !metaIsFreelancer && !metaIsCourseProvider && profile.role !== 'recruiter') {
                    console.log("🛠️ Fixing profile role mismatch: Metadata says recruiter, DB says candidate. Updating...");
                    try {
                        await updateUserProfileService(userId, { role: 'recruiter' });
                        // Update local state immediately
                        profile.role = 'recruiter';
                        setUserProfile(prev => ({ ...prev, role: 'recruiter' }));
                    } catch (err) {
                        console.error("❌ Failed to auto-fix profile role:", err);
                    }
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
                        if (avatarUrl && (!profile.photo || !profile.photo.trim())) updates.photo = avatarUrl;
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

                // If they are a recruiter (or just became one), but have no company, check metadata for company name and create it.
                let company: any = null; // Declare company at function scope so it can be used later
                if (profile.role === 'recruiter') {
                    company = await getRecruiterCompany(userId);

                    // CRITICAL FIX: If freelancer/course provider but company.industry is not set, ensure it's marked
                    if (company && (metaIsFreelancer || metaIsCourseProvider) && !company.industry) {
                        const industry = metaIsFreelancer ? 'Freelancer' : 'Education';
                        console.log("🛠️ Company exists but industry is not set. Setting to:", industry);
                        company.industry = industry;
                        // Also update in database
                        try {
                            await updateCompanyIndustry(company.id, industry);
                            console.log("✅ Company industry updated in database");
                        } catch (err) {
                            console.error("⚠️ Failed to update company industry in database:", err);
                        }
                    }

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
                                industry: metaIsFreelancer ? 'Freelancer' : (metaIsCourseProvider ? 'Education' : ''),
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

                    // NOTE: Freelancer portal auto-bootstrap removed.
                    // We no longer auto-create freelancer_profiles during generic session restoration.

                    // Ensure marketplace partner row exists for course providers
                    const isCourseProvider = metaIsCourseProvider || company?.industry === 'Education';
                    if (isCourseProvider) {
                        try {
                            const existingPartner = await getMarketplacePartnerByOwner(userId);
                            if (!existingPartner) {
                                const { data: { user } } = await supabase.auth.getUser();
                                await createMarketplacePartner({
                                    name: metaCompany || company?.name || user?.user_metadata?.company_name || 'Vzdělávání',
                                    contact_email: user?.email || profile.email,
                                    website: user?.user_metadata?.website || null,
                                    partner_type: 'education',
                                    owner_id: userId,
                                    course_categories: []
                                });
                                console.log('✅ Auto-created marketplace partner profile.');
                            }
                        } catch (err) {
                            console.warn('⚠️ Failed to ensure marketplace partner profile:', err);
                        }
                    }
                }

                // Auto-Upgrade Logic for Admin Tester - REMOVED for Strict Separation conformance
                // Admin can manually switch roles if needed via DB or specific admin tool, 
                // but should not auto-convert when testing as candidate.


                // Auto-enable commute filter on restore if address exists
                if (profile.address) {
                    // Note: This will be handled by the useAppFilters hook
                }

                // --- SET VIEW STATE FOR RECRUITER/FREELANCER ---
                // At this point: metaIsFreelancer is set, profile.role is corrected, company is loaded
                // Now determine the correct viewState based on consolidated logic
                if (profile.role === 'recruiter') {
                    // User is a recruiter (or freelancer acting as recruiter)
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
                    const isNonDashboardRoute = base === 'kurzy-a-rekvalifikace'
                        || base === 'sluzby'
                        || base === 'ulozene'
                        || base === 'assessment-centrum'
                        || base === 'profil'
                        || base === 'pro-firmy'
                        || base === 'freelancer-dashboard'
                        || base === 'company-dashboard'
                        || base === 'dashboard'
                        || base === 'course-provider-dashboard'
                        || isBlogDetail;

                    // Only set dashboard view if we're on the root route (no explicit page)
                    if (!isJobDetail && !isExternalPage && !isNonDashboardRoute && parts.length === 0) {
                        console.log("🔍 [ViewState Decision] metaIsFreelancer:", metaIsFreelancer, "company.industry:", company?.industry);
                        
                        // Check if course provider by metadata OR by company industry
                        const isCourseProvider = metaIsCourseProvider || company?.industry === 'Education';
                        const isFreelancer = metaIsFreelancer || company?.industry === 'Freelancer';

                        // Do not auto-navigate on login; stay on current view.
                        if (isCourseProvider) {
                            console.log("✅ Course provider logged in, keeping current view (no auto navigation).");
                        } else if (isFreelancer) {
                            console.log("✅ Freelancer logged in, keeping current view (dashboard disabled).");
                        } else {
                            if (company) {
                                console.log("✅ Recruiter logged in, keeping current view (no auto navigation).");
                            } else {
                                console.log("✅ Recruiter without company, keeping current view (no auto onboarding).");
                            }
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
                localStorage.removeItem('sb-auth-token');
            }
        } finally {
            clearCsrfToken();  // Clear CSRF token on logout
            setUserProfile(DEFAULT_USER_PROFILE);
            setCompanyProfile(null);
            setViewState(ViewState.LIST);

            // Final safety net: clear the specific Supabase storage key if it still exists
            if (localStorage.getItem('sb-auth-token')) {
                localStorage.removeItem('sb-auth-token');
            }

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
