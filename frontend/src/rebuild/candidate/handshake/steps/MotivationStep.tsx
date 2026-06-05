import React from 'react';
import { useTranslation } from 'react-i18next';
import { textareaClass } from '../../../ui/shellStyles';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import type { HandshakeBlueprintStep } from '../../../models';

export interface MotivationStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  onUpdateAnswer: (stepId: string, value: unknown) => void;
}

/**
 * Motivation Step - Why are you interested?
 * Collect: Free-text motivation/interest
 */
export const MotivationStep: React.FC<MotivationStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  onUpdateAnswer,
}) => {
  const { t } = useTranslation();

  const motivation = String(answers.motivation || '');

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('rebuild.journey.motivation_title', { defaultValue: 'What draws you to this opportunity?' })}
            </label>
            <textarea
              value={motivation}
              onChange={(e) => onUpdateAnswer('motivation', e.target.value)}
              placeholder={t('rebuild.journey.motivation_placeholder', {
                defaultValue: 'Share what excites you about this role. What problems do you want to solve? What interests you about this company?'
              })}
              rows={8}
              className={cn(textareaClass, 'mt-3')}
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {motivation.length} / 3000
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-[12px] border border-amber-100 dark:border-amber-950/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              {t('rebuild.journey.write_tips', { defaultValue: 'Writing Tips' })}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-amber-800 dark:text-amber-300">
              <li className="flex gap-2">
                <span className="flex-shrink-0">✓</span>
                <span>{t('rebuild.journey.tip_specific', { defaultValue: 'Be specific - mention concrete interests' })}</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">✓</span>
                <span>{t('rebuild.journey.tip_genuine', { defaultValue: 'Be genuine - authentic voice matters' })}</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">✓</span>
                <span>{t('rebuild.journey.tip_honest', { defaultValue: 'Be honest - about what you seek' })}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Side context */}
        <div className="h-fit rounded-[12px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-center">
          <div className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wide">
            {t('rebuild.journey.word_count', { defaultValue: 'Word Count' })}
          </div>
          <div className="mt-2 text-3xl font-bold text-[#1f5fbf] dark:text-blue-400">
            {motivation.split(/\s+/).filter(w => w.length > 0).length}
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('rebuild.journey.suggested_200_500', { defaultValue: 'Suggested: 200-500 words' })}
          </div>
        </div>
      </div>
    </StepContainer>
  );
};
