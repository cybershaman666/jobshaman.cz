import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';

interface CompanyDashboardShellProps {
  activeTab: CompanyDashboardTab;
  onTabChange: (tab: CompanyDashboardTab) => void;
  children: React.ReactNode;
}

const CompanyDashboardShell: React.FC<CompanyDashboardShellProps> = ({
  activeTab,
  onTabChange,
  children
}) => {
  const { t } = useTranslation();

  const tabs: Array<{ key: CompanyDashboardTab; label: string }> = [
    { key: 'overview', label: t('company.dashboard.tabs.overview', { defaultValue: 'Overview' }) },
    { key: 'jobs', label: t('company.jobs.nav', { defaultValue: 'Jobs' }) },
    { key: 'settings', label: t('company.dashboard.tabs.dna_culture') },
    { key: 'applications', label: t('company.applications.nav', { defaultValue: 'Applications' }) },
    { key: 'assessments', label: t('company.dashboard.tabs.assessments') },
    { key: 'candidates', label: t('company.dashboard.tabs.candidates') }
  ];

  return (
    <div className="w-full max-w-[1920px] mx-auto min-h-full pb-10">
      <div className="mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.92))] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.92))]">
        <div className="mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 backdrop-blur dark:border-cyan-900/40 dark:bg-slate-950/40 dark:text-cyan-300">
              {t('company.shell.badge', { defaultValue: 'Hiring command' })}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('company.portal.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {t('company.portal.subtitle')}
            </p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {t('company.shell.workspace_label', { defaultValue: 'Hiring workspace' })}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              {t('company.shell.workspace_desc', { defaultValue: 'One place for open roles, candidate responses, screening, and daily team focus.' })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-slate-950 text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.85)] dark:bg-slate-100 dark:text-slate-950'
                  : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
};

export default CompanyDashboardShell;
