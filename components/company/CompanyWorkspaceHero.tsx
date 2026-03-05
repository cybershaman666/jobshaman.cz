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
    <div className="company-surface-elevated overflow-hidden rounded-[1.15rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.18),_transparent_34%),radial-gradient(circle_at_78%_18%,_rgba(14,165,233,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.99),_rgba(248,250,252,0.95))] p-4 shadow-[0_26px_56px_-40px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.2),_transparent_34%),radial-gradient(circle_at_78%_18%,_rgba(14,165,233,0.16),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_26%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <div className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 backdrop-blur dark:border-cyan-900/30 dark:bg-slate-950/45 dark:text-cyan-300">
            <Zap size={12} />
            {t('company.workspace.badge', { defaultValue: 'Hiring workspace' })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {t('company.workspace.title', { defaultValue: 'Everything your hiring team needs, in one place' })}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('company.workspace.subtitle', {
                  defaultValue: 'Keep live roles, active candidate dialogues, and assessment progress in one clear flow. Go deeper only when you need to edit, compare, or decide.'
                })}
              </p>
            </div>
            <div className="rounded-[1rem] border border-white/80 bg-white/80 p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.24)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Radar size={12} className="text-cyan-600 dark:text-cyan-300" />
                {t('company.workspace.control_room', { defaultValue: 'HR control room' })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  {
                    key: 'roles',
                    label: t('company.workspace.metrics.live_roles', { defaultValue: 'Live roles' }),
                    value: liveRolesCount,
                    icon: PenTool,
                    tone: 'text-cyan-700 dark:text-cyan-300'
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
                  <div key={item.key} className="rounded-[0.95rem] border border-slate-200/80 bg-white/85 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${item.tone}`}>
                      <item.icon size={12} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1rem] border border-white/80 bg-white/80 p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.24)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                {t('company.workspace.sync.console', { defaultValue: 'Live console' })}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
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
            <button onClick={onOpenJobs} className="flex w-full items-center justify-between rounded-[0.95rem] bg-slate-950 px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_16px_28px_-20px_rgba(15,23,42,0.56)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
              <span className="flex items-center gap-2">
                <PenTool size={16} />
                {t('company.workspace.actions.new_role', { defaultValue: 'Create or edit roles' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] opacity-70">{liveRolesCount}</span>
            </button>
            <button onClick={handleOpenDialogues} className="company-pill-surface flex w-full items-center justify-between rounded-[0.95rem] border border-slate-200/80 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.18)] backdrop-blur transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-800">
              <span className="flex items-center gap-2">
                <Users size={16} />
                {t('company.workspace.actions.review_queue', { defaultValue: 'Review dialogues' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{reviewQueueCount}</span>
            </button>
            <button onClick={onOpenAssessments} className="company-pill-surface flex w-full items-center justify-between rounded-[0.95rem] border border-slate-200/80 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.18)] backdrop-blur transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-800">
              <span className="flex items-center gap-2">
                <BrainCircuit size={16} />
                {t('company.workspace.actions.assessments', { defaultValue: 'Open assessment hub' })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{savedAssessmentsCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyWorkspaceHero;
