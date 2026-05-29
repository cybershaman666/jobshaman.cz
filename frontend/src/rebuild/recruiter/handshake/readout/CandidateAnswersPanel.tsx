import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../cn';

export interface CandidateAnswersPanelProps {
  answers: Record<string, any>;
  blueprint?: any;
  className?: string;
}

/**
 * Display candidate's handshake answers in structured format
 * For recruiter readout view
 */
export const CandidateAnswersPanel: React.FC<CandidateAnswersPanelProps> = ({
  answers,
  blueprint,
  className,
}) => {
  const { t } = useTranslation();

  if (!answers || Object.keys(answers).length === 0) {
    return (
      <div className={cn('rounded-[12px] border border-slate-200 bg-slate-50 p-6 text-center', className)}>
        <div className="text-sm text-slate-600">
          {t('rebuild.recruiter.no_answers_yet', { defaultValue: 'No answers submitted yet' })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(answers).map(([key, value]) => {
        if (!value) return null;

        let displayLabel = key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.slice(1);
        let displayValue: React.ReactNode = value;

        // Format specific answer types
        if (value && typeof value === 'object' && !Array.isArray(value) && ('body' in value || 'prompt' in value || 'title' in value)) {
          const item = value as { title?: string; prompt?: string; body?: string };
          displayLabel = item.title || displayLabel;
          displayValue = (
            <div className="space-y-3">
              {item.prompt ? (
                <div className="rounded-[8px] bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">
                  {item.prompt}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {item.body || ''}
              </div>
            </div>
          );
        } else if (typeof value === 'string') {
          displayValue = (
            <div className="whitespace-pre-wrap text-sm text-slate-700 leading-6">
              {value}
            </div>
          );
        } else if (Array.isArray(value)) {
          displayValue = (
            <div className="flex flex-wrap gap-2">
              {value.map((item: any, idx: number) => (
                <span key={idx} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900">
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </span>
              ))}
            </div>
          );
        } else if (typeof value === 'object') {
          displayValue = (
            <div className="text-sm text-slate-700">
              {JSON.stringify(value, null, 2)}
            </div>
          );
        }

        return (
          <div key={key} className="rounded-[12px] border border-slate-200 bg-white p-4">
            <div className="text-xs font-bold uppercase text-slate-500 tracking-wide">
              {displayLabel}
            </div>
            <div className="mt-2">{displayValue}</div>
          </div>
        );
      })}
    </div>
  );
};
