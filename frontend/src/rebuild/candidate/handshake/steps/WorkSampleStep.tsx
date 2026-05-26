import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus } from 'lucide-react';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import { primaryButtonClass, secondaryButtonClass } from '../../../ui/shellStyles';
import type { HandshakeBlueprintStep } from '../../../models';

export interface WorkSampleStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  onUpdateAnswer: (stepId: string, value: unknown) => void;
  onAddExternalSubmission?: () => void;
}

/**
 * Work Sample Step - Show us your work
 * Support: External links (Figma, Notion, GitHub, etc.) + attachments
 */
export const WorkSampleStep: React.FC<WorkSampleStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  onUpdateAnswer,
  onAddExternalSubmission,
}) => {
  const { t } = useTranslation();

  const externalSubmissions = (answers.external_submissions || []) as any[];
  const note = String(answers.work_sample_note || '');

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-6">
        {/* Main Prompt */}
        <div className="rounded-[12px] border border-green-200 bg-green-50 p-6">
          <div className="text-[11px] font-bold uppercase text-green-700 tracking-wide">
            {t('rebuild.journey.work_sample_prompt', { defaultValue: 'Show Your Work' })}
          </div>
          <p className="mt-3 text-base leading-7 text-green-900">
            {step.prompt}
          </p>
        </div>

        {/* External Submissions */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('rebuild.journey.work_samples', { defaultValue: 'Work Samples' })}
            </h3>
            <button
              type="button"
              onClick={onAddExternalSubmission}
              className={cn(secondaryButtonClass, 'inline-flex gap-2')}
            >
              <Plus size={16} />
              {t('rebuild.journey.add_work_sample', { defaultValue: 'Add Link' })}
            </button>
          </div>

          {externalSubmissions.length > 0 ? (
            <div className="space-y-3">
              {externalSubmissions.map((submission, index) => (
                <div key={index} className="rounded-[12px] border border-slate-200 bg-white p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {submission.provider.toUpperCase()}
                      </div>
                      <a
                        href={submission.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-sm text-[#1f5fbf] hover:underline truncate"
                      >
                        {new URL(submission.external_url).hostname}
                        <ExternalLink size={14} />
                      </a>
                      {submission.comment && (
                        <p className="mt-2 text-sm text-slate-600">{submission.comment}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = externalSubmissions.filter((_, i) => i !== index);
                        onUpdateAnswer('external_submissions', updated);
                      }}
                      className="text-slate-400 hover:text-red-500 transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
              <div className="text-sm text-slate-600">
                {t('rebuild.journey.no_samples_yet', { defaultValue: 'No work samples added yet' })}
              </div>
              <button
                type="button"
                onClick={onAddExternalSubmission}
                className={cn(primaryButtonClass, 'mt-3 inline-flex gap-2')}
              >
                <Plus size={16} />
                {t('rebuild.journey.add_first_sample', { defaultValue: 'Add Your First Sample' })}
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold text-slate-700">
            {t('rebuild.journey.work_sample_notes', { defaultValue: 'Context & Notes (Optional)' })}
          </label>
          <textarea
            value={note}
            onChange={(e) => onUpdateAnswer('work_sample_note', e.target.value)}
            placeholder={t('rebuild.journey.work_sample_notes_placeholder', {
              defaultValue: 'Add context about these samples. What problem did you solve? What\'s your role? What are you proud of?'
            })}
            rows={5}
            className="mt-2 rounded-[8px] border border-slate-300 bg-white p-3 font-mono text-sm resize-none focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf]"
          />
        </div>

        {/* Supported Providers */}
        <div className="rounded-[12px] bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-700 mb-2">
            {t('rebuild.journey.supported_providers', { defaultValue: 'Supported Providers' })}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Figma', 'GitHub', 'Notion', 'Google Docs', 'Miro', 'Canva'].map((provider) => (
              <span key={provider} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {provider}
              </span>
            ))}
          </div>
        </div>
      </div>
    </StepContainer>
  );
};
