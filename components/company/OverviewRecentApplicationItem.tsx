import React from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyApplicationRow } from '../../types';

interface OverviewRecentApplicationItemProps {
  application: CompanyApplicationRow;
  onOpenApplication: (applicationId: string) => void;
}

const OverviewRecentApplicationItem: React.FC<OverviewRecentApplicationItemProps> = ({
  application,
  onOpenApplication
}) => {
  const { t } = useTranslation();

  return (
    <div className="company-surface-subtle rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/70 p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {application.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {application.job_title || t('company.dashboard.table.position')}
          </div>
          {application.candidateHeadline ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {application.candidateHeadline}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {application.hasCv && <span className="company-pill-surface px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">CV</span>}
          {application.hasCoverLetter && (
            <span className="company-pill-surface px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
              {t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}
            </span>
          )}
          {application.hasJcfpm && (
            <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 text-[11px] font-medium">
              JCFPM
            </span>
          )}
          <button
            onClick={() => onOpenApplication(application.id)}
            className="px-3 py-1.5 rounded-full border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:bg-slate-800/70 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
          >
            {t('company.workspace.actions.open_dossier', { defaultValue: 'Open dossier' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewRecentApplicationItem;
