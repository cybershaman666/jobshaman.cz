import { lazy, Suspense, type MutableRefObject } from 'react';
import { Analytics } from '@vercel/analytics/react';

import { CompanyProfile, DiscoveryFilterSource, Job, JobSearchFilters, SearchLanguageCode, UserProfile, ViewState } from '../types';
import PodminkyUziti from '../pages/PodminkyUziti';
import OchranaSoukromi from '../pages/OchranaSoukromi';
import EnterpriseSignup from './EnterpriseSignup';
import CandidateActivationRail from './CandidateActivationRail';
import ChallengeMarketplace from './challenges/ChallengeMarketplace';
import ChallengeFocusView from './challenges/ChallengeFocusView';
import PublicCompanyProfilePage from './challenges/PublicCompanyProfilePage';
import BlogSection from './BlogSection';
import { mapJcfpmToJhiPreferencesWithExplanation } from '../services/jcfpmService';
import { createDefaultJHIPreferences } from '../services/profileDefaults';
import { trackAnalyticsEvent } from '../services/supabaseService';
import { isActivationComplete } from '../services/candidateActivationService';

const CompanyDashboard = lazy(() => import('./CompanyDashboard'));
const CompanyLandingPage = lazy(() => import('./CompanyLandingPage'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const SavedJobsPage = lazy(() => import('./SavedJobsPage'));
const InvitationLanding = lazy(() => import('../pages/InvitationLanding'));
const AssessmentPreviewPage = lazy(() => import('../pages/AssessmentPreviewPage'));
const DemoHandshakePage = lazy(() => import('../pages/DemoHandshakePage'));
const DemoCompanyHandshakePage = lazy(() => import('../pages/DemoCompanyHandshakePage'));
const JcfpmFlow = lazy(() => import('./jcfpm/JcfpmFlow'));
const ProfileEditor = lazy(() => import('./ProfileEditor'));

type AppSceneRouterProps = {
    normalizedPath: string;
    viewState: ViewState;
    theme: 'light' | 'dark';
    vercelAnalyticsEnabled: boolean;
    userProfile: UserProfile;
    companyProfile: CompanyProfile | null;
    selectedCompanyId: string | null;
    selectedJobId: string | null;
    selectedBlogPostSlug: string | null;
    showCompanyLanding: boolean;
    isBlogOpen: boolean;
    jobsForDisplay: Job[];
    selectedJob: Job | null;
    resolvedSavedJobs: Job[];
    savedJobIds: string[];
    savedJobsSearchTerm: string;
    isLoadingJobs: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    totalCount: number;
    searchTerm: string;
    filterCity: string;
    filterMinSalary: number;
    filterBenefits: string[];
    remoteOnly: boolean;
    globalSearch: boolean;
    abroadOnly: boolean;
    enableCommuteFilter: boolean;
    filterMaxDistance: number;
    filterContractType: string[];
    filterDate: string;
    filterExperience: string[];
    filterLanguageCodes: SearchLanguageCode[];
    enableAutoLanguageGuard: boolean;
    implicitLanguageCodesApplied: string[];
    discoveryLane: 'challenges' | 'imports';
    candidateActivationState: any;
    activationNextStep: string;
    applyInteractionState: (jobId: string, state: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
    onDeleteAccount: () => Promise<boolean>;
    onSetCompanyProfile: (profile: CompanyProfile | null) => void;
    onSetViewState: (state: ViewState) => void;
    onProfileUpdate: (profile: UserProfile, persist?: boolean) => void | Promise<void>;
    onProfileSave: () => Promise<boolean>;
    onRefreshProfile: () => void | Promise<void>;
    onToggleSave: (jobId: string) => void;
    onApplyToJob: (job: Job) => void;
    onSavedJobsSearchChange: (value: string) => void;
    onSetBlogOpen: (value: boolean) => void;
    onSetSelectedBlogPostSlug: (slug: string | null) => void;
    onSetSelectedJobId: (jobId: string | null) => void;
    onSetSelectedCompanyId: (companyId: string | null) => void;
    onSetShowCompanyLanding: (value: boolean) => void;
    onSetCompanyRegistrationOpen: (value: boolean) => void;
    onSetApplyModalOpen: (value: boolean) => void;
    onSetShowCandidateOnboarding: (value: boolean) => void;
    onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
    onOpenPremium: (featureLabel?: string) => void;
    onHandleCompanyPageSelect: (companyId: string | null) => void;
    onHandleJobSelect: (jobId: string | null) => void;
    onLoadMoreJobs: () => void;
    onSetDiscoveryLane: (lane: 'challenges' | 'imports') => void;
    onSetSearchTerm: (value: string, source?: DiscoveryFilterSource) => void;
    onPerformSearch: (term: string) => void;
    onSetFilterCity: (value: string) => void;
    onSetFilterMinSalary: (value: number) => void;
    onSetFilterBenefits: (benefits: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onToggleBenefitFilter: (benefit: string) => void;
    onSetRemoteOnly: (value: boolean) => void;
    onSetGlobalSearch: (value: boolean) => void;
    onSetAbroadOnly: (value: boolean) => void;
    onSetEnableCommuteFilter: (value: boolean) => void;
    onSetFilterMaxDistance: (value: number, source?: DiscoveryFilterSource) => void;
    onSetFilterContractType: (types: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onToggleContractTypeFilter: (type: string) => void;
    onSetFilterDate: (value: string) => void;
    onSetFilterExperience: (values: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onSetFilterLanguageCodes: (values: SearchLanguageCode[] | ((prev: SearchLanguageCode[]) => SearchLanguageCode[]), source?: DiscoveryFilterSource) => void;
    onSetEnableAutoLanguageGuard: (value: boolean) => void;
    onApplyDiscoveryDefaults: (filters: JobSearchFilters) => void;
    getLocalePrefix: () => string;
    onboardingDismissedRef: MutableRefObject<boolean>;
};

export default function AppSceneRouter({
    normalizedPath,
    viewState,
    theme,
    vercelAnalyticsEnabled,
    userProfile,
    companyProfile,
    selectedCompanyId,
    selectedJobId,
    selectedBlogPostSlug,
    showCompanyLanding,
    isBlogOpen,
    jobsForDisplay,
    selectedJob,
    resolvedSavedJobs,
    savedJobIds,
    savedJobsSearchTerm,
    isLoadingJobs,
    loadingMore,
    hasMore,
    totalCount,
    searchTerm,
    filterCity,
    filterMinSalary,
    filterBenefits,
    remoteOnly,
    globalSearch,
    abroadOnly,
    enableCommuteFilter,
    filterMaxDistance,
    filterContractType,
    filterDate,
    filterExperience,
    filterLanguageCodes,
    enableAutoLanguageGuard,
    implicitLanguageCodesApplied,
    discoveryLane,
    candidateActivationState,
    activationNextStep,
    applyInteractionState,
    onDeleteAccount,
    onSetCompanyProfile,
    onSetViewState,
    onProfileUpdate,
    onProfileSave,
    onRefreshProfile,
    onToggleSave,
    onApplyToJob,
    onSavedJobsSearchChange,
    onSetBlogOpen,
    onSetSelectedBlogPostSlug,
    onSetSelectedJobId,
    onSetSelectedCompanyId,
    onSetShowCompanyLanding,
    onSetCompanyRegistrationOpen,
    onSetApplyModalOpen,
    onSetShowCandidateOnboarding,
    onOpenAuth,
    onOpenPremium,
    onHandleCompanyPageSelect,
    onHandleJobSelect,
    onLoadMoreJobs,
    onSetDiscoveryLane,
    onSetSearchTerm,
    onPerformSearch,
    onSetFilterCity,
    onSetFilterMinSalary,
    onSetFilterBenefits,
    onToggleBenefitFilter,
    onSetRemoteOnly,
    onSetGlobalSearch,
    onSetAbroadOnly,
    onSetEnableCommuteFilter,
    onSetFilterMaxDistance,
    onSetFilterContractType,
    onToggleContractTypeFilter,
    onSetFilterDate,
    onSetFilterExperience,
    onSetFilterLanguageCodes,
    onSetEnableAutoLanguageGuard,
    onApplyDiscoveryDefaults,
    getLocalePrefix,
    onboardingDismissedRef,
}: AppSceneRouterProps) {
    if (normalizedPath === '/admin') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                <AdminDashboard userProfile={userProfile} />
            </div>
        );
    }
    if (normalizedPath === '/jcfpm' || normalizedPath === '/profile/jcfpm' || normalizedPath === '/profil/jcfpm') {
        const queryParams = new URLSearchParams(window.location.search);
        const requestedSection = queryParams.get('section') || 'full';
        const normalizedSection = requestedSection === 'basic' ? 'full' : requestedSection;
        const sectionParam = userProfile.subscription?.tier === 'premium' ? normalizedSection : 'full';

        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div></div>}>
                    <JcfpmFlow
                        userId={userProfile.id || 'guest'}
                        isPremium={userProfile.subscription?.tier === 'premium'}
                        section={sectionParam}
                        initialSnapshot={userProfile.preferences?.jcfpm_v1 || null}
                        theme={theme}
                        onPersist={async (snapshot: any) => {
                            const mapped = mapJcfpmToJhiPreferencesWithExplanation(
                                snapshot,
                                userProfile.jhiPreferences || createDefaultJHIPreferences()
                            );
                            const updatedProfile: UserProfile = {
                                ...userProfile,
                                preferences: {
                                    ...userProfile.preferences,
                                    jcfpm_v1: snapshot,
                                    jcfpm_jhi_adjustment_v1: mapped.explanation,
                                },
                                jhiPreferences: mapped.preferences,
                            };
                            await onProfileUpdate(updatedProfile, true);
                            void trackAnalyticsEvent({
                                event_type: 'jcfpm_profile_saved',
                                feature: 'jcfpm_v1',
                                metadata: {
                                    schema_version: snapshot.schema_version,
                                    confidence: snapshot.confidence,
                                },
                            });
                        }}
                        onClose={() => {
                            onSetViewState(ViewState.LIST);
                            const lng = getLocalePrefix();
                            window.history.pushState({}, '', `/${lng}/`);
                        }}
                    />
                </Suspense>
            </div>
        );
    }
    if (normalizedPath === '/assessment-preview') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                <AssessmentPreviewPage />
            </div>
        );
    }
    if (normalizedPath === '/demo-handshake') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <DemoHandshakePage
                    onRegister={() => {
                        const lng = getLocalePrefix();
                        onSetShowCompanyLanding(false);
                        onSetSelectedJobId(null);
                        onSetSelectedBlogPostSlug(null);
                        onSetViewState(ViewState.LIST);
                        window.history.pushState({}, '', `/${lng}/`);
                        onOpenAuth('register');
                    }}
                    onBrowseRoles={() => {
                        const lng = getLocalePrefix();
                        window.location.assign(`/${lng}/`);
                    }}
                />
            </div>
        );
    }
    if (normalizedPath === '/demo-company-handshake') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <DemoCompanyHandshakePage
                    onRegister={() => {
                        const lng = getLocalePrefix();
                        onSetShowCompanyLanding(true);
                        onSetSelectedJobId(null);
                        onSetSelectedBlogPostSlug(null);
                        onSetViewState(ViewState.LIST);
                        window.history.pushState({}, '', `/${lng}/pro-firmy`);
                        onSetCompanyRegistrationOpen(true);
                    }}
                    onBackToCompanyLanding={() => {
                        const lng = getLocalePrefix();
                        onSetShowCompanyLanding(true);
                        onSetSelectedJobId(null);
                        onSetSelectedBlogPostSlug(null);
                        onSetViewState(ViewState.LIST);
                        window.location.assign(`/${lng}/pro-firmy`);
                    }}
                />
            </div>
        );
    }
    if (normalizedPath.startsWith('/assessment/')) {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                <InvitationLanding />
            </div>
        );
    }
    if (normalizedPath === '/podminky-uziti') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <PodminkyUziti />
            </div>
        );
    }
    if (normalizedPath === '/enterprise') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <EnterpriseSignup />
            </div>
        );
    }
    if (normalizedPath === '/ochrana-osobnich-udaju') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <OchranaSoukromi />
            </div>
        );
    }
    if (showCompanyLanding) {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <CompanyLandingPage
                    onRegister={() => onSetCompanyRegistrationOpen(true)}
                    onRequestDemo={() => {
                        const lng = getLocalePrefix();
                        onSetShowCompanyLanding(false);
                        onSetSelectedJobId(null);
                        onSetSelectedBlogPostSlug(null);
                        onSetViewState(ViewState.LIST);
                        window.location.assign(`/${lng}/demo-company-handshake`);
                    }}
                    onLogin={onOpenAuth}
                />
            </div>
        );
    }
    if (viewState === ViewState.COMPANY_DASHBOARD) {
        if (!companyProfile && userProfile.role === 'recruiter') {
            return null;
        }
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <CompanyDashboard
                    companyProfile={companyProfile}
                    userEmail={userProfile.email}
                    onDeleteAccount={onDeleteAccount}
                    onProfileUpdate={onSetCompanyProfile}
                />
            </div>
        );
    }
    if (viewState === ViewState.PROFILE) {
        return (
            <div className="col-span-1 lg:col-span-12 w-full pb-6 px-1">
                {userProfile.isLoggedIn
                    && userProfile.role !== 'recruiter'
                    && !isActivationComplete(candidateActivationState)
                    && activationNextStep !== 'quality_action' && (
                        <div className="mb-4">
                            <CandidateActivationRail
                                state={candidateActivationState}
                                onContinue={() => {
                                    onboardingDismissedRef.current = false;
                                    onSetShowCandidateOnboarding(true);
                                    void trackAnalyticsEvent({
                                        event_type: 'nudge_clicked',
                                        feature: 'candidate_activation_v1',
                                        metadata: { source: 'profile_rail', next_step: activationNextStep },
                                    });
                                }}
                            />
                        </div>
                    )}
                <Suspense fallback={null}>
                    <ProfileEditor
                        profile={userProfile}
                        onChange={(p, persist) => onProfileUpdate(p, persist)}
                        onSave={onProfileSave}
                        onRefreshProfile={onRefreshProfile}
                        onDeleteAccount={onDeleteAccount}
                        savedJobs={resolvedSavedJobs}
                        savedJobIds={savedJobIds}
                        onToggleSave={onToggleSave}
                        onJobSelect={onHandleJobSelect}
                        onApplyToJob={onApplyToJob}
                        selectedJobId={selectedJobId}
                    />
                </Suspense>
            </div>
        );
    }
    if (viewState === ViewState.SAVED) {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
                <SavedJobsPage
                    savedJobs={resolvedSavedJobs}
                    savedJobIds={savedJobIds}
                    onToggleSave={onToggleSave}
                    onJobSelect={onHandleJobSelect}
                    selectedJobId={selectedJobId}
                    userProfile={userProfile}
                    searchTerm={savedJobsSearchTerm}
                    onSearchChange={onSavedJobsSearchChange}
                    onApplyToJob={onApplyToJob}
                />
            </div>
        );
    }
    if (isBlogOpen) {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <BlogSection
                    selectedBlogPostSlug={selectedBlogPostSlug}
                    setSelectedBlogPostSlug={(slug) => {
                        onSetBlogOpen(true);
                        onSetSelectedBlogPostSlug(slug);
                    }}
                />
            </div>
        );
    }

    const nativeChallenges = jobsForDisplay.filter((job) => job.listingKind !== 'imported');
    const hasNativeChallenges = nativeChallenges.length > 0;

    return (
        <>
            {vercelAnalyticsEnabled && <Analytics />}
            <div className="col-span-1 lg:col-span-12">
                <div className="space-y-6">
                    {selectedCompanyId ? (
                        <PublicCompanyProfilePage
                            companyId={selectedCompanyId}
                            onBack={() => onHandleCompanyPageSelect(null)}
                            onOpenChallenge={onHandleJobSelect}
                        />
                    ) : selectedJob ? (
                        <ChallengeFocusView
                            job={selectedJob}
                            userProfile={userProfile}
                            firstQualityActionAt={candidateActivationState?.first_quality_action_at ?? null}
                            onBack={() => onHandleJobSelect(null)}
                            onRequireAuth={() => onOpenAuth(userProfile.isLoggedIn ? 'login' : 'register')}
                            onOpenProfile={() => {
                                onSetSelectedJobId(null);
                                onSetSelectedCompanyId(null);
                                onSetSelectedBlogPostSlug(null);
                                onSetShowCompanyLanding(false);
                                onSetViewState(ViewState.PROFILE);
                            }}
                            onOpenSupportingContext={() => {
                                if (!userProfile.isLoggedIn) {
                                    onOpenAuth('login');
                                    return;
                                }
                                onSetApplyModalOpen(true);
                            }}
                            onOpenCompanyPage={onHandleCompanyPageSelect}
                            onOpenImportedListing={() => onApplyToJob(selectedJob)}
                        />
                    ) : (
                        <div id="challenge-discovery">
                            <ChallengeMarketplace
                                hasNativeChallenges={hasNativeChallenges}
                                jobs={jobsForDisplay}
                                selectedJobId={selectedJobId}
                                savedJobIds={savedJobIds}
                                userProfile={userProfile}
                                lane={discoveryLane}
                                setLane={onSetDiscoveryLane}
                                loading={isLoadingJobs}
                                loadingMore={loadingMore}
                                hasMore={hasMore}
                                totalCount={totalCount}
                                loadMoreJobs={onLoadMoreJobs}
                                applyInteractionState={applyInteractionState}
                                theme={theme}
                                searchTerm={searchTerm}
                                setSearchTerm={onSetSearchTerm}
                                performSearch={onPerformSearch}
                                filterCity={filterCity}
                                setFilterCity={onSetFilterCity}
                                filterMinSalary={filterMinSalary}
                                setFilterMinSalary={onSetFilterMinSalary}
                                filterBenefits={filterBenefits}
                                setFilterBenefits={onSetFilterBenefits}
                                toggleBenefitFilter={onToggleBenefitFilter}
                                remoteOnly={remoteOnly}
                                setRemoteOnly={onSetRemoteOnly}
                                globalSearch={globalSearch}
                                setGlobalSearch={onSetGlobalSearch}
                                abroadOnly={abroadOnly}
                                setAbroadOnly={onSetAbroadOnly}
                                enableCommuteFilter={enableCommuteFilter}
                                setEnableCommuteFilter={onSetEnableCommuteFilter}
                                filterMaxDistance={filterMaxDistance}
                                setFilterMaxDistance={onSetFilterMaxDistance}
                                filterContractType={filterContractType}
                                setFilterContractType={onSetFilterContractType}
                                toggleContractTypeFilter={onToggleContractTypeFilter}
                                filterDate={filterDate}
                                setFilterDate={onSetFilterDate}
                                filterExperience={filterExperience}
                                setFilterExperience={onSetFilterExperience}
                                filterLanguageCodes={filterLanguageCodes}
                                setFilterLanguageCodes={onSetFilterLanguageCodes}
                                enableAutoLanguageGuard={enableAutoLanguageGuard}
                                setEnableAutoLanguageGuard={onSetEnableAutoLanguageGuard}
                                implicitLanguageCodesApplied={implicitLanguageCodesApplied}
                                applyDiscoveryDefaults={onApplyDiscoveryDefaults}
                                handleJobSelect={onHandleJobSelect}
                                handleToggleSave={onToggleSave}
                                onOpenProfile={() => onSetViewState(ViewState.PROFILE)}
                                onOpenAuth={() => onOpenAuth('register')}
                                onOpenPremium={onOpenPremium}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
