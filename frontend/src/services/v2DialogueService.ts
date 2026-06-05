import type {
  ApplicationMessageAttachment,
  CandidateDialogueCapacity,
  CompanyApplicationRow,
  DialogueDetail,
  DialogueDossier,
  DialogueMessage,
  DialogueSummary,
} from '../types';
import ApiService from './apiService';
import { getSubscriptionStatus } from './serverSideBillingService';
import { supabase } from './supabaseClient';

const ACTIVE_STATUSES = new Set(['pending', 'reviewed', 'shortlisted']);

const unwrapData = <T>(payload: any): T => (payload?.data ?? payload) as T;

let cachedCompanyId: string | null | undefined;

export const clearDialogueCache = (): void => {
  cachedCompanyId = undefined;
};

const resolveCompanyId = async (): Promise<string | null> => {
  if (cachedCompanyId !== undefined) return cachedCompanyId;
  try {
    const response = await ApiService.get<any>('/company/me');
    const company = unwrapData<any>(response);
    cachedCompanyId = company?.id ? String(company.id) : null;
  } catch {
    cachedCompanyId = null;
  }
  return cachedCompanyId;
};

const normalizeStatus = (status: unknown): CompanyApplicationRow['status'] => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'company_reviewing' || value === 'submitted') return 'reviewed';
  if (value === 'mutual_handshake') return 'shortlisted';
  if (value === 'completed') return 'hired';
  if (value === 'initiated' || value === 'in_progress') return 'pending';
  if (value === 'rejected') return 'rejected';
  if (value === 'withdrawn') return 'withdrawn';
  if (value === 'closed') return 'closed';
  return 'pending';
};

const buildJobSnapshot = (item: any) => ({
  title: item?.job_title || item?.jobTitle || item?.title || item?.session?.job_snapshot?.title || item?.headline || null,
  company: item?.company_name || item?.companyName || item?.session?.job_snapshot?.company || null,
  location: item?.location || item?.session?.job_snapshot?.location || null,
  url: item?.url || null,
  source: item?.source || 'v2_native_handshake',
});

const mapHandshakeToSummary = (item: any): DialogueSummary => {
  const session = item?.session || {};
  const jobId = item?.job_id ?? item?.jobId ?? session?.job_id ?? '';
  const companyId = item?.company_id ?? item?.companyId ?? session?.company_id ?? null;
  const status = normalizeStatus(item?.status ?? session?.status);
  return {
    id: String(item?.handshake_id || item?.id || session?.id || session?.application_id || ''),
    job_id: jobId,
    company_id: companyId ? String(companyId) : undefined,
    status,
    submitted_at: item?.submitted_at || session?.finalized_at || item?.createdAt || item?.created_at || undefined,
    updated_at: item?.updated_at || item?.updatedAt || session?.updated_at || undefined,
    source: 'v2_native_handshake',
    has_cover_letter: false,
    has_cv: Boolean(session?.candidate_context?.cv || session?.candidate_context?.cv_summary),
    has_jcfpm: Boolean(session?.candidate_context?.jcfpm?.completed),
    jcfpm_share_level: session?.candidate_context?.jcfpm?.completed ? 'summary' : undefined,
    company_name: item?.company_name || item?.companyName || session?.job_snapshot?.company || null,
    job_snapshot: buildJobSnapshot(item),
  };
};

const mapCompanyHandshakeToRow = (item: any): CompanyApplicationRow => ({
  id: String(item?.handshake_id || item?.id || ''),
  job_id: item?.job_id || item?.jobId || '',
  candidate_id: String(item?.candidate_id || item?.candidateId || ''),
  status: normalizeStatus(item?.status),
  created_at: item?.created_at || item?.createdAt || undefined,
  submitted_at: item?.submitted_at || item?.submittedAt || undefined,
  updated_at: item?.updated_at || item?.updatedAt || undefined,
  job_title: item?.job_title || item?.jobTitle || undefined,
  candidate_name: item?.candidate_name || item?.candidateName || undefined,
  candidateHeadline: item?.headline || undefined,
  candidateLocation: item?.candidate_location || item?.candidateLocation || undefined,
  candidateBio: item?.candidate_bio || item?.candidateBio || undefined,
  candidateSkills: Array.isArray(item?.candidate_skills) ? item.candidate_skills : Array.isArray(item?.candidateSkills) ? item.candidateSkills : [],
  matchPercent: item?.matchPercent ?? item?.score ?? null,
  answerCount: Number(item?.answer_count ?? item?.answerCount ?? 0),
  hasCoverLetter: false,
  hasCv: item?.has_cv ?? item?.hasCv ?? true,
  hasJcfpm: item?.has_jcfpm ?? item?.hasJcfpm ?? false,
  jcfpmShareLevel: 'summary',
});

const mapHandshakeToDetail = (payload: any): DialogueDetail => {
  const session = payload?.session || payload?.data?.session || {};
  const summary = mapHandshakeToSummary({ ...payload, session });
  return {
    ...summary,
    cover_letter: session?.final_note || null,
    cv_document_id: null,
    candidate_profile_snapshot: {
      name: session?.candidate_context?.name || undefined,
      email: session?.candidate_context?.email || undefined,
      jobTitle: session?.candidate_context?.job_title || undefined,
      skills: Array.isArray(session?.candidate_context?.skills) ? session.candidate_context.skills : [],
      values: Array.isArray(session?.candidate_context?.values) ? session.candidate_context.values : [],
    },
    shared_jcfpm_payload: session?.candidate_context?.jcfpm || null,
    application_payload: session,
    assets: Array.isArray(session?.attachments) ? session.attachments : [],
  };
};

const mapReadoutToDossier = (payload: any): DialogueDossier | null => {
  const data = unwrapData<any>(payload);
  const readout = data?.readout || data;
  const session = data?.session || {};
  const profileSummary = readout?.profile_summary || {};
  const handshakeId = readout?.handshake_id || data?.handshake_id || session?.id;
  if (!handshakeId) return null;
  return {
    id: String(handshakeId),
    job_id: readout?.job_id || session?.job_id || '',
    company_id: readout?.company_id || session?.company_id || undefined,
    candidate_id: session?.candidate_id || undefined,
    source: 'v2_native_handshake',
    status: normalizeStatus(session?.status || readout?.status),
    submitted_at: session?.finalized_at || undefined,
    updated_at: session?.updated_at || undefined,
    cover_letter: session?.final_note || null,
    candidate_profile_snapshot: {
      name: profileSummary?.name || readout?.identity?.name || readout?.identity?.alias || undefined,
      jobTitle: profileSummary?.headline || readout?.headline || undefined,
      skills: Array.isArray(profileSummary?.skills) && profileSummary.skills.length ? profileSummary.skills : Array.isArray(readout?.strengths) ? readout.strengths : [],
      values: [],
    },
    shared_jcfpm_payload: readout?.jcfpm_summary || null,
    application_payload: { readout, session },
    job_title: readout?.headline || undefined,
    candidate_name: readout?.identity?.name || readout?.identity?.alias || undefined,
    assets: Array.isArray(session?.attachments) ? session.attachments : [],
    signal_boost: readout ? {
      output_id: String(handshakeId),
      recruiter_readout: readout as any,
    } : null,
  };
};

const mapMessage = (message: any): DialogueMessage => ({
  id: String(message?.id || globalThis.crypto?.randomUUID?.() || Date.now()),
  application_id: String(message?.application_id || message?.handshake_id || ''),
  company_id: message?.company_id || null,
  candidate_id: message?.candidate_id || null,
  sender_user_id: message?.sender_user_id || null,
  sender_role: message?.sender_role === 'candidate' ? 'candidate' : 'recruiter',
  body: String(message?.body || ''),
  attachments: Array.isArray(message?.attachments) ? message.attachments : [],
  created_at: message?.created_at || new Date().toISOString(),
  read_by_candidate_at: message?.read_by_candidate_at || null,
  read_by_company_at: message?.read_by_company_at || null,
});

export const fetchMyDialoguesWithCapacity = async (limit = 80): Promise<{
  dialogues: DialogueSummary[];
  candidateCapacity: CandidateDialogueCapacity | null;
}> => {
  const response = await ApiService.get<any>(`/handshake/my?limit=${Math.max(1, Math.min(200, Math.floor(limit || 80)))}`);
  const handshakes = unwrapData<any[]>(response);
  const dialogues = Array.isArray(handshakes) ? handshakes.map(mapHandshakeToSummary).filter((item) => item.id) : [];
  const active = dialogues.filter((item) => ACTIVE_STATUSES.has(String(item.status))).length;
  let slotLimit = 5;
  try {
    const session = await supabase?.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    if (userId) {
      const subscription = await getSubscriptionStatus(userId);
      slotLimit = subscription.dialogueSlotsAvailable || slotLimit;
    }
  } catch {
    slotLimit = 5;
  }
  return {
    dialogues,
    candidateCapacity: {
      active,
      limit: slotLimit,
      remaining: Math.max(0, slotLimit - active),
    },
  };
};

export const fetchCandidateApplicationDetail = async (dialogueId: string): Promise<DialogueDetail | null> => {
  if (!dialogueId) return null;
  const response = await ApiService.get<any>(`/handshake/${encodeURIComponent(dialogueId)}`);
  return mapHandshakeToDetail(response);
};

export const fetchCandidateApplicationMessages = async (dialogueId: string): Promise<DialogueMessage[]> => {
  if (!dialogueId) return [];
  const response = await ApiService.get<any>(`/handshake/${encodeURIComponent(dialogueId)}/messages`);
  const messages = unwrapData<any[]>(response);
  return Array.isArray(messages) ? messages.map(mapMessage) : [];
};

export const sendCandidateApplicationMessage = async (
  dialogueId: string,
  message: { body: string; attachments?: ApplicationMessageAttachment[] },
): Promise<DialogueMessage | null> => {
  if (!dialogueId) return null;
  const response = await ApiService.post<any>(`/handshake/${encodeURIComponent(dialogueId)}/messages`, {
    body: message.body,
    attachments: message.attachments || [],
  });
  return mapMessage(unwrapData<any>(response));
};

export const withdrawCandidateApplication = async (dialogueId: string): Promise<{ ok: boolean }> => {
  if (!dialogueId) return { ok: false };
  const response = await ApiService.post<any>(`/handshake/${encodeURIComponent(dialogueId)}/withdraw`, {});
  return { ok: Boolean(response) };
};

export const createJobApplication = async (
  jobId: string | number,
  _source?: string,
  _metadata?: Record<string, unknown>,
  _payload?: Record<string, unknown>,
): Promise<{ status?: string; application_id?: string; application?: Record<string, unknown> }> => {
  const response = await ApiService.post<any>(`/handshake/initiate/${encodeURIComponent(String(jobId))}`, {});
  const handshake = unwrapData<any>(response);
  const handshakeId = handshake?.handshake_id || handshake?.id || handshake?.session?.id;
  return {
    status: handshake?.status || handshake?.session?.status || 'in_progress',
    application_id: handshakeId,
    application: handshake,
  };
};

export const fetchCompanyDialogues = async (
  companyId: string,
  _jobId?: string,
  limit = 500,
): Promise<CompanyApplicationRow[]> => {
  if (!companyId) return [];
  const response = await ApiService.get<any>(`/company/${encodeURIComponent(companyId)}/handshakes?limit=${Math.max(1, Math.min(200, Math.floor(limit || 80)))}`);
  const handshakes = unwrapData<any[]>(response);
  const rows = Array.isArray(handshakes) ? handshakes.map(mapCompanyHandshakeToRow).filter((item) => item.id) : [];
  return _jobId ? rows.filter((row) => String(row.job_id) === String(_jobId)) : rows;
};

export const fetchCompanyDialogueDetail = async (dialogueId: string): Promise<DialogueDossier | null> => {
  const companyId = await resolveCompanyId();
  if (!companyId || !dialogueId) return null;
  const response = await ApiService.get<any>(`/company/${encodeURIComponent(companyId)}/handshakes/${encodeURIComponent(dialogueId)}/readout`);
  return mapReadoutToDossier(response);
};

export const fetchCompanyApplicationDetail = fetchCompanyDialogueDetail;

export const fetchCompanyApplicationMessages = async (applicationId: string): Promise<DialogueMessage[]> => {
  const companyId = await resolveCompanyId();
  if (!companyId || !applicationId) return [];
  const response = await ApiService.get<any>(`/company/${encodeURIComponent(companyId)}/handshakes/${encodeURIComponent(applicationId)}/messages`);
  const messages = unwrapData<any[]>(response);
  return Array.isArray(messages) ? messages.map(mapMessage) : [];
};

export const sendCompanyApplicationMessage = async (
  applicationId: string,
  message: { body: string; attachments?: ApplicationMessageAttachment[] },
): Promise<DialogueMessage | null> => {
  const companyId = await resolveCompanyId();
  if (!companyId || !applicationId) return null;
  const response = await ApiService.post<any>(`/company/${encodeURIComponent(companyId)}/handshakes/${encodeURIComponent(applicationId)}/messages`, {
    body: message.body,
    attachments: message.attachments || [],
  });
  return mapMessage(unwrapData<any>(response));
};

export const updateCompanyApplicationStatus = async (
  applicationId: string,
  status: string,
): Promise<{ ok: boolean }> => {
  const companyId = await resolveCompanyId();
  if (!companyId || !applicationId) return { ok: false };
  const action = status === 'rejected' ? 'reject' : status === 'closed' ? 'close' : 'invite';
  const response = await ApiService.post<any>(`/company/${encodeURIComponent(companyId)}/handshakes/${encodeURIComponent(applicationId)}/decision`, {
    action,
    note: null,
  });
  return { ok: Boolean(response) };
};
