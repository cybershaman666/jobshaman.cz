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
  const [draftUrl, setDraftUrl] = React.useState('');
  const [draftProvider, setDraftProvider] = React.useState('other');
  const [draftComment, setDraftComment] = React.useState('');

  const externalSubmissions = (answers.external_submissions || []) as any[];
  const note = String(answers.work_sample_note || '');
  const canAddDraft = /^https?:\/\//i.test(draftUrl.trim());

  const addDraftSubmission = () => {
    if (!canAddDraft) return;
    onUpdateAnswer('external_submissions', [
      ...externalSubmissions,
      {
        provider: draftProvider,
        external_url: draftUrl.trim(),
        comment: draftComment.trim(),
      },
    ]);
    setDraftUrl('');
    setDraftComment('');
    setDraftProvider('other');
  };

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-6">
        {/* Main Prompt */}
        <div className="rounded-[12px] border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-6">
          <div className="text-[11px] font-bold uppercase text-green-700 dark:text-green-400 tracking-wide">
            {t('rebuild.journey.work_sample_prompt', { defaultValue: 'Show Your Work' })}
          </div>
          <p className="mt-3 text-base leading-7 text-green-900 dark:text-green-200">
            {step.prompt}
          </p>
        </div>

        {/* External Submissions */}
        <div>
          {!onAddExternalSubmission && (
            <div className="mb-4 grid gap-3 rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:grid-cols-[160px_1fr_auto]">
              <select
                value={draftProvider}
                onChange={(e) => setDraftProvider(e.target.value)}
                className="rounded-[8px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf]"
              >
                {['other', 'figma', 'notion', 'google_docs', 'miro', 'canva'].map((provider) => (
                  <option key={provider} value={provider}>{provider.replace('_', ' ')}</option>
                ))}
              </select>
              <input
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder={t('rebuild.journey.work_sample_url_placeholder', { defaultValue: 'https://...' })}
                className="rounded-[8px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf]"
              />
              <button
                type="button"
                onClick={addDraftSubmission}
                disabled={!canAddDraft}
                className={cn(primaryButtonClass, 'inline-flex justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50')}
              >
                <Plus size={16} />
                {t('rebuild.journey.add', { defaultValue: 'Add' })}
              </button>
              <textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder={t('rebuild.journey.work_sample_comment_placeholder', { defaultValue: 'Short context for the reviewer' })}
                rows={2}
                className="rounded-[8px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf] sm:col-span-3"
              />
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('rebuild.journey.work_samples', { defaultValue: 'Work Samples' })}
            </h3>
            <button
              type="button"
              onClick={onAddExternalSubmission || addDraftSubmission}
              disabled={!onAddExternalSubmission && !canAddDraft}
              className={cn(secondaryButtonClass, 'inline-flex gap-2 disabled:cursor-not-allowed disabled:opacity-50')}
            >
              <Plus size={16} />
              {t('rebuild.journey.add_work_sample', { defaultValue: 'Add Link' })}
            </button>
          </div>

          {externalSubmissions.length > 0 ? (
            <div className="space-y-3">
              {externalSubmissions.map((submission, index) => (
                <div key={index} className="rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                        {submission.provider.toUpperCase()}
                      </div>
                      <a
                        href={submission.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-sm text-[#1f5fbf] dark:text-blue-400 hover:underline truncate"
                      >
                        {new URL(submission.external_url).hostname}
                        <ExternalLink size={14} />
                      </a>
                      {submission.comment && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{submission.comment}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = externalSubmissions.filter((_, i) => i !== index);
                        onUpdateAnswer('external_submissions', updated);
                      }}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-6 text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('rebuild.journey.no_samples_yet', { defaultValue: 'No work samples added yet' })}
              </div>
              <button
                type="button"
                onClick={onAddExternalSubmission || addDraftSubmission}
                disabled={!onAddExternalSubmission && !canAddDraft}
                className={cn(primaryButtonClass, 'mt-3 inline-flex gap-2 disabled:cursor-not-allowed disabled:opacity-50')}
              >
                <Plus size={16} />
                {t('rebuild.journey.add_first_sample', { defaultValue: 'Add Your First Sample' })}
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('rebuild.journey.work_sample_notes', { defaultValue: 'Context & Notes (Optional)' })}
          </label>
          <textarea
            value={note}
            onChange={(e) => onUpdateAnswer('work_sample_note', e.target.value)}
            placeholder={t('rebuild.journey.work_sample_notes_placeholder', {
              defaultValue: 'Add context about these samples. What problem did you solve? What\'s your role? What are you proud of?'
            })}
            rows={5}
            className="mt-2 rounded-[8px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-mono text-sm text-slate-900 dark:text-slate-200 resize-none focus:border-[#1f5fbf] focus:outline-none focus:ring-1 focus:ring-[#1f5fbf]"
          />
        </div>

        {/* Supported Providers */}
        <div className="rounded-[12px] bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t('rebuild.journey.supported_providers', { defaultValue: 'Supported Providers' })}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Figma', 'GitHub', 'Notion', 'Google Docs', 'Miro', 'Canva'].map((provider) => (
              <span key={provider} className="rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                {provider}
              </span>
            ))}
          </div>
        </div>
      </div>
    </StepContainer>
  );
};
