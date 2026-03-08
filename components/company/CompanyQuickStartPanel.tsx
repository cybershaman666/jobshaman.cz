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
    <div className="company-surface-elevated overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="app-eyebrow">
            <Zap size={12} />
            {t('company.workspace.quickstart_badge', { defaultValue: 'Quick start' })}
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
            {t('company.workspace.quickstart_title', { defaultValue: 'Set up a polished hiring flow in minutes' })}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_desc', { defaultValue: 'Start with one role, one reusable assessment, and a complete company profile. After that, this page becomes your day-to-day hiring home.' })}
          </p>
        </div>
        <button onClick={onOpenJobs} className="app-button-primary rounded-[var(--radius-md)] px-4 py-3">
          <PenTool size={16} />
          {t('company.dashboard.create_first_ad')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <button onClick={onOpenJobs} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <PenTool size={14} />
            {t('company.workspace.quickstart_steps.first_role', { defaultValue: 'Create your first role' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.first_role_desc', { defaultValue: 'Use the role editor to shape a clear, candidate-friendly job post.' })}
          </div>
        </button>
        <button onClick={onOpenAssessments} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <BrainCircuit size={14} />
            {t('company.workspace.quickstart_steps.first_assessment', { defaultValue: 'Save one assessment' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.first_assessment_desc', { defaultValue: 'Prepare a reusable screening flow so recruiters can move faster later.' })}
          </div>
        </button>
        <button onClick={onOpenSettings} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <Users size={14} />
            {t('company.workspace.quickstart_steps.company_setup', { defaultValue: 'Finish company setup' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.company_setup_desc', { defaultValue: 'Set profile, brand, and hiring defaults before the first applicants arrive.' })}
          </div>
        </button>
      </div>
    </div>
  );
};

export default CompanyQuickStartPanel;
