export type DemoHandshakeStep = 'company_truth' | 'candidate_reply' | 'first_company_reply' | 'completed';

export interface DemoHandshakeAnswers {
  scenarioOne: string;
  scenarioTwo: string;
}

export const MIN_DEMO_HANDSHAKE_ANSWER_LENGTH = 20;

const normalizeAnswer = (value: string): string => String(value || '').trim();

export const getAnswerLengths = (answers: DemoHandshakeAnswers): { scenarioOne: number; scenarioTwo: number } => ({
  scenarioOne: normalizeAnswer(answers.scenarioOne).length,
  scenarioTwo: normalizeAnswer(answers.scenarioTwo).length,
});

export const hasRequiredAnswers = (
  answers: DemoHandshakeAnswers,
  minLength: number = MIN_DEMO_HANDSHAKE_ANSWER_LENGTH,
): boolean => {
  const lengths = getAnswerLengths(answers);
  return lengths.scenarioOne >= minLength && lengths.scenarioTwo >= minLength;
};

const ORDER: DemoHandshakeStep[] = ['company_truth', 'candidate_reply', 'first_company_reply', 'completed'];

export const getNextDemoHandshakeStep = (currentStep: DemoHandshakeStep): DemoHandshakeStep => {
  const currentIndex = ORDER.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === ORDER.length - 1) return 'completed';
  return ORDER[currentIndex + 1];
};

export const isStepTransitionAllowed = (
  from: DemoHandshakeStep,
  to: DemoHandshakeStep,
  answers?: DemoHandshakeAnswers,
): boolean => {
  const fromIndex = ORDER.indexOf(from);
  const toIndex = ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  if (toIndex !== fromIndex + 1) return false;

  if (from === 'candidate_reply' && to === 'first_company_reply') {
    return !!answers && hasRequiredAnswers(answers);
  }

  return true;
};

export const isDemoHandshakeCompleted = (step: DemoHandshakeStep): boolean => step === 'completed';
