import type {
  CandidateOnboardingFlowStep,
  CandidateOnboardingSessionV2,
} from '../types';

export const CANDIDATE_ONBOARDING_STEP_ORDER: CandidateOnboardingFlowStep[] = [
  'entry',
  'scenario_select',
  'micro_task',
  'processing',
  'reflection',
  'reality_check',
  'interest_reveal',
  'intent',
  'real_task_pick',
  'slot_reserve',
  'trial_task',
  'decision',
  'profile_nudge',
  'done',
];

export const createDefaultCandidateOnboardingSession = (): CandidateOnboardingSessionV2 => ({
  current_step: 'entry',
  scenario_id: null,
  answer_draft: '',
  interest_reveal_draft: '',
  evaluation: null,
  selected_intent: null,
  selected_task_id: null,
});

export const getPreviousCandidateOnboardingStep = (
  step: CandidateOnboardingFlowStep
): CandidateOnboardingFlowStep => {
  const currentIndex = CANDIDATE_ONBOARDING_STEP_ORDER.indexOf(step);
  if (currentIndex <= 0) return 'entry';
  return CANDIDATE_ONBOARDING_STEP_ORDER[currentIndex - 1] || 'entry';
};

export const getNextCandidateOnboardingStep = (
  step: CandidateOnboardingFlowStep
): CandidateOnboardingFlowStep => {
  const currentIndex = CANDIDATE_ONBOARDING_STEP_ORDER.indexOf(step);
  if (currentIndex < 0 || currentIndex >= CANDIDATE_ONBOARDING_STEP_ORDER.length - 1) return 'done';
  return CANDIDATE_ONBOARDING_STEP_ORDER[currentIndex + 1] || 'done';
};

export const sanitizeCandidateOnboardingSession = (raw: unknown): CandidateOnboardingSessionV2 => {
  const base = createDefaultCandidateOnboardingSession();
  if (!raw || typeof raw !== 'object') return base;

  const candidate = raw as Partial<CandidateOnboardingSessionV2>;
  const currentStep = CANDIDATE_ONBOARDING_STEP_ORDER.includes(
    candidate.current_step as CandidateOnboardingFlowStep
  )
    ? (candidate.current_step as CandidateOnboardingFlowStep)
    : base.current_step;
  const recoveredStep: CandidateOnboardingFlowStep = currentStep === 'processing'
    ? candidate.evaluation
      ? 'reflection'
      : 'micro_task'
    : currentStep;

  return {
    ...base,
    ...candidate,
    current_step: recoveredStep,
    answer_draft: String(candidate.answer_draft || ''),
    interest_reveal_draft: String(candidate.interest_reveal_draft || ''),
    selected_task_id: candidate.selected_task_id ? String(candidate.selected_task_id) : null,
  };
};
