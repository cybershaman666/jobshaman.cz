import type {
  ApplicationMessageAttachment,
  CompanyApplicationRow,
  DialogueDetail,
  DialogueDossier,
  DialogueMessage,
  DialogueSummary,
} from '../types';
import ApiService from './apiService';

export const fetchMyDialoguesWithCapacity = async (_limit = 80): Promise<{
  dialogues: DialogueSummary[];
  candidateCapacity: any;
}> => ({
  dialogues: [],
  candidateCapacity: null,
});

export const fetchCandidateApplicationDetail = async (_dialogueId: string): Promise<DialogueDetail | null> => null;

export const fetchCandidateApplicationMessages = async (_dialogueId: string): Promise<DialogueMessage[]> => [];

export const sendCandidateApplicationMessage = async (
  _dialogueId: string,
  _message: { body: string; attachments?: ApplicationMessageAttachment[] },
): Promise<DialogueMessage | null> => null;

export const withdrawCandidateApplication = async (_dialogueId: string): Promise<{ ok: boolean }> => ({ ok: false });

export const createJobApplication = async (
  jobId: string | number,
  _source?: string,
  _metadata?: Record<string, unknown>,
  _payload?: Record<string, unknown>,
): Promise<{ status?: string; application_id?: string; application?: Record<string, unknown> }> => {
  const response = await ApiService.post<any>(`/handshake/initiate/${encodeURIComponent(String(jobId))}`, {});
  const handshakeId = response?.data?.handshake_id || response?.handshake_id;
  return {
    status: response?.status || 'in_progress',
    application_id: handshakeId,
    application: response?.data || response,
  };
};

export const fetchCompanyDialogues = async (
  _companyId: string,
  _jobId?: string,
  _limit = 500,
): Promise<CompanyApplicationRow[]> => [];

export const fetchCompanyDialogueDetail = async (_dialogueId: string): Promise<DialogueDossier | null> => null;

export const fetchCompanyApplicationDetail = async (_applicationId: string): Promise<DialogueDetail | null> => null;

export const fetchCompanyApplicationMessages = async (_applicationId: string): Promise<DialogueMessage[]> => [];

export const sendCompanyApplicationMessage = async (
  _applicationId: string,
  _message: { body: string; attachments?: ApplicationMessageAttachment[] },
): Promise<DialogueMessage | null> => null;

export const updateCompanyApplicationStatus = async (
  _applicationId: string,
  _status: string,
): Promise<{ ok: boolean }> => ({ ok: false });
