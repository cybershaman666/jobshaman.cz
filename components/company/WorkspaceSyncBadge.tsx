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
  const language = (() => {
    const normalized = String(i18n.language || 'en').split('-')[0].toLowerCase();
    return ['cs', 'sk', 'de', 'at', 'pl'].includes(normalized) ? (normalized === 'at' ? 'de' : normalized) : 'en';
  })() as 'cs' | 'sk' | 'de' | 'pl' | 'en';
  const timeLocale = language === 'cs' ? 'cs-CZ' : language === 'sk' ? 'sk-SK' : language === 'de' ? 'de-AT' : language === 'pl' ? 'pl-PL' : 'en-US';
  const copy = ({
    cs: { syncing: 'Synchronizuji live queue...', synced: 'Naposledy synchronizováno {{time}}', waiting: 'Čeká na první synchronizaci', refresh: 'Obnovit teď' },
    sk: { syncing: 'Synchronizujem live queue...', synced: 'Naposledy synchronizované {{time}}', waiting: 'Čaká na prvú synchronizáciu', refresh: 'Obnoviť teraz' },
    de: { syncing: 'Live-Queue wird synchronisiert...', synced: 'Zuletzt synchronisiert {{time}}', waiting: 'Warten auf erste Synchronisierung', refresh: 'Jetzt aktualisieren' },
    pl: { syncing: 'Synchronizowanie live queue...', synced: 'Ostatnia synchronizacja {{time}}', waiting: 'Oczekiwanie na pierwszą synchronizację', refresh: 'Odśwież teraz' },
    en: { syncing: 'Syncing live queue...', synced: 'Last synced {{time}}', waiting: 'Waiting for first sync', refresh: 'Refresh now' }
  } as const)[language];

  const label = loading
    ? t(loadingKey, { defaultValue: loadingDefault === 'Syncing live queue...' ? copy.syncing : loadingDefault })
    : syncedAt
      ? t(syncedKey, {
        defaultValue: syncedDefault === 'Last synced {{time}}' ? copy.synced : syncedDefault,
        time: new Date(syncedAt).toLocaleTimeString(timeLocale, {
          hour: '2-digit',
          minute: '2-digit'
        })
      })
      : t(waitingKey, { defaultValue: waitingDefault === 'Waiting for first sync' ? copy.waiting : waitingDefault });

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <div className="rounded-full border border-amber-200/80 bg-white/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 shadow-[0_12px_24px_-24px_rgba(16,185,129,0.3)] backdrop-blur dark:border-amber-900/30 dark:bg-slate-950/45 dark:text-amber-300">
        {label}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="app-button-secondary rounded-full px-3 py-2 text-xs"
        >
          {t('company.workspace.sync.refresh_now', { defaultValue: copy.refresh })}
        </button>
      )}
    </div>
  );
};

export default WorkspaceSyncBadge;
