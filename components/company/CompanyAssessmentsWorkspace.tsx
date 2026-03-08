import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit } from 'lucide-react';
import { Assessment, CompanyProfile, Job } from '../../types';
import AssessmentCreator from '../AssessmentCreator';
import AssessmentInvitationModal from '../AssessmentInvitationModal';
import AssessmentResultsList from '../AssessmentResultsList';
import MyInvitations from '../MyInvitations';
import { openAssessmentPreviewPage } from '../../services/assessmentPreviewNavigation';
import MetricCard from './MetricCard';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspacePanel from './WorkspacePanel';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface AssessmentContext {
    jobId?: string;
    jobTitle?: string;
    candidateEmail?: string;
    candidateId?: string;
    candidateName?: string;
    dialogueId?: string;
    applicationId?: string;
    assessmentId?: string;
    assessmentName?: string;
}

interface CompanyAssessmentsWorkspaceProps {
    companyId: string;
    companyProfile: CompanyProfile | null;
    jobs: Job[];
    assessmentJobId?: string;
    assessmentContext: AssessmentContext | null;
    assessmentLibrary: Assessment[];
    assessmentLibraryLoading: boolean;
    assessmentLibraryBusyId: string | null;
    lastSyncedAt?: string | null;
    showInvitationsList: boolean;
    showInvitationModal: boolean;
    onRefreshLibrary: () => void;
    onToggleInvitations: () => void;
    onOpenInvitationModal: () => void;
    onCloseInvitationModal: () => void;
    onBackToDialogue?: () => void;
    onBackToApplication: () => void;
    onUseSavedAssessment: (assessment: Assessment) => void;
    onDuplicateAssessment: (assessmentId: string) => void;
    onArchiveAssessment: (assessmentId: string) => void;
    onInvitationSent: () => void;
    onAssessmentSaved: (assessment: Assessment) => void;
}

const CompanyAssessmentsWorkspace: React.FC<CompanyAssessmentsWorkspaceProps> = ({
    companyId,
    companyProfile,
    jobs,
    assessmentJobId,
    assessmentContext,
    assessmentLibrary,
    assessmentLibraryLoading,
    assessmentLibraryBusyId,
    lastSyncedAt,
    showInvitationsList,
    showInvitationModal,
    onRefreshLibrary,
    onToggleInvitations,
    onOpenInvitationModal,
    onCloseInvitationModal,
    onBackToDialogue,
    onBackToApplication,
    onUseSavedAssessment,
    onDuplicateAssessment,
    onArchiveAssessment,
    onInvitationSent,
    onAssessmentSaved
}) => {
    const { t } = useTranslation();
    const linkedDialogueId = assessmentContext?.dialogueId || assessmentContext?.applicationId;
    const handleBackToDialogue = onBackToDialogue || onBackToApplication;
    return (
        <div className="space-y-4 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<BrainCircuit size={12} />}
                badgeLabel={t('company.dashboard.tabs.assessments', { defaultValue: 'Assessment hub' })}
                title={t('company.dashboard.tabs.assessments', { defaultValue: 'Assessment hub' })}
                subtitle={t('company.assessments_tab.desc', { defaultValue: 'Create reusable screening flows, invite candidates, and review results without losing context.' })}
                actions={
                    <>
                        <WorkspaceSyncBadge
                            loading={assessmentLibraryLoading}
                            syncedAt={lastSyncedAt}
                            loadingKey="company.workspace.sync.syncing_library"
                            loadingDefault="Syncing assessment library..."
                            onRefresh={onRefreshLibrary}
                        />
                        <button
                            onClick={onToggleInvitations}
                            className="app-button-secondary rounded-full px-4 py-2.5 text-sm"
                        >
                            {showInvitationsList ? t('company.assessments_tab.close_invites') : t('company.assessments_tab.manage_invites')}
                        </button>
                        <button
                            onClick={onOpenInvitationModal}
                            className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.9)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                        >
                            {t('company.assessments_tab.invite_btn', { defaultValue: 'Invite candidate' })}
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MetricCard
                    label={t('company.assessment_library.title', { defaultValue: 'Saved assessment flows' })}
                    value={assessmentLibrary.length}
                    hint={t('company.assessment_library.subtitle', { defaultValue: 'Reuse, duplicate, preview, and retire assessments without leaving this workspace.' })}
                />
                <MetricCard
                    label={t('company.assessment_library.linked_context', { defaultValue: 'Linked review context' })}
                    value={<span className="text-base font-semibold">{assessmentContext?.jobTitle || t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}</span>}
                    hint={assessmentContext?.candidateEmail || t('company.workspace.timeline.empty', { defaultValue: 'Open a dialogue review to pin a live context here.' })}
                />
                <MetricCard
                    label={t('company.assessments_tab.manage_invites', { defaultValue: 'Invites' })}
                    value={<span className="text-base font-semibold">{showInvitationsList ? t('company.assessments_tab.close_invites') : t('company.assessments_tab.invite_btn')}</span>}
                    hint={t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this context' })}
                />
            </div>

            {assessmentContext && (
                    <div className="rounded-[22px] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-4 shadow-[var(--shadow-soft)]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-widest text-[var(--accent)]">{t('company.assessment_library.linked_context', { defaultValue: 'Linked review context' })}</div>
                            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-semibold">
                                {assessmentContext.jobTitle || t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2">
                                {assessmentContext.candidateName && <span>{assessmentContext.candidateName}</span>}
                                {assessmentContext.candidateEmail && <span>{assessmentContext.candidateEmail}</span>}
                                {assessmentContext.assessmentId && (
                                    <span className="rounded border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-2 py-0.5">
                                        {t('company.assessment_library.assessment_id', { defaultValue: 'Assessment ID' })}: {assessmentContext.assessmentId.slice(0, 8)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {linkedDialogueId && (
                                <button
                                    onClick={handleBackToDialogue}
                                    className="app-button-secondary rounded-full px-3 py-1.5 text-sm"
                                >
                                    {t('company.assessment_library.back_to_application', { defaultValue: 'Back to dialogue' })}
                                </button>
                            )}
                            <button
                                onClick={onOpenInvitationModal}
                                className="app-button-secondary rounded-full px-3 py-1.5 text-sm !text-[var(--accent)]"
                            >
                                {t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this context' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3">
                <div className="space-y-3">
                    <WorkspacePanel className="p-3">
                        <SectionHeader
                            title={t('company.assessment_library.title', { defaultValue: 'Saved assessment library' })}
                            subtitle={t('company.assessment_library.subtitle', { defaultValue: 'Reuse, duplicate, preview, and retire assessments without leaving this workspace.' })}
                            aside={assessmentLibraryLoading ? (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('common.loading') || 'Loading...'}
                                </div>
                            ) : undefined}
                            className="mb-3"
                        />

                        {assessmentLibrary.length === 0 && !assessmentLibraryLoading ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                {t('company.assessment_library.empty', { defaultValue: 'No saved assessments yet. Generate one below and it will appear here.' })}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assessmentLibrary.map((item) => {
                                    const isActiveAssessment = assessmentContext?.assessmentId === item.id;
                                    const busy = assessmentLibraryBusyId === item.id;
                                    return (
                                        <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.title}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{item.role}</span>
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                                            {t('company.assessment_library.assessment_id', { defaultValue: 'Assessment ID' })}: {item.id.slice(0, 8)}
                                                        </span>
                                                        {isActiveAssessment && (
                                                            <span className="rounded border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">
                                                                {t('company.assessment_library.selected', { defaultValue: 'Selected' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => onUseSavedAssessment(item)}
                                                        className="app-button-secondary rounded-md px-3 py-1.5 text-xs !text-[var(--accent)]"
                                                    >
                                                        {t('company.assessment_library.use', { defaultValue: 'Use' })}
                                                    </button>
                                                    <button
                                                        onClick={() => openAssessmentPreviewPage(item)}
                                                        className="app-button-secondary rounded-full px-3 py-1.5 text-xs"
                                                    >
                                                        {t('company.workspace.actions.preview_assessment', { defaultValue: 'Náhled' })}
                                                    </button>
                                                    <button
                                                        onClick={() => onDuplicateAssessment(item.id)}
                                                        disabled={busy}
                                                        className="app-button-secondary rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
                                                    >
                                                        {t('company.job_editor.duplicate', { defaultValue: 'Duplicate' })}
                                                    </button>
                                                    <button
                                                        onClick={() => onArchiveAssessment(item.id)}
                                                        disabled={busy}
                                                        className="px-3 py-1.5 rounded-md border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-950/20 disabled:opacity-50"
                                                    >
                                                        {t('company.assessment_library.archive', { defaultValue: 'Archive' })}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </WorkspacePanel>

                    {showInvitationsList && (
                        <WorkspacePanel className="p-3">
                            <MyInvitations forCompany />
                        </WorkspacePanel>
                    )}
                </div>

                <div className="space-y-3">
                    <WorkspacePanel className="p-3">
                        <SectionHeader
                            title={t('company.applications.detail.related_assessments', { defaultValue: 'Related assessments' })}
                            subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dialogue, move status, or jump directly into the linked review flow.' })}
                            className="mb-3"
                        />
                        <AssessmentResultsList
                            companyId={companyId}
                            jobTitleFilter={assessmentContext?.jobTitle}
                            candidateEmailFilter={assessmentContext?.candidateEmail}
                            dialogueIdFilter={linkedDialogueId}
                            applicationIdFilter={assessmentContext?.applicationId}
                        />
                    </WorkspacePanel>

                    {showInvitationModal && (
                        <AssessmentInvitationModal
                            companyId={companyId}
                            onClose={onCloseInvitationModal}
                            onSent={onInvitationSent}
                            initialAssessmentId={assessmentContext?.assessmentId}
                            initialCandidateEmail={assessmentContext?.candidateEmail}
                            initialCandidateId={assessmentContext?.candidateId || null}
                            initialDialogueId={linkedDialogueId || null}
                            initialApplicationId={linkedDialogueId || null}
                            initialJobId={assessmentContext?.jobId || null}
                            initialJobTitle={assessmentContext?.jobTitle}
                            initialAssessmentName={assessmentContext?.assessmentName}
                            initialMetadata={assessmentContext ? {
                                application_id: linkedDialogueId || null,
                                job_id: assessmentContext.jobId || null,
                                candidate_name: assessmentContext.candidateName || null
                            } : null}
                        />
                    )}

                    <AssessmentCreator
                        companyProfile={companyProfile}
                        jobs={jobs}
                        initialJobId={assessmentJobId}
                        onAssessmentSaved={onAssessmentSaved}
                    />
                </div>
            </div>
        </div>
    );
};

export default CompanyAssessmentsWorkspace;
