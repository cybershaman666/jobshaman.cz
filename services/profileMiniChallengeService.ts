import { BACKEND_URL } from '../constants';
import type { CompanyApplicationRow, DialogueDossier, DialogueMessage, Job } from '../types';
import { mapJobs } from './jobService';
import { authenticatedFetch } from './csrfService';
import type { DialogueMessageCreatePayload } from './jobApplicationService';

export interface ProfileMiniChallengeCreateInput {
  title: string;
  problem: string;
  timeEstimate?: string;
  reward?: string;
  location?: string;
  first_reply_prompt?: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };
let publisherMiniChallengesApiUnavailable = false;
export const PROFILE_MINI_CHALLENGES_UPDATED_EVENT = 'jobshaman:profile-mini-challenges-updated';

const emitProfileMiniChallengesUpdated = (detail: {
  kind: 'created' | 'updated';
  job?: Job;
  jobId?: string;
  status?: 'active' | 'paused' | 'closed' | 'archived';
}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PROFILE_MINI_CHALLENGES_UPDATED_EVENT, { detail }));
};

const shouldDisablePublisherMiniChallengesApi = (status: number): boolean =>
  [404, 500, 501, 502, 503].includes(status);

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail);
    }
  } catch {
    // Ignore malformed JSON and fall through to plain text.
  }
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const normalizeDbJobId = (jobId: string | number): string | number => {
  if (typeof jobId === 'number') return jobId;
  const raw = String(jobId || '').trim();
  const normalized = raw.startsWith('db-') ? raw.slice(3) : raw;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : normalized;
};

const mapPublisherListJobs = async (rawJobs: any[]): Promise<Job[]> => {
  const jobs = mapJobs(rawJobs, undefined, undefined, true, true);
  return mergePublisherJobMeta(jobs, rawJobs);
};

const mapPublisherDialogueRow = (row: any): CompanyApplicationRow => ({
  id: String(row?.id || row?.dialogue_id || ''),
  job_id: row?.job_id ?? row?.role_id ?? '',
  candidate_id: String(row?.candidate_id || ''),
  status: row?.status || 'pending',
  created_at: row?.created_at ?? undefined,
  submitted_at: row?.submitted_at ?? undefined,
  updated_at: row?.updated_at ?? undefined,
  dialogue_deadline_at: row?.dialogue_deadline_at ?? null,
  dialogue_current_turn: row?.dialogue_current_turn ?? null,
  dialogue_timeout_hours: row?.dialogue_timeout_hours ?? undefined,
  dialogue_closed_reason: row?.dialogue_closed_reason ?? null,
  dialogue_closed_at: row?.dialogue_closed_at ?? null,
  dialogue_is_overdue: Boolean(row?.dialogue_is_overdue),
  job_title: row?.job_title ?? row?.role_title ?? undefined,
  candidate_name: row?.candidate_name ?? undefined,
  candidate_email: row?.candidate_email ?? undefined,
  candidate_avatar_url: row?.candidate_avatar_url ?? row?.candidateAvatarUrl ?? undefined,
  candidateAvatarUrl: row?.candidateAvatarUrl ?? row?.candidate_avatar_url ?? undefined,
  hasCoverLetter: Boolean(row?.has_cover_letter ?? row?.hasCoverLetter),
  hasCv: Boolean(row?.has_cv ?? row?.hasCv),
  jcfpmShareLevel: row?.jcfpm_share_level ?? row?.jcfpmShareLevel ?? 'do_not_share',
  hasJcfpm: Boolean(row?.has_jcfpm ?? row?.hasJcfpm),
  candidateHeadline: row?.candidate_headline ?? row?.candidateHeadline ?? undefined,
});

const mapPublisherDialogueDetail = (row: any): DialogueDossier => ({
  id: String(row?.id || row?.dialogue_id || ''),
  job_id: row?.job_id ?? row?.role_id ?? '',
  company_id: row?.company_id ?? undefined,
  candidate_id: row?.candidate_id ?? undefined,
  source: row?.source ?? undefined,
  status: row?.status || 'pending',
  submitted_at: row?.submitted_at ?? undefined,
  updated_at: row?.updated_at ?? undefined,
  dialogue_deadline_at: row?.dialogue_deadline_at ?? null,
  dialogue_current_turn: row?.dialogue_current_turn ?? null,
  dialogue_timeout_hours: row?.dialogue_timeout_hours ?? undefined,
  dialogue_closed_reason: row?.dialogue_closed_reason ?? null,
  dialogue_closed_at: row?.dialogue_closed_at ?? null,
  dialogue_is_overdue: Boolean(row?.dialogue_is_overdue),
  reviewed_at: row?.reviewed_at ?? undefined,
  reviewed_by: row?.reviewed_by ?? undefined,
  cover_letter: row?.cover_letter ?? null,
  cv_document_id: row?.cv_document_id ?? null,
  cv_snapshot: row?.cv_snapshot ?? null,
  candidate_profile_snapshot: row?.candidate_profile_snapshot ?? null,
  jcfpm_share_level: row?.jcfpm_share_level ?? 'do_not_share',
  shared_jcfpm_payload: row?.shared_jcfpm_payload ?? null,
  application_payload: row?.application_payload ?? null,
  job_title: row?.job_title ?? row?.role_title ?? undefined,
  candidate_name: row?.candidate_name ?? undefined,
  candidate_email: row?.candidate_email ?? undefined,
  candidate_avatar_url: row?.candidate_avatar_url ?? row?.candidateAvatarUrl ?? undefined,
  candidateAvatarUrl: row?.candidateAvatarUrl ?? row?.candidate_avatar_url ?? undefined,
  assets: Array.isArray(row?.assets) ? row.assets : [],
  audio_transcript_status: row?.audio_transcript_status ?? undefined,
  ai_summary_status: row?.ai_summary_status ?? undefined,
  fit_evidence_status: row?.fit_evidence_status ?? undefined,
  ai_summary: row?.ai_summary ?? null,
  fit_evidence: row?.fit_evidence ?? null,
});

const mapPublisherDialogueMessage = (row: any): DialogueMessage => ({
  id: String(row?.id || ''),
  application_id: String(row?.application_id || row?.dialogue_id || ''),
  company_id: row?.company_id ?? null,
  candidate_id: row?.candidate_id ?? null,
  sender_user_id: row?.sender_user_id ?? null,
  sender_role: row?.sender_role === 'candidate' ? 'candidate' : 'recruiter',
  body: String(row?.body || ''),
  attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  audio_transcript_status: row?.audio_transcript_status ?? undefined,
  created_at: String(row?.created_at || new Date().toISOString()),
  read_by_candidate_at: row?.read_by_candidate_at ?? null,
  read_by_company_at: row?.read_by_company_at ?? null,
});

const mergePublisherJobMeta = (jobs: Job[], rawJobs: any[]): Job[] => {
  const metaById = new Map(rawJobs.map((row) => [String(row?.id || ''), row]));
  return jobs.map((job) => {
    const raw = metaById.get(String(job.id));
    return {
      ...job,
      status: (raw?.status || job.status || 'active') as Job['status'],
      reply_count: Number(raw?.reply_count || job.reply_count || 0),
      open_dialogues_count: Number(raw?.open_dialogues_count || job.open_dialogues_count || 0),
      posted_by: raw?.posted_by ? String(raw.posted_by) : job.posted_by ?? null,
    };
  });
};

export const listProfileMiniChallenges = async (): Promise<Job[]> => {
  if (publisherMiniChallengesApiUnavailable) {
    return [];
  }

  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges`, {
      method: 'GET',
      headers: jsonHeaders,
    });
    if (!response.ok) {
      if (shouldDisablePublisherMiniChallengesApi(response.status)) {
        publisherMiniChallengesApiUnavailable = true;
        return [];
      }
      throw new Error(await parseError(response, 'Failed to load mini challenges.'));
    }
    const payload = await response.json() as { jobs?: any[] };
    const rawJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    return mapPublisherListJobs(rawJobs);
  } catch (error) {
    if (publisherMiniChallengesApiUnavailable) {
      return [];
    }
    throw error;
  }
};

export const createProfileMiniChallenge = async (input: ProfileMiniChallengeCreateInput): Promise<Job> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to publish mini challenge.'));
  }
  const payload = await response.json() as { job?: any };
  const rawJob = payload?.job;
  if (!rawJob?.id) {
    throw new Error('Published mini challenge is missing an id.');
  }
  const createdJob = (await mapPublisherListJobs([rawJob]))[0];
  if (createdJob) {
    emitProfileMiniChallengesUpdated({ kind: 'created', job: createdJob });
  }
  return createdJob;
};

export const updateProfileMiniChallengeLifecycle = async (
  jobId: string | number,
  status: 'active' | 'paused' | 'closed' | 'archived',
): Promise<void> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const normalizedJobId = normalizeDbJobId(jobId);
  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges/${normalizedJobId}/lifecycle`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to update mini challenge status.'));
  }
  emitProfileMiniChallengesUpdated({ kind: 'updated', jobId: String(normalizedJobId), status });
};

export const fetchProfileMiniChallengeDialogues = async (jobId: string | number): Promise<CompanyApplicationRow[]> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const normalizedJobId = normalizeDbJobId(jobId);
  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges/${normalizedJobId}/dialogues`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to load replies.'));
  }
  const payload = await response.json() as { dialogues?: any[] };
  return Array.isArray(payload?.dialogues) ? payload.dialogues.map(mapPublisherDialogueRow) : [];
};

export const fetchProfileMiniChallengeDialogueDetail = async (dialogueId: string): Promise<DialogueDossier | null> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to load reply detail.'));
  }
  const payload = await response.json() as { dialogue?: any };
  return payload?.dialogue ? mapPublisherDialogueDetail(payload.dialogue) : null;
};

export const fetchProfileMiniChallengeDialogueMessages = async (dialogueId: string): Promise<DialogueMessage[]> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}/messages`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to load reply messages.'));
  }
  const payload = await response.json() as { messages?: any[] };
  return Array.isArray(payload?.messages) ? payload.messages.map(mapPublisherDialogueMessage) : [];
};

export const sendProfileMiniChallengeDialogueMessage = async (
  dialogueId: string,
  payload: DialogueMessageCreatePayload,
): Promise<DialogueMessage | null> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}/messages`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      body: payload.body || null,
      attachments: payload.attachments || [],
    }),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to send reply message.'));
  }
  const data = await response.json() as { message?: any };
  return data?.message ? mapPublisherDialogueMessage(data.message) : null;
};

export const updateProfileMiniChallengeDialogueStatus = async (
  dialogueId: string,
  status: CompanyApplicationRow['status'],
): Promise<void> => {
  if (publisherMiniChallengesApiUnavailable) {
    throw new Error('Publisher mini challenge API is unavailable.');
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}/status`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      throw new Error('Publisher mini challenge API is unavailable.');
    }
    throw new Error(await parseError(response, 'Failed to update reply status.'));
  }
};
