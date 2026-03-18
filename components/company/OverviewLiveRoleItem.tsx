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
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/30'
        };
    }
  })();

  return (
    <div className="company-surface-subtle app-organic-panel-soft rounded-[var(--radius-md)] border p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">{job.title}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{job.location}</div>
        </div>
        <span className={`company-pill-surface app-organic-pill rounded-full px-2.5 py-1 text-[11px] font-medium border ${roleStatusMeta.className}`}>
          {roleStatusMeta.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] border p-2">
          <div className="text-[11px] text-[var(--text-faint)]">{t('company.dashboard.table.views_count')}</div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">{stats.views}</div>
        </div>
        <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] border p-2">
          <div className="text-[11px] text-[var(--text-faint)]">{t('company.workspace.labels.applications', { defaultValue: 'Dialogues' })}</div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">{stats.applicants}</div>
        </div>
        <div className="company-surface-soft app-organic-panel-soft rounded-[0.95rem] border p-2">
          <div className="text-[11px] text-[var(--text-faint)]">{t('company.dashboard.table.conv_rate')}</div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
      </div>
      {(firstReply || companyTruthHard) && (
        <div className="company-surface-soft app-organic-panel-soft mt-3 space-y-2 rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-2.5">
          {firstReply && (
            <div className="text-[11px] leading-relaxed text-[var(--text)]">
              <span className="font-semibold text-[var(--accent)]">
                {t('company.job_editor.handshake.first_reply', { defaultValue: 'First reply' })}:
              </span>{' '}
              {firstReply}
            </div>
          )}
          {companyTruthHard && (
            <div className="text-[11px] leading-relaxed text-[var(--text)]">
              <span className="font-semibold text-[var(--text-strong)]">
                {t('company.job_editor.handshake.truth_hard', { defaultValue: 'What is actually hard about this role?' })}:
              </span>{' '}
              {companyTruthHard}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onEditJob(job.id)} className="app-button-secondary app-organic-pill rounded-full px-3 py-1.5 text-xs">
          {t('company.dashboard.actions.edit')}
        </button>
        <button onClick={() => onOpenJobApplications(job.id)} className="app-button-secondary app-organic-pill rounded-full px-3 py-1.5 text-xs">
          {t('company.jobs.open_applications', { defaultValue: 'Open dialogues' })}
        </button>
      </div>
    </div>
  );
};

export default OverviewLiveRoleItem;
