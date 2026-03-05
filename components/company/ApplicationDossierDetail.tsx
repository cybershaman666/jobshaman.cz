import React from 'react';
import { useTranslation } from 'react-i18next';
import { DialogueDossier } from '../../types';
import {
    fetchCompanyDialogueMessages,
    sendCompanyDialogueMessage
} from '../../services/jobApplicationService';
import ApplicationMessageCenter from '../ApplicationMessageCenter';
import AssessmentResultsList from '../AssessmentResultsList';
import SectionHeader from './SectionHeader';

interface ApplicationDossierDetailProps {
    dossier: DialogueDossier;
    dialogue?: DialogueDossier;
    companyId: string;
    locale: string;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromApplication: () => void;
    onCreateAssessmentFromDialogue?: () => void;
    onInviteCandidateFromDialogue?: () => void;
}

const ApplicationDossierDetail: React.FC<ApplicationDossierDetailProps> = ({
    dossier,
    dialogue: dialogueProp,
    companyId,
    locale,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromApplication,
    onCreateAssessmentFromDialogue,
    onInviteCandidateFromDialogue
}) => {
    const { t } = useTranslation();
    const dialogue = dialogueProp || dossier;
    const handleCreateAssessment = onCreateAssessmentFromDialogue || onCreateAssessmentFromApplication;
    const handleInviteCandidate = onInviteCandidateFromDialogue || onInviteCandidateFromApplication;
    if (!dialogue) return null;

    const getReadableStatus = (status: DialogueDossier['status']) => {
        switch (status) {
            case 'reviewed':
                return t('company.dashboard.status.approved', { defaultValue: 'Reviewed' });
            case 'shortlisted':
                return t('company.dashboard.status.shortlisted', { defaultValue: 'Shortlisted' });
            case 'rejected':
            case 'closed_rejected':
                return t('company.dashboard.status.refused', { defaultValue: 'Rejected' });
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
                return t('company.dashboard.status.pending', { defaultValue: 'Pending' });
        }
    };

    const getTimingMeta = () => {
        const closedReason = String(dossier.dialogue_closed_reason || '').trim().toLowerCase();
        if (dossier.status === 'closed_timeout' || closedReason === 'timeout') {
            return {
                label: t('company.applications.timeout_closed', { defaultValue: 'This dialogue was closed because neither side replied in time.' }),
                className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
            };
        }
        const deadlineValue = String(dossier.dialogue_deadline_at || '').trim();
        if (!deadlineValue || !['pending', 'reviewed', 'shortlisted'].includes(String(dossier.status || 'pending'))) {
            return null;
        }
        const deadline = new Date(deadlineValue);
        if (Number.isNaN(deadline.getTime())) return null;
        const msRemaining = deadline.getTime() - Date.now();
        const actorLabel =
            dossier.dialogue_current_turn === 'candidate'
                ? t('company.applications.turn_candidate', { defaultValue: 'Waiting for candidate' })
                : t('company.applications.turn_company', { defaultValue: 'Your reply is due' });
        if (dossier.dialogue_is_overdue || msRemaining <= 0) {
            return {
                label: `${actorLabel} • ${t('company.applications.deadline_passed', { defaultValue: 'deadline passed' })}`,
                className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
            };
        }
        return {
            label: `${actorLabel} • ${deadline.toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-US')}`,
            className: 'border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300'
        };
    };

    const getClosedReasonMeta = () => {
        if (['pending', 'reviewed', 'shortlisted'].includes(String(dossier.status || 'pending'))) {
            return null;
        }
        const normalizedReason = String(dossier.dialogue_closed_reason || dossier.status || '').trim().toLowerCase();
        switch (normalizedReason) {
            case 'timeout':
            case 'closed_timeout':
                return {
                    label: t('company.applications.close_reason_timeout', { defaultValue: 'The reply window expired before either side responded.' }),
                    className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                };
            case 'rejected':
            case 'closed_rejected':
                return {
                    label: t('company.applications.close_reason_rejected', { defaultValue: 'This dialogue was closed without moving the candidate forward.' }),
                    className: 'border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
                };
            case 'withdrawn':
            case 'closed_withdrawn':
                return {
                    label: t('company.applications.close_reason_withdrawn', { defaultValue: 'The candidate withdrew from this dialogue.' }),
                    className: 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300'
                };
            case 'closed_role_filled':
                return {
                    label: t('company.applications.close_reason_role_filled', { defaultValue: 'The role was filled before this dialogue continued.' }),
                    className: 'border-indigo-200 bg-indigo-50/80 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300'
                };
            case 'hired':
                return {
                    label: t('company.applications.close_reason_hired', { defaultValue: 'This dialogue ended in a hire decision.' }),
                    className: 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                };
            case 'closed':
            default:
                return {
                    label: t('company.applications.close_reason_generic', { defaultValue: 'This dialogue was closed without an active next step.' }),
                    className: 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300'
                };
        }
    };

    const timingMeta = getTimingMeta();
    const closeReasonMeta = getClosedReasonMeta();

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.dashboard.table.position')}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.job_title || t('company.dashboard.table.position')}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.dashboard.table.status', { defaultValue: 'Status' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {getReadableStatus(dossier.status)}
                        {closeReasonMeta ? (
                            <div className="mt-2 text-xs font-normal leading-5 text-slate-600 dark:text-slate-300">
                                {closeReasonMeta.label}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.workspace.timeline.application_received', { defaultValue: 'Handshake opened' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.submitted_at
                            ? new Date(dossier.submitted_at).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-US')
                            : '—'}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.applications.detail.source', { defaultValue: 'Source' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            {(timingMeta || closeReasonMeta) ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${(timingMeta || closeReasonMeta)?.className}`}>
                    {(timingMeta || closeReasonMeta)?.label}
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.candidate', { defaultValue: 'Candidate' })}</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.candidate_profile_snapshot?.name || dossier.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        {dossier.candidate_profile_snapshot?.email || dossier.candidate_email || t('company.applications.detail.no_email', { defaultValue: 'No email' })}
                    </div>
                    {dossier.candidate_profile_snapshot?.phone && (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {dossier.candidate_profile_snapshot.phone}
                        </div>
                    )}
                    {dossier.candidate_profile_snapshot?.jobTitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {dossier.candidate_profile_snapshot.jobTitle}
                        </div>
                    )}
                </div>
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.documents', { defaultValue: 'Documents' })}</div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                        {dossier.cv_snapshot?.originalName || dossier.cv_snapshot?.label || t('company.applications.detail.no_cv', { defaultValue: 'No CV attached' })}
                    </div>
                    {dossier.cv_snapshot?.fileUrl && (
                        <a
                            href={dossier.cv_snapshot.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                            {t('company.candidates.open_cv', { defaultValue: 'Open CV' })}
                        </a>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {t('company.applications.detail.source', { defaultValue: 'Source' })}: {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            {dossier.candidate_profile_snapshot?.skills?.length ? (
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.skills', { defaultValue: 'Skills' })}</div>
                    <div className="flex flex-wrap gap-2">
                        {dossier.candidate_profile_snapshot.skills.map((skill) => (
                            <span key={skill} className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                {dossier.cover_letter ? (
                    <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                        <SectionHeader
                            title={t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}
                            className="mb-2"
                        />
                        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {dossier.cover_letter}
                        </div>
                    </div>
                ) : null}

                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <SectionHeader
                        title={t('company.applications.detail.assessment_actions', { defaultValue: 'Next assessment steps' })}
                        subtitle={t('company.applications.detail.assessment_hint', { defaultValue: 'Keep this dialogue linked while you launch screening or send an invite.' })}
                        className="mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCreateAssessment}
                            className="px-3 py-2 rounded-full border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                        >
                            {t('company.dashboard.actions.create_assessment', { defaultValue: 'Create assessment' })}
                        </button>
                        <button
                            onClick={handleInviteCandidate}
                            className="px-3 py-2 rounded-full border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                        >
                            {t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this dialogue' })}
                        </button>
                    </div>
                </div>
            </div>

            {dossier.shared_jcfpm_payload ? (
                <div className="rounded-[22px] border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/70 dark:bg-cyan-950/20 p-4 space-y-3 shadow-[0_18px_36px_-30px_rgba(6,182,212,0.35)]">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Profile fit signal</div>
                        <div className="text-[11px] text-cyan-700 dark:text-cyan-300">
                            {t('company.applications.labels.summary', { defaultValue: 'Shared' })}
                        </div>
                    </div>
                    {dossier.shared_jcfpm_payload.archetype?.title && (
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {dossier.shared_jcfpm_payload.archetype.title}
                        </div>
                    )}
                    {dossier.shared_jcfpm_payload.strengths?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.skills', { defaultValue: 'Strengths' })}</div>
                            <div className="flex flex-wrap gap-2">
                                {dossier.shared_jcfpm_payload.strengths.map((item) => (
                                    <span key={item} className="px-2.5 py-1 text-xs rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border border-cyan-100 dark:border-cyan-900/40">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.environment_fit_summary?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.environment_fit', { defaultValue: 'Environment fit' })}</div>
                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.environment_fit_summary.map((item) => (
                                    <li key={item}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.comparison_signals?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                {t('company.applications.detail.comparison_signals', { defaultValue: 'Comparable signals' })}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {dossier.shared_jcfpm_payload.comparison_signals.map((item) => (
                                    <div key={`${item.key}-${item.score}`} className="rounded-xl border border-cyan-100 dark:border-cyan-900/30 bg-white/75 dark:bg-slate-900/40 px-3 py-2">
                                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                            {item.label}
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-cyan-500"
                                                    style={{ width: `${Math.max(6, Math.min(100, item.score || 0))}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.score}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.top_dimensions?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.top_dimensions', { defaultValue: 'Top dimensions' })}</div>
                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.top_dimensions.map((item) => (
                                    <div key={`${item.dimension}-${item.percentile}`} className="flex items-center justify-between">
                                        <span>{item.label || item.dimension}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{Math.round(item.percentile)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-[22px] border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/20">
                    {t('company.candidates.no_jcfpm_shared', { defaultValue: 'This candidate did not share a deeper profile signal with the handshake.' })}
                </div>
            )}

            <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                <SectionHeader
                    title={t('company.applications.detail.related_assessments', { defaultValue: 'Related assessments' })}
                    subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Assessment results linked to this applicant will appear here automatically.' })}
                    className="mb-2"
                />
                <AssessmentResultsList
                    companyId={companyId}
                    dialogueIdFilter={dialogue.id}
                    applicationIdFilter={dialogue.id}
                    candidateEmailFilter={dialogue.candidate_profile_snapshot?.email || dialogue.candidate_email || undefined}
                />
            </div>

            <ApplicationMessageCenter
                dialogueId={dialogue.id}
                applicationId={dialogue.id}
                storageOwnerId={companyId}
                viewerRole="recruiter"
                dialogueStatus={dialogue.status}
                dialogueDeadlineAt={dialogue.dialogue_deadline_at || null}
                dialogueTimeoutHours={dialogue.dialogue_timeout_hours ?? null}
                dialogueCurrentTurn={dialogue.dialogue_current_turn || null}
                dialogueClosedReason={dialogue.dialogue_closed_reason || null}
                dialogueIsOverdue={Boolean(dialogue.dialogue_is_overdue)}
                heading={t('company.applications.detail.messages_title', { defaultValue: 'Dialogue thread' })}
                subtitle={t('company.applications.detail.messages_desc', {
                    defaultValue: 'Use asynchronous dialogue messages for clarifications, document requests, and follow-up without live chat pressure.'
                })}
                emptyText={t('company.applications.detail.messages_empty', {
                    defaultValue: 'No messages yet. Start the dialogue when you need additional information or want to share a document.'
                })}
                fetchMessages={fetchCompanyDialogueMessages}
                sendMessage={sendCompanyDialogueMessage}
            />
        </div>
    );
};

export default ApplicationDossierDetail;
