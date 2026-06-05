import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../cn';
import type { HandshakeBlueprintStep } from '../../../models';

export interface StepContainerProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent wrapper for handshake step content
 * Provides header with step title and number
 */
export const StepContainer: React.FC<StepContainerProps> = ({
  step,
  stepIndex,
  totalSteps,
  children,
  className,
}) => {
  const { t } = useTranslation();

  const translatedTitle = React.useMemo(() => {
    const title = step.title || '';
    if (title === 'Porozumění zadání' || step.id === 'problem_frame') {
      return t('rebuild.journey.problem_frame_title', { defaultValue: 'Understanding the Prompt' });
    }
    if (title === 'Praktický postup' || step.id === 'work_sample') {
      return t('rebuild.journey.work_sample_title', { defaultValue: 'Practical Steps' });
    }
    if (title === 'Rizika a neznámé' || step.id === 'risk_and_unknowns') {
      return t('rebuild.journey.risk_title', { defaultValue: 'Risks & Unknowns' });
    }
    if (title === 'Navázání dialogu' || step.id === 'schedule') {
      return t('rebuild.journey.schedule_title', { defaultValue: 'Schedule Discussion' });
    }
    return title;
  }, [step.title, step.id, t]);

  const translatedPrompt = React.useMemo(() => {
    const prompt = step.prompt || '';
    if (prompt === 'Co by se mohlo pokazit a co bys potřeboval/a ověřit?') {
      return t('rebuild.journey.risk_prompt', { defaultValue: 'What could go wrong and what would you need to verify?' });
    }
    if (prompt === 'Vyber preferovaný čas pro další lidský krok.' || prompt === 'Vyberte preferovaný čas pro další lidský krok.') {
      return t('rebuild.journey.schedule_prompt', { defaultValue: 'Choose a preferred time for the next human step.' });
    }
    return prompt;
  }, [step.prompt, t]);

  const translatedHelper = React.useMemo(() => {
    const helper = step.helper || '';
    if (helper === 'Termín je žádost, firma jej potvrdí po review.' || step.id === 'schedule') {
      return t('rebuild.journey.schedule_helper', { defaultValue: 'The slot is a request, the company will confirm after review.' });
    }
    if (helper === 'Odpověz konkrétně, s předpoklady a riziky.' || step.id === 'problem_frame') {
      return t('rebuild.journey.problem_frame_helper', { defaultValue: 'Answer specifically, stating assumptions and risks.' });
    }
    if (helper === 'Popiš kroky, důkazy a rozhodovací kritéria.' || step.id === 'work_sample') {
      return t('rebuild.journey.work_sample_helper', { defaultValue: 'Describe steps, evidence, and decision criteria.' });
    }
    if (helper === 'Dobrá odpověď umí říct i co ještě neví.' || step.id === 'risk_and_unknowns') {
      return t('rebuild.journey.risk_helper', { defaultValue: "A good answer also names what you don't know yet." });
    }
    return helper;
  }, [step.helper, step.id, t]);

  return (
    <section className={cn('overflow-hidden rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md', className)}>
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5fbf] dark:text-[#7ce8ff]">
              {t('rebuild.journey.assessment_center', { defaultValue: 'Assessment Center' })}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {translatedTitle}
            </h2>
            {translatedPrompt && (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400 max-w-2xl">
                {translatedPrompt}
              </p>
            )}
          </div>
          
          {/* Step Counter Badge */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#dbeafe] dark:bg-slate-800 text-sm font-bold text-[#1f5fbf] dark:text-[#7ce8ff]">
            {stepIndex + 1}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:p-8">
        {children}
      </div>

      {/* Footer Helper Text */}
      {translatedHelper && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-6 py-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-5">
            💡 <span className="font-medium">{t('rebuild.journey.tip', { defaultValue: 'Tip' })}:</span> {translatedHelper}
          </p>
        </div>
      )}
    </section>
  );
};
