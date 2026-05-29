import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import { primaryButtonClass } from '../../../ui/shellStyles';
import type { HandshakeBlueprintStep } from '../../../models';

export interface ResultsSummaryStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  candidateScore: number;
  isSubmitting?: boolean;
  isSaving?: boolean;
  onSubmit?: () => Promise<void>;
  onUpdateAnswer: (stepId: string, value: unknown) => void;
}

/**
 * Results Summary Step - Review & submit your handshake
 * Shows: Score, feedback, final submission option
 */
export const ResultsSummaryStep: React.FC<ResultsSummaryStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  candidateScore,
  isSubmitting = false,
  isSaving = false,
  onSubmit,
  onUpdateAnswer,
}) => {
  const { t } = useTranslation();

  const finalNote = String(answers.final_note || '');

  const handleSubmit = async () => {
    if (onSubmit) {
      await onSubmit();
    }
  };

  // Determine score assessment
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-blue-50 border-blue-200';
    if (score >= 55) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-8">
        {/* Score Display */}
        <div className={cn('rounded-[12px] border-2 p-8 text-center', getScoreBg(candidateScore))}>
          <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">
            {t('rebuild.journey.assessment_complete', { defaultValue: 'Assessment Complete' })}
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className={cn('text-6xl font-bold', getScoreColor(candidateScore))}>
              {candidateScore}
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-700">/100</div>
              <div className="text-xs text-slate-600 mt-1">
                {candidateScore >= 85 && t('rebuild.journey.score_excellent', { defaultValue: 'Excellent' })}
                {candidateScore >= 70 && candidateScore < 85 && t('rebuild.journey.score_good', { defaultValue: 'Good' })}
                {candidateScore >= 55 && candidateScore < 70 && t('rebuild.journey.score_fair', { defaultValue: 'Fair' })}
                {candidateScore < 55 && t('rebuild.journey.score_develop', { defaultValue: 'Needs Work' })}
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-700 max-w-xl mx-auto leading-6">
            {t('rebuild.journey.score_insight', {
              defaultValue: 'Your responses show a solid understanding of the role and clear communication.'
            })}
          </p>
        </div>

        {/* What We Assessed */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">
            {t('rebuild.journey.assessment_criteria', { defaultValue: 'What We Assessed' })}
          </h3>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: t('rebuild.journey.clarity', { defaultValue: 'Clarity' }), score: 85 },
              { label: t('rebuild.journey.insight', { defaultValue: 'Insight' }), score: 78 },
              { label: t('rebuild.journey.practicality', { defaultValue: 'Practicality' }), score: 72 },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[12px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
                  <span className="text-lg font-bold text-[#1f5fbf]">{metric.score}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1f5fbf] transition-all duration-500"
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final Note */}
        <div className="border-t border-slate-200 pt-6">
          <label className="text-sm font-semibold text-slate-700">
            {t('rebuild.journey.final_message', { defaultValue: 'Final Message (Optional)' })}
          </label>
          <textarea
            value={finalNote}
            onChange={(e) => onUpdateAnswer('final_note', e.target.value)}
            placeholder={t('rebuild.journey.final_note_placeholder', {
              defaultValue: 'Anything else you\'d like the reviewer to know?'
            })}
            rows={4}
            className="mt-3 rounded-[8px] border border-slate-300 bg-white p-3 font-mono text-sm resize-none focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf]"
          />
        </div>

        {/* Submit Section */}
        <div className="rounded-[12px] border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">
                {t('rebuild.journey.ready_to_submit', { defaultValue: 'Ready to Submit' })}
              </h3>
              <p className="text-sm text-green-800 mt-2">
                {t('rebuild.journey.submit_desc', {
                  defaultValue: 'Your handshake is complete. Once submitted, the company will review your responses.'
                })}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isSaving}
                className={cn(primaryButtonClass, 'mt-4 inline-flex gap-2')}
              >
                {isSubmitting || isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isSaving
                      ? t('rebuild.journey.saving', { defaultValue: 'Saving...' })
                      : t('rebuild.journey.submitting', { defaultValue: 'Submitting...' })}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {t('rebuild.journey.submit_now', { defaultValue: 'Submit Handshake' })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
          {t('rebuild.journey.submit_info', {
            defaultValue: 'After submission, you can still edit your responses until the company begins reviewing.'
          })}
        </div>
      </div>
    </StepContainer>
  );
};
