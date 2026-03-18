import React from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile, Job } from '../../types';
import CompanyJobEditor from '../CompanyJobEditor';
import { Zap } from 'lucide-react';
import CreateMiniChallengeModal from '../challenges/CreateMiniChallengeModal';

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
  const [isChallengeModalOpen, setIsChallengeModalOpen] = React.useState(false);
  const hasLiveRoles = jobs.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="app-organic-shell flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">
            {t('company.jobs.workspace_title', { defaultValue: 'Správa rolí a výzev' })}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('company.jobs.workspace_desc', { defaultValue: 'Zde můžete spravovat aktivní inzeráty nebo zadávat rychlé mini výzvy.' })}
          </p>
        </div>
        <button
          onClick={() => setIsChallengeModalOpen(true)}
          className="app-organic-cta inline-flex items-center gap-2 px-4 py-2 text-sm font-bold transition hover:bg-[rgba(var(--accent-rgb),0.1)] active:scale-95"
        >
          <Zap size={16} />
          {t('company.jobs.new_challenge', { defaultValue: 'Nová mini výzva' })}
        </button>
      </div>

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
                        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      };
                  }
                })();

                return (
                  <div key={job.id} className="company-surface-soft app-organic-panel-soft rounded-[1.05rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_28px_-34px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900/92 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">{job.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {job.location} • {job.company}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                          <span className={`app-organic-pill px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${roleStatusMeta.className}`}>
                          {roleStatusMeta.label}
                        </span>
                        {job.legality_status && (
                          <span className="app-organic-pill px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {job.legality_status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.views_count')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                      </div>
                      <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.workspace.labels.applications', { defaultValue: 'Dialogues' })}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                      </div>
                      <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.conv_rate')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                        </div>
                      </div>
                    </div>

                    {(firstReply || companyTruthHard || companyTruthFail) && (
                      <div className="company-surface-soft app-organic-panel-soft space-y-2 rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-3">
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
                          <div className="app-organic-panel-soft rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {t('company.job_editor.handshake.truth_hard', { defaultValue: 'What is actually hard about this role?' })}
                            </span>{' '}
                            {companyTruthHard}
                          </div>
                        )}
                        {companyTruthFail && (
                          <div className="app-organic-panel-soft rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
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
                        className="app-button-secondary app-organic-pill px-3 py-2 text-xs font-semibold"
                      >
                        {t('company.dashboard.actions.edit', { defaultValue: 'Edit role' })}
                      </button>
                      <button
                        onClick={() => onOpenApplications(job.id)}
                        className="app-button-secondary app-organic-pill px-3 py-2 text-xs font-semibold"
                      >
                        {t('company.jobs.open_applications', { defaultValue: 'Open dialogues' })}
                      </button>
                      <button
                        onClick={() => onCreateAssessment(job.id)}
                        className="app-organic-pill company-surface-soft rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-colors hover:opacity-90"
                      >
                        {t('company.dashboard.actions.create_assessment', { defaultValue: 'Set up assessment' })}
                      </button>
                      {isClosed ? (
                        <button
                          onClick={() => onReopenJob(job.id)}
                          className="app-organic-pill rounded-full border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
                        >
                          {t('company.job_editor.reopen', { defaultValue: 'Reopen' })}
                        </button>
                      ) : (
                        <button
                          onClick={() => onCloseJob(job.id)}
                          className="app-organic-pill rounded-full border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
                        >
                          {t('company.dashboard.actions.close', { defaultValue: 'Pause role' })}
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteJob(job.id)}
                        className="app-organic-pill rounded-full border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40"
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

      <CreateMiniChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        isCsLike={t('common.locale_base', { defaultValue: 'cs' }) === 'cs'}
        onSubmit={(data) => {
          console.log('Company: New Mini Challenge created:', data);
          setIsChallengeModalOpen(false);
          // In real app, this would be a service call
          alert(t('common.locale_base', { defaultValue: 'cs' }) === 'cs' ? 'Výzva byla vytvořena.' : 'Challenge created.');
        }}
      />
    </div>
  );
};

export default CompanyJobsWorkspace;
