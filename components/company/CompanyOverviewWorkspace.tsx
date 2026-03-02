import React from 'react';
import { useTranslation } from 'react-i18next';
import { Assessment, CandidateBenchmarkMetrics, CompanyApplicationRow, CompanyProfile, Job } from '../../types';
import { BrainCircuit, Briefcase, Clock, Eye, PenTool, TrendingUp, Users, Zap } from 'lucide-react';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

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
    applicationsLoading: boolean;
    applicationsLastSyncedAt?: string | null;
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
    applicationsLoading,
    applicationsLastSyncedAt,
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
    onOpenApplication,
    onEditJob,
    onOpenJobApplications
}) => {
    const { t, i18n } = useTranslation();
    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-cyan-900 dark:text-cyan-300 mb-1">{t('company.subscription.title')}</h3>
                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                {subscriptionLabel} {t('company.subscription.plan_suffix')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${isFreeLikeTier || !subscription?.status
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : subscription?.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                }`}>
                                {isFreeLikeTier || !subscription?.status ? t('company.subscription.active') : subscription?.status === 'active' ? t('company.subscription.active') : t('company.subscription.inactive')}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        {subscription?.expiresAt && !isFreeLikeTier && (
                            <div className="text-sm text-cyan-700 dark:text-cyan-300">
                                <div className="font-medium">{t('company.subscription.next_payment')}</div>
                                <div className="font-mono">{new Date(subscription.expiresAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')}</div>
                                <div className="text-xs opacity-75">({t('company.subscription.days_left', { count: Math.ceil((new Date(subscription.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) })})</div>
                            </div>
                        )}
                        <div className="mt-2">
                            <button
                                onClick={onManagePlan}
                                className="text-sm px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-medium"
                            >
                                {t('company.subscription.manage')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-cyan-200 dark:border-cyan-800">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-cyan-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.ai_assessments')}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{subscription?.assessmentsAvailable || 0}</div>
                        <div className="text-xs text-slate-500">{subscription?.assessmentsUsed || 0} {t('company.subscription.used')}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Briefcase className="w-4 h-4 text-cyan-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.job_ads')}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                            {subscription?.jobPostingsUsed || 0} / {subscription?.jobPostingsAvailable === 999 ? t('company.subscription.unlimited') : subscription?.jobPostingsAvailable || '1'}
                        </div>
                        <div className="text-xs text-slate-500">{t('company.subscription.used')}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-cyan-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.team_members')}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{companyProfile?.members?.length || 1}</div>
                        <div className="text-xs text-slate-500">
                            {['growth', 'professional', 'enterprise'].includes(String((subscription?.tier || '')).toLowerCase()) ? t('company.subscription.unlimited') : t('company.subscription.no_limit')}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {visibleJobs.length === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                    <Zap size={12} />
                                    {t('company.workspace.quickstart_badge', { defaultValue: 'Quick start' })}
                                </div>
                                <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                                    {t('company.workspace.quickstart_title', { defaultValue: 'Make the dashboard useful from day one' })}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                                    {t('company.workspace.quickstart_desc', { defaultValue: 'Create your first role, prepare a reusable assessment, and finish the core company setup. As soon as the first role is live, the same page becomes your operational hiring cockpit.' })}
                                </p>
                            </div>
                            <button onClick={onOpenJobs} className="px-4 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg shadow-sm hover:bg-cyan-500 transition-colors flex items-center gap-2">
                                <PenTool size={16} />
                                {t('company.dashboard.create_first_ad')}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <button onClick={onOpenJobs} className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    <PenTool size={14} />
                                    {t('company.workspace.quickstart_steps.first_role', { defaultValue: 'Create the first role' })}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {t('company.workspace.quickstart_steps.first_role_desc', { defaultValue: 'Open the structured editor and publish your first job draft.' })}
                                </div>
                            </button>
                            <button onClick={onOpenAssessments} className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    <BrainCircuit size={14} />
                                    {t('company.workspace.quickstart_steps.first_assessment', { defaultValue: 'Prepare one assessment' })}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {t('company.workspace.quickstart_steps.first_assessment_desc', { defaultValue: 'Save at least one reusable assessment for faster screening.' })}
                                </div>
                            </button>
                            <button onClick={onOpenSettings} className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    <Users size={14} />
                                    {t('company.workspace.quickstart_steps.company_setup', { defaultValue: 'Complete company setup' })}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {t('company.workspace.quickstart_steps.company_setup_desc', { defaultValue: 'Finish profile, culture, and hiring defaults before the first applicants arrive.' })}
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                                <Zap size={12} />
                                {t('company.workspace.badge', { defaultValue: 'Hiring workspace' })}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('company.workspace.title', { defaultValue: 'One operational view for your hiring team' })}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
                                    {t('company.workspace.subtitle', {
                                        defaultValue: 'Track live roles, review the candidate queue, monitor assessment readiness, and move to deeper tools only when you need editing or detailed review.'
                                    })}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <WorkspaceSyncBadge
                                loading={applicationsLoading}
                                syncedAt={applicationsLastSyncedAt}
                                syncedKey="company.workspace.sync.live_queue"
                                syncedDefault="Live queue synced {{time}}"
                                onRefresh={onRefreshApplications}
                            />
                            <button onClick={onOpenJobs} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg shadow-sm hover:bg-cyan-500 transition-colors flex items-center gap-2">
                                <PenTool size={16} />
                                {t('company.workspace.actions.new_role', { defaultValue: 'Open job editor' })}
                            </button>
                            <button onClick={onOpenApplications} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                <Users size={16} />
                                {t('company.workspace.actions.review_queue', { defaultValue: 'Open review queue' })}
                            </button>
                            <button onClick={onOpenAssessments} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                <BrainCircuit size={16} />
                                {t('company.workspace.actions.assessments', { defaultValue: 'Open assessments' })}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.metrics.live_roles', { defaultValue: 'Live roles' })}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">{visibleJobs.length}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300"><Briefcase size={18} /></div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('company.workspace.metrics.live_roles_hint', { defaultValue: 'Roles currently visible to candidates or in active rotation.' })}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.metrics.review_queue', { defaultValue: 'Review queue' })}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">{openApplicationsCount}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300"><Clock size={18} /></div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('company.workspace.metrics.review_queue_hint', { defaultValue: 'Applications still need recruiter action or status progression.' })}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.metrics.visibility', { defaultValue: 'Visibility' })}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalViews}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"><Eye size={18} /></div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            {t('company.workspace.metrics.visibility_hint', {
                                defaultValue: '{{count}} applications captured • {{rate}}% average conversion',
                                count: totalApplicants,
                                rate: averageConversion.toFixed(1)
                            })}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.metrics.candidate_health', { defaultValue: 'Candidate health' })}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {candidateBenchmarks?.shortlist_rate?.value != null ? `${(candidateBenchmarks.shortlist_rate.value * 100).toFixed(0)}%` : '—'}
                                </div>
                            </div>
                            <div className="p-2 rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300"><TrendingUp size={18} /></div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            {candidateBenchmarks?.transparency?.note || t('company.workspace.metrics.candidate_health_hint', { defaultValue: 'Shortlist efficiency against the current candidate flow.' })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.today.title', { defaultValue: 'Today / next actions' })}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.today.subtitle', { defaultValue: 'A compact operational focus built from live statuses, recruiter queue movement, and recent activity.' })}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {todayActionPlan.map((item) => (
                                    <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-950/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">{item.label}</span>
                                            <button onClick={item.action} className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">{item.actionLabel}</button>
                                        </div>
                                        <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
                                        <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.queue.title', { defaultValue: 'Recruiter action queue' })}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.queue.subtitle', { defaultValue: 'The next actions most likely to unblock hiring progress.' })}</p>
                            </div>
                            <div className="space-y-3">
                                {recruiterActionQueue.map((item) => (
                                    <button key={item.id} onClick={item.action} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-cyan-300 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                                item.accent === 'amber' ? 'bg-amber-500'
                                                    : item.accent === 'rose' ? 'bg-rose-500'
                                                        : item.accent === 'emerald' ? 'bg-emerald-500'
                                                            : item.accent === 'cyan' ? 'bg-cyan-500'
                                                                : 'bg-slate-400'
                                            }`} />
                                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.cards.recent_applications', { defaultValue: 'Recent applications' })}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dossier, move status, or jump directly into the linked review flow.' })}</p>
                                </div>
                                <button onClick={onOpenApplications} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_full_queue', { defaultValue: 'Open full queue' })}
                                </button>
                            </div>
                            {applicationsLoading ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                            ) : recentApplications.length === 0 ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {t('company.workspace.cards.recent_applications_empty', { defaultValue: 'No applications yet. Once candidates apply, they will appear here first.' })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentApplications.map((app) => (
                                        <div key={app.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{app.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{app.job_title || t('company.dashboard.table.position')}</div>
                                                    {app.candidateHeadline && <div className="text-xs text-slate-500 dark:text-slate-400">{app.candidateHeadline}</div>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {app.hasCv && <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">CV</span>}
                                                    {app.hasCoverLetter && <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">{t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}</span>}
                                                    {app.hasJcfpm && <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 text-[11px] font-medium">JCFPM</span>}
                                                    <button onClick={() => onOpenApplication(app.id)} className="px-3 py-1.5 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20">
                                                        {t('company.workspace.actions.open_dossier', { defaultValue: 'Open dossier' })}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.timeline.title', { defaultValue: 'Recent activity timeline' })}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.timeline.subtitle', { defaultValue: 'A compact audit trail of roles, applications, and assessment changes.' })}</p>
                            </div>
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
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.cards.live_roles', { defaultValue: 'Live roles' })}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.cards.live_roles_desc', { defaultValue: 'Your most important roles with direct access to editing and review.' })}</p>
                                </div>
                                <button onClick={onOpenJobs} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_jobs', { defaultValue: 'Open jobs' })}
                                </button>
                            </div>
                            <div className="space-y-3">
                                {visibleJobs.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                        {t('company.workspace.empty_live_roles', { defaultValue: 'No live roles yet. Create the first structured draft and this panel will turn into your live roles monitor.' })}
                                    </div>
                                ) : visibleJobs.slice(0, 4).map((job) => {
                                    const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                                    const lifecycleStatus = String((job as any).status || 'active');
                                    return (
                                        <div key={job.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{job.location}</div>
                                                </div>
                                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">{lifecycleStatus}</span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-[11px] text-slate-500">{t('company.dashboard.table.views_count')}</div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                                                </div>
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-[11px] text-slate-500">{t('company.workspace.labels.applications', { defaultValue: 'Applications' })}</div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                                                </div>
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-[11px] text-slate-500">{t('company.dashboard.table.conv_rate')}</div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button onClick={() => onEditJob(job.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    {t('company.dashboard.actions.edit')}
                                                </button>
                                                <button onClick={() => onOpenJobApplications(job.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.cards.assessment_library', { defaultValue: 'Assessment library' })}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.cards.assessment_library_desc', { defaultValue: 'Reusable assessments available to recruiters right now.' })}</p>
                                </div>
                                <button onClick={onOpenAssessments} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_assessment_library', { defaultValue: 'Open library' })}
                                </button>
                            </div>
                            {assessmentLibraryLoading ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                            ) : assessmentLibrary.length === 0 ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">{t('company.workspace.cards.assessment_library_empty', { defaultValue: 'No saved assessments yet. Create one and the team can reuse it immediately.' })}</div>
                            ) : (
                                <div className="space-y-3">
                                    {assessmentLibrary.slice(0, 4).map((item) => (
                                        <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.role}</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button onClick={onOpenAssessments} className="px-3 py-1.5 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20">
                                                    {t('company.workspace.actions.use_assessment', { defaultValue: 'Use in workflow' })}
                                                </button>
                                                <button onClick={onOpenAssessments} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    {t('company.workspace.actions.preview_assessment', { defaultValue: 'Preview' })}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.workspace.cards.candidate_intelligence', { defaultValue: 'Candidate intelligence' })}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company.workspace.cards.candidate_intelligence_desc', { defaultValue: 'A compact view of candidate flow quality without leaving the workspace.' })}</p>
                                </div>
                                <button onClick={onOpenCandidates} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {t('company.workspace.actions.open_candidates', { defaultValue: 'Open candidates' })}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/30 p-4 border border-slate-200 dark:border-slate-800">
                                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.candidate_count', { defaultValue: 'Candidate profiles' })}</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{candidatesCount}</div>
                                </div>
                                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/30 p-4 border border-slate-200 dark:border-slate-800">
                                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.candidate_coverage', { defaultValue: 'Assessment coverage' })}</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{candidateCoverageLabel}</div>
                                </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.workspace.cards.shortlist_health', { defaultValue: 'Shortlist health' })}</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                    {candidateBenchmarks?.shortlist_rate?.value != null ? `${(candidateBenchmarks.shortlist_rate.value * 100).toFixed(1)}%` : '—'}
                                </div>
                                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    {candidateBenchmarks?.transparency?.note || t('company.workspace.cards.shortlist_health_empty', { defaultValue: 'We will show benchmark quality here once enough recruiter and assessment data accumulates.' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyOverviewWorkspace;
