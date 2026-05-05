import { useState, useRef } from 'react';
import { UserProfile, CompanyProfile, ViewState } from '../types';
import {
    signOut,
    getUserProfile,
    getRecruiterCompany,
    verifyAuthSession,
    createBaseProfile,
    isSupabaseNetworkCooldownActive,
    consumePendingAuthConsent
} from '../services/v2UserService';
import { refreshCsrfTokenIfNeeded, clearCsrfToken } from '../services/csrfService';
import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { supabase } from '../services/supabaseClient';
import { clearSupabaseAuthStorage } from '../services/supabaseClient';
import { createDefaultCandidateSearchProfile, createDefaultJHIPreferences, createDefaultTaxProfileByCountry } from '../services/profileDefaults';

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
    id: undefined,
    isLoggedIn: false,
    name: '',
    email: '',
    address: '',
    transportMode: 'public',
    slots: 3,
    activeHandshakes: [],
    preferences: {
        workLifeBalance: 50,
        financialGoals: 50,
        commuteTolerance: 45,
        priorities: [],
        searchProfile: createDefaultCandidateSearchProfile()
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

export const useUserProfile = () => {
    const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LIST);

    // Track in-progress session restoration to prevent duplicates
    const restorationInProgressRef = useRef<string | null>(null);
    // Avoid repeated restore runs for the same user caused by INITIAL_SESSION + SIGNED_IN bursts.
    const lastSuccessfulRestorationRef = useRef<{ userId: string; at: number } | null>(null);
    const RESTORATION_DEDUPE_WINDOW_MS = 60_000;
    // Session restoration and profile management
    const handleSessionRestoration = async (userId: string) => {
        if (!userId) return;
        if (restorationInProgressRef.current === userId) return;
        if (
            lastSuccessfulRestorationRef.current?.userId === userId &&
            (Date.now() - lastSuccessfulRestorationRef.current.at) < RESTORATION_DEDUPE_WINDOW_MS
        ) return;

        restorationInProgressRef.current = userId;
        try {
            const { isValid } = await verifyAuthSession('handleSessionRestoration');
            if (!isValid) {
                restorationInProgressRef.current = null;
                return;
            }

            const { data: { session: gateSession } } = await supabase.auth.getSession();
            const authUser = gateSession?.user;
            if (authUser && authUser.email_confirmed_at === null) {
                await signOut();
                setUserProfile(DEFAULT_USER_PROFILE);
                setCompanyProfile(null);
                setViewState(ViewState.LIST);
                restorationInProgressRef.current = null;
                return;
            }

            let profile = await getUserProfile(userId);
            if (!profile && supabase) {
                if (isSupabaseNetworkCooldownActive()) {
                    restorationInProgressRef.current = null;
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                profile = await getUserProfile(userId);
                if (!profile) {
                    const { data: { session: fallbackSession } } = await supabase.auth.getSession();
                    const user = fallbackSession?.user;
                    if (user && user.email) {
                        try {
                            const role: UserProfile['role'] = 'candidate';
                            const name = user.user_metadata?.full_name || user.email.split('@')[0];
                            await createBaseProfile(userId, user.email, name, role);
                            profile = await getUserProfile(userId);
                        } catch (createErr) {
                            console.error('Failed to create fallback profile:', createErr);
                        }
                    }
                }
            }

            if (profile) {
                const consentApplied = await consumePendingAuthConsent(userId);
                if (consentApplied) {
                    profile = await getUserProfile(userId) || profile;
                }
                const activeProfile = profile;

                setUserProfile(prev => ({
                    ...prev,
                    ...activeProfile,
                    isLoggedIn: true,
                    slots: activeProfile.slots ?? prev.slots ?? 3,
                    activeHandshakes: activeProfile.activeHandshakes ?? []
                }));

                if (!hasDedicatedSearchRuntime()) {
                    const session = await supabase?.auth.getSession();
                    let accessToken = session?.data?.session?.access_token;
                    if (accessToken && typeof accessToken === 'string') {
                        await refreshCsrfTokenIfNeeded(accessToken);
                    }
                }

                if (activeProfile.role === 'recruiter') {
                    const company = await getRecruiterCompany(userId);
                    if (company) setCompanyProfile(company);
                }

                lastSuccessfulRestorationRef.current = { userId, at: Date.now() };
            } else if (authUser) {
                const fallbackName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Jobshaman';
                setUserProfile(prev => ({
                    ...prev,
                    id: userId,
                    email: authUser.email || prev.email || '',
                    name: fallbackName,
                    role: 'candidate',
                    isLoggedIn: true,
                }));
                lastSuccessfulRestorationRef.current = { userId, at: Date.now() };
            }
        } catch (error) {
            console.error('Session restoration failed:', error);
        } finally {
            restorationInProgressRef.current = null;
        }
    };

    const consumeSlot = async (handshakeId: string) => {
        if (userProfile.slots && userProfile.slots > 0) {
            const newSlots = userProfile.slots - 1;
            const newHandshakes = [...(userProfile.activeHandshakes || []), handshakeId];
            
            updateUserProfileState({ 
                slots: newSlots, 
                activeHandshakes: newHandshakes 
            });
            
            // In a real app, you'd sync with backend here
            // await updateUserProfileService(userProfile.id!, { slots: newSlots, activeHandshakes: newHandshakes });
            return true;
        }
        return false;
    };

    const freeSlot = async (handshakeId: string) => {
        const newSlots = (userProfile.slots || 0) + 1;
        const newHandshakes = (userProfile.activeHandshakes || []).filter(id => id !== handshakeId);
        
        updateUserProfileState({ 
            slots: newSlots, 
            activeHandshakes: newHandshakes 
        });
        
        // In a real app, you'd sync with backend here
        // await updateUserProfileService(userProfile.id!, { slots: newSlots, activeHandshakes: newHandshakes });
    };

    const updateUserProfileState = (updates: Partial<UserProfile>) => {
        setUserProfile(prev => ({ ...prev, ...updates }));
    };

    const signOutUser = async () => {
        try {
            await signOut();
        } catch (error: any) {
            if (error?.message?.includes('Refresh Token')) clearSupabaseAuthStorage();
        } finally {
            clearCsrfToken();
            setUserProfile(DEFAULT_USER_PROFILE);
            setCompanyProfile(null);
            setViewState(ViewState.LIST);
            lastSuccessfulRestorationRef.current = null;
            clearSupabaseAuthStorage();
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
        handleSessionRestoration,
        consumeSlot,
        freeSlot
    };
};
