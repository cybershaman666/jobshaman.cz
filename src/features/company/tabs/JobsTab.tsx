import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Eye, MessageSquare, UserCheck, MoreVertical, Archive, X, RotateCcw, Briefcase } from 'lucide-react';

interface JobsTabProps {
  jobsData: any;
}

export const JobsTab: React.FC<JobsTabProps> = ({ jobsData }) => {
  const { t } = useTranslation();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobs = jobsData?.jobs || [];
  const jobStats = jobsData?.jobStats || {};
  const refreshJobs = jobsData?.refreshJobs || (() => {});
  const selectedJob = jobs.find((j: any) => j.id === selectedJobId) || jobs[0];

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: t('company.jobs.status_active', { defaultValue: 'Active' }), cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      closed: { label: t('company.jobs.status_closed', { defaultValue: 'Closed' }), cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
      paused: { label: t('company.jobs.status_paused', { defaultValue: 'Paused' }), cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      archived: { label: t('company.jobs.status_archived', { defaultValue: 'Archived' }), cls: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' },
    };
    const cfg = map[status] || map.active;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Briefcase size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('company.jobs.empty_title', { defaultValue: 'No jobs yet' })}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('company.jobs.empty_desc', { defaultValue: 'Create your first job challenge to start discovering candidates' })}
        </p>
        <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-dark)] transition-colors">
          <Plus size={16} />
          {t('company.jobs.create_first', { defaultValue: 'Create first job' })}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('company.jobs.title', { defaultValue: 'Jobs & Challenges' })}
          <span className="ml-2 text-sm font-normal text-slate-400">({jobs.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshJobs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw size={14} />
            {t('company.jobs.refresh', { defaultValue: 'Refresh' })}
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-dark)] transition-colors">
            <Plus size={14} />
            {t('company.jobs.new_job', { defaultValue: 'New Job' })}
          </button>
        </div>
      </div>

      {/* Job List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('company.jobs.col_title', { defaultValue: 'Title' })}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                {t('company.jobs.col_status', { defaultValue: 'Status' })}
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Eye size={14} className="inline" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <MessageSquare size={14} className="inline" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <UserCheck size={14} className="inline" />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                {t('company.jobs.col_updated', { defaultValue: 'Updated' })}
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((job: any) => {
              const stats = jobStats[job.id] || {};
              return (
                <tr
                  key={job.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {(job.title || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {job.title || job.job_title || 'Untitled'}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate sm:hidden">
                          {statusBadge(job.status)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {statusBadge(job.status)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                    {stats.views ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                    {stats.dialogues ?? stats.applicants ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {job.applicants_count != null ? (
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {job.applicants_count}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell">
                    {job.updated_at
                      ? new Date(job.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <MoreVertical size={14} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Actions for Selected Job */}
      {selectedJob && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            {t('company.jobs.quick_actions', { defaultValue: 'Quick Actions' })}: {selectedJob.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedJob.status === 'active' && (
              <>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                  <X size={14} />
                  {t('company.jobs.close_job', { defaultValue: 'Close' })}
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <Archive size={14} />
                  {t('company.jobs.archive_job', { defaultValue: 'Archive' })}
                </button>
              </>
            )}
            {selectedJob.status === 'closed' && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                <RotateCcw size={14} />
                {t('company.jobs.reopen_job', { defaultValue: 'Reopen' })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
