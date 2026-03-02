import React from 'react';
import { useTranslation } from 'react-i18next';
import { Job } from '../../types';

interface OverviewLiveRoleItemProps {
  job: Job;
  stats: { views: number; applicants: number };
  onEditJob: (jobId: string) => void;
  onOpenJobApplications: (jobId: string) => void;
}

const OverviewLiveRoleItem: React.FC<OverviewLiveRoleItemProps> = ({
  job,
  stats,
  onEditJob,
  onOpenJobApplications
}) => {
  const { t } = useTranslation();
  const lifecycleStatus = String((job as any).status || 'active');

  return (
    <div className="company-surface-subtle rounded-2xl border border-slate-200/80 bg-white/85 dark:bg-slate-900/70 dark:border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{job.location}</div>
        </div>
        <span className="company-pill-surface px-2 py-1 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
          {lifecycleStatus}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="company-surface-soft rounded-xl bg-slate-50 dark:bg-slate-950/30 p-2 border border-slate-200/70 dark:border-slate-800/90">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.dashboard.table.views_count')}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.views}</div>
        </div>
        <div className="company-surface-soft rounded-xl bg-slate-50 dark:bg-slate-950/30 p-2 border border-slate-200/70 dark:border-slate-800/90">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.workspace.labels.applications', { defaultValue: 'Applications' })}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
        </div>
        <div className="company-surface-soft rounded-xl bg-slate-50 dark:bg-slate-950/30 p-2 border border-slate-200/70 dark:border-slate-800/90">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.dashboard.table.conv_rate')}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onEditJob(job.id)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t('company.dashboard.actions.edit')}
        </button>
        <button onClick={() => onOpenJobApplications(job.id)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
        </button>
      </div>
    </div>
  );
};

export default OverviewLiveRoleItem;
