import ApiService from './apiService';

export type MentorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type MentorChatReply = {
  reply: string;
  next_step?: string;
  tone?: 'direct' | 'quiet' | 'data_missing' | string;
  suggested_prompts?: string[];
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
  return response.data;
};
