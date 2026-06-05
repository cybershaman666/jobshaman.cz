import React from 'react';
import { useTranslation } from 'react-i18next';
import { fieldClass, textareaClass } from '../../../ui/shellStyles';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import type { HandshakeBlueprintStep } from '../../../models';
import type { CandidatePreferenceProfile } from '../../../models';

export interface IdentityStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  preferences: CandidatePreferenceProfile;
  onUpdateAnswer: (stepId: string, value: unknown) => void;
}

/**
 * Identity Step - Introduce yourself
 * Collect: Legal name, Alias, Personal story
 */
export const IdentityStep: React.FC<IdentityStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  preferences,
  onUpdateAnswer,
}) => {
  const { t } = useTranslation();

  const legalName = String(answers.legal_name || preferences.legalName || '');
  const alias = String(answers.preferred_alias || preferences.preferredAlias || '');
  const story = String(answers.identity_story || preferences.story || '');

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left: Intro visual */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[12px] bg-gradient-to-b from-[#0f172a] to-[#1f2937] h-[20rem]">
            <svg
              className="h-full w-full object-cover"
              viewBox="0 0 400 300"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1f5fbf', stopOpacity: 0.3 }} />
                  <stop offset="100%" style={{ stopColor: '#0f95ac', stopOpacity: 0.1 }} />
                </linearGradient>
              </defs>
              <rect width="400" height="300" fill="url(#grad1)" />
              <circle cx="200" cy="100" r="50" fill="#1f5fbf" opacity="0.4" />
            </svg>
          </div>
          <div className="rounded-[12px] bg-slate-50 dark:bg-slate-800/50 p-5 text-base italic leading-7 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            "{t('rebuild.journey.identity_intro_company', { defaultValue: 'Help us understand who you are and what drives you.' })}"
          </div>
        </div>

        {/* Right: Form */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('rebuild.journey.legal_name', { defaultValue: 'Legal Name' })}
            </label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => onUpdateAnswer('legal_name', e.target.value)}
              placeholder={t('rebuild.journey.legal_name_placeholder', { defaultValue: 'Your full legal name' })}
              className={cn(fieldClass, 'mt-2')}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('rebuild.journey.alias', { defaultValue: 'Preferred Name' })}
            </label>
            <input
              type="text"
              value={alias}
              onChange={(e) => onUpdateAnswer('preferred_alias', e.target.value)}
              placeholder={t('rebuild.journey.alias_placeholder', { defaultValue: 'How you prefer to be called' })}
              className={cn(fieldClass, 'mt-2')}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('rebuild.journey.your_story', { defaultValue: 'Your Story' })}
            </label>
            <textarea
              value={story}
              onChange={(e) => onUpdateAnswer('identity_story', e.target.value)}
              placeholder={t('rebuild.journey.identity_placeholder', { 
                defaultValue: 'Tell us about yourself. What\'s your background? What defines you professionally?' 
              })}
              rows={6}
              className={cn(textareaClass, 'mt-2')}
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {story.length} / 2000
            </div>
          </div>
        </div>
      </div>
    </StepContainer>
  );
};
