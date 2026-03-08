
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile } from '../types';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import CompanySettings from './CompanySettings';
import PlanUpgradeModal from './PlanUpgradeModal';
import { useCompanyJobsData } from '../hooks/useCompanyJobsData';
import { useCompanyActivityLog } from '../hooks/useCompanyActivityLog';
import { useCompanyDialoguesData } from '../hooks/useCompanyApplicationsData';
import { useCompanyAssessmentsData } from '../hooks/useCompanyAssessmentsData';
import { useCompanyCandidatesData } from '../hooks/useCompanyCandidatesData';
import { useCompanyDialogueAssessmentActions } from '../hooks/useCompanyAssessmentActions';
import { useCompanyDialogueActions } from '../hooks/useCompanyApplicationActions';
import { useCompanyJobActions } from '../hooks/useCompanyJobActions';
import { useCompanyDashboardNavigation } from '../hooks/useCompanyDashboardNavigation';
import CompanyApplicationsWorkspace from './company/CompanyApplicationsWorkspace';
import CompanyAssessmentsWorkspace from './company/CompanyAssessmentsWorkspace';
import CompanyDashboardContent from './company/CompanyDashboardContent';
import CompanyCandidatesWorkspace from './company/CompanyCandidatesWorkspace';
import CompanyDashboardShell from './company/CompanyDashboardShell';
import CompanyOverviewWorkspace from './company/CompanyOverviewWorkspace';
import CompanyJobsWorkspace from './company/CompanyJobsWorkspace';
import {
    buildOverviewHeaderState,
    buildOverviewMetrics,
    buildRecruiterActionQueue,
    buildTodayActionPlan,
    buildWorkspaceActivity
} from './company/companyDashboardDerived';

interface CompanyDashboardProps {
    companyProfile?: CompanyProfile | null;
    userEmail?: string;
    onDeleteAccount?: () => Promise<boolean>;
    onProfileUpdate?: (profile: CompanyProfile) => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ companyProfile: propProfile, userEmail, onDeleteAccount, onProfileUpdate }) => {
    const { t } = useTranslation();
    const [showUpgradeModal, setShowUpgradeModal] = useState<{ open: boolean, feature?: string }>({ open: false });
    const {
        activeTab,
        setActiveTab,
        editorSeedJobId,
        setEditorSeedJobId
    } = useCompanyDashboardNavigation();

    // Data State (Empty for initial load, fetched from Supabase)

    // Data State (Empty for Real, Mocks for Demo)
    // Data State (Empty for initial load, fetched from Supabase)
    const [assessmentContext, setAssessmentContext] = useState<{
        jobId?: string;
        jobTitle?: string;
        candidateEmail?: string;
        candidateId?: string;
        candidateName?: string;
        dialogueId?: string;
        applicationId?: string;
        assessmentId?: string;
        assessmentName?: string;
    } | null>(null);

    // Subscription state
    const [subscription, setSubscription] = useState<any>(null);

    const [assessmentJobId, setAssessmentJobId] = useState<string | undefined>(undefined);

    // Candidate State
    // Simplified Profile management
    const companyProfile = propProfile;
    const {
        jobs,
        setJobs,
        jobStats,
        selectedJobId,
        setSelectedJobId,
        refreshJobs
    } = useCompanyJobsData(companyProfile?.id);
    const {
        companyActivityLog,
        assessmentInvitations,
        assessmentResultsAudit,
        refreshActivityLog,
        refreshOperationalEvents,
        appendActivityEvent
    } = useCompanyActivityLog(companyProfile?.id);
    const {
        dialogues,
        dialoguesLoading,
        dialoguesUpdating,
        selectedDialogueId,
        selectedDialogueDetail,
        dialogueDetailLoading,
        lastDialoguesSyncAt,
        refreshDialogues,
        openDialogueDetail,
        closeDialogueDetail,
        setDialogueUpdating,
        applyDialogueStatusLocally
    } = useCompanyDialoguesData({
        companyId: companyProfile?.id,
        activeTab,
        selectedJobId
    });
    const {
        assessmentLibrary,
        setAssessmentLibrary,
        assessmentLibraryLoading,
        assessmentLibraryBusyId,
        showInvitationModal,
        showInvitationsList,
        lastAssessmentLibrarySyncAt,
        refreshAssessmentLibrary,
        duplicateAssessment,
        archiveAssessment,
        setShowInvitationModal,
        setShowInvitationsList
    } = useCompanyAssessmentsData(companyProfile?.id, activeTab);
    const {
        candidates,
        candidateBenchmarks,
        isLoadingCandidateBenchmarks,
        lastCandidatesSyncAt,
        refreshCandidates,
        refreshCandidateBenchmarks
    } = useCompanyCandidatesData(companyProfile?.id, activeTab, selectedJobId, t);
    const {
        handleCreateAssessmentFromJob,
        handleCreateAssessmentFromDialogue,
        handleInviteCandidateFromDialogue,
        handleUseSavedAssessment,
        handleDuplicateAssessment,
        handleArchiveAssessment
    } = useCompanyDialogueAssessmentActions({
        jobs,
        selectedDialogueDetail,
        assessmentLibrary,
        duplicateAssessment,
        archiveAssessment,
        appendActivityEvent,
        setAssessmentJobId,
        setAssessmentContext,
        setActiveTab,
        setShowInvitationModal
    });
    const { handleDialogueStatusChange } = useCompanyDialogueActions({
        dialogues,
        companyId: companyProfile?.id,
        activeTab,
        selectedJobId,
        refreshActivityLog,
        refreshDialogues,
        appendActivityEvent,
        setDialogueUpdating,
        applyDialogueStatusLocally
    });
    const {
        handleEditorLifecycleChange,
        handleDeleteJob,
        handleCloseJob,
        handleReopenJob
    } = useCompanyJobActions({
        jobs,
        companyId: companyProfile?.id,
        t,
        setJobs,
        refreshJobs,
        refreshActivityLog,
        appendActivityEvent
    });

    // Load subscription data
    useEffect(() => {
        const loadSubscription = async () => {
            if (!companyProfile?.id) return;

            try {
                const subscriptionData = await getSubscriptionStatus(companyProfile.id);
                setSubscription(subscriptionData);
            } catch (error) {
                console.error('Failed to load subscription:', error);
            }
        };

        loadSubscription();
    }, [companyProfile?.id]);

    // GUARD: If no profile (and we are expecting one), show loading or empty state
    // This satisfies TypeScript because subsequent code knows companyProfile is not null
    if (!companyProfile) {
        return (
            <div className="min-h-[500px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-[var(--text-muted)]">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent)]"></div>
                    <p>{t('common.loading') || 'Načítám...'}</p>
                </div>
            </div>
        );
    }

    const effectiveCompanyProfile = useMemo(() => {
        if (!subscription) return companyProfile;
        return {
            ...companyProfile,
            subscription: {
                ...companyProfile.subscription,
                tier: subscription.tier || companyProfile.subscription?.tier || 'free',
                expiresAt: subscription.expiresAt || companyProfile.subscription?.expiresAt,
                usage: {
                    ...companyProfile.subscription?.usage,
                    aiAssessmentsUsed: subscription.assessmentsUsed || 0,
                    activeJobsCount: subscription.roleOpensUsed ?? subscription.jobPostingsUsed ?? companyProfile.subscription?.usage?.activeJobsCount ?? 0,
                    activeDialogueSlotsUsed: subscription.dialogueSlotsUsed ?? companyProfile.subscription?.usage?.activeDialogueSlotsUsed ?? 0,
                    roleOpensUsed: subscription.roleOpensUsed ?? subscription.jobPostingsUsed ?? companyProfile.subscription?.usage?.roleOpensUsed ?? 0
                }
            } as any
        };
    }, [companyProfile, subscription]);

    const visibleJobs = useMemo(
        () => jobs.filter((job) => String((job as any).status || 'active') !== 'archived'),
        [jobs]
    );

    const selectedJob = useMemo(
        () => jobs.find((job) => String(job.id) === String(selectedJobId)) || visibleJobs[0] || jobs[0] || null,
        [jobs, selectedJobId, visibleJobs]
    );

    const handleEditJob = (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setEditorSeedJobId(jobId);
            setSelectedJobId(jobId);
            setActiveTab('jobs');
        }
    };

    const handleOpenApplications = (jobId: string) => {
        setSelectedJobId(jobId);
        closeDialogueDetail();
        setActiveTab('applications');
    };

    const {
        totalViews,
        totalApplicants,
        averageConversion,
        openApplications
    } = useMemo(() => buildOverviewMetrics({
        applications: dialogues,
        jobStats
    }), [dialogues, jobStats]);

    const recruiterActionQueue = useMemo(() => buildRecruiterActionQueue({
        t,
        visibleJobs,
        jobStats,
        openApplications,
        selectedJobId,
        assessmentLibraryCount: assessmentLibrary.length,
        onEditJob: handleEditJob,
        onOpenApplicationQueue: handleOpenApplications,
        onOpenApplicationDetail: openDialogueDetail,
        onOpenAssessments: () => setActiveTab('assessments'),
        onOpenJobs: () => setActiveTab('jobs')
    }), [assessmentLibrary.length, openApplications, selectedJobId, t, visibleJobs, jobStats]);

    const workspaceActivity = useMemo(() => buildWorkspaceActivity({
        t,
        visibleJobs,
        applications: dialogues,
        assessmentLibrary,
        assessmentInvitations,
        assessmentResultsAudit,
        companyActivityLog
    }), [dialogues, assessmentInvitations, assessmentLibrary, assessmentResultsAudit, companyActivityLog, t, visibleJobs]);

    const todayActionPlan = useMemo(() => buildTodayActionPlan({
        t,
        applications: dialogues,
        assessmentLibraryCount: assessmentLibrary.length,
        candidateBenchmarks,
        jobs,
        visibleJobs,
        jobStats,
        workspaceActivity,
        onOpenJobs: () => setActiveTab('jobs'),
        onOpenApplications: () => setActiveTab('applications'),
        onOpenApplicationDetail: openDialogueDetail,
        onOpenAssessments: () => setActiveTab('assessments'),
        onOpenCandidates: () => setActiveTab('candidates'),
        onEditJob: handleEditJob,
        onSelectPausedJob: (jobId: string) => {
            setSelectedJobId(jobId);
            setActiveTab('jobs');
        }
    }), [dialogues, assessmentLibrary.length, candidateBenchmarks, jobs, jobStats, t, visibleJobs, workspaceActivity]);

    useEffect(() => {
        let active = true;
        const loadAudit = async () => {
            if (!companyProfile?.id || (activeTab !== 'overview' && activeTab !== 'applications' && activeTab !== 'assessments')) return;
            await refreshOperationalEvents(companyProfile.id);
            if (!active) return;
        };
        loadAudit();
        return () => { active = false; };
    }, [companyProfile?.id, activeTab]);

    const renderWorkspaceOverview = () => {
        const {
            subscriptionLabel,
            isFreeLikeTier,
            recentApplications,
            candidateCoverageLabel
        } = buildOverviewHeaderState({
            t,
            subscription,
            effectiveSubscriptionTier: effectiveCompanyProfile.subscription?.tier || 'free',
            applications: dialogues,
            candidateBenchmarks
        });

        return (
            <CompanyOverviewWorkspace
                companyProfile={companyProfile}
                subscription={subscription}
                subscriptionLabel={subscriptionLabel}
                isFreeLikeTier={isFreeLikeTier}
                visibleJobs={visibleJobs}
                jobStats={jobStats}
                openApplicationsCount={openApplications.length}
                totalViews={totalViews}
                totalApplicants={totalApplicants}
                averageConversion={averageConversion}
                candidateBenchmarks={candidateBenchmarks}
                candidatesCount={candidates.length}
                candidateCoverageLabel={candidateCoverageLabel}
                assessmentLibrary={assessmentLibrary}
                assessmentLibraryLoading={assessmentLibraryLoading}
                dialoguesLoading={dialoguesLoading}
                applicationsLoading={dialoguesLoading}
                dialoguesLastSyncedAt={lastDialoguesSyncAt}
                applicationsLastSyncedAt={lastDialoguesSyncAt}
                recentDialogues={recentApplications}
                recentApplications={recentApplications}
                recruiterActionQueue={recruiterActionQueue}
                todayActionPlan={todayActionPlan}
                workspaceActivity={workspaceActivity}
                onManagePlan={() => setShowUpgradeModal({ open: true, feature: 'Změna plánu' })}
                onOpenJobs={() => setActiveTab('jobs')}
                onOpenApplications={() => setActiveTab('applications')}
                onRefreshApplications={() => {
                    void refreshDialogues({
                        jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined
                    });
                }}
                onOpenAssessments={() => setActiveTab('assessments')}
                onOpenCandidates={() => setActiveTab('candidates')}
                onOpenSettings={() => setActiveTab('settings')}
                onOpenDialogue={(dialogueId) => {
                    setActiveTab('applications');
                    openDialogueDetail(dialogueId);
                }}
                onOpenApplication={(applicationId) => {
                    setActiveTab('applications');
                    openDialogueDetail(applicationId);
                }}
                onEditJob={handleEditJob}
                onOpenJobApplications={handleOpenApplications}
            />
        );
    };

    const renderJobs = () => {
        return (
            <CompanyJobsWorkspace
                companyProfile={companyProfile}
                jobs={visibleJobs}
                jobStats={jobStats}
                userEmail={userEmail}
                seedJobId={editorSeedJobId}
                onSeedConsumed={() => setEditorSeedJobId(null)}
                onEditJob={handleEditJob}
                onOpenApplications={handleOpenApplications}
                onCreateAssessment={(jobId) => {
                    handleCreateAssessmentFromJob(jobId);
                }}
                onCloseJob={handleCloseJob}
                onDeleteJob={handleDeleteJob}
                onReopenJob={handleReopenJob}
                onJobLifecycleChange={handleEditorLifecycleChange}
            />
        );
    };

    const renderApplications = () => (
        <CompanyApplicationsWorkspace
            jobs={jobs}
            selectedJobId={selectedJobId}
            selectedJob={selectedJob}
            dialogues={dialogues}
            applications={dialogues}
            dialoguesLoading={dialoguesLoading}
            applicationsLoading={dialoguesLoading}
            dialoguesUpdating={dialoguesUpdating}
            applicationsUpdating={dialoguesUpdating}
            selectedDialogueId={selectedDialogueId}
            selectedApplicationId={selectedDialogueId}
            selectedDialogueDetail={selectedDialogueDetail}
            selectedApplicationDetail={selectedDialogueDetail}
            dialogueDetailLoading={dialogueDetailLoading}
            applicationDetailLoading={dialogueDetailLoading}
            lastSyncedAt={lastDialoguesSyncAt}
            companyId={companyProfile.id || ''}
            onSelectedJobChange={setSelectedJobId}
            onOpenJobs={() => setActiveTab('jobs')}
            onRefresh={() => {
                    void refreshDialogues({
                        jobId: selectedJobId || undefined
                    });
                }}
            onOpenDialogue={openDialogueDetail}
            onOpenApplication={openDialogueDetail}
            onCloseDetail={closeDialogueDetail}
            onStatusChange={handleDialogueStatusChange}
            onCreateAssessmentFromDialogue={handleCreateAssessmentFromDialogue}
            onCreateAssessmentFromApplication={handleCreateAssessmentFromDialogue}
            onInviteCandidateFromDialogue={handleInviteCandidateFromDialogue}
            onInviteCandidateFromApplication={handleInviteCandidateFromDialogue}
        />
    );

    const renderAssessments = () => (
        <CompanyAssessmentsWorkspace
            companyId={companyProfile.id || ''}
            companyProfile={effectiveCompanyProfile || null}
            jobs={jobs}
            assessmentJobId={assessmentJobId}
            assessmentContext={assessmentContext}
            assessmentLibrary={assessmentLibrary}
            assessmentLibraryLoading={assessmentLibraryLoading}
            assessmentLibraryBusyId={assessmentLibraryBusyId}
            lastSyncedAt={lastAssessmentLibrarySyncAt}
            showInvitationsList={showInvitationsList}
            showInvitationModal={showInvitationModal}
            onRefreshLibrary={() => {
                void refreshAssessmentLibrary();
            }}
            onToggleInvitations={() => setShowInvitationsList((prev) => !prev)}
            onOpenInvitationModal={() => setShowInvitationModal(true)}
            onCloseInvitationModal={() => setShowInvitationModal(false)}
            onBackToDialogue={() => setActiveTab('applications')}
            onBackToApplication={() => setActiveTab('applications')}
            onUseSavedAssessment={handleUseSavedAssessment}
            onDuplicateAssessment={handleDuplicateAssessment}
            onArchiveAssessment={handleArchiveAssessment}
            onInvitationSent={() => {
                setShowInvitationsList(true);
                appendActivityEvent('assessment_invited', {
                    application_id: assessmentContext?.dialogueId || assessmentContext?.applicationId || null,
                    job_id: assessmentContext?.jobId || null,
                    job_title: assessmentContext?.jobTitle || null,
                    candidate_name: assessmentContext?.candidateName || null,
                    candidate_email: assessmentContext?.candidateEmail || null,
                    assessment_id: assessmentContext?.assessmentId || null,
                    assessment_title: assessmentContext?.assessmentName || null
                }, 'assessment', assessmentContext?.assessmentId || undefined);
                if (companyProfile?.id) {
                    refreshOperationalEvents(companyProfile.id);
                }
            }}
            onAssessmentSaved={(assessment) => {
                setAssessmentLibrary((prev) => [assessment, ...prev.filter((item) => item.id !== assessment.id)]);
                setAssessmentContext((prev) => ({
                    ...(prev || {}),
                    assessmentId: assessment.id,
                    assessmentName: assessment.title,
                    jobTitle: prev?.jobTitle || assessment.role
                }));
                appendActivityEvent('assessment_saved', {
                    assessment_id: assessment.id,
                    assessment_title: assessment.title || null,
                    job_title: assessment.role || null
                }, 'assessment', assessment.id);
                void refreshAssessmentLibrary();
            }}
        />
    );

    const renderCandidates = () => (
        <CompanyCandidatesWorkspace
            jobs={jobs}
            selectedJobId={selectedJobId}
            selectedJob={selectedJob}
            candidates={candidates}
            candidateBenchmarks={candidateBenchmarks}
            isLoadingCandidateBenchmarks={isLoadingCandidateBenchmarks}
            lastSyncedAt={lastCandidatesSyncAt}
            onSelectedJobChange={setSelectedJobId}
            onRefresh={() => {
                void Promise.all([
                    refreshCandidates(),
                    refreshCandidateBenchmarks()
                ]);
            }}
        />
    );

    return (
        <CompanyDashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
            <CompanyDashboardContent
                activeTab={activeTab}
                overview={renderWorkspaceOverview}
                settings={() => effectiveCompanyProfile ? <CompanySettings profile={effectiveCompanyProfile} onSave={onProfileUpdate || (() => { })} onDeleteAccount={onDeleteAccount} /> : null}
                jobs={renderJobs}
                dialogues={renderApplications}
                applications={renderApplications}
                assessments={renderAssessments}
                candidates={renderCandidates}
            />
            <PlanUpgradeModal
                isOpen={showUpgradeModal.open}
                onClose={() => setShowUpgradeModal({ open: false })}
                feature={showUpgradeModal.feature}
                companyProfile={effectiveCompanyProfile}
            />
        </CompanyDashboardShell>
    );
};

export default CompanyDashboard;
