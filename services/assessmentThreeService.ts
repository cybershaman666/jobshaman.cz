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
import { authenticatedFetch, isBackendNetworkCooldownActive } from './csrfService';

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
  if (isBackendNetworkCooldownActive()) {
    const localFrame: RealtimeSignalsResponse['merged_frame'] = {
      timestamp: new Date().toISOString(),
      unlocked_skills: unlockedSkills,
      narrative_integrity: narrativeIntegrity,
      confidence: Math.max(25, Math.min(90, 30 + unlockedSkills.length * 5)),
      evidence: [],
    };
    return { frames: [localFrame], merged_frame: localFrame };
  }
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
  if (isBackendNetworkCooldownActive()) {
    return {
      frame: {
        candidate_vector: [0.6, 0.58, 0.62],
        company_vector: [1, 1, 1],
        match: 60,
        tension_points: ['Realtime backend temporarily unavailable'],
      },
      recommendation: 'Local mode: verify culture fit in interview follow-up.',
      disclaimer: 'AI recommendation only. Final decision remains with recruiter.',
    };
  }
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
  if (isBackendNetworkCooldownActive()) {
    const monthlyCommuteHours = (payload.commute_minutes_daily * 22) / 60;
    return {
      time_ring: Math.max(0, Math.min(100, Math.round(100 - monthlyCommuteHours * 1.8))),
      energy_ring: Math.max(0, Math.min(100, Math.round(payload.subjective_energy - monthlyCommuteHours * 0.8))),
      sustainability_score: Math.max(0, Math.min(100, Math.round(62 - payload.commute_cost / 2000 + payload.home_office_days * 4))),
      drift_score: Math.max(0, Math.min(100, Math.round(45 + payload.role_shift * 0.35))),
      recommendations: ['Backend unavailable: showing local estimate.'],
      advisory_disclaimer: 'AI recommendation only. Final decision remains with user/recruiter.',
    };
  }
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
  if (isBackendNetworkCooldownActive()) {
    const text = (payload.answer || '').trim();
    if (text.length < 20) {
      return { quality_tier: 'weak', points: 4, penalty: 10, evidence: ['short_response'] };
    }
    if (text.length < 80) {
      return { quality_tier: 'acceptable', points: 12, penalty: 3, evidence: ['medium_detail'] };
    }
    return { quality_tier: 'strong', points: 20, penalty: 0, evidence: ['detailed_response'] };
  }
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
