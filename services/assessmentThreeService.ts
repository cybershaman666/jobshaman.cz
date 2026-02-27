import {
  Assessment,
  AssessmentGalaxyNode,
  AssessmentSignalFrame,
  CultureResonanceResponse,
  GalaxyEvaluateNodeResponse,
  HappinessAuditInput,
  HappinessAuditOutput,
  RealtimeSignalsResponse,
} from '../types';
import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const toJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `3D service request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const fetchRealtimeSignals = async (
  chunks: string[],
  unlockedSkills: string[],
  narrativeIntegrity: number
): Promise<RealtimeSignalsResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/assessments/realtime-signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chunks,
      unlocked_skills: unlockedSkills,
      narrative_integrity: narrativeIntegrity,
    }),
  });
  return toJsonOrThrow<RealtimeSignalsResponse>(response);
};

export const fetchCultureResonance = async (
  candidateAnswers: string[],
  companyValues: string[]
): Promise<CultureResonanceResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/assessments/culture-resonance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidate_answers: candidateAnswers,
      company_values: companyValues,
    }),
  });
  return toJsonOrThrow<CultureResonanceResponse>(response);
};

export const simulateHappinessAudit = async (
  payload: HappinessAuditInput
): Promise<HappinessAuditOutput> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/audit/happiness/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return toJsonOrThrow<HappinessAuditOutput>(response);
};

export const evaluateGalaxyNode = async (payload: {
  question_id: string;
  question_text: string;
  category: 'Technical' | 'Situational' | 'Practical' | 'Logic';
  answer: string;
  metadata?: Record<string, unknown>;
}): Promise<GalaxyEvaluateNodeResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/assessments/galaxy/evaluate-node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return toJsonOrThrow<GalaxyEvaluateNodeResponse>(response);
};

export const buildInitialGalaxyNodes = (assessment: Assessment): AssessmentGalaxyNode[] => {
  const total = Math.max(assessment.questions.length, 1);
  return assessment.questions.map((q, idx) => {
    const angle = (idx / total) * Math.PI * 2;
    const radius = 2.2 + (idx % 3) * 0.45;
    const category = (q.category || 'Technical') as AssessmentGalaxyNode['category'];
    return {
      id: `node_${q.id}`,
      questionId: q.id,
      category,
      state: idx === 0 ? 'available' : 'locked',
      points: 0,
      maxPoints: 24,
      penaltyApplied: 0,
      position3d: [Math.cos(angle) * radius, Math.sin(angle) * radius, (idx % 2 === 0 ? 0.3 : -0.3)] as [number, number, number],
      position2d: {
        x: Math.round(Math.cos(angle) * 42),
        y: Math.round(Math.sin(angle) * 42),
      },
    };
  });
};

export const buildLocalSignalFrame = (
  chunks: string[],
  unlockedSkills: string[],
  narrativeIntegrity: number
): AssessmentSignalFrame => {
  const joined = chunks.join(' ').toLowerCase();
  const evidence: string[] = [];
  if (/\b(priorit|first|nejdřív|urgent|kritick)\b/.test(joined)) evidence.push('Priority framing');
  if (/\b(data|metric|kpi|měřen)\b/.test(joined)) evidence.push('Data orientation');
  if (/\b(team|tým|stakeholder|ceo)\b/.test(joined)) evidence.push('Stakeholder awareness');
  if (/\b(risk|rizik|fallback|trade-off)\b/.test(joined)) evidence.push('Risk management signal');

  return {
    timestamp: new Date().toISOString(),
    unlocked_skills: unlockedSkills,
    narrative_integrity: narrativeIntegrity,
    confidence: Math.max(15, Math.min(95, 35 + unlockedSkills.length * 6 + evidence.length * 8)),
    evidence,
  };
};
