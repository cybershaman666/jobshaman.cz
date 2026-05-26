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

  return (
    <section className={cn('overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-md', className)}>
      {/* Header */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5fbf]">
              {t('rebuild.journey.assessment_center', { defaultValue: 'Assessment Center' })}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {step.title}
            </h2>
            {step.prompt && (
              <p className="mt-2 text-sm leading-6 text-slate-600 max-w-2xl">
                {step.prompt}
              </p>
            )}
          </div>
          
          {/* Step Counter Badge */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#dbeafe] text-sm font-bold text-[#1f5fbf]">
            {stepIndex + 1}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:p-8">
        {children}
      </div>

      {/* Footer Helper Text */}
      {step.helper && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-600 leading-5">
            💡 <span className="font-medium">{t('rebuild.journey.tip', { defaultValue: 'Tip' })}:</span> {step.helper}
          </p>
        </div>
      )}
    </section>
  );
};
