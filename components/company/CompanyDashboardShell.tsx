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
    <div className="mx-auto min-h-full w-full max-w-[1680px] pb-6 sm:pb-8">
      <div className="app-page-header mb-4 overflow-hidden rounded-[var(--radius-2xl)] border p-4 sm:p-5 lg:p-6">
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div>
            <div className="app-eyebrow">
              {t('company.shell.badge', { defaultValue: 'Hiring command' })}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-3xl">{t('company.portal.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-[0.95rem]">
              {t('company.portal.subtitle')}
            </p>
          </div>

          <div className="grid gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <ActiveTabIcon size={12} className="text-[var(--accent)]" />
                {t('company.shell.current_module', { defaultValue: 'Current module' })}
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight text-[var(--text-strong)]">
                {activeTabMeta.label}
              </div>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {t('company.shell.active_modules', { defaultValue: 'Active modules' })}
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[var(--text-strong)]">
                {tabs.length}
              </div>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {t('company.shell.workspace_label', { defaultValue: 'Hiring workspace' })}
              </div>
              <div className="mt-3 text-sm font-medium leading-6 text-[var(--text-strong)]">
                {t('company.shell.workspace_desc', { defaultValue: 'One place for live roles, active dialogues, screening, and the next team action.' })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-soft)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all whitespace-nowrap sm:px-4 ${
                activeTab === tab.key
                  ? 'bg-[var(--accent)] text-white shadow-[0_12px_24px_-16px_rgba(var(--accent-rgb),0.55)]'
                  : 'text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-strong)] dark:hover:bg-white/10'
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
