import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../../cn';
import { StepContainer } from '../ui/StepContainer';
import type { HandshakeBlueprintStep } from '../../../models';

export interface ScheduleSlot {
  id: string;
  date: string;
  time: string;
  duration: number; // minutes
  timezone: string;
}

export interface ScheduleStepProps {
  step: HandshakeBlueprintStep;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  availableSlots: ScheduleSlot[];
  onUpdateAnswer: (stepId: string, value: unknown) => void;
  isLoadingSlots?: boolean;
}

/**
 * Schedule Step - When can you talk?
 * Collect: Selected time slot for next interaction
 */
export const ScheduleStep: React.FC<ScheduleStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  answers,
  availableSlots,
  onUpdateAnswer,
  isLoadingSlots = false,
}) => {
  const { t } = useTranslation();

  const selectedSlot = answers.schedule_slot as ScheduleSlot | undefined;

  const formatSlotTime = (slot: ScheduleSlot) => {
    const date = new Date(slot.date);
    const dateStr = date.toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${dateStr} at ${slot.time}`;
  };

  return (
    <StepContainer step={step} stepIndex={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-6">
        {/* Prompt */}
        <div className="rounded-[12px] border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/20 p-6">
          <div className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-400 tracking-wide">
            {t('rebuild.journey.schedule_prompt', { defaultValue: 'Next Steps' })}
          </div>
          <p className="mt-3 text-base leading-7 text-purple-900 dark:text-purple-200">
            {step.prompt || t('rebuild.journey.schedule_default', {
              defaultValue: 'Let\'s set up a time to talk. Choose a slot that works for you.'
            })}
          </p>
        </div>

        {/* Available Slots */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            {t('rebuild.journey.available_times', { defaultValue: 'Available Times' })}
          </h3>

          {isLoadingSlots ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              {t('rebuild.journey.loading_slots', { defaultValue: 'Loading available times...' })}
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="rounded-[12px] border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
              <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  {t('rebuild.journey.no_slots', { defaultValue: 'No Slots Available' })}
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {t('rebuild.journey.no_slots_desc', { defaultValue: 'Check back later or contact the company directly.' })}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {availableSlots.map((slot) => {
                const isSelected = selectedSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => onUpdateAnswer('schedule_slot', slot)}
                    className={cn(
                      'rounded-[12px] border-2 p-4 text-left transition-all',
                      isSelected
                        ? 'border-[#1f5fbf] bg-[#dbeafe] dark:border-blue-500/80 dark:bg-blue-950/60 shadow-md'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center',
                        isSelected
                          ? 'bg-[#1f5fbf] dark:bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      )}>
                        <Calendar size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          'font-semibold',
                          isSelected ? 'text-[#1f5fbf] dark:text-blue-300' : 'text-slate-900 dark:text-slate-200'
                        )}>
                          {formatSlotTime(slot)}
                        </div>
                        <div className={cn(
                          'text-sm mt-1 flex items-center gap-1',
                          isSelected ? 'text-[#0f4a8f] dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                        )}>
                          <Clock size={14} />
                          {slot.duration} min
                        </div>
                        <div className={cn(
                          'text-xs mt-1',
                          isSelected ? 'text-[#0f4a8f] dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'
                        )}>
                          {slot.timezone}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 text-[#1f5fbf] dark:text-blue-400 font-bold text-xl">
                          ✓
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Slot Summary */}
        {selectedSlot && (
          <div className="rounded-[12px] border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-4">
            <div className="text-sm font-semibold text-green-900 dark:text-green-200">
              ✓ {t('rebuild.journey.scheduled', { defaultValue: 'Scheduled for' })} {formatSlotTime(selectedSlot)}
            </div>
            <p className="text-sm text-green-800 dark:text-green-300 mt-2">
              {t('rebuild.journey.schedule_confirm', {
                defaultValue: 'A confirmation email will be sent to you shortly.'
              })}
            </p>
          </div>
        )}
      </div>
    </StepContainer>
  );
};
