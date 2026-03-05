import {
  MIN_DEMO_HANDSHAKE_ANSWER_LENGTH,
  getNextDemoHandshakeStep,
  hasRequiredAnswers,
  isDemoHandshakeCompleted,
  isStepTransitionAllowed,
} from './demoHandshakeFlow';

describe('demoHandshakeFlow', () => {
  it('validates required answer lengths for submission', () => {
    expect(hasRequiredAnswers({ scenarioOne: 'short', scenarioTwo: 'also short' })).toBe(false);

    const validAnswer = 'x'.repeat(MIN_DEMO_HANDSHAKE_ANSWER_LENGTH);
    expect(hasRequiredAnswers({ scenarioOne: validAnswer, scenarioTwo: validAnswer })).toBe(true);
  });

  it('allows only forward adjacent transitions', () => {
    expect(isStepTransitionAllowed('company_truth', 'candidate_reply')).toBe(true);
    expect(isStepTransitionAllowed('company_truth', 'first_company_reply')).toBe(false);
    expect(isStepTransitionAllowed('first_company_reply', 'company_truth')).toBe(false);
  });

  it('gates candidate_reply -> first_company_reply by required answers', () => {
    const validAnswer = 'x'.repeat(MIN_DEMO_HANDSHAKE_ANSWER_LENGTH);
    expect(
      isStepTransitionAllowed('candidate_reply', 'first_company_reply', {
        scenarioOne: validAnswer,
        scenarioTwo: validAnswer,
      }),
    ).toBe(true);

    expect(
      isStepTransitionAllowed('candidate_reply', 'first_company_reply', {
        scenarioOne: validAnswer,
        scenarioTwo: 'too short',
      }),
    ).toBe(false);
  });

  it('marks completed state correctly', () => {
    expect(isDemoHandshakeCompleted('completed')).toBe(true);
    expect(isDemoHandshakeCompleted('first_company_reply')).toBe(false);
  });

  it('returns expected next steps', () => {
    expect(getNextDemoHandshakeStep('company_truth')).toBe('candidate_reply');
    expect(getNextDemoHandshakeStep('candidate_reply')).toBe('first_company_reply');
    expect(getNextDemoHandshakeStep('first_company_reply')).toBe('completed');
    expect(getNextDemoHandshakeStep('completed')).toBe('completed');
  });
});
