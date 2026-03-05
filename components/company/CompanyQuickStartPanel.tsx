import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, PenTool, Users, Zap } from 'lucide-react';

interface CompanyQuickStartPanelProps {
  onOpenJobs: () => void;
  onOpenAssessments: () => void;
  onOpenSettings: () => void;
}

const CompanyQuickStartPanel: React.FC<CompanyQuickStartPanelProps> = ({
  onOpenJobs,
  onOpenAssessments,
  onOpenSettings
}) => {
  const { t } = useTranslation();

  return (
    <div className="company-surface-elevated overflow-hidden rounded-[1.1rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.95))] p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_24%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 backdrop-blur dark:border-amber-900/30 dark:bg-slate-950/45 dark:text-amber-300">
            <Zap size={12} />
            {t('company.workspace.quickstart_badge', { defaultValue: 'Quick start' })}
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {t('company.workspace.quickstart_title', { defaultValue: 'Set up a polished hiring flow in minutes' })}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {t('company.workspace.quickstart_desc', { defaultValue: 'Start with one role, one reusable assessment, and a complete company profile. After that, this page becomes your day-to-day hiring home.' })}
          </p>
        </div>
        <button onClick={onOpenJobs} className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_-22px_rgba(15,23,42,0.6)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
          <PenTool size={16} />
          {t('company.dashboard.create_first_ad')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <button onClick={onOpenJobs} className="company-surface-subtle rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:bg-slate-950/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <PenTool size={14} />
            {t('company.workspace.quickstart_steps.first_role', { defaultValue: 'Create your first role' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t('company.workspace.quickstart_steps.first_role_desc', { defaultValue: 'Use the role editor to shape a clear, candidate-friendly job post.' })}
          </div>
        </button>
        <button onClick={onOpenAssessments} className="company-surface-subtle rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:bg-slate-950/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <BrainCircuit size={14} />
            {t('company.workspace.quickstart_steps.first_assessment', { defaultValue: 'Save one assessment' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t('company.workspace.quickstart_steps.first_assessment_desc', { defaultValue: 'Prepare a reusable screening flow so recruiters can move faster later.' })}
          </div>
        </button>
        <button onClick={onOpenSettings} className="company-surface-subtle rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:bg-slate-950/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Users size={14} />
            {t('company.workspace.quickstart_steps.company_setup', { defaultValue: 'Finish company setup' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t('company.workspace.quickstart_steps.company_setup_desc', { defaultValue: 'Set profile, brand, and hiring defaults before the first applicants arrive.' })}
          </div>
        </button>
      </div>
    </div>
  );
};

export default CompanyQuickStartPanel;
