import { lazy, Suspense, type MutableRefObject } from 'react';
import { Analytics } from '@vercel/analytics/react';

import { CompanyProfile, DiscoveryFilterSource, Job, JobSearchFilters, SearchDiagnosticsMeta, SearchLanguageCode, SearchMode, UserProfile, ViewState } from '../types';
import PodminkyUziti from '../pages/PodminkyUziti';
import OchranaSoukromi from '../pages/OchranaSoukromi';
import EnterpriseSignup from './EnterpriseSignup';
import CandidateActivationRail from './CandidateActivationRail';
import ChallengeMarketplace from './challenges/ChallengeMarketplace';
import BlogSection from './BlogSection';
import { mapJcfpmToJhiPreferencesWithExplanation } from '../services/jcfpmService';
import { createDefaultJHIPreferences } from '../services/profileDefaults';
import { trackAnalyticsEvent } from '../services/supabaseService';
import { isActivationComplete } from '../services/candidateActivationService';
import ChallengeDetailPage from '../src/pages/challenge-detail/ChallengeDetailPage';
import CompanySpacePage from '../src/pages/company-space/CompanySpacePage';

const CompanyDashboard = lazy(() => import('./CompanyDashboard'));
const CompanyLandingPage = lazy(() => import('./CompanyLandingPage'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const SavedJobsPage = lazy(() => import('./SavedJobsPage'));
const InvitationLanding = lazy(() => import('../pages/InvitationLanding'));
const AssessmentPreviewPage = lazy(() => import('../pages/AssessmentPreviewPage'));
const DemoHandshakePage = lazy(() => import('../pages/DemoHandshakePage'));
const DemoCompanyHandshakePage = lazy(() => import('../pages/DemoCompanyHandshakePage'));
const DemoSolarpunkPark = lazy(() => import('../pages/DemoSolarpunkPark'));
const JcfpmFlow = lazy(() => import('./jcfpm/JcfpmFlow'));
const ProfileEditor = lazy(() => import('./ProfileEditor'));
const MarketRadarPage = lazy(() => import('../pages/MarketRadarPage'));

type AppSceneRouterProps = {
    normalizedPath: string;
    viewState: ViewState;
    isMapMode?: boolean;
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
    currentPage: number;
    pageSize: number;
    searchTerm: string;
    filterCity: string;
    filterMinSalary: number;
    filterBenefits: string[];
    remoteOnly: boolean;
    globalSearch: boolean;
    abroadOnly: boolean;
    countryCodes: string[];
    enableCommuteFilter: boolean;
    filterMaxDistance: number;
    filterContractType: string[];
    filterDate: string;
    filterExperience: string[];
    filterLanguageCodes: SearchLanguageCode[];
    hasExplicitLanguageFilter: boolean;
    enableAutoLanguageGuard: boolean;
    implicitLanguageCodesApplied: string[];
    discoveryLane: 'challenges' | 'imports';
    discoveryMode: 'all' | 'micro_jobs';
    searchDiagnostics: SearchDiagnosticsMeta | null;
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
    onGoToJobsPage: (page: number) => void;
    onSetDiscoveryLane: (lane: 'challenges' | 'imports') => void;
    onSetDiscoveryMode: (mode: 'all' | 'micro_jobs') => void;
    onSetSearchTerm: (value: string, source?: DiscoveryFilterSource) => void;
    onPerformSearch: (term: string) => void;
    onSetFilterCity: (value: string) => void;
    onSetFilterMinSalary: (value: number) => void;
    onSetFilterBenefits: (benefits: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onToggleBenefitFilter: (benefit: string) => void;
    onSetRemoteOnly: (value: boolean) => void;
    onSetGlobalSearch: (value: boolean) => void;
    onSetAbroadOnly: (value: boolean) => void;
    onSetCountryCodes: (value: string[] | ((prev: string[]) => string[])) => void;
    onSetEnableCommuteFilter: (value: boolean) => void;
    onSetFilterMaxDistance: (value: number, source?: DiscoveryFilterSource) => void;
    onSetFilterContractType: (types: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onToggleContractTypeFilter: (type: string) => void;
    onSetFilterDate: (value: string) => void;
    onSetFilterExperience: (values: string[] | ((prev: string[]) => string[]), source?: DiscoveryFilterSource) => void;
    onSetFilterLanguageCodes: (values: SearchLanguageCode[] | ((prev: SearchLanguageCode[]) => SearchLanguageCode[]), source?: DiscoveryFilterSource) => void;
    onSetEnableAutoLanguageGuard: (value: boolean) => void;
    onApplyDiscoveryDefaults: (filters: JobSearchFilters, force?: boolean) => void;
    searchMode: SearchMode;
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
    loadingMore,
    hasMore,
    currentPage,
    pageSize,
    totalCount,
    filterMinSalary,
    remoteOnly,
    enableCommuteFilter,
    filterMaxDistance,
    discoveryLane,
    discoveryMode,
    searchDiagnostics,
    candidateActivationState,
    activationNextStep,
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
    onHandleCompanyPageSelect,
    onHandleJobSelect,
    onLoadMoreJobs,
    onGoToJobsPage,
    onSetDiscoveryLane,
    onSetDiscoveryMode,
    onSetFilterMinSalary,
    onSetRemoteOnly,
    onSetEnableCommuteFilter,
    onSetFilterMaxDistance,
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
    if (normalizedPath === '/market-radar' || viewState === ViewState.MARKET_RADAR) {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div></div>}>
                    <MarketRadarPage
                        userProfile={userProfile}
                        onOpenAuth={onOpenAuth}
                        onOpenProfile={() => onSetViewState(ViewState.PROFILE)}
                    />
                </Suspense>
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
    if (normalizedPath === '/demo-solarpunk-park') {
        return (
            <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar">
                <DemoSolarpunkPark />
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
                        <CompanySpacePage
                            companyId={selectedCompanyId}
                            onBack={() => onHandleCompanyPageSelect(null)}
                            onOpenChallenge={onHandleJobSelect}
                        />
                    ) : selectedJob ? (
                        <ChallengeDetailPage
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
                                discoveryMode={discoveryMode}
                                searchDiagnostics={searchDiagnostics}
                                setDiscoveryMode={onSetDiscoveryMode}
                                setLane={onSetDiscoveryLane}
                                totalCount={totalCount}
                                loadingMore={loadingMore}
                                hasMore={hasMore}
                                currentPage={currentPage}
                                pageSize={pageSize}
                                theme={theme}
                                loadMoreJobs={onLoadMoreJobs}
                                goToPage={onGoToJobsPage}
                                filterMinSalary={filterMinSalary}
                                setFilterMinSalary={onSetFilterMinSalary}
                                remoteOnly={remoteOnly}
                                setRemoteOnly={onSetRemoteOnly}
                                enableCommuteFilter={enableCommuteFilter}
                                setEnableCommuteFilter={onSetEnableCommuteFilter}
                                filterMaxDistance={filterMaxDistance}
                                setFilterMaxDistance={onSetFilterMaxDistance}
                                applyDiscoveryDefaults={onApplyDiscoveryDefaults}
                                handleJobSelect={onHandleJobSelect}
                                handleToggleSave={onToggleSave}
                                onOpenProfile={() => onSetViewState(ViewState.PROFILE)}
                                onOpenAuth={onOpenAuth}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
