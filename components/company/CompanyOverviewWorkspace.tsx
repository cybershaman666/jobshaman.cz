import React from 'react';
import { useTranslation } from 'react-i18next';
import { Assessment, CandidateBenchmarkMetrics, CompanyApplicationRow, CompanyProfile, Job } from '../../types';
import CompanyQuickStartPanel from './CompanyQuickStartPanel';
import CompanySubscriptionHero from './CompanySubscriptionHero';
import CompanyWorkspaceHero from './CompanyWorkspaceHero';
import MetricCard from './MetricCard';
import OverviewAssessmentLibraryItem from './OverviewAssessmentLibraryItem';
import OverviewLiveRoleItem from './OverviewLiveRoleItem';
import OverviewQueueItem from './OverviewQueueItem';
import OverviewRecentApplicationItem from './OverviewRecentApplicationItem';
import OverviewTodayActionItem from './OverviewTodayActionItem';
import WorkspacePanel from './WorkspacePanel';

interface QueueItem {
    id: string;
    title: string;
    detail: string;
    action: () => void;
    accent: string;
}

interface TodayActionItem {
    id: string;
    title: string;
    detail: string;
    label: string;
    actionLabel: string;
    action: () => void;
}

interface ActivityItem {
    id: string;
    at: string;
    title: string;
    detail: string;
}

interface Props {
    companyProfile: CompanyProfile;
    subscription: any;
    subscriptionLabel: string;
    isFreeLikeTier: boolean;
    visibleJobs: Job[];
    jobStats: Record<string, { views: number; applicants: number }>;
    openApplicationsCount: number;
    totalViews: number;
    totalApplicants: number;
    averageConversion: number;
    candidateBenchmarks: CandidateBenchmarkMetrics | null;
    candidatesCount: number;
    candidateCoverageLabel: string;
    assessmentLibrary: Assessment[];
    assessmentLibraryLoading: boolean;
    dialoguesLoading?: boolean;
    applicationsLoading: boolean;
    dialoguesLastSyncedAt?: string | null;
    applicationsLastSyncedAt?: string | null;
    recentDialogues?: CompanyApplicationRow[];
    recentApplications: CompanyApplicationRow[];
    recruiterActionQueue: QueueItem[];
    todayActionPlan: TodayActionItem[];
    workspaceActivity: ActivityItem[];
    onManagePlan: () => void;
    onOpenJobs: () => void;
    onOpenApplications: () => void;
    onRefreshApplications: () => void;
    onOpenAssessments: () => void;
    onOpenCandidates: () => void;
    onOpenSettings: () => void;
    onOpenDialogue?: (dialogueId: string) => void;
    onOpenApplication: (applicationId: string) => void;
    onEditJob: (jobId: string) => void;
    onOpenJobApplications: (jobId: string) => void;
}

const CompanyOverviewWorkspace: React.FC<Props> = ({
    companyProfile,
    subscription,
    subscriptionLabel,
    isFreeLikeTier,
    visibleJobs,
    jobStats,
    openApplicationsCount,
    totalViews,
    totalApplicants,
    averageConversion,
    candidateBenchmarks,
    candidatesCount,
    candidateCoverageLabel,
    assessmentLibrary,
    assessmentLibraryLoading,
    dialoguesLoading,
    applicationsLoading,
    dialoguesLastSyncedAt,
    applicationsLastSyncedAt,
    recentDialogues,
    recentApplications,
    recruiterActionQueue,
    todayActionPlan,
    workspaceActivity,
    onManagePlan,
    onOpenJobs,
    onOpenApplications,
    onRefreshApplications,
    onOpenAssessments,
    onOpenCandidates,
    onOpenSettings,
    onOpenDialogue,
    onOpenApplication,
    onEditJob,
    onOpenJobApplications
}) => {
    const { t, i18n } = useTranslation();
    const resolvedDialoguesLoading = dialoguesLoading ?? applicationsLoading;
    const resolvedDialoguesLastSyncedAt = dialoguesLastSyncedAt ?? applicationsLastSyncedAt;
    const resolvedRecentDialogues = recentDialogues ?? recentApplications;
    const handleOpenDialogue = onOpenDialogue || onOpenApplication;
    const roleOpensUsed = Number(subscription?.roleOpensUsed ?? companyProfile?.subscription?.usage?.roleOpensUsed ?? 0);
    const roleOpensAvailable = typeof subscription?.roleOpensAvailable === 'number' ? Number(subscription.roleOpensAvailable) : null;
    const dialogueSlotsUsed = Number(subscription?.dialogueSlotsUsed ?? companyProfile?.subscription?.usage?.activeDialogueSlotsUsed ?? 0);
    const dialogueSlotsAvailable = typeof subscription?.dialogueSlotsAvailable === 'number' ? Number(subscription.dialogueSlotsAvailable) : null;
    const featuredTodayAction = todayActionPlan[0] || null;
    const secondaryTodayActions = todayActionPlan.slice(1, 3);
    const queuePreview = recruiterActionQueue.slice(0, 3);
    const dialoguePreview = resolvedRecentDialogues.slice(0, 3);
    const rolePreview = visibleJobs.slice(0, 3);
    const assessmentPreview = assessmentLibrary.slice(0, 3);

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="space-y-4">
                {visibleJobs.length === 0 && (
                    <CompanyQuickStartPanel
                        onOpenJobs={onOpenJobs}
                        onOpenAssessments={onOpenAssessments}
                        onOpenSettings={onOpenSettings}
                    />
                )}

                    <CompanyWorkspaceHero
                        applicationsLoading={resolvedDialoguesLoading}
                        applicationsLastSyncedAt={resolvedDialoguesLastSyncedAt}
                        liveRolesCount={visibleJobs.length}
                        reviewQueueCount={openApplicationsCount}
                        savedAssessmentsCount={assessmentLibrary.length}
                        onRefreshApplications={onRefreshApplications}
                        onOpenJobs={onOpenJobs}
                        onOpenApplications={onOpenApplications}
                        onOpenAssessments={onOpenAssessments}
                    />

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <MetricCard
                        label={t('company.workspace.metrics.live_roles', { defaultValue: 'Live roles' })}
                        value={visibleJobs.length}
                        hint={roleOpensAvailable != null
                            ? t('company.workspace.metrics.live_roles_hint', {
                                defaultValue: '{{used}} / {{limit}} role opens used this period',
                                used: roleOpensUsed,
                                limit: roleOpensAvailable >= 999 ? t('company.subscription.unlimited') : roleOpensAvailable
                            })
                            : t('company.workspace.metrics.live_roles_hint', { defaultValue: 'Roles currently visible to candidates or in active rotation.' })}
                        className="relative"
                    />
                    <MetricCard
                        label={t('company.workspace.metrics.review_queue', { defaultValue: 'Review queue' })}
                        value={openApplicationsCount}
                        hint={dialogueSlotsAvailable != null
                            ? t('company.workspace.metrics.review_queue_hint', {
                                defaultValue: '{{used}} / {{limit}} dialogue slots currently occupied',
                                used: dialogueSlotsUsed,
                                limit: dialogueSlotsAvailable >= 999 ? t('company.subscription.unlimited') : dialogueSlotsAvailable
                            })
                            : t('company.workspace.metrics.review_queue_hint', { defaultValue: 'Open dialogues still need recruiter action or a clear next step.' })}
                    />
                    <MetricCard
                        label={t('company.workspace.metrics.visibility', { defaultValue: 'Visibility' })}
                        value={totalViews}
                        hint={t('company.workspace.metrics.visibility_hint', {
                            defaultValue: '{{count}} applications captured • {{rate}}% average conversion',
                            count: totalApplicants,
                            rate: averageConversion.toFixed(1)
                        })}
                    />
                    <MetricCard
                        label={t('company.workspace.metrics.candidate_health', { defaultValue: 'Candidate health' })}
                        value={candidateBenchmarks?.shortlist_rate?.value != null ? `${(candidateBenchmarks.shortlist_rate.value * 100).toFixed(0)}%` : '—'}
                        hint={candidateBenchmarks?.transparency?.note || t('company.workspace.metrics.candidate_health_hint', { defaultValue: 'Shortlist efficiency against the current candidate flow.' })}
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
                    <div className="space-y-4">
                        <WorkspacePanel
                            title={t('company.workspace.overview_focus_title', { defaultValue: 'What needs attention now' })}
                            subtitle={t('company.workspace.overview_focus_desc', { defaultValue: 'A simple view of what should happen next, who just applied, and where your team should focus first.' })}
                            action={(
                                <button onClick={onOpenApplications} className="company-pill-surface px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_full_queue', { defaultValue: 'Open dialogue inbox' })}
                                </button>
                            )}
                        >
                            <div className="space-y-4">
                                {featuredTodayAction ? (
                                    <div className="company-surface-soft rounded-[1.05rem] border border-slate-200/80 dark:border-slate-800 p-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.45)]">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="company-pill-surface inline-flex items-center rounded-full border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                                    {featuredTodayAction.label}
                                                </div>
                                                <div className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                                                    {featuredTodayAction.title}
                                                </div>
                                                <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    {featuredTodayAction.detail}
                                                </div>
                                            </div>
                                            <button
                                                onClick={featuredTodayAction.action}
                                                className="self-start rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_26px_-18px_rgba(15,23,42,0.9)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                                            >
                                                {featuredTodayAction.actionLabel}
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {secondaryTodayActions.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {secondaryTodayActions.map((item) => (
                                            <OverviewTodayActionItem
                                                key={item.id}
                                                item={item}
                                            />
                                        ))}
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {t('company.workspace.queue.title', { defaultValue: 'What the team should do next' })}
                                                </div>
                                                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    {t('company.workspace.queue.subtitle', { defaultValue: 'Clear next steps for the team, without digging through multiple screens.' })}
                                                </div>
                                            </div>
                                        </div>

                                        {queuePreview.length === 0 ? (
                                            <div className="company-surface-soft rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {t('company.workspace.queue_empty', { defaultValue: 'No urgent blockers right now. The queue will light up as new recruiter actions appear.' })}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {queuePreview.map((item) => (
                                                    <OverviewQueueItem
                                                        key={item.id}
                                                        item={item}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {t('company.workspace.cards.recent_applications', { defaultValue: 'Newest candidate responses' })}
                                                </div>
                                                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    {t('company.workspace.cards.recent_applications_desc', { defaultValue: 'See who just opened a handshake, review the context, and move the dialogue forward in one click.' })}
                                                </div>
                                            </div>
                                        </div>

                                        {resolvedDialoguesLoading ? (
                                            <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                                        ) : dialoguePreview.length === 0 ? (
                                            <div className="company-surface-soft rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {t('company.workspace.cards.recent_applications_empty', { defaultValue: 'No dialogues yet. As soon as candidates open a handshake, their thread will land here first.' })}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {dialoguePreview.map((app) => (
                                                    <OverviewRecentApplicationItem
                                                        key={app.id}
                                                        application={app}
                                                        onOpenDialogue={handleOpenDialogue}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </WorkspacePanel>

                        <WorkspacePanel
                            title={t('company.workspace.timeline.title', { defaultValue: 'Recent activity timeline' })}
                            subtitle={t('company.workspace.timeline.subtitle', { defaultValue: 'A clean timeline of role updates, candidate movement, and assessment activity.' })}
                        >
                            {workspaceActivity.length === 0 ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">{t('company.workspace.timeline.empty', { defaultValue: 'Activity will appear here as soon as the team starts publishing or reviewing.' })}</div>
                            ) : (
                                <div className="space-y-4">
                                    {workspaceActivity.map((item) => (
                                        <div key={item.id} className="flex gap-3">
                                            <div className="pt-1"><span className="block h-2.5 w-2.5 rounded-full bg-cyan-500" /></div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
                                                <div className="text-sm text-slate-600 dark:text-slate-300">{item.detail}</div>
                                                <div className="text-[11px] text-slate-400 mt-1">{new Date(item.at).toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </WorkspacePanel>
                    </div>

                    <div className="space-y-4">
                        <CompanySubscriptionHero
                            companyProfile={companyProfile}
                            subscription={subscription}
                            subscriptionLabel={subscriptionLabel}
                            isFreeLikeTier={isFreeLikeTier}
                            onManagePlan={onManagePlan}
                        />

                        <WorkspacePanel
                            title={t('company.workspace.control_center_title', { defaultValue: 'Hiring overview' })}
                            subtitle={t('company.workspace.control_center_desc', { defaultValue: 'A quick summary of live roles, reusable screening, and the current state of your dialogue capacity.' })}
                            action={(
                                <button onClick={onOpenJobs} className="company-pill-surface px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_jobs', { defaultValue: 'Open roles' })}
                                </button>
                            )}
                        >
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {t('company.workspace.cards.live_roles', { defaultValue: 'Live roles' })}
                                        </div>
                                        <button onClick={onOpenJobs} className="text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
                                            {t('company.workspace.actions.open_jobs', { defaultValue: 'Open roles' })}
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        {rolePreview.length === 0 ? (
                                            <div className="company-surface-soft rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {t('company.workspace.empty_live_roles', { defaultValue: 'No active roles yet. Create your first role and this panel becomes your live hiring board.' })}
                                            </div>
                                        ) : rolePreview.map((job) => {
                                            const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                                            return (
                                                <OverviewLiveRoleItem
                                                    key={job.id}
                                                    job={job}
                                                    stats={stats}
                                                    onEditJob={onEditJob}
                                                    onOpenJobApplications={onOpenJobApplications}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200/80 pt-4 dark:border-slate-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {t('company.workspace.cards.assessment_library', { defaultValue: 'Assessment library' })}
                                        </div>
                                        <button onClick={onOpenAssessments} className="text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
                                            {t('company.workspace.actions.open_assessment_library', { defaultValue: 'Open assessment hub' })}
                                        </button>
                                    </div>
                                    <div className="mt-3">
                                        {assessmentLibraryLoading ? (
                                            <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                                        ) : assessmentPreview.length === 0 ? (
                                            <div className="company-surface-soft rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {t('company.workspace.cards.assessment_library_empty', { defaultValue: 'No saved assessments yet. Create one once, and the team can reuse it right away.' })}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {assessmentPreview.map((item) => (
                                                    <OverviewAssessmentLibraryItem
                                                        key={item.id}
                                                        assessment={item}
                                                        onOpenAssessments={onOpenAssessments}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200/80 pt-4 dark:border-slate-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {t('company.workspace.cards.candidate_intelligence', { defaultValue: 'Candidate intelligence' })}
                                        </div>
                                        <button onClick={onOpenCandidates} className="text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
                                            {t('company.workspace.actions.open_candidates', { defaultValue: 'Open talent view' })}
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div className="company-surface-soft rounded-[1rem] p-4 border border-slate-200 dark:border-slate-800 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.45)]">
                                            <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.candidate_count', { defaultValue: 'Candidate profiles' })}</div>
                                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{candidatesCount}</div>
                                        </div>
                                        <div className="company-surface-soft rounded-[1rem] p-4 border border-slate-200 dark:border-slate-800 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.45)]">
                                            <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.candidate_coverage', { defaultValue: 'Assessment coverage' })}</div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{candidateCoverageLabel}</div>
                                        </div>
                                    </div>
                                    <div className="company-surface-soft mt-3 rounded-[1rem] border border-slate-200 dark:border-slate-800 p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.45)]">
                                        <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.shortlist_health', { defaultValue: 'Shortlist health' })}</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                                            {candidateBenchmarks?.shortlist_rate?.value != null ? `${(candidateBenchmarks.shortlist_rate.value * 100).toFixed(1)}%` : '—'}
                                        </div>
                                        <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            {candidateBenchmarks?.transparency?.source_name === 'fallback'
                                                ? t('company.workspace.cards.shortlist_health_empty', { defaultValue: 'We will show benchmark quality here once enough recruiter and assessment data accumulates.' })
                                                : (candidateBenchmarks?.transparency?.note || t('company.workspace.cards.shortlist_health_empty', { defaultValue: 'We will show benchmark quality here once enough recruiter and assessment data accumulates.' }))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </WorkspacePanel>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyOverviewWorkspace;
