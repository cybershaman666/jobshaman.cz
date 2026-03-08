import React from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile, Job } from '../../types';
import CompanyJobEditor from '../CompanyJobEditor';

const extractMarkdownSection = (description: string, headings: string[]): string => {
  if (!description.trim() || headings.length === 0) return '';
  const normalizedHeadings = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `^#{2,3}\\s*(?:${normalizedHeadings.join('|')})\\s*$\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`,
    'im'
  );
  const match = description.match(pattern);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

interface CompanyJobsWorkspaceProps {
  companyProfile: CompanyProfile;
  jobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
  userEmail?: string;
  seedJobId?: string | null;
  onSeedConsumed?: () => void;
  onEditJob: (jobId: string) => void;
  onOpenApplications: (jobId: string) => void;
  onCreateAssessment: (jobId: string) => void;
  onCloseJob: (jobId: string) => Promise<void> | void;
  onDeleteJob: (jobId: string) => Promise<void> | void;
  onReopenJob: (jobId: string) => Promise<void> | void;
  onJobLifecycleChange?: (
    jobId: string | number,
    status: 'active' | 'paused' | 'closed' | 'archived',
    options?: { skipAudit?: boolean; refreshJobs?: boolean }
  ) => void;
}

const CompanyJobsWorkspace: React.FC<CompanyJobsWorkspaceProps> = ({
  companyProfile,
  jobs,
  jobStats,
  userEmail,
  seedJobId,
  onSeedConsumed,
  onEditJob,
  onOpenApplications,
  onCreateAssessment,
  onCloseJob,
  onDeleteJob,
  onReopenJob,
  onJobLifecycleChange
}) => {
  const { t } = useTranslation();
  const hasLiveRoles = jobs.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className={`grid grid-cols-1 gap-4 ${hasLiveRoles ? 'xl:grid-cols-[380px_minmax(0,1fr)]' : ''}`}>
        {hasLiveRoles ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {jobs.map((job) => {
                const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                const lifecycleStatus = String((job as any).status || 'active');
                const isClosed = lifecycleStatus === 'closed';
                const firstReply = extractMarkdownSection(job.description || '', ['First Reply']);
                const companyTruthHard = extractMarkdownSection(job.description || '', ['Company Truth: What Is Actually Hard?']);
                const companyTruthFail = extractMarkdownSection(job.description || '', ['Company Truth: Who Typically Struggles?']);
                const roleStatusMeta = (() => {
                  switch (lifecycleStatus) {
                    case 'paused':
                      return {
                        label: t('company.dashboard.role_status.paused', { defaultValue: 'Paused' }),
                        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      };
                    case 'closed':
                      return {
                        label: t('company.dashboard.role_status.closed', { defaultValue: 'Closed' }),
                        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      };
                    case 'archived':
                      return {
                        label: t('company.dashboard.role_status.archived', { defaultValue: 'Archived' }),
                        className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      };
                    default:
                      return {
                        label: t('company.dashboard.role_status.active', { defaultValue: 'Active' }),
                        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      };
                  }
                })();

                return (
                  <div key={job.id} className="rounded-[1.05rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_28px_-34px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900/92 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">{job.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {job.location} • {job.company}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${roleStatusMeta.className}`}>
                          {roleStatusMeta.label}
                        </span>
                        {job.legality_status && (
                          <span className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {job.legality_status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.views_count')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                      </div>
                      <div className="rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.workspace.labels.applications', { defaultValue: 'Dialogues' })}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                      </div>
                      <div className="rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.conv_rate')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                        </div>
                      </div>
                    </div>

                    {(firstReply || companyTruthHard || companyTruthFail) && (
                    <div className="space-y-2 rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-3">
                      {firstReply && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                              {t('company.job_editor.handshake.first_reply', { defaultValue: 'First reply' })}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                              {firstReply}
                            </div>
                          </div>
                        )}
                        {companyTruthHard && (
                          <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {t('company.job_editor.handshake.truth_hard', { defaultValue: 'What is actually hard about this role?' })}
                            </span>{' '}
                            {companyTruthHard}
                          </div>
                        )}
                        {companyTruthFail && (
                          <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {t('company.job_editor.handshake.truth_fail', { defaultValue: 'What type of person typically fails here?' })}
                            </span>{' '}
                            {companyTruthFail}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onEditJob(job.id)}
                        className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('company.dashboard.actions.edit', { defaultValue: 'Edit role' })}
                      </button>
                      <button
                        onClick={() => onOpenApplications(job.id)}
                        className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('company.jobs.open_applications', { defaultValue: 'Open dialogues' })}
                      </button>
                      <button
                        onClick={() => onCreateAssessment(job.id)}
                        className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-colors hover:opacity-90"
                      >
                        {t('company.dashboard.actions.create_assessment', { defaultValue: 'Set up assessment' })}
                      </button>
                      {isClosed ? (
                        <button
                          onClick={() => onReopenJob(job.id)}
                          className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        >
                          {t('company.job_editor.reopen', { defaultValue: 'Reopen' })}
                        </button>
                      ) : (
                        <button
                          onClick={() => onCloseJob(job.id)}
                          className="rounded-full border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
                        >
                          {t('company.dashboard.actions.close', { defaultValue: 'Pause role' })}
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteJob(job.id)}
                        className="rounded-full border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        {t('company.dashboard.actions.delete', { defaultValue: 'Archive role' })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <CompanyJobEditor
          companyProfile={companyProfile}
          jobs={jobs}
          userEmail={userEmail}
          seedJobId={seedJobId}
          onSeedConsumed={onSeedConsumed}
          onJobLifecycleChange={onJobLifecycleChange}
        />
      </div>
    </div>
  );
};

export default CompanyJobsWorkspace;
