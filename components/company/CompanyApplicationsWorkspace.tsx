import React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, X } from 'lucide-react';
import { ApplicationDossier, CompanyApplicationRow, Job } from '../../types';
import ApplicationDossierDetail from './ApplicationDossierDetail';
import MetricCard from './MetricCard';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface CompanyApplicationsWorkspaceProps {
    jobs: Job[];
    selectedJobId: string;
    selectedJob: Job | null;
    applications: CompanyApplicationRow[];
    applicationsLoading: boolean;
    applicationsUpdating: Record<string, boolean>;
    selectedApplicationId: string | null;
    selectedApplicationDetail: ApplicationDossier | null;
    applicationDetailLoading: boolean;
    lastSyncedAt?: string | null;
    companyId: string;
    onSelectedJobChange: (jobId: string) => void;
    onOpenJobs: () => void;
    onRefresh: () => void;
    onOpenApplication: (applicationId: string) => void;
    onCloseDetail: () => void;
    onStatusChange: (applicationId: string, status: CompanyApplicationRow['status']) => void;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromApplication: () => void;
}

const CompanyApplicationsWorkspace: React.FC<CompanyApplicationsWorkspaceProps> = ({
    jobs,
    selectedJobId,
    selectedJob,
    applications,
    applicationsLoading,
    applicationsUpdating,
    selectedApplicationId,
    selectedApplicationDetail,
    applicationDetailLoading,
    lastSyncedAt,
    companyId,
    onSelectedJobChange,
    onOpenJobs,
    onRefresh,
    onOpenApplication,
    onCloseDetail,
    onStatusChange,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromApplication
}) => {
    const { t, i18n } = useTranslation();
    const sharedJcfpmCount = applications.filter((app) => app.hasJcfpm).length;
    const openApplications = applications.filter((app) => ['pending', 'reviewed', 'shortlisted'].includes(String(app.status || 'pending')));
    return (
        <div className="space-y-3 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<Briefcase size={12} />}
                badgeLabel={t('company.applications.title', { defaultValue: 'Applications workspace' })}
                title={t('company.applications.title', { defaultValue: 'Applications workspace' })}
                subtitle={t('company.applications.subtitle', { defaultValue: 'Review structured application dossiers, update statuses, and inspect shared JCFPM context.' })}
                actions={
                    <>
                        <WorkspaceSyncBadge
                            loading={applicationsLoading}
                            syncedAt={lastSyncedAt}
                            onRefresh={onRefresh}
                        />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 min-w-[240px]">
                            <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                                {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
                            </div>
                            <select
                                value={selectedJobId}
                                onChange={(e) => onSelectedJobChange(e.target.value)}
                                className="w-full bg-transparent font-semibold text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer border-none ring-0 p-0"
                            >
                                {jobs.map((job) => (
                                    <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={onOpenJobs}
                            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {t('company.workspace.actions.open_jobs', { defaultValue: 'Open jobs' })}
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard
                    label={t('company.workspace.labels.applications', { defaultValue: 'Applications' })}
                    value={applications.length}
                    hint={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dossier, move status, or jump directly into the linked review flow.' })}
                />
                <MetricCard
                    label={t('company.workspace.metrics.review_queue', { defaultValue: 'Review queue' })}
                    value={openApplications.length}
                    hint={t('company.workspace.metrics.review_queue_hint', { defaultValue: 'Applications still need recruiter action or status progression.' })}
                />
                <MetricCard
                    label={t('company.applications.metrics.shared_jcfpm', { defaultValue: 'Shared JCFPM' })}
                    value={sharedJcfpmCount}
                    hint={t('company.applications.metrics.shared_jcfpm_hint', { defaultValue: 'Shared JCFPM signals are visible directly inside recruiter dossiers.' })}
                />
                <MetricCard
                    label={t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}
                    value={<span className="text-base font-semibold">{selectedJob?.title || t('company.dashboard.table.position')}</span>}
                    hint={selectedJob?.location || t('company.dashboard.empty_state_desc')}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <SectionHeader
                        title={t('company.candidates.applications_title', { defaultValue: 'Applications' })}
                        subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dossier, move status, or jump directly into the linked review flow.' })}
                        aside={applicationsLoading ? (
                            <span className="text-xs text-slate-500">{t('common.loading') || 'Loading...'}</span>
                        ) : undefined}
                        className="mb-3"
                    />
                    {applications.length === 0 && !applicationsLoading ? (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.candidates.applications_empty', { defaultValue: 'No applications for the selected role yet.' })}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {applications.map((app) => (
                                <div key={app.id} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {app.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500 space-y-1">
                                                    <div>{app.job_title || t('company.dashboard.table.position')}</div>
                                                    {app.candidateHeadline && (
                                                        <div className="text-[11px] text-slate-400">{app.candidateHeadline}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <select
                                                value={app.status}
                                                onChange={(e) => onStatusChange(app.id, e.target.value as CompanyApplicationRow['status'])}
                                                className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                disabled={applicationsUpdating[app.id]}
                                            >
                                                <option value="pending">{t('company.dashboard.status.pending')}</option>
                                                <option value="reviewed">{t('company.dashboard.status.approved', { defaultValue: 'Reviewed' })}</option>
                                                <option value="shortlisted">{t('company.dashboard.status.shortlisted', { defaultValue: 'Shortlisted' })}</option>
                                                <option value="rejected">{t('company.dashboard.status.refused', { defaultValue: 'Rejected' })}</option>
                                                <option value="hired">{t('company.dashboard.status.hired', { defaultValue: 'Hired' })}</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px]">
                                            {app.hasCv && <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">CV</span>}
                                            {app.hasCoverLetter && <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}</span>}
                                            {app.hasJcfpm && (
                                                <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                                                    JCFPM: {app.jcfpmShareLevel === 'full_report'
                                                        ? t('company.applications.labels.full', { defaultValue: 'Full' })
                                                        : t('company.applications.labels.summary', { defaultValue: 'Summary' })}
                                                </span>
                                            )}
                                            {applicationsUpdating[app.id] && (
                                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                    {t('common.saving', { defaultValue: 'Saving…' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => onOpenApplication(app.id)}
                                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                                    selectedApplicationId === app.id
                                                        ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                }`}
                                            >
                                                {t('company.candidates.open_application', { defaultValue: 'Open' })}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <SectionHeader
                        title={t('company.candidates.application_review_title', { defaultValue: 'Application review' })}
                        subtitle={selectedApplicationDetail?.submitted_at
                            ? new Date(selectedApplicationDetail.submitted_at).toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')
                            : t('company.candidates.application_review_desc', { defaultValue: 'Structured dossier for recruiter review.' })}
                        aside={selectedApplicationDetail ? (
                            <button
                                onClick={onCloseDetail}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X size={16} />
                            </button>
                        ) : undefined}
                    />

                    {applicationDetailLoading ? (
                        <div className="text-sm text-slate-500">{t('common.loading') || 'Loading...'}</div>
                    ) : selectedApplicationDetail ? (
                        <ApplicationDossierDetail
                            dossier={selectedApplicationDetail}
                            companyId={companyId}
                            locale={i18n.language}
                            onCreateAssessmentFromApplication={onCreateAssessmentFromApplication}
                            onInviteCandidateFromApplication={onInviteCandidateFromApplication}
                        />
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.applications.detail.select_prompt', { defaultValue: 'Select an application from the queue to review the full dossier.' })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyApplicationsWorkspace;
