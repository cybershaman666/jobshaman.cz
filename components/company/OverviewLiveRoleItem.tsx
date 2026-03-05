import React from 'react';
import { useTranslation } from 'react-i18next';
import { Job } from '../../types';

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
  const firstReply = extractMarkdownSection(job.description || '', ['First Reply']);
  const companyTruthHard = extractMarkdownSection(job.description || '', ['Company Truth: What Is Actually Hard?']);
  const lifecycleStatus = String((job as any).status || 'active');
  const roleStatusMeta = (() => {
    switch (lifecycleStatus) {
      case 'paused':
        return {
          label: t('company.dashboard.role_status.paused', { defaultValue: 'Paused' }),
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/30'
        };
      case 'closed':
        return {
          label: t('company.dashboard.role_status.closed', { defaultValue: 'Closed' }),
          className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/30'
        };
      case 'archived':
        return {
          label: t('company.dashboard.role_status.archived', { defaultValue: 'Archived' }),
          className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/80 dark:border-slate-700'
        };
      default:
        return {
          label: t('company.dashboard.role_status.active', { defaultValue: 'Active' }),
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/30'
        };
    }
  })();

  return (
    <div className="company-surface-subtle rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{job.location}</div>
        </div>
        <span className={`company-pill-surface rounded-full px-2.5 py-1 text-[11px] font-medium border ${roleStatusMeta.className}`}>
          {roleStatusMeta.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="company-surface-soft rounded-[0.95rem] border border-slate-200/70 bg-slate-50 p-2 dark:border-slate-800/90 dark:bg-slate-950/30">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.dashboard.table.views_count')}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.views}</div>
        </div>
        <div className="company-surface-soft rounded-[0.95rem] border border-slate-200/70 bg-slate-50 p-2 dark:border-slate-800/90 dark:bg-slate-950/30">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.workspace.labels.applications', { defaultValue: 'Dialogues' })}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
        </div>
        <div className="company-surface-soft rounded-[0.95rem] border border-slate-200/70 bg-slate-50 p-2 dark:border-slate-800/90 dark:bg-slate-950/30">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('company.dashboard.table.conv_rate')}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
      </div>
      {(firstReply || companyTruthHard) && (
        <div className="mt-3 space-y-2 rounded-[0.95rem] border border-cyan-200/70 bg-cyan-50/60 p-2.5 dark:border-cyan-900/30 dark:bg-cyan-950/15">
          {firstReply && (
            <div className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="font-semibold text-cyan-800 dark:text-cyan-300">
                {t('company.job_editor.handshake.first_reply', { defaultValue: 'First reply' })}:
              </span>{' '}
              {firstReply}
            </div>
          )}
          {companyTruthHard && (
            <div className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="font-semibold text-slate-900 dark:text-white">
                {t('company.job_editor.handshake.truth_hard', { defaultValue: 'What is actually hard about this role?' })}:
              </span>{' '}
              {companyTruthHard}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onEditJob(job.id)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t('company.dashboard.actions.edit')}
        </button>
        <button onClick={() => onOpenJobApplications(job.id)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t('company.jobs.open_applications', { defaultValue: 'Open dialogues' })}
        </button>
      </div>
    </div>
  );
};

export default OverviewLiveRoleItem;
