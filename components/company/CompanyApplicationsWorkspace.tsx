import React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, X } from 'lucide-react';
import { CompanyApplicationRow, DialogueDossier, Job } from '../../types';
import ApplicationDossierDetail from './ApplicationDossierDetail';
import MetricCard from './MetricCard';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspacePanel from './WorkspacePanel';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

const getAvatarInitials = (value: string): string => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return 'JS';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

interface CompanyApplicationsWorkspaceProps {
    jobs: Job[];
    selectedJobId: string;
    selectedJob: Job | null;
    dialogues?: CompanyApplicationRow[];
    applications: CompanyApplicationRow[];
    dialoguesLoading?: boolean;
    applicationsLoading: boolean;
    dialoguesUpdating?: Record<string, boolean>;
    applicationsUpdating: Record<string, boolean>;
    selectedDialogueId?: string | null;
    selectedApplicationId: string | null;
    selectedDialogueDetail?: DialogueDossier | null;
    selectedApplicationDetail: DialogueDossier | null;
    dialogueDetailLoading?: boolean;
    applicationDetailLoading: boolean;
    lastSyncedAt?: string | null;
    companyId: string;
    onSelectedJobChange: (jobId: string) => void;
    onOpenJobs: () => void;
    onRefresh: () => void;
    onOpenDialogue?: (dialogueId: string) => void;
    onOpenApplication: (applicationId: string) => void;
    onCloseDetail: () => void;
    onStatusChange: (applicationId: string, status: CompanyApplicationRow['status']) => void;
    onCreateAssessmentFromDialogue?: () => void;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromDialogue?: () => void;
    onInviteCandidateFromApplication: () => void;
}

const CompanyApplicationsWorkspace: React.FC<CompanyApplicationsWorkspaceProps> = ({
    jobs,
    selectedJobId,
    selectedJob,
    dialogues,
    applications,
    dialoguesLoading,
    applicationsLoading,
    dialoguesUpdating,
    applicationsUpdating,
    selectedDialogueId,
    selectedApplicationId,
    selectedDialogueDetail,
    selectedApplicationDetail,
    dialogueDetailLoading,
    applicationDetailLoading,
    lastSyncedAt,
    companyId,
    onSelectedJobChange,
    onOpenJobs,
    onRefresh,
    onOpenDialogue,
    onOpenApplication,
    onCloseDetail,
    onStatusChange,
    onCreateAssessmentFromDialogue,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromDialogue,
    onInviteCandidateFromApplication
}) => {
    const { t, i18n } = useTranslation();
    const languagePrefix = String(i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = languagePrefix === 'cs' || languagePrefix === 'sk';
    const resolvedDialogues = dialogues ?? applications;
    const resolvedDialoguesLoading = dialoguesLoading ?? applicationsLoading;
    const resolvedDialoguesUpdating = dialoguesUpdating ?? applicationsUpdating;
    const resolvedSelectedDialogueId = selectedDialogueId ?? selectedApplicationId;
    const resolvedSelectedDialogueDetail = selectedDialogueDetail ?? selectedApplicationDetail;
    const resolvedDialogueDetailLoading = dialogueDetailLoading ?? applicationDetailLoading;
    const handleOpenDialogue = onOpenDialogue || onOpenApplication;
    const handleCreateAssessment = onCreateAssessmentFromDialogue || onCreateAssessmentFromApplication;
    const handleInviteCandidate = onInviteCandidateFromDialogue || onInviteCandidateFromApplication;
    const sharedJcfpmCount = resolvedDialogues.filter((dialogue) => dialogue.hasJcfpm).length;
    const openDialogues = resolvedDialogues.filter((dialogue) => ['pending', 'reviewed', 'shortlisted'].includes(String(dialogue.status || 'pending')));
    const resolvedResponseSlaHours = (() => {
        const detailHours = Number(resolvedSelectedDialogueDetail?.dialogue_timeout_hours);
        if (Number.isFinite(detailHours) && detailHours > 0) return Math.max(1, Math.round(detailHours));
        const firstOpen = openDialogues.find((item) => Number(item.dialogue_timeout_hours) > 0);
        const openHours = Number(firstOpen?.dialogue_timeout_hours);
        if (Number.isFinite(openHours) && openHours > 0) return Math.max(1, Math.round(openHours));
        return 48;
    })();
    const responseSlaLabel =
        resolvedResponseSlaHours % 24 === 0
            ? t('company.applications.reaction_sla_days', {
                defaultValue: isCsLike ? '{{count}} dní' : '{{count}} days',
                count: Math.max(1, Math.round(resolvedResponseSlaHours / 24))
            })
            : t('company.applications.reaction_sla_hours', {
                defaultValue: isCsLike ? '{{count}} hodin' : '{{count}} hours',
                count: resolvedResponseSlaHours
            });

    const getStatusLabel = (status: CompanyApplicationRow['status']) => {
        switch (status) {
            case 'reviewed':
                return t('company.applications.response_state_read', { defaultValue: isCsLike ? 'Přečteno' : 'Read' });
            case 'shortlisted':
                return t('company.applications.response_state_continue', { defaultValue: isCsLike ? 'Chceme pokračovat' : 'Continue' });
            case 'rejected':
            case 'closed_rejected':
                return t('company.applications.response_state_declined', {
                    defaultValue: isCsLike ? 'Děkujeme, ale hledáme jiný přístup' : 'Thanks, different direction'
                });
            case 'hired':
                return t('company.dashboard.status.hired', { defaultValue: 'Hired' });
            case 'withdrawn':
            case 'closed_withdrawn':
                return t('company.applications.status.withdrawn', { defaultValue: 'Withdrawn' });
            case 'closed_timeout':
                return t('company.applications.status.timeout', { defaultValue: 'Closed by timeout' });
            case 'closed_role_filled':
                return t('company.applications.status.role_filled', { defaultValue: 'Role filled' });
            case 'closed':
                return t('company.applications.status.closed', { defaultValue: 'Closed' });
            default:
                return t('company.applications.response_state_pending', {
                    defaultValue: isCsLike ? 'Čeká na první reakci' : 'Waiting for first response'
                });
        }
    };

    const getStatusBadgeClass = (status: CompanyApplicationRow['status']) => {
        switch (status) {
            case 'shortlisted':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'rejected':
            case 'closed_rejected':
                return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
            case 'hired':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'closed_timeout':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'withdrawn':
            case 'closed':
            case 'closed_withdrawn':
                return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'closed_role_filled':
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'reviewed':
                return 'border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] text-[var(--accent)]';
            default:
                return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    const isSelectableStatus = (status: CompanyApplicationRow['status']) =>
        ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'].includes(String(status || 'pending'));

    const getDialogueClosedReasonMeta = (
        item: Pick<CompanyApplicationRow, 'status' | 'dialogue_closed_reason'>
    ): { label: string; className: string } | null => {
        if (!item || ['pending', 'reviewed', 'shortlisted'].includes(String(item.status || 'pending'))) {
            return null;
        }

        const normalizedReason = String(item.dialogue_closed_reason || item.status || '').trim().toLowerCase();
        switch (normalizedReason) {
            case 'timeout':
            case 'closed_timeout':
                return {
                    label: t('company.applications.close_reason_timeout', { defaultValue: 'The reply window expired before either side responded.' }),
                    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                };
            case 'rejected':
            case 'closed_rejected':
                return {
                    label: t('company.applications.close_reason_rejected', { defaultValue: 'You closed this dialogue without moving the candidate forward.' }),
                    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                };
            case 'withdrawn':
            case 'closed_withdrawn':
                return {
                    label: t('company.applications.close_reason_withdrawn', { defaultValue: 'The candidate withdrew from this dialogue.' }),
                    className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                };
            case 'closed_role_filled':
                return {
                    label: t('company.applications.close_reason_role_filled', { defaultValue: 'The role was filled before this dialogue continued.' }),
                    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                };
            case 'hired':
                return {
                    label: t('company.applications.close_reason_hired', { defaultValue: 'This dialogue ended in a hire decision.' }),
                    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                };
            case 'closed':
            default:
                return {
                    label: t('company.applications.close_reason_generic', { defaultValue: 'This dialogue was closed without an active next step.' }),
                    className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                };
        }
    };

    const getDialogueTimingMeta = (
        item: Pick<
            CompanyApplicationRow,
            'status' | 'dialogue_deadline_at' | 'dialogue_current_turn' | 'dialogue_closed_reason' | 'dialogue_is_overdue'
        >
    ): { label: string; className: string } | null => {
        const closedReason = String(item.dialogue_closed_reason || '').trim().toLowerCase();
        if (item.status === 'closed_timeout' || closedReason === 'timeout') {
            return {
                label: t('company.applications.timeout_closed', { defaultValue: 'Closed after the reply window expired.' }),
                className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            };
        }
        if (!['pending', 'reviewed', 'shortlisted'].includes(String(item.status || 'pending'))) {
            return null;
        }
        const deadlineValue = String(item.dialogue_deadline_at || '').trim();
        if (!deadlineValue) return null;
        const deadline = new Date(deadlineValue);
        if (Number.isNaN(deadline.getTime())) return null;
        const msRemaining = deadline.getTime() - Date.now();
        const actorLabel =
            item.dialogue_current_turn === 'candidate'
                ? t('company.applications.turn_candidate', { defaultValue: 'Waiting for candidate' })
                : t('company.applications.turn_company', { defaultValue: 'Your reply is due' });
        if (item.dialogue_is_overdue || msRemaining <= 0) {
            return {
                label: `${actorLabel} • ${t('company.applications.deadline_passed', { defaultValue: 'deadline passed' })}`,
                className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            };
        }
        const totalHours = msRemaining / (60 * 60 * 1000);
        const windowLabel =
            totalHours < 1
                ? t('company.applications.deadline_under_hour', { defaultValue: '< 1 hour left' })
                : totalHours < 24
                    ? t('company.applications.deadline_hours', {
                        defaultValue: '{{count}} h left',
                        count: Math.max(1, Math.ceil(totalHours))
                    })
                    : t('company.applications.deadline_days', {
                        defaultValue: '{{count}} d left',
                        count: Math.max(1, Math.ceil(totalHours / 24))
                    });
        return {
            label: `${actorLabel} • ${windowLabel}`,
            className:
                totalHours <= 12
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] text-[var(--accent)]'
        };
    };

    const getResponseSlaHint = (
        item: Pick<CompanyApplicationRow, 'dialogue_timeout_hours'>
    ): string => {
        const rawHours = Number(item.dialogue_timeout_hours);
        const resolvedHours = Number.isFinite(rawHours) && rawHours > 0 ? Math.max(1, Math.round(rawHours)) : 48;
        const windowLabel =
            resolvedHours % 24 === 0
                ? t('company.applications.response_sla_days', {
                    defaultValue: isCsLike ? '{{count}} dní' : '{{count}} days',
                    count: Math.max(1, Math.round(resolvedHours / 24))
                })
                : t('company.applications.response_sla_hours', {
                    defaultValue: isCsLike ? '{{count}} hodin' : '{{count}} hours',
                    count: resolvedHours
                });
        return t('company.applications.response_sla_hint_inline', {
            defaultValue: isCsLike ? 'SLA reakce: {{window}}' : 'Response SLA: {{window}}',
            window: windowLabel
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<Briefcase size={12} />}
                badgeLabel={t('company.applications.title', { defaultValue: 'Dialogue inbox' })}
                title={t('company.applications.title', { defaultValue: 'Dialogue inbox' })}
                subtitle={t('company.applications.subtitle', { defaultValue: 'Review active handshakes, move them forward, and keep each person in context.' })}
                actions={
                    <>
                        <WorkspaceSyncBadge
                            loading={resolvedDialoguesLoading}
                            syncedAt={lastSyncedAt}
                            onRefresh={onRefresh}
                        />
                        <div className="company-control min-w-[240px] px-3.5 py-2.5">
                            <div className="mb-1 text-[11px] uppercase tracking-widest text-[var(--text-faint)]">
                                {t('company.jobs.open_applications', { defaultValue: 'Open role dialogues' })}
                            </div>
                            <select
                                value={selectedJobId}
                                onChange={(e) => onSelectedJobChange(e.target.value)}
                                className="w-full cursor-pointer border-none bg-transparent p-0 font-semibold text-[var(--text-strong)] ring-0 focus:outline-none dark:[color-scheme:dark]"
                            >
                                {jobs.map((job) => (
                                    <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={onOpenJobs} className="app-button-secondary rounded-full px-4 py-2.5 text-sm">
                            {t('company.workspace.actions.open_jobs', { defaultValue: 'Open roles' })}
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard
                    label={t('company.workspace.labels.applications', { defaultValue: 'Dialogues' })}
                    value={resolvedDialogues.length}
                    hint={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'See who just opened a handshake, review the context, and move the dialogue forward in one click.' })}
                />
                <MetricCard
                    label={t('company.workspace.metrics.review_queue', { defaultValue: 'Needs review' })}
                    value={openDialogues.length}
                    hint={t('company.workspace.metrics.review_queue_hint', { defaultValue: 'Open dialogues still need recruiter action or a clear next step.' })}
                />
                <MetricCard
                    label={t('company.applications.metrics.shared_jcfpm', { defaultValue: 'Shared profile signal' })}
                    value={sharedJcfpmCount}
                    hint={t('company.applications.metrics.shared_jcfpm_hint', { defaultValue: 'Candidates who shared a deeper profile signal for better hiring context.' })}
                />
                <MetricCard
                    label={t('company.assessment_library.selected_role', { defaultValue: 'Role in focus' })}
                    value={<span className="text-base font-semibold">{selectedJob?.title || t('company.dashboard.table.position')}</span>}
                    hint={selectedJob?.location || t('company.dashboard.empty_state_desc')}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3">
                <WorkspacePanel className="p-3">
                    <SectionHeader
                        title={t('company.candidates.applications_title', { defaultValue: 'Active dialogues' })}
                        subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dialogue, move status, or jump directly into the linked review flow.' })}
                            aside={resolvedDialoguesLoading ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</span>
                        ) : undefined}
                        className="mb-3"
                    />
                    <div className="mb-3 rounded-[0.9rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
                        {t('company.applications.reaction_sla_hint', {
                            defaultValue: isCsLike
                                ? 'Kandidát vidí očekávání první reakce do {{window}}.'
                                : 'Candidates see first-response expectation within {{window}}.',
                            window: responseSlaLabel
                        })}
                    </div>
                    {resolvedDialogues.length === 0 && !resolvedDialoguesLoading ? (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.candidates.applications_empty', { defaultValue: 'No dialogues for the selected role yet.' })}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {resolvedDialogues.map((dialogue) => {
                                const timingMeta = getDialogueTimingMeta(dialogue);
                                const closeReasonMeta = getDialogueClosedReasonMeta(dialogue);
                                return (
                                <div key={dialogue.id} className="rounded-[1rem] border border-slate-200/80 bg-white/85 px-3 py-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/30">
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex items-start gap-3">
                                                {dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url ? (
                                                    <img
                                                        src={dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url}
                                                        alt={dialogue.candidate_name || 'Candidate'}
                                                        className="h-11 w-11 shrink-0 rounded-2xl object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                                        {getAvatarInitials(dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }))}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                                        <div>{dialogue.job_title || t('company.dashboard.table.position')}</div>
                                                        {dialogue.candidateHeadline && (
                                                            <div className="text-[11px] text-slate-400">{dialogue.candidateHeadline}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelectableStatus(dialogue.status) ? (
                                                <select
                                                    value={dialogue.status}
                                                    onChange={(e) => onStatusChange(dialogue.id, e.target.value as CompanyApplicationRow['status'])}
                                                    className="company-control rounded-full px-2.5 py-1 text-xs dark:[color-scheme:dark]"
                                                    disabled={resolvedDialoguesUpdating[dialogue.id]}
                                                >
                                                    <option value="pending">{t('company.applications.response_state_pending', { defaultValue: isCsLike ? 'Čeká na první reakci' : 'Waiting for first response' })}</option>
                                                    <option value="reviewed">{t('company.applications.response_state_read', { defaultValue: isCsLike ? 'Přečteno' : 'Read' })}</option>
                                                    <option value="shortlisted">{t('company.applications.response_state_continue', { defaultValue: isCsLike ? 'Chceme pokračovat' : 'We want to continue' })}</option>
                                                    <option value="rejected">{t('company.applications.response_state_declined', { defaultValue: isCsLike ? 'Děkujeme, ale hledáme jiný přístup' : 'Thanks, different direction' })}</option>
                                                    <option value="hired">{t('company.dashboard.status.hired', { defaultValue: 'Hired' })}</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(dialogue.status)}`}>
                                                    {getStatusLabel(dialogue.status)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px]">
                                            {timingMeta && (
                                                <span className={`rounded-full px-2 py-1 ${timingMeta.className}`}>
                                                    {timingMeta.label}
                                                </span>
                                            )}
                                            {closeReasonMeta && (
                                                <span className={`rounded-full px-2 py-1 ${closeReasonMeta.className}`}>
                                                    {closeReasonMeta.label}
                                                </span>
                                            )}
                                            <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
                                                {getResponseSlaHint(dialogue)}
                                            </span>
                                            {dialogue.hasCv && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">CV</span>}
                                            {dialogue.hasCoverLetter && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}</span>}
                                            {dialogue.hasJcfpm && (
                                                <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
                                                    JCFPM: {t('company.applications.labels.summary', { defaultValue: 'Shared' })}
                                                </span>
                                            )}
                                            {resolvedDialoguesUpdating[dialogue.id] && (
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    {t('common.saving', { defaultValue: 'Saving…' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleOpenDialogue?.(dialogue.id)}
                                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                    resolvedSelectedDialogueId === dialogue.id
                                                        ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                                        : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]'
                                                }`}
                                            >
                                                {t('company.candidates.open_application', { defaultValue: 'Open dialogue' })}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </WorkspacePanel>

                <WorkspacePanel className="p-3" bodyClassName="space-y-3">
                    <SectionHeader
                        title={t('company.candidates.application_review_title', { defaultValue: 'Dialogue review' })}
                        subtitle={resolvedSelectedDialogueDetail
                            ? (getDialogueTimingMeta(resolvedSelectedDialogueDetail) || getDialogueClosedReasonMeta(resolvedSelectedDialogueDetail) || null)?.label ||
                              (resolvedSelectedDialogueDetail.submitted_at
                                  ? new Date(resolvedSelectedDialogueDetail.submitted_at).toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')
                                  : t('company.candidates.application_review_desc', { defaultValue: 'Structured dossier for recruiter review.' }))
                            : t('company.candidates.application_review_desc', { defaultValue: 'Structured dossier for recruiter review.' })}
                        aside={resolvedSelectedDialogueDetail ? (
                            <button
                                onClick={onCloseDetail}
                                className="rounded-[0.85rem] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        ) : undefined}
                    />

                    {resolvedDialogueDetailLoading ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                    ) : resolvedSelectedDialogueDetail ? (
                        <ApplicationDossierDetail
                            dialogue={resolvedSelectedDialogueDetail}
                            dossier={resolvedSelectedDialogueDetail}
                            companyId={companyId}
                            locale={i18n.language}
                            onCreateAssessmentFromDialogue={handleCreateAssessment}
                            onCreateAssessmentFromApplication={handleCreateAssessment}
                            onInviteCandidateFromDialogue={handleInviteCandidate}
                            onInviteCandidateFromApplication={handleInviteCandidate}
                        />
                    ) : (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.applications.detail.select_prompt', { defaultValue: 'Select a dialogue from the queue to review the full context.' })}
                        </div>
                    )}
                </WorkspacePanel>
            </div>
        </div>
    );
};

export default CompanyApplicationsWorkspace;
