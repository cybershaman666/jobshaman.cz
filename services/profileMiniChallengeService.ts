import { BACKEND_URL } from '../constants';
import type { CompanyApplicationRow, DialogueDossier, DialogueMessage, Job } from '../types';
import { fetchJobsByIds } from './jobService';
import { authenticatedFetch } from './csrfService';
import type { DialogueMessageCreatePayload } from './jobApplicationService';
import { supabase } from './supabaseService';

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

const nowIso = (): string => new Date().toISOString();

const trimText = (value: unknown, maxLength: number): string => String(value ?? '').trim().slice(0, maxLength);

const normalizeSupportedCountryCode = (value: unknown): string => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['cz', 'cs', 'sk', 'pl', 'de', 'at'].includes(normalized) ? normalized : 'cz';
};

const parseRewardBudget = (reward?: string): { salary_from: number | null; salary_to: number | null } => {
  const source = String(reward || '').trim();
  if (!source) return { salary_from: null, salary_to: null };
  const numbers = Array.from(source.matchAll(/\d[\d\s.,]*/g))
    .map((match) => Number(String(match[0] || '').replace(/[^\d]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 2);
  if (numbers.length === 0) return { salary_from: null, salary_to: null };
  if (numbers.length === 1) return { salary_from: numbers[0], salary_to: numbers[0] };
  const ordered = numbers.sort((left, right) => left - right);
  return { salary_from: ordered[0], salary_to: ordered[ordered.length - 1] };
};

const deriveFirstReplyPrompt = (title: string, problem: string): string => {
  const normalizedTitle = trimText(title, 180) || 'this mini challenge';
  const normalizedProblem = trimText(problem, 600);
  if (/[ěščřžýáíéúůťďňľĺôä]/i.test(normalizedProblem) || /\b(jak|proč|kde|co|výzv|probl[eé]m)\b/i.test(normalizedProblem)) {
    return `Jak bys tuhle mini výzvu uchopil(a) jako první, jaké vidíš největší riziko a jak bys ověřil(a), že řešení funguje i v praxi?`;
  }
  return `How would you approach "${normalizedTitle}" first, what is the biggest risk you see, and how would you validate the work in reality?`;
};

const buildProfileMiniChallengeDescription = (input: {
  problem: string;
  reward?: string;
  timeEstimate?: string;
  firstReplyPrompt: string;
  microJobKind?: string;
  collaborationModes?: string[];
  longTermPotential?: string;
}): string => {
  const markers = [
    '<!-- jobshaman:hiring_stage=collecting_cvs -->',
    '<!-- jobshaman:challenge_format=micro_job -->',
  ];
  const microJobKind = trimText(input.microJobKind || 'one_off_task', 80);
  const timeEstimate = trimText(input.timeEstimate, 120);
  const collaborationModes = Array.isArray(input.collaborationModes)
    ? Array.from(new Set(input.collaborationModes.map((mode) => trimText(mode, 40).toLowerCase()).filter(Boolean)))
    : ['async'];
  const longTermPotential = trimText(input.longTermPotential || 'maybe', 40);

  if (microJobKind) markers.push(`<!-- jobshaman:micro_job_kind=${microJobKind} -->`);
  if (timeEstimate) markers.push(`<!-- jobshaman:micro_time_estimate=${timeEstimate} -->`);
  if (collaborationModes.length > 0) markers.push(`<!-- jobshaman:micro_collaboration=${collaborationModes.join(',')} -->`);
  if (longTermPotential) markers.push(`<!-- jobshaman:micro_long_term=${longTermPotential} -->`);

  const sections = [
    markers.join('\n'),
    `## Challenge\n${trimText(input.problem, 4000)}`,
    `## First Reply\n${trimText(input.firstReplyPrompt, 2000)}`,
  ];

  const reward = trimText(input.reward, 240);
  if (reward) {
    sections.push(`### Reward\n${reward}`);
  }

  return sections.filter(Boolean).join('\n\n').trim();
};

const getCurrentPublisherIdentity = async (): Promise<{
  userId: string;
  companyLabel: string;
  contactEmail: string | null;
  countryCode: string;
}> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || 'Failed to read current session.');
  }
  const session = sessionData?.session;
  const user = session?.user;
  const userId = String(user?.id || '').trim();
  if (!userId) {
    throw new Error('User not authenticated.');
  }

  let fullName = '';
  let contactEmail = trimText(user?.email, 180) || null;
  let countryCode = 'cz';
  try {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id,full_name,email,preferences,preferred_country_code')
      .eq('id', userId)
      .maybeSingle();

    fullName = trimText(profileRow?.full_name ?? user?.user_metadata?.full_name, 180);
    contactEmail = trimText(profileRow?.email || contactEmail, 180) || null;
    countryCode = normalizeSupportedCountryCode(
      profileRow?.preferred_country_code
        ?? profileRow?.preferences?.preferredCountryCode
        ?? user?.user_metadata?.preferred_country_code
    );
  } catch {
    fullName = trimText(user?.user_metadata?.full_name, 180);
  }

  const emailLabel = contactEmail ? contactEmail.split('@')[0] : '';
  return {
    userId,
    companyLabel: fullName || emailLabel || 'JobShaman Member',
    contactEmail,
    countryCode,
  };
};

const fetchLinkedJobs = async (jobIds: Array<string | number>): Promise<Map<string, { title?: string | null }>> => {
  const unique = Array.from(new Set(jobIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!supabase || unique.length === 0) return new Map();
  const { data, error } = await supabase.from('jobs').select('id,title').in('id', unique);
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((row: any) => [String(row.id), { title: row.title }]));
};

const fetchLinkedProfiles = async (
  profileIds: string[],
): Promise<Map<string, { full_name?: string | null; email?: string | null; avatar_url?: string | null }>> => {
  const unique = Array.from(new Set(profileIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!supabase || unique.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id,full_name,email,avatar_url').in('id', unique);
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((row: any) => [String(row.id), { full_name: row.full_name, email: row.email, avatar_url: row.avatar_url }]));
};

const isRawMicroJob = (row: any): boolean => String(row?.description || '').includes('jobshaman:challenge_format=micro_job');

const mapPublisherListJobs = async (rawJobs: any[]): Promise<Job[]> => {
  const ids = rawJobs.map((row) => String(row?.id || '')).filter(Boolean);
  const jobs = await fetchJobsByIds(ids);
  return mergePublisherJobMeta(jobs, rawJobs);
};

const loadPublisherDialogueAccessRow = async (dialogueId: string): Promise<any> => {
  if (!supabase || !dialogueId) {
    throw new Error('Dialogue not found.');
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('id', dialogueId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Dialogue not found.');
  }

  const identity = await getCurrentPublisherIdentity();
  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id,posted_by,recruiter_id')
    .eq('id', data.job_id)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error('Linked mini challenge not found.');
  }

  const postedBy = String(jobRow?.posted_by || '').trim();
  const recruiterId = String(jobRow?.recruiter_id || '').trim();
  if (identity.userId !== postedBy && identity.userId !== recruiterId) {
    throw new Error('Unauthorized');
  }

  return data;
};

const listProfileMiniChallengesFallback = async (): Promise<Job[]> => {
  const identity = await getCurrentPublisherIdentity();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('posted_by', identity.userId)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(error.message || 'Failed to load mini challenges.');
  }

  const rawJobs = (Array.isArray(data) ? data : []).filter(isRawMicroJob);
  const jobIds = rawJobs.map((row: any) => row.id).filter((value: unknown) => value !== null && value !== undefined);
  const statsByJobId = new Map<string, { reply_count: number; open_dialogues_count: number }>();

  if (jobIds.length > 0) {
    const { data: applicationRows } = await supabase
      .from('job_applications')
      .select('job_id,status')
      .in('job_id', jobIds)
      .limit(Math.max(200, jobIds.length * 40));

    if (Array.isArray(applicationRows)) {
      applicationRows.forEach((row: any) => {
        const key = String(row?.job_id || '').trim();
        if (!key) return;
        const current = statsByJobId.get(key) || { reply_count: 0, open_dialogues_count: 0 };
        current.reply_count += 1;
        const status = String(row?.status || '').trim().toLowerCase();
        if (!['rejected', 'withdrawn', 'closed', 'expired', 'cancelled'].includes(status)) {
          current.open_dialogues_count += 1;
        }
        statsByJobId.set(key, current);
      });
    }
  }

  const enrichedRawJobs = rawJobs.map((row: any) => ({
    ...row,
    reply_count: statsByJobId.get(String(row.id))?.reply_count || 0,
    open_dialogues_count: statsByJobId.get(String(row.id))?.open_dialogues_count || 0,
  }));

  return mapPublisherListJobs(enrichedRawJobs);
};

const createProfileMiniChallengeFallback = async (input: ProfileMiniChallengeCreateInput): Promise<Job> => {
  const identity = await getCurrentPublisherIdentity();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const title = trimText(input.title, 180);
  const problem = trimText(input.problem, 4000);
  if (!title || !problem) {
    throw new Error('Title and problem are required.');
  }

  const reward = trimText(input.reward, 240) || undefined;
  const description = buildProfileMiniChallengeDescription({
    problem,
    reward,
    timeEstimate: trimText(input.timeEstimate, 120) || undefined,
    firstReplyPrompt: trimText(input.first_reply_prompt, 2000) || deriveFirstReplyPrompt(title, problem),
    microJobKind: 'one_off_task',
    collaborationModes: ['async'],
    longTermPotential: 'maybe',
  });
  const location = trimText(input.location, 160) || 'Remote';
  const workType = location.toLowerCase().includes('remote') ? 'Remote' : 'Hybrid';
  const budget = parseRewardBudget(reward);
  const payload = {
    title,
    company: identity.companyLabel,
    location,
    description,
    salary_from: budget.salary_from,
    salary_to: budget.salary_to,
    salary_currency: 'CZK',
    salary_timeframe: 'project_total',
    work_type: workType,
    work_model: workType.toLowerCase(),
    source: 'jobshaman.cz',
    scraped_at: nowIso(),
    posted_by: identity.userId,
    recruiter_id: identity.userId,
    contact_email: identity.contactEmail,
    country_code: identity.countryCode,
    status: 'active',
    is_active: true,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to publish mini challenge.');
  }

  const jobs = await mapPublisherListJobs([{ ...data, reply_count: 0, open_dialogues_count: 0 }]);
  const job = jobs[0];
  if (!job) {
    throw new Error('Published mini challenge could not be hydrated.');
  }
  return job;
};

const updateProfileMiniChallengeLifecycleFallback = async (
  jobId: string | number,
  status: 'active' | 'paused' | 'closed' | 'archived',
): Promise<void> => {
  const identity = await getCurrentPublisherIdentity();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedJobId = normalizeDbJobId(jobId);
  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id,posted_by,recruiter_id')
    .eq('id', normalizedJobId)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error('Mini challenge not found.');
  }

  const postedBy = String(jobRow?.posted_by || '').trim();
  const recruiterId = String(jobRow?.recruiter_id || '').trim();
  if (identity.userId !== postedBy && identity.userId !== recruiterId) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('jobs')
    .update({ status, is_active: status === 'active', updated_at: nowIso() })
    .eq('id', normalizedJobId);

  if (error) {
    throw new Error(error.message || 'Failed to update mini challenge status.');
  }
};

const fetchProfileMiniChallengeDialoguesFallback = async (jobId: string | number): Promise<CompanyApplicationRow[]> => {
  const identity = await getCurrentPublisherIdentity();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedJobId = normalizeDbJobId(jobId);
  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id,posted_by,recruiter_id,title')
    .eq('id', normalizedJobId)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error('Mini challenge not found.');
  }

  const postedBy = String(jobRow?.posted_by || '').trim();
  const recruiterId = String(jobRow?.recruiter_id || '').trim();
  if (identity.userId !== postedBy && identity.userId !== recruiterId) {
    throw new Error('Unauthorized');
  }

  let query = supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', normalizedJobId)
    .limit(200);

  let data: any[] | null = null;
  const submittedResult = await query.order('submitted_at', { ascending: false });
  if (!submittedResult.error && Array.isArray(submittedResult.data)) {
    data = submittedResult.data;
  } else {
    const fallbackResult = await query.order('applied_at', { ascending: false });
    if (fallbackResult.error) {
      throw new Error(fallbackResult.error.message || 'Failed to load replies.');
    }
    data = Array.isArray(fallbackResult.data) ? fallbackResult.data : [];
  }

  const profileMap = await fetchLinkedProfiles((data || []).map((row: any) => String(row?.candidate_id || '')).filter(Boolean));
  return (data || []).map((row: any) => mapPublisherDialogueRow({
    ...row,
    job_title: row?.job_title ?? jobRow?.title ?? null,
    candidate_name:
      row?.candidate_name ??
      profileMap.get(String(row?.candidate_id || ''))?.full_name ??
      profileMap.get(String(row?.candidate_id || ''))?.email ??
      row?.candidate_profile_snapshot?.name ??
      'Candidate',
    candidate_email:
      row?.candidate_email ??
      profileMap.get(String(row?.candidate_id || ''))?.email ??
      row?.candidate_profile_snapshot?.email ??
      null,
    candidate_avatar_url:
      row?.candidate_avatar_url ??
      row?.candidate_profile_snapshot?.avatar_url ??
      profileMap.get(String(row?.candidate_id || ''))?.avatar_url ??
      null,
    has_cover_letter: Boolean(row?.cover_letter),
    has_cv: Boolean(row?.cv_document_id || row?.cv_snapshot?.fileUrl || row?.cv_snapshot?.originalName),
    has_jcfpm: Boolean(row?.shared_jcfpm_payload),
    candidate_headline: row?.candidate_headline ?? row?.candidate_profile_snapshot?.jobTitle ?? null,
  }));
};

const fetchProfileMiniChallengeDialogueDetailFallback = async (dialogueId: string): Promise<DialogueDossier | null> => {
  const row = await loadPublisherDialogueAccessRow(dialogueId);
  const [jobMap, profileMap] = await Promise.all([
    fetchLinkedJobs(row?.job_id ? [row.job_id] : []),
    fetchLinkedProfiles(row?.candidate_id ? [String(row.candidate_id)] : []),
  ]);

  return mapPublisherDialogueDetail({
    ...row,
    job_title: jobMap.get(String(row?.job_id || ''))?.title ?? null,
    candidate_name:
      profileMap.get(String(row?.candidate_id || ''))?.full_name ??
      profileMap.get(String(row?.candidate_id || ''))?.email ??
      row?.candidate_profile_snapshot?.name ??
      'Candidate',
    candidate_email:
      profileMap.get(String(row?.candidate_id || ''))?.email ??
      row?.candidate_profile_snapshot?.email ??
      null,
    candidate_avatar_url:
      row?.candidate_avatar_url ??
      row?.candidate_profile_snapshot?.avatar_url ??
      profileMap.get(String(row?.candidate_id || ''))?.avatar_url ??
      null,
    has_cover_letter: Boolean(row?.cover_letter),
    has_cv: Boolean(row?.cv_document_id || row?.cv_snapshot?.fileUrl || row?.cv_snapshot?.originalName),
    has_jcfpm: Boolean(row?.shared_jcfpm_payload),
    candidate_headline: row?.candidate_headline ?? row?.candidate_profile_snapshot?.jobTitle ?? null,
  });
};

const fetchProfileMiniChallengeDialogueMessagesFallback = async (dialogueId: string): Promise<DialogueMessage[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  await loadPublisherDialogueAccessRow(dialogueId);

  const { data, error } = await supabase
    .from('application_messages')
    .select('*')
    .eq('application_id', dialogueId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load reply messages.');
  }

  const rows = Array.isArray(data) ? data : [];
  const unreadIds = rows
    .filter((row: any) => row?.sender_role === 'candidate' && !row?.read_by_company_at)
    .map((row: any) => row?.id)
    .filter(Boolean);

  if (unreadIds.length > 0) {
    await supabase
      .from('application_messages')
      .update({ read_by_company_at: nowIso() })
      .in('id', unreadIds);
  }

  return rows.map(mapPublisherDialogueMessage);
};

const sendProfileMiniChallengeDialogueMessageFallback = async (
  dialogueId: string,
  payload: DialogueMessageCreatePayload,
): Promise<DialogueMessage | null> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const identity = await getCurrentPublisherIdentity();
  const dialogue = await loadPublisherDialogueAccessRow(dialogueId);
  const body = trimText(payload.body, 8000);
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!body && attachments.length === 0) {
    throw new Error('Message body or attachment is required.');
  }

  const createdAt = nowIso();
  const { data, error } = await supabase
    .from('application_messages')
    .insert({
      application_id: dialogueId,
      company_id: dialogue?.company_id ?? null,
      candidate_id: dialogue?.candidate_id ?? null,
      sender_user_id: identity.userId,
      sender_role: 'recruiter',
      body,
      attachments,
      created_at: createdAt,
      read_by_company_at: createdAt,
      read_by_candidate_at: null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to send reply message.');
  }

  await supabase
    .from('job_applications')
    .update({ updated_at: createdAt })
    .eq('id', dialogueId);

  return mapPublisherDialogueMessage(data);
};

const updateProfileMiniChallengeDialogueStatusFallback = async (
  dialogueId: string,
  status: CompanyApplicationRow['status'],
): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  await loadPublisherDialogueAccessRow(dialogueId);
  const updatePayload: Record<string, any> = {
    status,
    updated_at: nowIso(),
  };
  if (['reviewed', 'shortlisted', 'rejected', 'hired'].includes(String(status || '').toLowerCase())) {
    updatePayload.reviewed_at = nowIso();
  }

  const { error } = await supabase
    .from('job_applications')
    .update(updatePayload)
    .eq('id', dialogueId);

  if (error) {
    throw new Error(error.message || 'Failed to update reply status.');
  }
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
    return listProfileMiniChallengesFallback();
  }

  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges`, {
      method: 'GET',
      headers: jsonHeaders,
    });
    if (!response.ok) {
      if (shouldDisablePublisherMiniChallengesApi(response.status)) {
        publisherMiniChallengesApiUnavailable = true;
        return listProfileMiniChallengesFallback();
      }
      throw new Error(await parseError(response, 'Failed to load mini challenges.'));
    }
    const payload = await response.json() as { jobs?: any[] };
    const rawJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    return mapPublisherListJobs(rawJobs);
  } catch (error) {
    if (publisherMiniChallengesApiUnavailable || !String((error as Error)?.message || '').trim()) {
      return listProfileMiniChallengesFallback();
    }
    throw error;
  }
};

export const createProfileMiniChallenge = async (input: ProfileMiniChallengeCreateInput): Promise<Job> => {
  if (publisherMiniChallengesApiUnavailable) {
    return createProfileMiniChallengeFallback(input);
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      return createProfileMiniChallengeFallback(input);
    }
    throw new Error(await parseError(response, 'Failed to publish mini challenge.'));
  }
  const payload = await response.json() as { job?: any };
  const rawJob = payload?.job;
  if (!rawJob?.id) {
    throw new Error('Published mini challenge is missing an id.');
  }
  return (await mapPublisherListJobs([rawJob]))[0];
};

export const updateProfileMiniChallengeLifecycle = async (
  jobId: string | number,
  status: 'active' | 'paused' | 'closed' | 'archived',
): Promise<void> => {
  if (publisherMiniChallengesApiUnavailable) {
    return updateProfileMiniChallengeLifecycleFallback(jobId, status);
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
      return updateProfileMiniChallengeLifecycleFallback(jobId, status);
    }
    throw new Error(await parseError(response, 'Failed to update mini challenge status.'));
  }
};

export const fetchProfileMiniChallengeDialogues = async (jobId: string | number): Promise<CompanyApplicationRow[]> => {
  if (publisherMiniChallengesApiUnavailable) {
    return fetchProfileMiniChallengeDialoguesFallback(jobId);
  }

  const normalizedJobId = normalizeDbJobId(jobId);
  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/mini-challenges/${normalizedJobId}/dialogues`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      return fetchProfileMiniChallengeDialoguesFallback(jobId);
    }
    throw new Error(await parseError(response, 'Failed to load replies.'));
  }
  const payload = await response.json() as { dialogues?: any[] };
  return Array.isArray(payload?.dialogues) ? payload.dialogues.map(mapPublisherDialogueRow) : [];
};

export const fetchProfileMiniChallengeDialogueDetail = async (dialogueId: string): Promise<DialogueDossier | null> => {
  if (publisherMiniChallengesApiUnavailable) {
    return fetchProfileMiniChallengeDialogueDetailFallback(dialogueId);
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      return fetchProfileMiniChallengeDialogueDetailFallback(dialogueId);
    }
    throw new Error(await parseError(response, 'Failed to load reply detail.'));
  }
  const payload = await response.json() as { dialogue?: any };
  return payload?.dialogue ? mapPublisherDialogueDetail(payload.dialogue) : null;
};

export const fetchProfileMiniChallengeDialogueMessages = async (dialogueId: string): Promise<DialogueMessage[]> => {
  if (publisherMiniChallengesApiUnavailable) {
    return fetchProfileMiniChallengeDialogueMessagesFallback(dialogueId);
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}/messages`, {
    method: 'GET',
    headers: jsonHeaders,
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      return fetchProfileMiniChallengeDialogueMessagesFallback(dialogueId);
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
    return sendProfileMiniChallengeDialogueMessageFallback(dialogueId, payload);
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
      return sendProfileMiniChallengeDialogueMessageFallback(dialogueId, payload);
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
    return updateProfileMiniChallengeDialogueStatusFallback(dialogueId, status);
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/publisher/dialogues/${dialogueId}/status`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    if (shouldDisablePublisherMiniChallengesApi(response.status)) {
      publisherMiniChallengesApiUnavailable = true;
      return updateProfileMiniChallengeDialogueStatusFallback(dialogueId, status);
    }
    throw new Error(await parseError(response, 'Failed to update reply status.'));
  }
};
