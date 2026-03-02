import React from 'react';
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

  return (
        <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <WorkspaceHeader
            badgeIcon={<Briefcase size={12} />}
            badgeLabel={t('company.jobs.title', { defaultValue: 'Jobs workspace' })}
            title={t('company.jobs.title', { defaultValue: 'Jobs workspace' })}
            subtitle={t('company.jobs.subtitle', { defaultValue: 'Manage live roles, route candidates into review, and publish through structured drafts.' })}
            actions={(
              <button
                onClick={onCreateDraft}
                className="px-3 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-500 transition-colors"
              >
                {t('company.jobs.new_draft_cta', { defaultValue: 'New draft' })}
              </button>
            )}
          />

          {jobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
              {t('company.jobs.empty', { defaultValue: 'No live roles yet. Start by creating a structured draft on the right.' })}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                const lifecycleStatus = String((job as any).status || 'active');
                const isClosed = lifecycleStatus === 'closed';
                const isPaused = lifecycleStatus === 'paused';

                return (
                  <div key={job.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                        <div className="text-slate-500">{t('company.dashboard.table.views_count')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                        <div className="text-slate-500">{t('company.workspace.labels.applications', { defaultValue: 'Applications' })}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                        <div className="text-slate-500">{t('company.dashboard.table.conv_rate')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onEditJob(job.id)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {t('company.dashboard.actions.edit')}
                      </button>
                      <button
                        onClick={() => onOpenApplications(job.id)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
                      </button>
                      <button
                        onClick={() => onCreateAssessment(job.id)}
                        className="px-3 py-2 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                      >
                        {t('company.dashboard.actions.create_assessment')}
                      </button>
                      {isClosed ? (
                        <button
                          onClick={() => onReopenJob(job.id)}
                          className="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                        >
                          {t('company.job_editor.reopen', { defaultValue: 'Reopen' })}
                        </button>
                      ) : (
                        <button
                          onClick={() => onCloseJob(job.id)}
                          className="px-3 py-2 rounded-lg border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-950/20"
                        >
                          {t('company.dashboard.actions.close')}
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteJob(job.id)}
                        className="px-3 py-2 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-950/20"
                      >
                        {t('company.dashboard.actions.delete')}
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
          onSeedConsumed={onSeedConsumed}
          onJobLifecycleChange={onJobLifecycleChange}
        />
      </div>
    </div>
  );
};

export default CompanyJobsWorkspace;
