import React from 'react';
import { useTranslation } from 'react-i18next';
import { ApplicationDossier } from '../../types';
import AssessmentResultsList from '../AssessmentResultsList';
import SectionHeader from './SectionHeader';

interface ApplicationDossierDetailProps {
    dossier: ApplicationDossier;
    companyId: string;
    locale: string;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromApplication: () => void;
}

const ApplicationDossierDetail: React.FC<ApplicationDossierDetailProps> = ({
    dossier,
    companyId,
    locale,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromApplication
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                        {t('company.dashboard.table.position')}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.job_title || t('company.dashboard.table.position')}
                    </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                        {t('company.dashboard.table.status', { defaultValue: 'Status' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {String(dossier.status || 'pending')}
                    </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                        {t('company.workspace.timeline.application_received', { defaultValue: 'Application received' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.submitted_at
                            ? new Date(dossier.submitted_at).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-US')
                            : '—'}
                    </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                        {t('company.applications.detail.source', { defaultValue: 'Source' })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t('company.applications.detail.candidate', { defaultValue: 'Candidate' })}</div>
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
                        <div className="text-xs text-slate-500 mt-2">
                            {dossier.candidate_profile_snapshot.jobTitle}
                        </div>
                    )}
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t('company.applications.detail.documents', { defaultValue: 'Documents' })}</div>
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
                    <div className="text-xs text-slate-500 mt-2">
                        {t('company.applications.detail.source', { defaultValue: 'Source' })}: {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            {dossier.candidate_profile_snapshot?.skills?.length ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t('company.applications.detail.skills', { defaultValue: 'Skills' })}</div>
                    <div className="flex flex-wrap gap-2">
                        {dossier.candidate_profile_snapshot.skills.map((skill) => (
                            <span key={skill} className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                {dossier.cover_letter ? (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <SectionHeader
                            title={t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}
                            className="mb-2"
                        />
                        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {dossier.cover_letter}
                        </div>
                    </div>
                ) : null}

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <SectionHeader
                        title={t('company.applications.detail.assessment_actions', { defaultValue: 'Assessment actions' })}
                        subtitle={t('company.applications.detail.assessment_hint', { defaultValue: 'This keeps the linked application context attached when you move into assessments.' })}
                        className="mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={onCreateAssessmentFromApplication}
                            className="px-3 py-2 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                        >
                            {t('company.dashboard.actions.create_assessment')}
                        </button>
                        <button
                            onClick={onInviteCandidateFromApplication}
                            className="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                        >
                            {t('company.assessment_library.invite_from_context', { defaultValue: 'Invite from this context' })}
                        </button>
                    </div>
                </div>
            </div>

            {dossier.shared_jcfpm_payload ? (
                <div className="rounded-lg border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/70 dark:bg-cyan-950/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">JCFPM</div>
                        <div className="text-[11px] text-cyan-700 dark:text-cyan-300">
                            {dossier.jcfpm_share_level === 'full_report'
                                ? t('company.applications.labels.full', { defaultValue: 'Full' })
                                : t('company.applications.labels.summary', { defaultValue: 'Summary' })}
                        </div>
                    </div>
                    {dossier.shared_jcfpm_payload.archetype?.title && (
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {dossier.shared_jcfpm_payload.archetype.title}
                        </div>
                    )}
                    {dossier.shared_jcfpm_payload.strengths?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 mb-2">{t('company.applications.detail.skills', { defaultValue: 'Strengths' })}</div>
                            <div className="flex flex-wrap gap-2">
                                {dossier.shared_jcfpm_payload.strengths.map((item) => (
                                    <span key={item} className="px-2 py-1 text-xs rounded-md bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border border-cyan-100 dark:border-cyan-900/40">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.environment_fit_summary?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 mb-2">{t('company.applications.detail.environment_fit', { defaultValue: 'Environment fit' })}</div>
                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.environment_fit_summary.map((item) => (
                                    <li key={item}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.top_dimensions?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 mb-2">{t('company.applications.detail.top_dimensions', { defaultValue: 'Top dimensions' })}</div>
                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.top_dimensions.map((item) => (
                                    <div key={`${item.dimension}-${item.percentile}`} className="flex items-center justify-between">
                                        <span>{item.label || item.dimension}</span>
                                        <span className="text-xs text-slate-500">{Math.round(item.percentile)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-500 dark:text-slate-400">
                    {t('company.candidates.no_jcfpm_shared', { defaultValue: 'No JCFPM result was shared with this application.' })}
                </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <SectionHeader
                    title={t('company.applications.detail.related_assessments', { defaultValue: 'Related assessments' })}
                    subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Open a dossier, move status, or jump directly into the linked review flow.' })}
                    className="mb-2"
                />
                <AssessmentResultsList
                    companyId={companyId}
                    applicationIdFilter={dossier.id}
                    candidateEmailFilter={dossier.candidate_profile_snapshot?.email || dossier.candidate_email || undefined}
                />
            </div>
        </div>
    );
};

export default ApplicationDossierDetail;
