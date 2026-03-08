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
              ? t('activation.step_cv', { defaultValue: 'Doplňte podpůrný kontext' })
            : t('activation.step_quality', { defaultValue: 'První aktivita: otevřít detail nabídky nebo uložit nabídku' });

  const etaMinutes = state.completion_percent >= 80 ? 1 : state.completion_percent >= 50 ? 2 : 3;
  const checklist = [
    { id: 'A1', label: t('activation.item_location', { defaultValue: 'Lokalita ověřena' }), done: state.location_verified },
    { id: 'A2', label: t('activation.item_cv', { defaultValue: 'Podklad nebo AI draft připraven' }), done: state.cv_ready },
    { id: 'A3', label: t('activation.item_skills', { defaultValue: '3+ klíčové skills' }), done: state.skills_confirmed_count >= 3 },
    { id: 'A4', label: t('activation.item_preferences', { defaultValue: 'Role + mzda nastavené' }), done: state.preferences_ready },
    { id: 'A5', label: t('activation.item_quality', { defaultValue: 'První quality akce' }), done: Boolean(state.first_quality_action_at) },
  ];

  return (
    <div className={`rounded-[1rem] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,249,235,0.98),rgba(255,243,224,0.94))] shadow-[0_18px_34px_-30px_rgba(180,83,9,0.18)] dark:border-amber-200/80 dark:bg-[linear-gradient(180deg,rgba(255,249,235,0.98),rgba(255,243,224,0.94))] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
            {t('activation.title', { defaultValue: 'Handshake activation' })}
          </div>
          <div className={`${compact ? 'text-sm' : 'text-base'} truncate font-semibold text-slate-900`}>
            {nextStepLabel}
          </div>
          <div className="text-xs text-slate-600">
            {t('activation.eta', {
              defaultValue: '{{minutes}} min do silnějších handshake signálů',
              minutes: etaMinutes,
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 rounded-[0.9rem] bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          {t('activation.cta_continue', { defaultValue: 'Pokračovat' })}
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
          style={{ width: `${state.completion_percent}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
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
              className={`rounded-[0.8rem] px-2 py-1 border ${item.done
                ? 'border-emerald-300/70 text-emerald-700 bg-emerald-50/70'
                : 'border-amber-200 text-slate-600 bg-white/65'
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
