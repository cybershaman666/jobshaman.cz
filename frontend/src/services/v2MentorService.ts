import ApiService from './apiService';
import type { HandshakeBlueprint, Role } from '../rebuild/models';

export type MentorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  jobRecommendations?: ShamiJobRecommendation[];
};

export type ShamiJobRecommendation = {
  id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  fit_score?: number;
  intent?: string;
  work_model?: string;
  salary?: string;
  reasons?: string[];
  caveats?: string[];
  why?: string;
  watch_out?: string;
};

export type MentorChatReply = {
  reply: string;
  next_step?: string;
  tone?: 'direct' | 'quiet' | 'data_missing' | string;
  suggested_prompts?: string[];
  job_recommendations?: ShamiJobRecommendation[];
  model?: string;
  latency_ms?: number;
};

export const sendMentorChatMessage = async (
  message: string,
  recentMessages: MentorChatMessage[] = [],
): Promise<MentorChatReply> => {
  const response = await ApiService.post<{ status: string; data: MentorChatReply }>('/mentor/chat', {
    message,
    recent_messages: recentMessages.slice(-8),
  });
  console.log('✅ Mentor Chat Response:', response);
  return response.data;
};

export type RecruiterAgentReply = {
  reply: string;
  navigation_suggestion?: string;
  navigation_label?: string;
  suggested_prompts?: string[];
  model?: string;
  latency_ms?: number;
};

export const sendRecruiterAgentMessage = async (
  message: string,
  recentMessages: MentorChatMessage[] = [],
): Promise<RecruiterAgentReply> => {
  const response = await ApiService.post<{ status: string; data: RecruiterAgentReply }>('/mentor/recruiter-chat', {
    message,
    recent_messages: recentMessages.slice(-8),
  });
  return response.data;
};

export type RoleInsightSignal = {
  label: string;
  text: string;
};

export type RoleInsightReply = {
  headline: string;
  summary: string;
  signals: RoleInsightSignal[];
  watch_out?: string;
  suggested_first_move?: string;
  model?: string;
  latency_ms?: number;
};

export const getRoleInsight = async (
  role: Role,
  blueprint: HandshakeBlueprint,
  locale: string,
): Promise<RoleInsightReply> => {
  const response = await ApiService.post<{ status: string; data: RoleInsightReply }>('/mentor/role-insight', {
    role: {
      id: role.id,
      title: role.title,
      companyName: role.companyName,
      location: role.location,
      workModel: role.workModel,
      salaryFrom: role.salaryFrom,
      salaryTo: role.salaryTo,
      currency: role.currency,
      contractType: role.contractType,
      summary: role.summary,
      roleSummary: role.roleSummary,
      challenge: role.challenge,
      mission: role.mission,
      description: role.description,
      firstStep: role.firstStep,
      skills: role.skills,
      benefits: role.benefits,
    },
    blueprint: {
      id: blueprint.id,
      overview: blueprint.overview,
      steps: blueprint.steps,
    },
    locale,
  });
  return response.data;
};
