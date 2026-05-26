import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../../cn';
import type { HandshakeBlueprintStep } from '../../../models';

export interface ProgressFlowProps {
  steps: HandshakeBlueprintStep[];
  currentIndex: number;
  variant?: 'minimal' | 'detailed';
  className?: string;
}

export const ProgressFlow: React.FC<ProgressFlowProps> = ({
  steps,
  currentIndex,
  variant = 'minimal',
  className,
}) => {
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Progress Bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200/50">
        <div
          className="h-full bg-[#1f5fbf] shadow-[0_0_8px_rgba(31,95,191,0.4)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Indicators */}
      {variant === 'detailed' && (
        <div className="flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 flex-1">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full">
                  {isComplete ? (
                    <CheckCircle2 size={32} className="text-[#1f5fbf]" />
                  ) : (
                    <div
                      className={cn(
                        'flex h-full w-full items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                        isCurrent
                          ? 'border-[#1f5fbf] bg-[#dbeafe] text-[#1f5fbf] scale-110'
                          : 'border-slate-300 text-slate-400'
                      )}
                    >
                      {index + 1}
                    </div>
                  )}
                </div>
                <span className="text-center text-[10px] font-medium text-slate-600 leading-tight max-w-[60px]">
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Step Counter */}
      <div className="text-center text-xs font-semibold text-slate-500 tracking-wide uppercase">
        {currentIndex + 1} of {steps.length}
      </div>
    </div>
  );
};
