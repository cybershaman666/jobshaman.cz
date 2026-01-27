import { useState } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import { signOut, getUserProfile, getRecruiterCompany, updateUserProfile as updateUserProfileService, createCompany } from '../services/supabaseService';
import { fetchCsrfToken, clearCsrfToken } from '../services/csrfService';
import { supabase } from '../services/supabaseClient';
import { MOCK_COMPANY_PROFILE } from '../constants';

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
            const profile = await getUserProfile(userId);
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

                // Auto-Upgrade Logic for Admin Tester
                if (profile.email === 'misahlavacu@gmail.com' && profile.role !== 'recruiter') {
                    console.log("Auto-upgrading admin tester to recruiter...");
                    await updateUserProfileService(userId, { role: 'recruiter' });
                    // Force update local state
                    setUserProfile(prev => ({ ...prev, role: 'recruiter' }));

                    // Check if admin already has a company
                    let company = await getRecruiterCompany(userId);

                    if (!company) {
                        console.log("Creating default company for admin tester...");
                        try {
                            // Create company using mock data as template (excluding ID to let DB generate UUID)
                            const { id, ...companyData } = MOCK_COMPANY_PROFILE;
                            company = await createCompany(companyData, userId);
                            console.log("Company created successfully:", company?.id);
                        } catch (err) {
                            console.error("Failed to auto-create company:", err);
                        }
                    }

                    if (company) {
                        setCompanyProfile(company);
                        setViewState(ViewState.COMPANY_DASHBOARD);
                    } else {
                        // Don't automatically show onboarding - let them click to create company
                        setViewState(ViewState.LIST);
                    }
                }

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

                if (profile.role === 'recruiter') {
                    const company = await getRecruiterCompany(userId);
                    if (company) {
                        setCompanyProfile(company);
                        setViewState(ViewState.COMPANY_DASHBOARD);
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
        await signOut();
        clearCsrfToken();  // Clear CSRF token on logout
        setUserProfile(DEFAULT_USER_PROFILE);
        setCompanyProfile(null);
        setViewState(ViewState.LIST);
    };

    return {
        userProfile,
        companyProfile,
        viewState,
        setViewState,
        setUserProfile: updateUserProfileState,
        setCompanyProfile,
        signOut: signOutUser,
        handleSessionRestoration
    };
};