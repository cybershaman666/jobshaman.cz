import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit } from 'lucide-react';
import { Assessment, CompanyProfile, Job } from '../../types';
import AssessmentCreator from '../AssessmentCreator';
import AssessmentInvitationModal from '../AssessmentInvitationModal';
import AssessmentResultsList from '../AssessmentResultsList';
import MyInvitations from '../MyInvitations';
import { openAssessmentPreviewPage } from '../../services/assessmentPreviewNavigation';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface AssessmentContext {
    jobId?: string;
    jobTitle?: string;
    candidateEmail?: string;
    candidateId?: string;
    candidateName?: string;
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
    onBackToApplication,
    onUseSavedAssessment,
    onDuplicateAssessment,
    onArchiveAssessment,
    onInvitationSent,
    onAssessmentSaved
}) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-3 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<BrainCircuit size={12} />}
                badgeLabel={t('company.dashboard.tabs.assessments')}
                title={t('company.dashboard.tabs.assessments')}
                subtitle={t('company.assessments_tab.desc')}
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
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {showInvitationsList ? t('company.assessments_tab.close_invites') : t('company.assessments_tab.manage_invites')}
                        </button>
                        <button
                            onClick={onOpenInvitationModal}
                            className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
                        >
                            {t('company.assessments_tab.invite_btn')}
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {t('company.assessment_library.title', { defaultValue: 'Saved assessment library' })}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{assessmentLibrary.length}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t('company.assessment_library.subtitle', { defaultValue: 'Reuse, duplicate, preview, and retire assessments without leaving this workspace.' })}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {t('company.assessment_library.linked_context', { defaultValue: 'Linked review context' })}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                        {assessmentContext?.jobTitle || t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {assessmentContext?.candidateEmail || t('company.workspace.timeline.empty', { defaultValue: 'Open an application dossier to pin a live review context here.' })}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {t('company.assessments_tab.manage_invites')}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                        {showInvitationsList ? t('company.assessments_tab.close_invites') : t('company.assessments_tab.invite_btn')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this context' })}
                    </div>
                </div>
            </div>

            {assessmentContext && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900/30 dark:bg-cyan-950/20">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">{t('company.assessment_library.linked_context', { defaultValue: 'Linked review context' })}</div>
                            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-semibold">
                                {assessmentContext.jobTitle || t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2">
                                {assessmentContext.candidateName && <span>{assessmentContext.candidateName}</span>}
                                {assessmentContext.candidateEmail && <span>{assessmentContext.candidateEmail}</span>}
                                {assessmentContext.assessmentId && (
                                    <span className="px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/40 border border-cyan-100 dark:border-cyan-900/30">
                                        {t('company.assessment_library.assessment_id', { defaultValue: 'Assessment ID' })}: {assessmentContext.assessmentId.slice(0, 8)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {assessmentContext.applicationId && (
                                <button
                                    onClick={onBackToApplication}
                                    className="px-3 py-1 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    {t('company.assessment_library.back_to_application', { defaultValue: 'Back to application' })}
                                </button>
                            )}
                            <button
                                onClick={onOpenInvitationModal}
                                className="px-3 py-1 rounded-md border border-cyan-200 text-sm text-cyan-700 hover:bg-white dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-slate-900"
                            >
                                {t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this context' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3">
                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
                                                            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                                                                {t('company.assessment_library.selected', { defaultValue: 'Selected' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => onUseSavedAssessment(item)}
                                                        className="px-3 py-1.5 rounded-md border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                                                    >
                                                        {t('company.assessment_library.use', { defaultValue: 'Use' })}
                                                    </button>
                                                    <button
                                                        onClick={() => openAssessmentPreviewPage(item)}
                                                        className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        {t('company.workspace.actions.preview_assessment', { defaultValue: 'Preview' })}
                                                    </button>
                                                    <button
                                                        onClick={() => onDuplicateAssessment(item.id)}
                                                        disabled={busy}
                                                        className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
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
                    </div>

                    {showInvitationsList && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                            <MyInvitations forCompany />
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <SectionHeader
                            title={t('company.applications.detail.related_assessments', { defaultValue: 'Related assessments' })}
                            subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dossier, move status, or jump directly into the linked review flow.' })}
                            className="mb-3"
                        />
                        <AssessmentResultsList
                            companyId={companyId}
                            jobTitleFilter={assessmentContext?.jobTitle}
                            candidateEmailFilter={assessmentContext?.candidateEmail}
                            applicationIdFilter={assessmentContext?.applicationId}
                        />
                    </div>

                    {showInvitationModal && (
                        <AssessmentInvitationModal
                            companyId={companyId}
                            onClose={onCloseInvitationModal}
                            onSent={onInvitationSent}
                            initialAssessmentId={assessmentContext?.assessmentId}
                            initialCandidateEmail={assessmentContext?.candidateEmail}
                            initialCandidateId={assessmentContext?.candidateId || null}
                            initialApplicationId={assessmentContext?.applicationId || null}
                            initialJobId={assessmentContext?.jobId || null}
                            initialJobTitle={assessmentContext?.jobTitle}
                            initialAssessmentName={assessmentContext?.assessmentName}
                            initialMetadata={assessmentContext ? {
                                application_id: assessmentContext.applicationId || null,
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
