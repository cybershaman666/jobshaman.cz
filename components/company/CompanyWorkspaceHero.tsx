import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BrainCircuit, PenTool, Radar, Users, Zap } from 'lucide-react';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface CompanyWorkspaceHeroProps {
  dialoguesLoading?: boolean;
  applicationsLoading: boolean;
  dialoguesLastSyncedAt?: string | null;
  applicationsLastSyncedAt?: string | null;
  liveRolesCount: number;
  reviewQueueCount: number;
  savedAssessmentsCount: number;
  onRefreshDialogues?: () => void;
  onRefreshApplications: () => void;
  onOpenJobs: () => void;
  onOpenDialogues?: () => void;
  onOpenApplications: () => void;
  onOpenAssessments: () => void;
}

const CompanyWorkspaceHero: React.FC<CompanyWorkspaceHeroProps> = ({
  dialoguesLoading,
  applicationsLoading,
  dialoguesLastSyncedAt,
  applicationsLastSyncedAt,
  liveRolesCount,
  reviewQueueCount,
  savedAssessmentsCount,
  onRefreshDialogues,
  onRefreshApplications,
  onOpenJobs,
  onOpenDialogues,
  onOpenApplications,
  onOpenAssessments
}) => {
  const { t } = useTranslation();
  const resolvedDialoguesLoading = dialoguesLoading ?? applicationsLoading;
  const resolvedDialoguesLastSyncedAt = dialoguesLastSyncedAt ?? applicationsLastSyncedAt;
  const handleRefreshDialogues = onRefreshDialogues || onRefreshApplications;
  const handleOpenDialogues = onOpenDialogues || onOpenApplications;

  return (
    <div className="company-surface-elevated overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <div className="app-eyebrow">
            <Zap size={12} />
            {t('company.workspace.badge', { defaultValue: 'Hiring workspace' })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {t('company.workspace.title', { defaultValue: 'Everything your hiring team needs, in one place' })}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                {t('company.workspace.subtitle', {
                  defaultValue: 'Keep live roles, active candidate dialogues, and assessment progress in one clear flow. Go deeper only when you need to edit, compare, or decide.'
                })}
              </p>
            </div>
            <div className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                <Radar size={12} className="text-[var(--accent)]" />
                {t('company.workspace.control_room', { defaultValue: 'HR control room' })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  {
                    key: 'roles',
                    label: t('company.workspace.metrics.live_roles', { defaultValue: 'Live roles' }),
                    value: liveRolesCount,
                    icon: PenTool,
                    tone: 'text-[var(--accent)]'
                  },
                  {
                    key: 'queue',
                    label: t('company.workspace.metrics.review_queue', { defaultValue: 'Review queue' }),
                    value: reviewQueueCount,
                    icon: Activity,
                    tone: 'text-amber-700 dark:text-amber-300'
                  },
                  {
                    key: 'assessments',
                    label: t('company.dashboard.tabs.assessments', { defaultValue: 'Assessments' }),
                    value: savedAssessmentsCount,
                    icon: BrainCircuit,
                    tone: 'text-emerald-700 dark:text-emerald-300'
                  }
                ].map((item) => (
                  <div key={item.key} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${item.tone}`}>
                      <item.icon size={12} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-[var(--text-strong)]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {t('company.workspace.sync.console', { defaultValue: 'Live console' })}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                {t('company.workspace.actions.review_queue', { defaultValue: 'Review dialogues' })}
              </div>
            </div>
            <WorkspaceSyncBadge
              loading={resolvedDialoguesLoading}
              syncedAt={resolvedDialoguesLastSyncedAt}
              syncedKey="company.workspace.sync.live_queue"
              syncedDefault="Live queue synced {{time}}"
              onRefresh={handleRefreshDialogues}
            />
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={onOpenJobs} className="app-button-primary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <PenTool size={16} />
                {t('company.workspace.actions.new_role', { defaultValue: 'Create or edit roles' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] opacity-70">{liveRolesCount}</span>
            </button>
            <button onClick={handleOpenDialogues} className="app-button-secondary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <Users size={16} />
                {t('company.workspace.actions.review_queue', { defaultValue: 'Review dialogues' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">{reviewQueueCount}</span>
            </button>
            <button onClick={onOpenAssessments} className="app-button-secondary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <BrainCircuit size={16} />
                {t('company.workspace.actions.assessments', { defaultValue: 'Open assessment hub' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">{savedAssessmentsCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyWorkspaceHero;
