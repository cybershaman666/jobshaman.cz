import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BrainCircuit, Briefcase, Building2, BookOpen, Settings, Users, type LucideIcon } from 'lucide-react';
import type { CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';
import { Button, MetricTile, PageHero } from '../ui/primitives';
import AppShellAtmosphere from '../ui/AppShellAtmosphere';

interface CompanyDashboardShellProps {
  activeTab: CompanyDashboardTab;
  onTabChange: (tab: CompanyDashboardTab) => void;
  companyName?: string;
  subscriptionLabel?: string;
  statusLine?: string;
  metrics?: Array<{ label: string; value: string }>;
  children: React.ReactNode;
}

const CompanyDashboardShell: React.FC<CompanyDashboardShellProps> = ({
  activeTab,
  onTabChange,
  companyName,
  subscriptionLabel,
  statusLine,
  metrics = [],
  children
}) => {
  const { t } = useTranslation();

  const tabs: Array<{ key: CompanyDashboardTab; label: string; icon: LucideIcon }> = [
    { key: 'overview', label: t('company.dashboard.tabs.overview', { defaultValue: 'Overview' }), icon: Activity },
    { key: 'jobs', label: t('company.jobs.nav', { defaultValue: 'Roles' }), icon: Briefcase },
    { key: 'settings', label: t('company.dashboard.tabs.dna_culture'), icon: Settings },
    { key: 'applications', label: t('company.applications.nav', { defaultValue: 'Dialogues' }), icon: Building2 },
    { key: 'assessments', label: t('company.dashboard.tabs.assessments'), icon: BrainCircuit },
    { key: 'candidates', label: t('company.dashboard.tabs.candidates'), icon: Users },
    { key: 'learning_resources', label: t('company.dashboard.tabs.learning_resources', { defaultValue: 'Learning resources' }), icon: BookOpen }
  ];
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const ActiveTabIcon = activeTabMeta.icon;

  return (
    <div className="relative min-h-full overflow-hidden px-4 pb-6 pt-4 sm:px-5 sm:pb-8 lg:px-6">
      <AppShellAtmosphere />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-5 xl:flex-row">
        <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-[280px] xl:self-start">
          <div className="overflow-hidden rounded-[30px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,247,252,0.98)_48%,rgba(233,242,249,0.98)_100%)] p-5 shadow-[0_34px_90px_-60px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(10,17,25,0.95)_0%,rgba(11,22,31,0.98)_48%,rgba(9,16,24,0.98)_100%)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              {t('company.shell.badge', { defaultValue: 'Hiring command' })}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
              {companyName || t('company.portal.title')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {statusLine || t('company.portal.subtitle')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
                {subscriptionLabel || t('company.shell.free', { defaultValue: 'Free' })}
              </span>
              <span className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] dark:border-white/10 dark:bg-white/5">
                <ActiveTabIcon size={13} className="mr-1 inline-flex text-[var(--accent)]" />
                {activeTabMeta.label}
              </span>
            </div>

            <div className="mt-5 grid gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'hero' : 'quiet'}
                  size="sm"
                  onClick={() => onTabChange(tab.key)}
                  className="w-full justify-start !rounded-[18px] px-4 py-3"
                >
                  <tab.icon size={15} />
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <PageHero
            className="mb-5 overflow-hidden"
            variant="hero"
            eyebrow={t('company.shell.badge', { defaultValue: 'Hiring command' })}
            title={t('company.portal.title')}
            body={t('company.shell.workspace_desc', { defaultValue: 'One place for live roles, active dialogues, screening, and the next team action.' })}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              {(metrics.length > 0 ? metrics : [
                { label: t('company.shell.hiring_workspace', { defaultValue: 'Hiring workspace' }), value: t('company.shell.live', { defaultValue: 'Live' }) },
                { label: t('company.shell.status', { defaultValue: 'Status' }), value: t('company.shell.connected', { defaultValue: 'Connected' }) },
              ]).slice(0, 2).map((metric) => (
                <MetricTile
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone="muted"
                />
              ))}
            </div>
          </PageHero>

          <div className="min-h-[500px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboardShell;
