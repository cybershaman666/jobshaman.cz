import { useState, useRef } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import { signOut, getUserProfile, getRecruiterCompany, updateUserProfile as updateUserProfileService, createCompany, verifyAuthSession } from '../services/supabaseService';
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

                            const { createBaseProfile } = await import('../services/supabaseService');
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

                // --- NEW AUTO-RECOVERY LOGIC START ---
                // If user registered as recruiter (via metadata) but profile says 'candidate' (default trigger), fix it.
                if (supabase) {
                    const { data: { user } } = await supabase.auth.getUser();
                    const metaRole = user?.user_metadata?.role;
                    const metaCompany = user?.user_metadata?.company_name;
                    const metaIco = user?.user_metadata?.ico;
                    const metaWebsite = user?.user_metadata?.website;
                    const metaIsFreelancer = user?.user_metadata?.is_freelancer === true || user?.user_metadata?.is_freelancer === 'true';

                    if (metaRole === 'recruiter' && profile.role !== 'recruiter') {
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

                    // If they are a recruiter (or just became one), but have no company, check metadata for company name and create it.
                    if (profile.role === 'recruiter') {
                        let company = await getRecruiterCompany(userId);

                        if (!company && metaCompany) {
                            console.log("🛠️ Recruiter has no company, but metadata has company_name. Auto-creating company...");
                            try {
                                const newCompanyData = {
                                    name: metaCompany,
                                    // Use metadata values if available
                                    ico: metaIco || '',
                                    address: '',
                                    description: '',
                                    contact_email: user?.email,
                                    contact_phone: '',
                                    website: metaWebsite || '',
                                    industry: metaIsFreelancer ? 'Freelancer' : '',
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
                            const pathname = window.location.pathname;
                            if (!pathname.startsWith('/jobs/') && pathname !== '/podminky-uziti' && pathname !== '/ochrana-osobnich-udaju' && pathname !== '/enterprise' && !pathname.startsWith('/assessment/')) {
                                // If metadata marks user as freelancer, prefer freelancer dashboard
                                if (metaIsFreelancer) {
                                    setViewState(ViewState.FREELANCER_DASHBOARD);
                                } else {
                                    setViewState(ViewState.COMPANY_DASHBOARD);
                                }
                            }
                        }
                    }
                }
                // --- NEW AUTO-RECOVERY LOGIC END ---

                // Auto-Upgrade Logic for Admin Tester - REMOVED for Strict Separation conformance
                // Admin can manually switch roles if needed via DB or specific admin tool, 
                // but should not auto-convert when testing as candidate.


                // Auto-enable commute filter on restore if address exists
                if (profile.address) {
                    // Note: This will be handled by the useAppFilters hook
                }

                // --- STRICT ROLE SEPARATION ---
                // Only load company data if the user is explicitly a recruiter
                if (profile.role === 'recruiter') {
                    const company = await getRecruiterCompany(userId);
                    if (company) {
                        setCompanyProfile(company);
                        // Force view state to dashboard if they are a recruiter logging in
                        // unless they are on a specific page that allows otherwise (like job detail or marketplace)
                        const pathname = window.location.pathname;
                        const isJobDetail = pathname.startsWith('/jobs/');
                        const isExternalPage = pathname === '/podminky-uziti' || pathname === '/ochrana-osobnich-udaju' || pathname === '/enterprise' || pathname.startsWith('/assessment/');

                        if (!isJobDetail && !isExternalPage) {
                            if (metaIsFreelancer || company.industry === 'Freelancer') {
                                setViewState(ViewState.FREELANCER_DASHBOARD);
                            } else {
                                setViewState(ViewState.COMPANY_DASHBOARD);
                            }
                            console.log("✅ Recruiter/Freelancer logged in, dashboard loaded.");
                        } else {
                            console.log("🔗 Recruiter logged in on deep link/external page, maintaining current view.");
                        }
                    }
                    else {
                        // Recruiter without company? They might need to finish onboarding
                        console.log("⚠️ Recruiter role but no company found.");
                    }
                } else {
                    // Start as candidate
                    setCompanyProfile(null);
                    // Ensure view state isn't stuck on dashboard
                    if (viewState === ViewState.COMPANY_DASHBOARD) {
                        setViewState(ViewState.LIST);
                    }
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