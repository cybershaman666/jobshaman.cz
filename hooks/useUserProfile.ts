import { useState } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import { signOut, getUserProfile, getRecruiterCompany, updateUserProfile as updateUserProfileService } from '../services/supabaseService';

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
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
            const profile = await getUserProfile(userId);
            if (profile) {
                setUserProfile(prev => ({
                    ...prev,
                    ...profile,
                    isLoggedIn: true
                }));

                // Auto-Upgrade Logic for Admin Tester
                if (profile.email === 'misahlavacu@gmail.com' && profile.role !== 'recruiter') {
                    console.log("Auto-upgrading admin tester to recruiter...");
                    await updateUserProfileService(userId, { role: 'recruiter' });
                    // Force update local state
                    setUserProfile(prev => ({ ...prev, role: 'recruiter' }));
                    // Check if admin already has a company
                    const company = await getRecruiterCompany(userId);
                    if (company) {
                        setCompanyProfile(company);
                        setViewState(ViewState.COMPANY_DASHBOARD);
                    } else {
                        // Don't automatically show onboarding - let them click to create company
                        setViewState(ViewState.LIST);
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