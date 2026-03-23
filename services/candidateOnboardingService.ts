import { BACKEND_URL } from '../constants';
import type {
  CandidateOnboardingEvaluation,
  CandidateOnboardingIntent,
  CandidateOnboardingScenarioId,
} from '../types';
import { authenticatedFetch } from './csrfService';

const CANDIDATE_ONBOARDING_EVALUATION_TIMEOUT_MS = 12_000;

const parseErrorDetail = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload?.detail) return String(payload.detail);
  } catch {
    // Ignore malformed payloads and use fallback.
  }
  return fallback;
};

const normalizeIntentHints = (raw: unknown): CandidateOnboardingIntent[] => {
  const allowed: CandidateOnboardingIntent[] = ['explore_options', 'compare_offers', 'try_real_work'];
  return Array.isArray(raw)
    ? raw
        .map((item) => String(item || '').trim())
        .filter((item): item is CandidateOnboardingIntent => allowed.includes(item as CandidateOnboardingIntent))
    : [];
};

const mapEvaluation = (payload: any): CandidateOnboardingEvaluation => ({
  summary: String(payload?.summary || '').trim(),
  strengths: Array.isArray(payload?.strengths) ? payload.strengths.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [],
  misses: Array.isArray(payload?.misses) ? payload.misses.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [],
  role_signals: Array.isArray(payload?.role_signals) ? payload.role_signals.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [],
  reality_check: String(payload?.reality_check || '').trim(),
  intent_hints: normalizeIntentHints(payload?.intent_hints),
});

const buildFallbackEvaluation = (answer: string): CandidateOnboardingEvaluation => {
  const normalized = String(answer || '').trim();
  const mentionsPeople = /(people|person|team|customer|guest|client|lidé|člov|host|zákaz|tým)/i.test(normalized);
  const mentionsObservation = /(notice|observe|look|spot|watch|listen|vnímal|všim|pozor|sleduj|počúv|notice)/i.test(normalized);
  const mentionsSystem = /(system|process|flow|pattern|handoff|structure|chaos|proces|systém|vzorec|tok|řád)/i.test(normalized);
  const mentionsExperiment = /(try|test|small|first step|check|verify|experiment|zkus|ověř|malý krok|první krok)/i.test(normalized);
  const mentionsHandsOn = /(fix|build|make|do|repair|create|postav|uděl|oprav|vytvoř)/i.test(normalized);

  const strengths: string[] = [];
  const misses: string[] = [];
  const roleSignals: string[] = [];
  const intentHints: CandidateOnboardingIntent[] = [];

  if (mentionsObservation) strengths.push('You started by noticing what is happening before rushing to fix it.');
  if (mentionsPeople) strengths.push('You paid attention to people, not just the visible task.');
  if (mentionsSystem) strengths.push('You looked for the pattern underneath the surface.');
  if (mentionsExperiment) strengths.push('You leaned toward a small next move instead of overclaiming certainty.');

  if (!mentionsObservation) misses.push('You could slow the first move down and name what you would notice first.');
  if (!mentionsPeople) misses.push('There is room to bring in the human side of the situation more clearly.');
  if (!mentionsExperiment) misses.push('Your answer could become stronger with one gentle first check or trial.');

  if (mentionsHandsOn) roleSignals.push('This energy points toward hands-on problem solving and making ideas tangible.');
  if (mentionsSystem) roleSignals.push('This could fit environments where pattern-reading and improvement matter.');
  if (mentionsPeople) roleSignals.push('You may come alive in work that depends on trust, reading people, or coordination.');

  if (mentionsHandsOn || mentionsExperiment) intentHints.push('try_real_work');
  if (mentionsSystem) intentHints.push('compare_offers');
  if (!intentHints.length) intentHints.push('explore_options');

  return {
    summary: strengths[0] || 'You responded in a grounded way and moved toward the real situation instead of hiding behind polished language.',
    strengths: strengths.slice(0, 3),
    misses: misses.slice(0, 3),
    role_signals: roleSignals.slice(0, 3),
    reality_check: mentionsHandsOn
      ? 'Even if your CV says something else, this answer reads as practical, hands-on, and close to execution.'
      : 'There is a real direction here, and it becomes much more convincing once you name the first thing you would notice or test.',
    intent_hints: Array.from(new Set(intentHints)).slice(0, 3),
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const buildFallbackCandidateOnboardingEvaluation = (answer: string): CandidateOnboardingEvaluation =>
  buildFallbackEvaluation(answer);

export interface CandidateOnboardingEvaluationRequest {
  scenarioId: CandidateOnboardingScenarioId;
  answer: string;
  locale: string;
}

export const evaluateCandidateOnboardingAnswer = async ({
  scenarioId,
  answer,
  locale,
}: CandidateOnboardingEvaluationRequest): Promise<CandidateOnboardingEvaluation> => {
  const requestPayload = {
    scenario_id: scenarioId,
    answer,
    locale,
  };

  try {
    const response = await withTimeout(
      authenticatedFetch(`${BACKEND_URL}/candidate-onboarding/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      }),
      CANDIDATE_ONBOARDING_EVALUATION_TIMEOUT_MS,
      'Candidate onboarding evaluation timed out.'
    );

    if (response.ok) {
      const payload = await response.json();
      return mapEvaluation(payload?.evaluation || payload);
    }

    const detail = await parseErrorDetail(response, 'Candidate onboarding evaluation failed.');
    if (response.status < 500 && response.status !== 404) {
      throw new Error(detail);
    }
  } catch (error) {
    console.warn('Candidate onboarding evaluation endpoint unavailable, trying AI execute fallback.', error);
  }

  try {
    const response = await withTimeout(
      authenticatedFetch(`${BACKEND_URL}/ai/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate_candidate_onboarding_answer',
          params: requestPayload,
        }),
      }),
      CANDIDATE_ONBOARDING_EVALUATION_TIMEOUT_MS,
      'Candidate onboarding AI fallback timed out.'
    );

    if (!response.ok) {
      const detail = await parseErrorDetail(response, 'AI execute fallback failed.');
      throw new Error(detail);
    }

    const payload = await response.json();
    return mapEvaluation(payload?.evaluation || payload?.result || payload);
  } catch (error) {
    console.error('Candidate onboarding evaluation failed:', error);
    return buildFallbackEvaluation(answer);
  }
};
