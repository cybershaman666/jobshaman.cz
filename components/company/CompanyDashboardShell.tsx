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
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('company.portal.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('company.portal.subtitle')}</p>
        </div>

        <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
