import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../../cn';
import { primaryButtonClass, secondaryButtonClass, shellPageClass } from '../../ui/shellStyles';
import { ProgressFlow } from './ui/ProgressFlow';
import { CandidatePacketPanel } from './ui/CandidatePacketPanel';
import { IdentityStep } from './steps/IdentityStep';
import { MotivationStep } from './steps/MotivationStep';
import { SkillAlignmentStep } from './steps/SkillAlignmentStep';
import { ChallengeResponseStep } from './steps/ChallengeResponseStep';
import { WorkSampleStep } from './steps/WorkSampleStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { ResultsSummaryStep } from './steps/ResultsSummaryStep';
import { useHandshakeSession } from './hooks/useHandshakeSession';

import type { CandidateJourneySession, CandidatePreferenceProfile, Company, HandshakeBlueprint, Role } from '../../models';
import type { CVDocument, UserProfile } from '../../../types';

export interface CandidateHandshakeLayoutProps {
  handshakeId: string;
  role: Role;
  company: Company;
  blueprint: HandshakeBlueprint;
  initialSession: CandidateJourneySession;
  preferences: CandidatePreferenceProfile;
  userProfile: UserProfile;
  activeCvDocument: CVDocument | null;
  
  // Callbacks
  onNavigateBack: () => void;
  onNavigateToStep: (stepId: string) => void;
  onFinalizeHandshake: (session: CandidateJourneySession, candidateScore: number) => Promise<void>;
  onAddExternalSubmission?: () => void;
  
  // Optional
  finalizeBusy?: boolean;
  className?: string;
}

/**
 * Main handshake layout for candidates
 * Manages all 7 steps + navigation + state
 * Clean, progressive disclosure UI matching mockups
 */
export const CandidateHandshakeLayout: React.FC<CandidateHandshakeLayoutProps> = ({
  handshakeId,
  role,
  company,
  blueprint,
  initialSession,
  preferences,
  userProfile,
  activeCvDocument,
  onNavigateBack,
  onNavigateToStep,
  onFinalizeHandshake,
  onAddExternalSubmission,
  finalizeBusy = false,
  className,
}) => {
  const { t } = useTranslation();

  // Session state management
  const { session, updateAnswer, isDirty, isSaving, saveAnswers } = useHandshakeSession(
    handshakeId,
    initialSession,
    {
      autoSaveDelay: 800,
    }
  );

  // Calculate candidate score based on answers
  const candidateScore = React.useMemo(() => {
    const textVolume = Object.values(session.answers || {}).reduce((sum, value) => {
      if (Array.isArray(value)) return sum + value.join(' ').length;
      if (typeof value === 'object' && value !== null) {
        return sum + JSON.stringify(value).length;
      }
      return sum + String(value || '').length;
    }, 0);
    return Math.max(74, Math.min(96, 72 + Math.round(textVolume / 36)));
  }, [session.answers]);

  // Current step logic
  const currentStepId = session.currentStepId || blueprint.steps[0]?.id || 'identity';
  const stepIndex = Math.max(0, blueprint.steps.findIndex((s) => s.id === currentStepId));
  const currentStep = blueprint.steps[stepIndex] || blueprint.steps[0];

  // Navigation
  const previousStep = blueprint.steps[stepIndex - 1];
  const nextStep = blueprint.steps[stepIndex + 1];

  const goToPreviousStep = () => {
    if (previousStep) {
      onNavigateToStep(previousStep.id);
    }
  };

  const goToNextStep = () => {
    if (nextStep) {
      onNavigateToStep(nextStep.id);
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    try {
      await saveAnswers();
      await onFinalizeHandshake(session, candidateScore);
    } catch (error) {
      console.error('Failed to finalize handshake', error);
    }
  };

  // Render step content based on type
  const renderStepContent = () => {
    const stepType = (currentStep as any)?.type || '';

    switch (stepType) {
      case 'identity':
        return (
          <IdentityStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            preferences={preferences}
            onUpdateAnswer={updateAnswer}
          />
        );

      case 'motivation':
        return (
          <MotivationStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            onUpdateAnswer={updateAnswer}
          />
        );

      case 'skill_alignment':
        return (
          <SkillAlignmentStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            role={role}
            availableSkills={role.skills || []}
            onUpdateAnswer={updateAnswer}
          />
        );

      case 'challenge_response':
      case 'scenario_response':
      case 'task_workspace':
      case 'reflection':
        return (
          <ChallengeResponseStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            onUpdateAnswer={updateAnswer}
          />
        );

      case 'work_sample':
      case 'portfolio_or_proof':
        return (
          <WorkSampleStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            onUpdateAnswer={updateAnswer}
            onAddExternalSubmission={onAddExternalSubmission}
          />
        );

      case 'schedule_slot':
      case 'schedule_request':
        return (
          <ScheduleStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            availableSlots={[]} // TODO: load from API
            onUpdateAnswer={updateAnswer}
          />
        );

      case 'results_summary':
        return (
          <ResultsSummaryStep
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={blueprint.steps.length}
            answers={session.answers || {}}
            candidateScore={candidateScore}
            isSubmitting={finalizeBusy}
            onSubmit={handleSubmit}
            onUpdateAnswer={updateAnswer}
            isSaving={isSaving}
          />
        );

      default:
        return <div className="text-center text-slate-600 dark:text-slate-400 py-8">Unknown step type: {stepType}</div>;
    }
  };

  return (
    <div className={cn(shellPageClass, 'space-y-6', className)}>
      {/* Header with navigation */}
      <div className="rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_18px_50px_-44px_rgba(15,23,42,0.34)] sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Back button + Breadcrumb */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onNavigateBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-200 dark:border-slate-800 text-slate-500 transition hover:border-[#1f5fbf] hover:text-[#1f5fbf]"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#1f5fbf]">{company.name}</div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{role.title}</div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="hidden md:flex min-w-0 flex-1 justify-center gap-2 overflow-x-auto px-2">
            {blueprint.steps.slice(0, 5).map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onNavigateToStep(step.id)}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition',
                  step.id === currentStep.id
                    ? 'border-[#1f5fbf] text-[#1f5fbf]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                )}
              >
                {step.title}
              </button>
            ))}
          </div>

          {/* Step counter + status */}
          <div className="flex items-center gap-4">
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <div className="font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {t('rebuild.journey.step_count', { current: stepIndex + 1, total: blueprint.steps.length })}
              </div>
              <div className="text-xs dark:text-slate-400">{blueprint.overview}</div>
            </div>

            {/* Auto-save indicator */}
            {isDirty && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                <Loader2 size={14} className="animate-spin" />
                {t('rebuild.journey.saving', { defaultValue: 'Saving...' })}
              </div>
            )}

            {/* Company reviewer avatar */}
            <img
              src={company.reviewer.avatarUrl}
              alt={company.reviewer.name}
              className="h-9 w-9 rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Slot availability warning */}
      {session.slotAvailability && !session.slotAvailability.available && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
          {session.slotAvailability.reason === 'candidate_slots_full'
            ? t('rebuild.journey.candidate_slots_full', {
                defaultValue: 'All your active handshake slots are currently occupied. Close or finish another handshake before starting this one.',
              })
            : t('rebuild.journey.company_slots_full', {
                defaultValue: 'This company challenge is currently full. Try again after the company frees a handshake slot.',
              })}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Left: Step content */}
        <div className="space-y-6">
          {renderStepContent()}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-4 rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={!previousStep || finalizeBusy}
              className={cn(
                secondaryButtonClass,
                'inline-flex gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <ArrowLeft size={16} />
              {t('rebuild.journey.previous', { defaultValue: 'Previous' })}
            </button>

            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {t('rebuild.journey.step', { defaultValue: 'Step' })} {stepIndex + 1} {t('rebuild.journey.of', { defaultValue: 'of' })} {blueprint.steps.length}
            </div>

            {stepIndex < blueprint.steps.length - 1 ? (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!nextStep || finalizeBusy || isSaving}
                className={cn(primaryButtonClass, 'inline-flex gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
              >
                {isSaving ? t('rebuild.journey.saving', { defaultValue: 'Saving...' }) : t('rebuild.journey.next', { defaultValue: 'Next' })}
                <ArrowRight size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Right: Candidate packet + progress */}
        <aside className="space-y-4">
          {/* Progress */}
          <div className="rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <ProgressFlow
              steps={blueprint.steps}
              currentIndex={stepIndex}
              variant="minimal"
            />
          </div>

          {/* Candidate packet */}
          <CandidatePacketPanel
            role={role}
            preferences={preferences}
            userProfile={userProfile}
            activeCvDocument={activeCvDocument}
            session={session}
            candidateScore={candidateScore}
          />
        </aside>
      </div>
    </div>
  );
};
