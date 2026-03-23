import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BrainCircuit, Briefcase, Building2, Settings, Users, type LucideIcon } from 'lucide-react';
import type { CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';
import { Button, MetricTile, PageHero } from '../ui/primitives';

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
    <div className="app-aurora-shell app-workspace-stage mx-auto min-h-full w-full max-w-[1680px] px-4 pb-6 pt-4 sm:px-5 sm:pb-8 lg:px-6">
      <PageHero
        className="mb-5 overflow-hidden"
        variant="hero"
        eyebrow={t('company.shell.badge', { defaultValue: 'Hiring command' })}
        title={t('company.portal.title')}
        body={t('company.portal.subtitle')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="grid gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label={t('company.shell.current_module', { defaultValue: 'Current module' })}
              value={(
                <span className="inline-flex items-center gap-2">
                  <ActiveTabIcon size={16} className="text-[var(--accent)]" />
                  {activeTabMeta.label}
                </span>
              )}
              tone="accent"
            />
            <MetricTile
              label={t('company.shell.active_modules', { defaultValue: 'Active modules' })}
              value={tabs.length}
              tone="muted"
            />
            <MetricTile
              label={t('company.shell.workspace_label', { defaultValue: 'Hiring workspace' })}
              value={t('company.shell.workspace_desc', { defaultValue: 'One place for live roles, active dialogues, screening, and the next team action.' })}
              tone="muted"
            />
          </div>

          <div className="app-frost-panel app-organic-panel-soft flex gap-2 overflow-x-auto rounded-[var(--radius-panel)] border p-2 shadow-[var(--shadow-soft)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'hero' : 'quiet'}
                size="sm"
                onClick={() => onTabChange(tab.key)}
                className="shrink-0 whitespace-nowrap !rounded-full"
              >
                <tab.icon size={15} />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </PageHero>

      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
};

export default CompanyDashboardShell;
