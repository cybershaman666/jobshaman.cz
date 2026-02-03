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

                // --- PREPARE METADATA FLAGS ---
                // Extract metadata before any logic that depends on it
                let metaIsFreelancer = false;
                let metaRole = null;
                let metaCompany = null;
                let metaIco = null;
                let metaWebsite = null;

                if (supabase) {
                    const { data: { user } } = await supabase.auth.getUser();
                    metaRole = user?.user_metadata?.role;
                    metaCompany = user?.user_metadata?.company_name;
                    metaIco = user?.user_metadata?.ico;
                    metaWebsite = user?.user_metadata?.website;
                    metaIsFreelancer = user?.user_metadata?.is_freelancer === true || user?.user_metadata?.is_freelancer === 'true';
                    console.log("📋 [Metadata] Extracted:", {
                        metaRole,
                        metaCompany,
                        metaIsFreelancer,
                        rawIsFreelancer: user?.user_metadata?.is_freelancer,
                        allMetadata: user?.user_metadata
                    });
                }

                // If user registered as recruiter (via metadata) but profile says 'candidate' (default trigger), fix it.
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
                let company: any = null; // Declare company at function scope so it can be used later
                if (profile.role === 'recruiter') {
                    company = await getRecruiterCompany(userId);

                    // CRITICAL FIX: If freelancer but company.industry is not set, ensure it's marked as 'Freelancer'
                    if (company && metaIsFreelancer && !company.industry) {
                        console.log("🛠️ Freelancer company exists but industry is not set. Setting to 'Freelancer'...");
                        company.industry = 'Freelancer';
                        // Also update in database
                        try {
                            const { updateCompanyIndustry } = await import('../services/supabaseService');
                            await updateCompanyIndustry(company.id, 'Freelancer');
                            console.log("✅ Company industry updated to 'Freelancer' in database");
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
                    }

                    // Ensure freelancer_profiles row exists for freelancer companies
                    const isFreelancer = metaIsFreelancer || company?.industry === 'Freelancer';
                    if (isFreelancer) {
                        try {
                            const { getFreelancerProfile, createFreelancerProfile } = await import('../services/supabaseService');
                            const existingFreelancer = await getFreelancerProfile(userId);
                            if (!existingFreelancer) {
                                const { data: { user } } = await supabase.auth.getUser();
                                await createFreelancerProfile(userId, {
                                    contact_email: user?.email || profile.email || null,
                                    website: user?.user_metadata?.website || null,
                                    presentation: '',
                                    work_type: 'remote'
                                });
                                console.log('✅ Auto-created freelancer profile for marketplace visibility.');
                            }
                        } catch (err) {
                            console.warn('⚠️ Failed to ensure freelancer profile:', err);
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
                    const pathname = window.location.pathname;
                    const isJobDetail = pathname.startsWith('/jobs/');
                    const isExternalPage = pathname === '/podminky-uziti' || pathname === '/ochrana-osobnich-udaju' || pathname === '/enterprise' || pathname.startsWith('/assessment/');

                    // Only set dashboard view if not on special pages
                    if (!isJobDetail && !isExternalPage) {
                        console.log("🔍 [ViewState Decision] metaIsFreelancer:", metaIsFreelancer, "company.industry:", company?.industry);
                        
                        // Check if freelancer by metadata OR by company industry
                        const isFreelancer = metaIsFreelancer || company?.industry === 'Freelancer';
                        
                        if (isFreelancer) {
                            // Freelancers ALWAYS go to FREELANCER_DASHBOARD
                            setViewState(ViewState.FREELANCER_DASHBOARD);
                            console.log("✅ Freelancer logged in, FREELANCER_DASHBOARD set.");
                        } else {
                            // Regular recruiters go to COMPANY_DASHBOARD
                            setViewState(ViewState.COMPANY_DASHBOARD);
                            console.log("✅ Recruiter logged in, COMPANY_DASHBOARD set.");
                        }
                    } else {
                        console.log("🔗 Logged in on deep link/external page, maintaining current view.");
                    }
                } else {
                    // Candidate: no company profile, no dashboard
                    setCompanyProfile(null);
                    // Ensure view state isn't stuck on dashboard
                    if (viewState === ViewState.COMPANY_DASHBOARD) {
                        setViewState(ViewState.LIST);
                    }
                    console.log("✅ Candidate logged in, view state set to LIST.");
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
