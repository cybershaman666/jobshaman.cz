import { useState } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import { signOut, getUserProfile, getRecruiterCompany, updateUserProfile as updateUserProfileService, createCompany } from '../services/supabaseService';
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

    // Session restoration and profile management
    const handleSessionRestoration = async (userId: string) => {
        try {
            console.log('🔄 handleSessionRestoration called with userId:', userId);
            let profile = await getUserProfile(userId);

            // Fallback: If profile doesn't exist but we have a session (e.g., DB trigger lag), create it now.
            if (!profile && supabase) {
                // VERIFY SESSION FIRST: Don't create profile if no user is actually logged in
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.log('⚠️ No active session found. Skipping fallback profile creation.');
                    return; // Exit early if no user
                }

                console.warn('⚠️ Profile not found for existing user. Attempting to create fallback profile...');
                if (user.email) {
                    try {
                        // Use metadata role if available, otherwise default to candidate
                        const role = user.user_metadata?.role || 'candidate';
                        const name = user.user_metadata?.full_name || user.email.split('@')[0];

                        await import('../services/supabaseService').then(m => m.createBaseProfile(userId, user.email!, name, role));
                        profile = await getUserProfile(userId); // Retry fetch
                        console.log('✅ Fallback profile created and loaded:', profile?.id);
                    } catch (createErr) {
                        console.error('❌ Failed to create fallback profile:', createErr);
                    }
                }
            }

            console.log('Profile returned from getUserProfile:', { id: profile?.id, email: profile?.email, isLoggedIn: profile?.isLoggedIn });

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
                                    logo_url: ''
                                };
                                company = await createCompany(newCompanyData, userId);
                                console.log("✅ Company auto-created from metadata:", company?.id);
                            } catch (err) {
                                console.error("❌ Failed to auto-create company from metadata:", err);
                            }
                        }

                        if (company) {
                            setCompanyProfile(company);
                            const pathname = window.location.pathname;
                            if (!pathname.startsWith('/jobs/') && pathname !== '/podminky-uziti' && pathname !== '/ochrana-osobnich-udaju' && pathname !== '/enterprise' && !pathname.startsWith('/assessment/')) {
                                setViewState(ViewState.COMPANY_DASHBOARD);
                            }
                        }
                    }
                }
                // --- NEW AUTO-RECOVERY LOGIC END ---

                // Auto-Upgrade Logic for Admin Tester - REMOVED for Strict Separation conformance
                // Admin can manually switch roles if needed via DB or specific admin tool, 
                // but should not auto-convert when testing as candidate.

                // Auto-initialize coordinates for test user if missing (Brno coordinates)
                if (profile.email === 'misahlavacu@gmail.com' && !profile.coordinates) {
                    console.log("🌍 Auto-initializing test user coordinates (Brno)...");
                    const brnoCoords = { lat: 49.1922, lon: 16.6113 };
                    try {
                        await updateUserProfileService(userId, {
                            address: 'Brno, Česká republika',
                            coordinates: brnoCoords
                        });
                        // Update local state
                        setUserProfile(prev => ({
                            ...prev,
                            address: 'Brno, Česká republika',
                            coordinates: brnoCoords
                        }));
                        console.log("✅ Test user coordinates initialized:", brnoCoords);
                    } catch (err) {
                        console.error("❌ Failed to initialize coordinates:", err);
                    }
                }

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
                            setViewState(ViewState.COMPANY_DASHBOARD);
                            console.log("✅ Recruiter logged in, dashboard loaded.");
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