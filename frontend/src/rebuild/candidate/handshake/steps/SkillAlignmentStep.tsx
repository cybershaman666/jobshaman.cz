import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import type { HandshakeBlueprintStep, Role } from '../../../models';

export interface SkillAlignmentStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  role: Role;
  availableSkills: string[];
  onUpdateAnswer: (stepId: string, value: unknown) => void;
}

/**
 * Skill Alignment Step - Which skills matter most for this role?
 * Collect: Selection of top 3-5 relevant skills
 */
export const SkillAlignmentStep: React.FC<SkillAlignmentStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  role,
  availableSkills,
  onUpdateAnswer,
}) => {
  const { t } = useTranslation();

  const selectedSkills = (answers.key_skills || []) as string[];

  const toggleSkill = (skill: string) => {
    const updated = selectedSkills.includes(skill)
      ? selectedSkills.filter(s => s !== skill)
      : [...selectedSkills, skill].slice(0, 5); // Max 5 skills
    
    onUpdateAnswer('key_skills', updated);
  };

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            {t('rebuild.journey.select_skills', { defaultValue: 'Select Your Top Skills (3-5)' })}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {t('rebuild.journey.skills_help_match', { defaultValue: 'Help us understand which skills you want to use in this role.' })}
          </p>
        </div>

        {/* Skills Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableSkills.map((skill) => {
            const isSelected = selectedSkills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={cn(
                  'rounded-[12px] border-2 px-4 py-3 text-left font-medium transition-all',
                  isSelected
                    ? 'border-[#1f5fbf] bg-[#dbeafe] text-[#1f5fbf] shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-5 w-5 rounded border-2 transition-all',
                      isSelected
                        ? 'border-[#1f5fbf] bg-[#1f5fbf]'
                        : 'border-slate-300'
                    )}
                  >
                    {isSelected && (
                      <svg className="h-full w-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span>{skill}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Count */}
        <div className="rounded-[12px] bg-slate-50 p-4 border border-slate-200">
          <div className="text-sm font-semibold text-slate-700">
            {t('rebuild.journey.selected', { defaultValue: 'Selected Skills' })}: {selectedSkills.length} / 5
          </div>
          {selectedSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-2 rounded-full bg-[#dbeafe] px-3 py-1 text-sm font-medium text-[#1f5fbf]"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="hover:text-[#0f4a8f]"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </StepContainer>
  );
};
