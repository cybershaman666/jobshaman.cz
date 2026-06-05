import React from 'react';
import { useTranslation } from 'react-i18next';
import { textareaClass } from '../../../ui/shellStyles';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import type { HandshakeBlueprintStep } from '../../../models';

export interface ChallengeResponseStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  onUpdateAnswer: (stepId: string, value: unknown) => void;
}

/**
 * Challenge Response Step - How would you approach this?
 * Collect: Scenario response / problem-solving approach
 */
export const ChallengeResponseStep: React.FC<ChallengeResponseStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  onUpdateAnswer,
}) => {
  const { t } = useTranslation();

  const response = String(answers.challenge_response || '');

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-6">
        {/* Challenge Context Box */}
        <div className="rounded-[12px] border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-6">
          <div className="text-[11px] font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wide">
            {t('rebuild.journey.challenge_context', { defaultValue: 'The Challenge' })}
          </div>
          <p className="mt-3 text-base leading-7 text-blue-900 dark:text-blue-200">
            {step.prompt}
          </p>
        </div>

        {/* Response Form */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('rebuild.journey.your_approach', { defaultValue: 'Your Approach' })}
          </label>
          <textarea
            value={response}
            onChange={(e) => onUpdateAnswer('challenge_response', e.target.value)}
            placeholder={t('rebuild.journey.challenge_placeholder', {
              defaultValue: 'How would you approach this challenge? What\'s your thinking process? What would you do first?'
            })}
            rows={8}
            className={cn(textareaClass, 'mt-3')}
          />
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {response.length} / 5000
          </div>
        </div>

        {/* Evaluation Criteria */}
        <div className="rounded-[12px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
          <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 tracking-wide mb-3">
            {t('rebuild.journey.we_look_for', { defaultValue: 'We\'re Assessing' })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3">
              <span className="flex-shrink-0 text-lg">🎯</span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">{t('rebuild.journey.clarity', { defaultValue: 'Clarity' })}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{t('rebuild.journey.clarity_desc', { defaultValue: 'Clear thinking' })}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 text-lg">🔍</span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">{t('rebuild.journey.insight', { defaultValue: 'Insight' })}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{t('rebuild.journey.insight_desc', { defaultValue: 'Deep understanding' })}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 text-lg">⚙️</span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">{t('rebuild.journey.practicality', { defaultValue: 'Practicality' })}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{t('rebuild.journey.practicality_desc', { defaultValue: 'Doable solutions' })}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 text-lg">🛠️</span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">{t('rebuild.journey.execution', { defaultValue: 'Execution' })}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{t('rebuild.journey.execution_desc', { defaultValue: 'Next steps' })}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepContainer>
  );
};
