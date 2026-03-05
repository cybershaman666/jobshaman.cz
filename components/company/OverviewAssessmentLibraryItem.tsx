import React from 'react';
import { useTranslation } from 'react-i18next';
import { Assessment } from '../../types';

interface OverviewAssessmentLibraryItemProps {
  assessment: Assessment;
  onOpenAssessments: () => void;
}

const OverviewAssessmentLibraryItem: React.FC<OverviewAssessmentLibraryItemProps> = ({
  assessment,
  onOpenAssessments
}) => {
  const { t } = useTranslation();

  return (
    <div className="company-surface-subtle rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/70">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{assessment.title}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{assessment.role}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onOpenAssessments} className="px-3 py-1.5 rounded-full border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:bg-slate-800/70 dark:text-cyan-300 dark:hover:bg-cyan-950/20">
          {t('company.workspace.actions.use_assessment', { defaultValue: 'Use in workflow' })}
        </button>
        <button onClick={onOpenAssessments} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t('company.workspace.actions.preview_assessment', { defaultValue: 'Preview' })}
        </button>
      </div>
    </div>
  );
};

export default OverviewAssessmentLibraryItem;
