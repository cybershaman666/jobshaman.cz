import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  Users,
  MessageSquare,
  MoreVertical,
  Archive,
  X,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface ChallengesTabProps {
  jobsData: any;
}

export const ChallengesTab: React.FC<ChallengesTabProps> = ({ jobsData }) => {
  const { t } = useTranslation();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

  const challenges = jobsData?.jobs || [];
  const challengeStats = jobsData?.jobStats || {};
  const refreshChallenges = jobsData?.refreshJobs || (() => {});
  const selectedChallenge = challenges.find((c: any) => c.id === selectedChallengeId) || challenges[0];

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: t('company.challenges.status_active', { defaultValue: 'Aktivní' }), cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      closed: { label: t('company.challenges.status_closed', { defaultValue: 'Uzavřená' }), cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
      paused: { label: t('company.challenges.status_paused', { defaultValue: 'Pozastavená' }), cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      archived: { label: t('company.challenges.status_archived', { defaultValue: 'Archivovaná' }), cls: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' },
    };
    const cfg = map[status] || map.active;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  // Detect mini-challenge vs standard challenge
  const isMiniChallenge = (challenge: any) => {
    return challenge.challenge_format === 'micro_job' ||
           challenge.kind ||
           (challenge.title || '').toLowerCase().includes('mini');
  };

  if (challenges.length === 0) {
    return (
      <div className="space-y-6">
        {/* Empty State */}
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/10 mb-4">
            <Target size={32} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('company.challenges.empty_title', { defaultValue: 'Zatím žádné výzvy' })}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            {t('company.challenges.empty_desc', {
              defaultValue: 'Výzva není jen popis práce. Je to reálný problém, který firma řeší. Kandidát ukáže, jak přemýšlí a co umí — ne co má v CV.'
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('company.challenges.title', { defaultValue: 'Výzvy' })}
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({challenges.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshChallenges}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw size={14} />
            {t('company.challenges.refresh', { defaultValue: 'Obnovit' })}
          </button>
        </div>
      </div>

      {/* Challenge List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('company.challenges.col_title', { defaultValue: 'Výzva' })}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                {t('company.challenges.col_type', { defaultValue: 'Typ' })}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                {t('company.challenges.col_status', { defaultValue: 'Stav' })}
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Eye size={14} className="inline" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Users size={14} className="inline" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <MessageSquare size={14} className="inline" />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                {t('company.challenges.col_updated', { defaultValue: 'Aktualizováno' })}
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {challenges.map((challenge: any) => {
              const stats = challengeStats[challenge.id] || {};
              const isMini = isMiniChallenge(challenge);
              return (
                <tr
                  key={challenge.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedChallengeId(challenge.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isMini
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {isMini ? <Zap size={16} /> : (challenge.title || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {challenge.title || challenge.job_title || 'Untitled'}
                        </p>
                        {isMini && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                            <Zap size={10} />
                            {t('company.challenges.mini_badge', { defaultValue: 'Mini-výzva' })}
                          </span>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate sm:hidden">
                          {statusBadge(challenge.status)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs font-medium ${
                      isMini ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {isMini
                        ? t('company.challenges.type_mini', { defaultValue: 'Mini-výzva' })
                        : t('company.challenges.type_standard', { defaultValue: 'Výzva' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {statusBadge(challenge.status)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                    {stats.views ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                    {stats.applicants ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                    {stats.dialogues ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell">
                    {challenge.updated_at
                      ? new Date(challenge.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <MoreVertical size={14} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Actions for Selected Challenge */}
      {selectedChallenge && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedChallenge.title}
            </h3>
            {isMiniChallenge(selectedChallenge) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <Zap size={10} />
                {t('company.challenges.mini_badge', { defaultValue: 'Mini-výzva' })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedChallenge.status === 'active' && (
              <>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                  <PauseCircle size={14} />
                  {t('company.challenges.pause', { defaultValue: 'Pozastavit' })}
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <X size={14} />
                  {t('company.challenges.close', { defaultValue: 'Uzavřít' })}
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <Archive size={14} />
                  {t('company.challenges.archive', { defaultValue: 'Archivovat' })}
                </button>
              </>
            )}
            {selectedChallenge.status === 'paused' && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                <PlayCircle size={14} />
                {t('company.challenges.resume', { defaultValue: 'Obnovit' })}
              </button>
            )}
            {selectedChallenge.status === 'closed' && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                <RotateCcw size={14} />
                {t('company.challenges.reopen', { defaultValue: 'Znovu otevřít' })}
              </button>
            )}
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Sparkles size={14} />
              {t('company.challenges.ai_optimize', { defaultValue: 'AI optimalizace' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Need Target icon
import { Target } from 'lucide-react';
