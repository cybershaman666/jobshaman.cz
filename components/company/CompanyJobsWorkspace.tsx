import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { CompanyProfile, Job } from '../../types';
import CompanyJobEditor from '../CompanyJobEditor';
import WorkspaceHeader from './WorkspaceHeader';

interface CompanyJobsWorkspaceProps {
  companyProfile: CompanyProfile;
  jobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
  userEmail?: string;
  seedJobId?: string | null;
  onSeedConsumed?: () => void;
  onCreateDraft: () => void;
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
  onCreateDraft,
  onEditJob,
  onOpenApplications,
  onCreateAssessment,
  onCloseJob,
  onDeleteJob,
  onReopenJob,
  onJobLifecycleChange
}) => {
  const { t } = useTranslation();
  const [createDraftSignal, setCreateDraftSignal] = useState(0);

  const handleCreateDraftClick = () => {
    onCreateDraft();
    setCreateDraftSignal((prev) => prev + 1);
  };

  return (
        <div className="space-y-5 animate-in fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <WorkspaceHeader
            badgeIcon={<Briefcase size={12} />}
            badgeLabel={t('company.jobs.title', { defaultValue: 'Roles hub' })}
            title={t('company.jobs.title', { defaultValue: 'Roles hub' })}
            subtitle={t('company.jobs.subtitle', { defaultValue: 'Create, refine, and manage your open roles in one calm workspace.' })}
            actions={(
              <button
                onClick={handleCreateDraftClick}
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.9)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                {t('company.jobs.new_draft_cta', { defaultValue: 'New draft' })}
              </button>
            )}
          />

          {jobs.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 dark:border-slate-800 bg-white/90 p-5 text-sm text-slate-500 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] dark:bg-slate-900/90 dark:text-slate-400">
              {t('company.jobs.empty', { defaultValue: 'No live roles yet. Start with a new role draft and your hiring board will appear here.' })}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                const lifecycleStatus = String((job as any).status || 'active');
                const isClosed = lifecycleStatus === 'closed';
                const isPaused = lifecycleStatus === 'paused';

                return (
                  <div key={job.id} className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/92 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">{job.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {job.location} • {job.company}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          isClosed
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            : isPaused
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}>
                          {lifecycleStatus}
                        </span>
                        {job.legality_status && (
                          <span className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {job.legality_status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.views_count')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.workspace.labels.applications', { defaultValue: 'Applications' })}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/30 p-3">
                        <div className="text-slate-500 dark:text-slate-400">{t('company.dashboard.table.conv_rate')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                        </div>
                      </div>
                    </div>

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
                        {t('company.jobs.open_applications', { defaultValue: 'View applicants' })}
                      </button>
                      <button
                        onClick={() => onCreateAssessment(job.id)}
                        className="rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-900/30 dark:bg-cyan-950/20 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
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
          )}
        </div>

        <CompanyJobEditor
          companyProfile={companyProfile}
          jobs={jobs}
          userEmail={userEmail}
          seedJobId={seedJobId}
          createDraftSignal={createDraftSignal}
          onSeedConsumed={onSeedConsumed}
          onJobLifecycleChange={onJobLifecycleChange}
        />
      </div>
    </div>
  );
};

export default CompanyJobsWorkspace;
