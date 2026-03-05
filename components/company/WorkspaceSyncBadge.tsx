import React from 'react';
import { useTranslation } from 'react-i18next';

interface WorkspaceSyncBadgeProps {
  loading: boolean;
  syncedAt?: string | null;
  loadingKey?: string;
  syncedKey?: string;
  waitingKey?: string;
  loadingDefault?: string;
  syncedDefault?: string;
  waitingDefault?: string;
  onRefresh?: () => void;
  className?: string;
}

const WorkspaceSyncBadge: React.FC<WorkspaceSyncBadgeProps> = ({
  loading,
  syncedAt,
  loadingKey = 'company.workspace.sync.syncing',
  syncedKey = 'company.workspace.sync.last_synced_short',
  waitingKey = 'company.workspace.sync.waiting',
  loadingDefault = 'Syncing live queue...',
  syncedDefault = 'Last synced {{time}}',
  waitingDefault = 'Waiting for first sync',
  onRefresh,
  className = ''
}) => {
  const { t, i18n } = useTranslation();

  const label = loading
    ? t(loadingKey, { defaultValue: loadingDefault })
    : syncedAt
      ? t(syncedKey, {
        defaultValue: syncedDefault,
        time: new Date(syncedAt).toLocaleTimeString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      })
      : t(waitingKey, { defaultValue: waitingDefault });

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <div className="rounded-full border border-emerald-200/80 bg-white/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-[0_12px_24px_-24px_rgba(16,185,129,0.3)] backdrop-blur dark:border-emerald-900/30 dark:bg-slate-950/45 dark:text-emerald-300">
        {label}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.18)] backdrop-blur transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          {t('company.workspace.sync.refresh_now', { defaultValue: 'Refresh now' })}
        </button>
      )}
    </div>
  );
};

export default WorkspaceSyncBadge;
