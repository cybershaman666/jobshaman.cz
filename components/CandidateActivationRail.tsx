import React from 'react';
import { useTranslation } from 'react-i18next';
import { CandidateActivationStateV1 } from '../types';
import { getNextActivationStep, isActivationComplete } from '../services/candidateActivationService';

interface CandidateActivationRailProps {
  state: CandidateActivationStateV1;
  onContinue: () => void;
  compact?: boolean;
}

const CandidateActivationRail: React.FC<CandidateActivationRailProps> = ({
  state,
  onContinue,
  compact = false,
}) => {
  const { t } = useTranslation();
  if (isActivationComplete(state)) return null;

  const nextStep = getNextActivationStep(state);
  const nextStepLabel =
    nextStep === 'location'
      ? t('activation.step_location', { defaultValue: 'Doplňte lokaci' })
      : nextStep === 'skills'
        ? t('activation.step_skills', { defaultValue: 'Potvrďte top 3 skills' })
        : nextStep === 'preferences'
          ? t('activation.step_preferences', { defaultValue: 'Nastavte preferovanou roli a mzdu' })
            : nextStep === 'cv'
              ? t('activation.step_cv', { defaultValue: 'Nahrajte CV' })
            : t('activation.step_quality', { defaultValue: 'První aktivita: otevřít detail nabídky nebo uložit nabídku' });

  const etaMinutes = state.completion_percent >= 80 ? 1 : state.completion_percent >= 50 ? 2 : 3;
  const checklist = [
    { id: 'A1', label: t('activation.item_location', { defaultValue: 'Lokalita ověřena' }), done: state.location_verified },
    { id: 'A2', label: t('activation.item_cv', { defaultValue: 'CV připravené' }), done: state.cv_ready },
    { id: 'A3', label: t('activation.item_skills', { defaultValue: '3+ klíčové skills' }), done: state.skills_confirmed_count >= 3 },
    { id: 'A4', label: t('activation.item_preferences', { defaultValue: 'Role + mzda nastavené' }), done: state.preferences_ready },
    { id: 'A5', label: t('activation.item_quality', { defaultValue: 'První quality akce' }), done: Boolean(state.first_quality_action_at) },
  ];

  return (
    <div className={`rounded-2xl border border-cyan-200/80 dark:border-cyan-700/50 bg-white/95 dark:bg-slate-900/90 shadow-[0_10px_30px_rgba(2,132,199,0.1)] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
            {t('activation.title', { defaultValue: 'Profile Activation' })}
          </div>
          <div className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-900 dark:text-slate-100 truncate`}>
            {nextStepLabel}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {t('activation.eta', {
              defaultValue: '{{minutes}} min do lepších matchů',
              minutes: etaMinutes,
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors"
        >
          {t('activation.cta_continue', { defaultValue: 'Pokračovat' })}
        </button>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
          style={{ width: `${state.completion_percent}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {t('activation.progress', {
          defaultValue: 'Dokončeno {{percent}}%',
          percent: state.completion_percent,
        })}
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg px-2 py-1 border ${item.done
                ? 'border-emerald-300/70 dark:border-emerald-700/70 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/50'
                }`}
            >
              {item.done ? '[OK] ' : ''}{item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidateActivationRail;
