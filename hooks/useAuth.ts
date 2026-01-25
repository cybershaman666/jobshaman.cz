import { useState, useEffect } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import { supabase, getUserProfile, updateUserProfile, getRecruiterCompany, signOut as supabaseSignOut } from '../services/supabaseService';

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

export const useAuth = (setViewState: (view: ViewState) => void) => {
    const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnboardingCompany, setIsOnboardingCompany] = useState(false);
    const [isCompanyRegistrationOpen, setIsCompanyRegistrationOpen] = useState(false);
    const [showCompanyLanding, setShowCompanyLanding] = useState(false);

    const handleSessionRestoration = async (userId: string) => {
        try {
            const profile = await getUserProfile(userId);
            if (profile) {
                setUserProfile(prev => ({
                    ...prev,
                    ...profile,
                    isLoggedIn: true
                }));

                if (profile.role === 'recruiter') {
                    const company = await getRecruiterCompany(userId);
                    if (company) setCompanyProfile(company);
                    else setIsOnboardingCompany(true);
                    setViewState(ViewState.COMPANY_DASHBOARD);
                }
            }
        } catch (error) {
            console.error("Session restoration failed:", error);
        }
    };

    const handleProfileUpdate = async (updatedProfile: UserProfile) => {
        try {
            setUserProfile(updatedProfile);
            if (updatedProfile.id) {
                await updateUserProfile(updatedProfile.id, updatedProfile);
                console.log("Profile saved successfully");
            }
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("Nepodařilo se uložit profil. Zkuste to znovu.");
        }
    };

    const handleAuthAction = async () => {
        if (userProfile.isLoggedIn && userProfile.id) {
            await supabaseSignOut();
        } else {
            setIsAuthModalOpen(true);
        }
    };

    const handleCompanyOnboardingComplete = (company: CompanyProfile) => {
        setCompanyProfile(company);
        setIsOnboardingCompany(false);
        setViewState(ViewState.COMPANY_DASHBOARD);
    };

    useEffect(() => {
        if (supabase) {
            supabase.auth.getSession().then(({ data }: { data: any }) => {
                if (data?.session) {
                    handleSessionRestoration(data.session.user.id);
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
                if (session) {
                    handleSessionRestoration(session.user.id);
                } else {
                    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
                    setViewState(ViewState.LIST);
                    setCompanyProfile(null);
                }
            });

            return () => subscription.unsubscribe();
        }
    }, []);

    return {
        userProfile,
        setUserProfile,
        companyProfile,
        setCompanyProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isOnboardingCompany,
        setIsOnboardingCompany,
        isCompanyRegistrationOpen,
        setIsCompanyRegistrationOpen,
        showCompanyLanding,
        setShowCompanyLanding,
        handleProfileUpdate,
        handleAuthAction,
        handleCompanyOnboardingComplete
    };
};
