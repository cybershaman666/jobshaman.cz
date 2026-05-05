import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { fetchJobTitlesByIds } from './jobCatalogService';
import { supabase } from './supabaseService';
import {
    DialogueDossier,
    ApplicationJcfpmShareLevel,
    DialogueMessage,
    DialogueDetail,
    CandidateDialogueCapacity,
    DialogueSummary,
    CompanyApplicationRow,
    ApplicationDraftSuggestion,
    ApplicationDraftTone,
    CompanyDialogueSolutionSnapshotState,
    SolutionSnapshot,
    SolutionSnapshotUpsertPayload,
} from '../types';
let companyDialoguesApiUnavailable = false;

const shouldDisableCompanyDialoguesApi = (status: number): boolean =>
    [404, 409, 500, 501, 502, 503].includes(status);

export interface MutationResult {
    ok: boolean;
    via: 'api' | 'fallback' | 'failed';
}

export interface DialogueMessageCreatePayload {
    body?: string | null;
    attachments?: Array<{
        name: string;
        url: string;
        path?: string | null;
        size?: number | null;
        content_type?: string | null;
    }>;
}

export type ApplicationMessageCreatePayload = DialogueMessageCreatePayload;

const normalizeDialogueJobId = (jobId: string | number): number => {
    if (typeof jobId === 'number') return jobId;
    const raw = String(jobId || '').trim();
    const normalized = raw.startsWith('db-') ? raw.slice(3) : raw;
    return Number(normalized);
};

export interface OpenDialogueDetails {
    coverLetter?: string | null;
    cvDocumentId?: string | null;
    cvSnapshot?: {
        id?: string | null;
        label?: string | null;
        originalName?: string | null;
        fileUrl?: string | null;
    } | null;
    candidateProfileSnapshot?: {
        name?: string;
        email?: string;
        phone?: string;
        jobTitle?: string;
        avatar_url?: string;
        linkedin?: string;
        skills?: string[];
        values?: string[];
        preferredCountryCode?: string;
    } | null;
    jcfpmShareLevel?: ApplicationJcfpmShareLevel;
    sharedJcfpmPayload?: Record<string, any> | null;
}

export type CreateJobApplicationDetails = OpenDialogueDetails;

export interface OpenDialogueResult {
    status: string;
    dialogue_id?: string;
    dialogue?: DialogueDossier;
    candidate_capacity?: CandidateDialogueCapacity;
}

export type CreateJobApplicationResult = {
    status: string;
    application_id?: string;
    application?: DialogueDossier;
    candidate_capacity?: CandidateDialogueCapacity;
};

export interface GenerateApplicationDraftPayload {
    cvDocumentId?: string | null;
    tone?: ApplicationDraftTone;
    language?: string;
    regenerate?: boolean;
}

const parseErrorDetail = async (response: Response, fallback: string): Promise<string> => {
    try {
        const payload = await response.json();
        if (payload?.detail) return String(payload.detail);
    } catch {
        // ignore malformed error payloads
    }
    return fallback;
};

const normalizeDialogueLikeRow = (row: any): any => {
    if (!row || typeof row !== 'object') return row;
    return {
        ...row,
        id: row?.id ?? row?.dialogue_id ?? '',
        job_id: row?.job_id ?? row?.role_id ?? row?.jobId ?? row?.roleId ?? undefined,
        job_title: row?.job_title ?? row?.role_title ?? row?.jobTitle ?? row?.roleTitle ?? undefined,
    };
};

const extractDialogueLikePayload = (payload: any): any =>
    normalizeDialogueLikeRow(payload?.application ?? payload?.dialogue ?? null);

const extractDialogueLikeList = (payload: any): any[] => {
    const rows = Array.isArray(payload?.applications)
        ? payload.applications
        : Array.isArray(payload?.dialogues)
            ? payload.dialogues
            : [];
    return rows.map(normalizeDialogueLikeRow);
};

const extractCandidateDialogueCapacity = (payload: any): CandidateDialogueCapacity | undefined => {
    const row = payload?.candidate_capacity;
    if (!row || typeof row !== 'object') return undefined;
    const active = Number(row?.active ?? 0);
    const limit = Number(row?.limit ?? 0);
    const remaining = Number(row?.remaining ?? Math.max(0, limit - active));
    return {
        active: Number.isFinite(active) ? active : 0,
        limit: Number.isFinite(limit) ? limit : 0,
        remaining: Number.isFinite(remaining) ? remaining : 0,
    };
};

const mapDialogueLifecycleFields = (row: any) => ({
    dialogue_deadline_at: row?.dialogue_deadline_at ?? row?.dialogueDeadlineAt ?? null,
    dialogue_current_turn: row?.dialogue_current_turn ?? row?.dialogueCurrentTurn ?? null,
    dialogue_timeout_hours: row?.dialogue_timeout_hours ?? row?.dialogueTimeoutHours ?? undefined,
    dialogue_closed_reason: row?.dialogue_closed_reason ?? row?.dialogueClosedReason ?? null,
    dialogue_closed_at: row?.dialogue_closed_at ?? row?.dialogueClosedAt ?? null,
    dialogue_is_overdue: Boolean(row?.dialogue_is_overdue ?? row?.dialogueIsOverdue ?? false),
});

const mapDialogueSummary = (row: any): DialogueSummary => ({
    id: String(row?.id || ''),
    job_id: row?.job_id,
    company_id: row?.company_id ?? undefined,
    status: row?.status ?? 'pending',
    submitted_at: row?.submitted_at ?? row?.created_at ?? row?.applied_at,
    updated_at: row?.updated_at ?? row?.submitted_at ?? row?.created_at ?? row?.applied_at,
    ...mapDialogueLifecycleFields(row),
    source: row?.source ?? undefined,
    has_cover_letter: Boolean(row?.has_cover_letter ?? row?.cover_letter),
    has_cv: Boolean(row?.has_cv ?? row?.cv_snapshot?.fileUrl ?? row?.cv_snapshot?.originalName ?? row?.cv_document_id),
    has_jcfpm: Boolean(row?.has_jcfpm ?? row?.shared_jcfpm_payload),
    jcfpm_share_level: row?.jcfpm_share_level ?? row?.jcfpmShareLevel ?? 'do_not_share',
    company_name: row?.company_name ?? undefined,
    company_website: row?.company_website ?? undefined,
    job_snapshot: row?.job_snapshot ?? undefined,
});

const mapStringArray = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean)
        : []
);

const mapSolutionSnapshot = (row: any): SolutionSnapshot => ({
    id: String(row?.id || ''),
    dialogue_id: String(row?.dialogue_id || row?.application_id || ''),
    job_id: row?.job_id,
    company_id: String(row?.company_id || ''),
    candidate_id: String(row?.candidate_id || ''),
    problem: String(row?.problem || ''),
    solution: String(row?.solution || ''),
    result: String(row?.result || ''),
    problem_tags: mapStringArray(row?.problem_tags),
    solution_tags: mapStringArray(row?.solution_tags),
    is_public: Boolean(row?.is_public),
    share_slug: row?.share_slug ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    job_title: row?.job_title ?? row?.jobs?.title ?? null,
    company_name: row?.company_name ?? row?.companies?.name ?? null,
    candidate_name: row?.candidate_name ?? null,
});

const mapCompanyDialogueSolutionSnapshotState = (payload: any): CompanyDialogueSolutionSnapshotState => ({
    eligible: Boolean(payload?.eligible),
    reason: payload?.reason ?? null,
    snapshot: payload?.snapshot ? mapSolutionSnapshot(payload.snapshot) : null,
});

export const openDialogue = async (
    jobId: string | number,
    source?: string,
    metadata?: Record<string, any>,
    details?: OpenDialogueDetails
): Promise<OpenDialogueResult | null> => {
    try {
        const normalizedJobId = normalizeDialogueJobId(jobId);
        if (!Number.isFinite(normalizedJobId)) {
            return null;
        }
        const response = await authenticatedFetch(`${BACKEND_URL}/dialogues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: normalizedJobId,
                source: source || null,
                metadata: metadata || null,
                cover_letter: details?.coverLetter || null,
                cv_document_id: details?.cvDocumentId || null,
                cv_snapshot: details?.cvSnapshot || null,
                candidate_profile_snapshot: details?.candidateProfileSnapshot || null,
                jcfpm_share_level: details?.jcfpmShareLevel || null,
                shared_jcfpm_payload: details?.sharedJcfpmPayload || null
            })
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const dialogue = extractDialogueLikePayload(payload);
        return {
            status: String(payload?.status || ''),
            dialogue_id: payload?.dialogue_id ?? payload?.application_id ?? dialogue?.id ?? undefined,
            dialogue: dialogue ?? undefined,
            candidate_capacity: extractCandidateDialogueCapacity(payload),
        };
    } catch {
        return null;
    }
};

export const generateApplicationDraft = async (
    jobId: string | number,
    payload: GenerateApplicationDraftPayload = {}
): Promise<ApplicationDraftSuggestion> => {
    const normalizedJobId = normalizeDialogueJobId(jobId);
    if (!Number.isFinite(normalizedJobId)) {
        throw new Error('Invalid job ID');
    }

    const response = await authenticatedFetch(`${BACKEND_URL}/jobs/${normalizedJobId}/application-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cv_document_id: payload.cvDocumentId || null,
            tone: payload.tone || 'concise',
            language: payload.language || 'auto',
            regenerate: Boolean(payload.regenerate),
        }),
    });

    if (!response.ok) {
        throw new Error(await parseErrorDetail(response, 'Nepodařilo se připravit návrh odpovědi.'));
    }

    const data = await response.json();
    return {
        draftText: String(data?.draft_text || ''),
        fitScore: typeof data?.fit_score === 'number' ? data.fit_score : null,
        fitReasons: Array.isArray(data?.fit_reasons) ? data.fit_reasons.map((item: unknown) => String(item)) : [],
        fitWarnings: Array.isArray(data?.fit_warnings) ? data.fit_warnings.map((item: unknown) => String(item)) : [],
        language: String(data?.language || 'cs'),
        tone: String(data?.tone || payload.tone || 'concise') as ApplicationDraftTone,
        usedFallback: Boolean(data?.used_fallback),
        modelMeta: data?.model_meta && typeof data.model_meta === 'object' ? data.model_meta : null,
    };
};

export const fetchCompanyDialogueDetail = async (
    dialogueId: string
): Promise<DialogueDossier | null> => {
    if (!dialogueId) return null;
    if (companyDialoguesApiUnavailable) {
        return await fetchCompanyDialogueDetailFallback(dialogueId);
    }
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues/${dialogueId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            if (shouldDisableCompanyDialoguesApi(response.status)) {
                companyDialoguesApiUnavailable = true;
            }
            return await fetchCompanyDialogueDetailFallback(dialogueId);
        }
        const payload = await response.json();
        return extractDialogueLikePayload(payload);
    } catch {
        companyDialoguesApiUnavailable = true;
        return await fetchCompanyDialogueDetailFallback(dialogueId);
    }
};

export const fetchCompanyDialogueSolutionSnapshotState = async (
    dialogueId: string
): Promise<CompanyDialogueSolutionSnapshotState | null> => {
    if (!dialogueId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues/${dialogueId}/solution-snapshot`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return null;
        return mapCompanyDialogueSolutionSnapshotState(await response.json());
    } catch {
        return null;
    }
};

export const saveCompanyDialogueSolutionSnapshot = async (
    dialogueId: string,
    payload: SolutionSnapshotUpsertPayload
): Promise<SolutionSnapshot> => {
    const response = await authenticatedFetch(
        `${BACKEND_URL}/company/dialogues/${dialogueId}/solution-snapshot`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                problem: payload.problem,
                solution: payload.solution,
                result: payload.result,
                problem_tags: payload.problem_tags || [],
                solution_tags: payload.solution_tags || [],
                is_public: Boolean(payload.is_public),
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await parseErrorDetail(response, 'Nepodařilo se uložit solution snapshot.'));
    }
    const data = await response.json();
    if (!data?.snapshot) {
        throw new Error('Nepodařilo se uložit solution snapshot.');
    }
    return mapSolutionSnapshot(data.snapshot);
};

export const fetchMySolutionSnapshots = async (
    limit: number = 12
): Promise<SolutionSnapshot[]> => {
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/solution-snapshots/me?limit=${Math.max(1, Math.min(50, Math.floor(limit || 12)))}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        return Array.isArray(payload?.snapshots) ? payload.snapshots.map(mapSolutionSnapshot) : [];
    } catch {
        return [];
    }
};

export const fetchMyDialogues = async (
    limit: number = 80
): Promise<DialogueSummary[]> => {
    const result = await fetchMyDialoguesWithCapacity(limit);
    return result.dialogues;
};

export const fetchMyDialoguesWithCapacity = async (
    limit: number = 80
): Promise<{ dialogues: DialogueSummary[]; candidateCapacity: CandidateDialogueCapacity | null }> => {
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/me?limit=${Math.max(1, Math.min(200, Math.floor(limit || 80)))}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            return {
                dialogues: [],
                candidateCapacity: null,
            };
        }
        const payload = await response.json();
        return {
            dialogues: extractDialogueLikeList(payload).map(mapDialogueSummary),
            candidateCapacity: extractCandidateDialogueCapacity(payload) ?? null,
        };
    } catch {
        return {
            dialogues: [],
            candidateCapacity: null,
        };
    }
};

export const fetchCandidateDialogueCapacity = async (): Promise<CandidateDialogueCapacity | null> => {
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/me?limit=1`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return null;
        const payload = await response.json();
        return extractCandidateDialogueCapacity(payload) ?? null;
    } catch {
        return null;
    }
};

export const fetchMyDialogueDetail = async (
    dialogueId: string
): Promise<DialogueDetail | null> => {
    if (!dialogueId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/${dialogueId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return null;
        const payload = await response.json();
        const dialogue = extractDialogueLikePayload(payload);
        if (!dialogue) return null;
        return {
            ...mapDialogueSummary(dialogue),
            reviewed_at: dialogue.reviewed_at ?? null,
            reviewed_by: dialogue.reviewed_by ?? null,
            cover_letter: dialogue.cover_letter ?? null,
            cv_document_id: dialogue.cv_document_id ?? null,
            cv_snapshot: dialogue.cv_snapshot ?? null,
            candidate_profile_snapshot: dialogue.candidate_profile_snapshot ?? null,
            shared_jcfpm_payload: dialogue.shared_jcfpm_payload ?? null,
            application_payload: dialogue.application_payload ?? null,
            assets: Array.isArray(dialogue.assets) ? dialogue.assets : [],
            audio_transcript_status: dialogue.audio_transcript_status ?? 'not_applicable',
            ai_summary_status: dialogue.ai_summary_status ?? 'unavailable',
            fit_evidence_status: dialogue.fit_evidence_status ?? 'unavailable',
            ai_summary: dialogue.ai_summary ?? null,
            fit_evidence: dialogue.fit_evidence ?? null,
        } as DialogueDetail;
    } catch {
        return null;
    }
};

export const withdrawMyDialogue = async (
    dialogueId: string
): Promise<MutationResult> => {
    if (!dialogueId) return { ok: false, via: 'failed' };
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/${dialogueId}/withdraw`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        if (response.ok) return { ok: true, via: 'api' };
        if (supabase) {
            const { error } = await supabase
                .from('job_applications')
                .update({
                    status: 'withdrawn',
                    dialogue_closed_reason: 'candidate_withdrew',
                    dialogue_closed_at: new Date().toISOString(),
                })
                .eq('id', dialogueId);
            if (!error) {
                return { ok: true, via: 'fallback' };
            }
        }
        return { ok: false, via: 'failed' };
    } catch {
        if (supabase) {
            const { error } = await supabase
                .from('job_applications')
                .update({
                    status: 'withdrawn',
                    dialogue_closed_reason: 'candidate_withdrew',
                    dialogue_closed_at: new Date().toISOString(),
                })
                .eq('id', dialogueId);
            if (!error) {
                return { ok: true, via: 'fallback' };
            }
        }
        return { ok: false, via: 'failed' };
    }
};

const mapDialogueMessage = (row: any): DialogueMessage => ({
    id: String(row?.id || ''),
    application_id: String(row?.application_id || row?.dialogue_id || ''),
    company_id: row?.company_id ?? null,
    candidate_id: row?.candidate_id ?? null,
    sender_user_id: row?.sender_user_id ?? null,
    sender_role: row?.sender_role === 'candidate' ? 'candidate' : 'recruiter',
    body: String(row?.body || ''),
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
    audio_transcript_status: row?.audio_transcript_status ?? undefined,
    created_at: row?.created_at ?? new Date().toISOString(),
    read_by_candidate_at: row?.read_by_candidate_at ?? null,
    read_by_company_at: row?.read_by_company_at ?? null,
});

export const fetchMyDialogueMessages = async (
    dialogueId: string
): Promise<DialogueMessage[]> => {
    if (!dialogueId) return [];
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/${dialogueId}/messages`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload?.messages)) return [];
        return payload.messages.map(mapDialogueMessage);
    } catch {
        return [];
    }
};

export const sendMyDialogueMessage = async (
    dialogueId: string,
    payload: DialogueMessageCreatePayload
): Promise<DialogueMessage | null> => {
    if (!dialogueId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/dialogues/${dialogueId}/messages`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    body: payload.body || null,
                    attachments: payload.attachments || []
                })
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data?.message ? mapDialogueMessage(data.message) : null;
    } catch {
        return null;
    }
};

export const fetchCompanyDialogueMessages = async (
    dialogueId: string
): Promise<DialogueMessage[]> => {
    if (!dialogueId) return [];
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues/${dialogueId}/messages`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload?.messages)) return [];
        return payload.messages.map(mapDialogueMessage);
    } catch {
        return [];
    }
};

export const sendCompanyDialogueMessage = async (
    dialogueId: string,
    payload: DialogueMessageCreatePayload
): Promise<DialogueMessage | null> => {
    if (!dialogueId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues/${dialogueId}/messages`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    body: payload.body || null,
                    attachments: payload.attachments || []
                })
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data?.message ? mapDialogueMessage(data.message) : null;
    } catch {
        return null;
    }
};

export const fetchCompanyDialogues = async (
    companyId: string,
    jobId?: string,
    limit: number = 500
): Promise<CompanyApplicationRow[]> => {
    if (!companyId) return [];
    if (companyDialoguesApiUnavailable) {
        return await fetchCompanyDialoguesFallback(companyId, jobId, limit);
    }
    const params = new URLSearchParams({
        company_id: companyId,
        limit: String(limit)
    });
    if (jobId) params.set('role_id', jobId);

    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues?${params.toString()}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            if (shouldDisableCompanyDialoguesApi(response.status)) {
                companyDialoguesApiUnavailable = true;
            }
            return await fetchCompanyDialoguesFallback(companyId, jobId, limit);
        }
        const payload = await response.json();
        return extractDialogueLikeList(payload).map(mapCompanyDialogueRow);
    } catch {
        companyDialoguesApiUnavailable = true;
        return await fetchCompanyDialoguesFallback(companyId, jobId, limit);
    }
};

export const updateCompanyDialogueStatus = async (
    dialogueId: string,
    status: string
): Promise<MutationResult> => {
    if (!dialogueId) return { ok: false, via: 'failed' };
    if (companyDialoguesApiUnavailable) {
        return await updateCompanyDialogueStatusFallback(dialogueId, status);
    }
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dialogues/${dialogueId}/status`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            }
        );
        if (response.ok) return { ok: true, via: 'api' };
        if (shouldDisableCompanyDialoguesApi(response.status)) {
            companyDialoguesApiUnavailable = true;
        }
        return await updateCompanyDialogueStatusFallback(dialogueId, status);
    } catch {
        companyDialoguesApiUnavailable = true;
        return await updateCompanyDialogueStatusFallback(dialogueId, status);
    }
};

const mapCompanyDialogueRow = (row: any): CompanyApplicationRow => ({
    ...row,
    id: row?.id ?? row?.dialogue_id ?? '',
    job_id: row?.job_id ?? row?.role_id ?? row?.jobId ?? row?.roleId ?? row?.job_id,
    job_title: row?.job_title ?? row?.role_title ?? row?.jobTitle ?? row?.roleTitle ?? row?.job_title,
    candidate_avatar_url:
        row?.candidate_avatar_url ??
        row?.candidateAvatarUrl ??
        row?.candidate_profile_snapshot?.avatar_url ??
        undefined,
    candidateAvatarUrl:
        row?.candidateAvatarUrl ??
        row?.candidate_avatar_url ??
        row?.candidate_profile_snapshot?.avatar_url ??
        undefined,
    hasCoverLetter: row?.has_cover_letter ?? row?.hasCoverLetter ?? false,
    hasCv: row?.has_cv ?? row?.hasCv ?? false,
    jcfpmShareLevel: row?.jcfpm_share_level ?? row?.jcfpmShareLevel ?? 'do_not_share',
    hasJcfpm: row?.has_jcfpm ?? row?.hasJcfpm ?? false,
    candidateHeadline: row?.candidate_headline ?? row?.candidateHeadline ?? undefined,
    submitted_at: row?.submitted_at ?? row?.created_at ?? row?.applied_at,
    ...mapDialogueLifecycleFields(row),
}) as CompanyApplicationRow;

const fetchLinkedJobs = async (jobIds: Array<string | number>): Promise<Map<string, { title?: string | null }>> => {
    const unique = Array.from(new Set(jobIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (unique.length === 0) return new Map();
    return fetchJobTitlesByIds(unique);
};

const fetchLinkedProfiles = async (profileIds: string[]): Promise<Map<string, { full_name?: string | null; email?: string | null; avatar_url?: string | null }>> => {
    const unique = Array.from(new Set(profileIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (!supabase || unique.length === 0) return new Map();
    const { data, error } = await supabase.from('profiles').select('id,full_name,email,avatar_url').in('id', unique);
    if (error || !Array.isArray(data)) return new Map();
    return new Map(data.map((row: any) => [String(row.id), { full_name: row.full_name, email: row.email, avatar_url: row.avatar_url }]));
};

const fetchCompanyDialoguesFallback = async (
    companyId: string,
    jobId?: string,
    limit: number = 500
): Promise<CompanyApplicationRow[]> => {
    if (!supabase) return [];
    let query = supabase
        .from('job_applications')
        .select('*')
        .eq('company_id', companyId)
        .order('applied_at', { ascending: false })
        .limit(limit);

    if (jobId) {
        query = query.eq('job_id', jobId);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];

    const jobMap = await fetchLinkedJobs(data.map((row: any) => row.job_id).filter(Boolean));
    const profileMap = await fetchLinkedProfiles(data.map((row: any) => String(row.candidate_id || '')).filter(Boolean));

    return data.map((row: any) => mapCompanyDialogueRow({
        ...row,
        job_title: row?.job_title ?? jobMap.get(String(row.job_id))?.title ?? null,
        candidate_name:
            row?.candidate_name ??
            profileMap.get(String(row.candidate_id || ''))?.full_name ??
            profileMap.get(String(row.candidate_id || ''))?.email ??
            'Candidate',
        candidate_email:
            row?.candidate_email ??
            profileMap.get(String(row.candidate_id || ''))?.email ??
            null,
        candidate_avatar_url:
            row?.candidate_avatar_url ??
            row?.candidate_profile_snapshot?.avatar_url ??
            profileMap.get(String(row.candidate_id || ''))?.avatar_url ??
            null,
        has_cover_letter: Boolean(row?.cover_letter),
        has_cv: Boolean(row?.cv_document_id || row?.cv_snapshot?.fileUrl || row?.cv_snapshot?.originalName),
        jcfpm_share_level: row?.jcfpm_share_level ?? 'do_not_share',
        has_jcfpm: Boolean(row?.shared_jcfpm_payload),
        candidate_headline:
            row?.candidate_headline ??
            row?.candidate_profile_snapshot?.jobTitle ??
            null,
    }));
};

const fetchCompanyDialogueDetailFallback = async (dialogueId: string): Promise<DialogueDossier | null> => {
    if (!supabase || !dialogueId) return null;
    const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', dialogueId)
        .maybeSingle();
    if (error || !data) return null;

    const [jobMap, profileMap] = await Promise.all([
        fetchLinkedJobs(data.job_id ? [data.job_id] : []),
        fetchLinkedProfiles(data.candidate_id ? [String(data.candidate_id)] : [])
    ]);

    return {
        ...(mapCompanyDialogueRow({
            ...data,
            job_title: jobMap.get(String(data.job_id || ''))?.title ?? null,
            candidate_name:
                profileMap.get(String(data.candidate_id || ''))?.full_name ??
                profileMap.get(String(data.candidate_id || ''))?.email ??
                data?.candidate_profile_snapshot?.name ??
                'Candidate',
            candidate_email:
                profileMap.get(String(data.candidate_id || ''))?.email ??
                data?.candidate_profile_snapshot?.email ??
                null,
            candidate_avatar_url:
                data?.candidate_avatar_url ??
                data?.candidate_profile_snapshot?.avatar_url ??
                profileMap.get(String(data.candidate_id || ''))?.avatar_url ??
                null,
            has_cover_letter: Boolean(data?.cover_letter),
            has_cv: Boolean(data?.cv_document_id || data?.cv_snapshot?.fileUrl || data?.cv_snapshot?.originalName),
            has_jcfpm: Boolean(data?.shared_jcfpm_payload)
        }) as unknown as CompanyApplicationRow),
        company_id: data.company_id,
        source: data.source ?? null,
        ...mapDialogueLifecycleFields(data),
        reviewed_at: data.reviewed_at ?? null,
        reviewed_by: data.reviewed_by ?? null,
        cover_letter: data.cover_letter ?? null,
        cv_document_id: data.cv_document_id ?? null,
        cv_snapshot: data.cv_snapshot ?? null,
        candidate_profile_snapshot: data.candidate_profile_snapshot ?? null,
        jcfpm_share_level: data.jcfpm_share_level ?? 'do_not_share',
        shared_jcfpm_payload: data.shared_jcfpm_payload ?? null,
        application_payload: data.application_payload ?? null
    } as DialogueDossier;
};

const updateCompanyDialogueStatusFallback = async (
    dialogueId: string,
    status: string
): Promise<MutationResult> => {
    if (!supabase || !dialogueId) return { ok: false, via: 'failed' };
    const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', dialogueId);
    return error
        ? { ok: false, via: 'failed' }
        : { ok: true, via: 'fallback' };
};

export const createJobApplication = async (
    jobId: string | number,
    source?: string,
    metadata?: Record<string, any>,
    details?: CreateJobApplicationDetails
): Promise<CreateJobApplicationResult | null> => {
    const result = await openDialogue(jobId, source, metadata, details);
    if (!result) return null;
    return {
        status: result.status,
        application_id: result.dialogue_id,
        application: result.dialogue,
        candidate_capacity: result.candidate_capacity,
    };
};

export const fetchCandidateApplications = fetchMyDialogues;
export const fetchMyDialogueCapacity = fetchCandidateDialogueCapacity;
export const fetchCandidateApplicationDetail = fetchMyDialogueDetail;
export const withdrawCandidateApplication = withdrawMyDialogue;
export const fetchCandidateApplicationMessages = fetchMyDialogueMessages;
export const sendCandidateApplicationMessage = sendMyDialogueMessage;
export const fetchCompanyApplications = fetchCompanyDialogues;
export const fetchCompanyApplicationDetail = fetchCompanyDialogueDetail;
export const fetchCompanyApplicationMessages = fetchCompanyDialogueMessages;
export const sendCompanyApplicationMessage = sendCompanyDialogueMessage;
export const updateCompanyApplicationStatus = updateCompanyDialogueStatus;
export const createDialogue = openDialogue;
