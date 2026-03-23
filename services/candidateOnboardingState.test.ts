import {
  createDefaultCandidateOnboardingSession,
  getNextCandidateOnboardingStep,
  getPreviousCandidateOnboardingStep,
  sanitizeCandidateOnboardingSession,
} from './candidateOnboardingState';

describe('candidateOnboardingState', () => {
  it('builds a safe default session', () => {
    expect(createDefaultCandidateOnboardingSession()).toEqual({
      current_step: 'entry',
      scenario_id: null,
      answer_draft: '',
      interest_reveal_draft: '',
      evaluation: null,
      selected_intent: null,
      selected_task_id: null,
    });
  });

  it('walks forward and backward through the flow', () => {
    expect(getNextCandidateOnboardingStep('entry')).toBe('scenario_select');
    expect(getNextCandidateOnboardingStep('decision')).toBe('profile_nudge');
    expect(getNextCandidateOnboardingStep('reality_check')).toBe('interest_reveal');
    expect(getPreviousCandidateOnboardingStep('intent')).toBe('interest_reveal');
    expect(getPreviousCandidateOnboardingStep('real_task_pick')).toBe('intent');
    expect(getPreviousCandidateOnboardingStep('entry')).toBe('entry');
  });

  it('sanitizes invalid persisted sessions', () => {
    expect(
      sanitizeCandidateOnboardingSession({
        current_step: 'not-real',
        answer_draft: 123,
        selected_task_id: 999,
      })
    ).toEqual({
      current_step: 'entry',
      scenario_id: null,
      answer_draft: '123',
      interest_reveal_draft: '',
      evaluation: null,
      selected_intent: null,
      selected_task_id: '999',
    });
  });

  it('recovers persisted processing sessions into a safe next step', () => {
    expect(
      sanitizeCandidateOnboardingSession({
        current_step: 'processing',
        answer_draft: 'Something is off here.',
      }).current_step
    ).toBe('micro_task');

    expect(
      sanitizeCandidateOnboardingSession({
        current_step: 'processing',
        evaluation: { summary: 'ok', strengths: [], misses: [], role_signals: [], reality_check: 'ok', intent_hints: [] },
      }).current_step
    ).toBe('reflection');
  });
});
