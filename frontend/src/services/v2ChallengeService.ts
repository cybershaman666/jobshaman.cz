import ApiService from './apiService';
import type { Role } from '../rebuild/models';

export type ExternalToolProvider = 'notion' | 'canva' | 'figma' | 'google_docs' | 'miro' | 'other';

export interface AssessmentTask {
  id: string;
  type: 'text_response' | 'workspace' | 'file_upload' | 'external_link' | 'scheduler' | string;
  phase: 'briefing' | 'identity' | 'motivation' | 'task' | 'review' | 'dialogue' | string;
  title: string;
  prompt: string;
  instructions?: string;
  timebox_minutes?: number;
  required?: boolean;
  rubric?: Array<{ id: string; label: string; weight: number }>;
  providers?: ExternalToolProvider[];
  expected_submission?: string;
  evidence_required?: boolean;
}

export interface ChallengeDraft {
  id: string;
  company_id: string;
  company_name?: string;
  title: string;
  summary?: string;
  description?: string;
  location?: string;
  work_model?: Role['workModel'] | string;
  salary_from?: number | null;
  salary_to?: number | null;
  currency?: Role['currency'] | string;
  status: 'draft' | 'ai_assisted' | 'ready_for_publish' | 'published' | 'archived' | string;
  source_kind?: string;
  assessment_tasks?: AssessmentTask[];
  handshake_blueprint_v1?: Record<string, unknown>;
  capacity_policy?: Record<string, unknown>;
  editor_state?: Record<string, unknown>;
  payload_json?: Record<string, unknown>;
  tags?: string[];
  skills_required?: string[];
  published_at?: string | null;
  updated_at?: string | null;
}

export interface ChallengeUpsertInput {
  title: string;
  role_family?: string;
  summary: string;
  description?: string;
  skills?: string[];
  salary_from?: number | null;
  salary_to?: number | null;
  salary_currency?: string;
  work_model?: string;
  location?: string;
  first_reply_prompt?: string;
  company_goal?: string;
  assessment_tasks?: AssessmentTask[];
  handshake_blueprint_v1?: Record<string, unknown>;
  capacity_policy?: Record<string, unknown>;
  editor_state?: Record<string, unknown>;
}

const unwrapChallenge = (payload: any): ChallengeDraft => payload?.data?.id ? payload.data : payload?.challenge || payload?.data || payload;

export const listCompanyChallenges = async (): Promise<ChallengeDraft[]> => {
  const payload = await ApiService.get<any>('/company/challenges');
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const createCompanyChallenge = async (input: ChallengeUpsertInput): Promise<ChallengeDraft> => {
  const payload = await ApiService.post<any>('/company/challenges', input);
  return unwrapChallenge(payload);
};

export const updateCompanyChallenge = async (challengeId: string, input: Partial<ChallengeUpsertInput> & { status?: string }): Promise<ChallengeDraft> => {
  const payload = await ApiService.patch<any>(`/company/challenges/${encodeURIComponent(challengeId)}`, input);
  return unwrapChallenge(payload);
};

export const aiAssistCompanyChallenge = async (
  challengeId: string,
  input: { problem_statement?: string; role_family?: string; title?: string; summary?: string; candidate_task?: string; first_reply_prompt?: string; skills?: string[]; work_model?: string; location?: string } = {},
): Promise<{ challenge: ChallengeDraft; ai_output: Record<string, unknown> }> => {
  const payload = await ApiService.post<any>(`/company/challenges/${encodeURIComponent(challengeId)}/ai-assist`, input);
  return payload?.data || payload;
};

export const aiDraftCompanyChallenge = async (
  input: { title?: string; summary?: string; candidate_task?: string; first_reply_prompt?: string; problem_statement?: string; role_family?: string; skills?: string[]; work_model?: string; location?: string } = {},
): Promise<{ ai_output: Record<string, unknown> }> => {
  const payload = await ApiService.post<any>('/company/challenges/ai-draft', input);
  return payload?.data || payload;
};

export const publishCompanyChallenge = async (
  challengeId: string,
  input: { human_confirmed: boolean; change_summary?: string } = { human_confirmed: true },
): Promise<ChallengeDraft> => {
  const payload = await ApiService.post<any>(`/company/challenges/${encodeURIComponent(challengeId)}/publish`, input);
  return unwrapChallenge(payload);
};

export const fetchCompanyChallengePreview = async (challengeId: string): Promise<Record<string, unknown>> => {
  const payload = await ApiService.get<any>(`/company/challenges/${encodeURIComponent(challengeId)}/preview`);
  return payload?.data || payload;
};
