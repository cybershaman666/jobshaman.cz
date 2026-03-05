import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BrainCircuit, Briefcase, Building2, Settings, Users, type LucideIcon } from 'lucide-react';
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

  const tabs: Array<{ key: CompanyDashboardTab; label: string; icon: LucideIcon }> = [
    { key: 'overview', label: t('company.dashboard.tabs.overview', { defaultValue: 'Overview' }), icon: Activity },
    { key: 'jobs', label: t('company.jobs.nav', { defaultValue: 'Roles' }), icon: Briefcase },
    { key: 'settings', label: t('company.dashboard.tabs.dna_culture'), icon: Settings },
    { key: 'applications', label: t('company.applications.nav', { defaultValue: 'Dialogues' }), icon: Building2 },
    { key: 'assessments', label: t('company.dashboard.tabs.assessments'), icon: BrainCircuit },
    { key: 'candidates', label: t('company.dashboard.tabs.candidates'), icon: Users }
  ];
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const ActiveTabIcon = activeTabMeta.icon;

  return (
    <div className="w-full max-w-[1920px] mx-auto min-h-full pb-8">
      <div className="mb-4 overflow-hidden rounded-[1.2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_8%_18%,_rgba(6,182,212,0.16),_transparent_30%),radial-gradient(circle_at_92%_16%,_rgba(16,185,129,0.14),_transparent_24%),radial-gradient(circle_at_50%_100%,_rgba(14,165,233,0.10),_transparent_40%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92))] p-4 shadow-[0_20px_46px_-40px_rgba(15,23,42,0.26)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_8%_18%,_rgba(6,182,212,0.22),_transparent_30%),radial-gradient(circle_at_92%_16%,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_50%_100%,_rgba(14,165,233,0.12),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.92))]">
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 backdrop-blur dark:border-cyan-900/40 dark:bg-slate-950/40 dark:text-cyan-300">
              {t('company.shell.badge', { defaultValue: 'Hiring command' })}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('company.portal.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {t('company.portal.subtitle')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1rem] border border-white/80 bg-white/82 p-4 shadow-[0_14px_22px_-28px_rgba(15,23,42,0.22)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <ActiveTabIcon size={12} className="text-cyan-600 dark:text-cyan-300" />
                {t('company.shell.current_module', { defaultValue: 'Current module' })}
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                {activeTabMeta.label}
              </div>
            </div>
            <div className="rounded-[1rem] border border-white/80 bg-white/82 p-4 shadow-[0_14px_22px_-28px_rgba(15,23,42,0.22)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t('company.shell.active_modules', { defaultValue: 'Active modules' })}
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                {tabs.length}
              </div>
            </div>
            <div className="rounded-[1rem] border border-white/80 bg-white/82 p-4 shadow-[0_14px_22px_-28px_rgba(15,23,42,0.22)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t('company.shell.workspace_label', { defaultValue: 'Hiring workspace' })}
              </div>
              <div className="mt-3 text-sm font-medium leading-6 text-slate-900 dark:text-white">
                {t('company.shell.workspace_desc', { defaultValue: 'One place for live roles, active dialogues, screening, and the next team action.' })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-[1rem] border border-white/80 bg-white/75 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-slate-950 text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.85)] dark:bg-slate-100 dark:text-slate-950'
                  : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <tab.icon size={15} />
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
