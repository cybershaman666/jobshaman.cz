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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
        {label}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
        >
          {t('company.workspace.sync.refresh_now', { defaultValue: 'Refresh now' })}
        </button>
      )}
    </div>
  );
};

export default WorkspaceSyncBadge;
