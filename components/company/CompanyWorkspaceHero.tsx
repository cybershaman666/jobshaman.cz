import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, PenTool, Users, Zap } from 'lucide-react';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface CompanyWorkspaceHeroProps {
  applicationsLoading: boolean;
  applicationsLastSyncedAt?: string | null;
  onRefreshApplications: () => void;
  onOpenJobs: () => void;
  onOpenApplications: () => void;
  onOpenAssessments: () => void;
}

const CompanyWorkspaceHero: React.FC<CompanyWorkspaceHeroProps> = ({
  applicationsLoading,
  applicationsLastSyncedAt,
  onRefreshApplications,
  onOpenJobs,
  onOpenApplications,
  onOpenAssessments
}) => {
  const { t } = useTranslation();

  return (
    <div className="company-surface-elevated overflow-hidden rounded-[26px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.95))] p-5 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.14),_transparent_25%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-2">
          <div className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 backdrop-blur dark:border-cyan-900/30 dark:bg-slate-950/45 dark:text-cyan-300">
            <Zap size={12} />
            {t('company.workspace.badge', { defaultValue: 'Hiring workspace' })}
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {t('company.workspace.title', { defaultValue: 'Everything your hiring team needs, in one place' })}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('company.workspace.subtitle', {
                defaultValue: 'Keep open roles, incoming applicants, and assessment progress in one clear flow. Go deeper only when you need to edit, compare, or decide.'
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkspaceSyncBadge
            loading={applicationsLoading}
            syncedAt={applicationsLastSyncedAt}
            syncedKey="company.workspace.sync.live_queue"
            syncedDefault="Live queue synced {{time}}"
            onRefresh={onRefreshApplications}
          />
          <button onClick={onOpenJobs} className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.9)] transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
            <PenTool size={16} />
            {t('company.workspace.actions.new_role', { defaultValue: 'Create or edit roles' })}
          </button>
          <button onClick={onOpenApplications} className="company-pill-surface flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-800">
            <Users size={16} />
            {t('company.workspace.actions.review_queue', { defaultValue: 'Review applicants' })}
          </button>
          <button onClick={onOpenAssessments} className="company-pill-surface flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-800">
            <BrainCircuit size={16} />
            {t('company.workspace.actions.assessments', { defaultValue: 'Open assessment hub' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyWorkspaceHero;
