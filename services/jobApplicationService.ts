import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { supabase } from './supabaseService';
import {
    ApplicationDossier,
    ApplicationJcfpmShareLevel,
    ApplicationMessage,
    CandidateApplicationDetail,
    CandidateApplicationSummary,
    CompanyApplicationRow
} from '../types';
let companyApplicationsApiUnavailable = false;

const shouldDisableCompanyApplicationsApi = (status: number): boolean =>
    [404, 409, 500, 501, 502, 503].includes(status);

export interface MutationResult {
    ok: boolean;
    via: 'api' | 'fallback' | 'failed';
}

export interface ApplicationMessageCreatePayload {
    body?: string | null;
    attachments?: Array<{
        name: string;
        url: string;
        path?: string | null;
        size?: number | null;
        content_type?: string | null;
    }>;
}

export interface CreateJobApplicationDetails {
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
        linkedin?: string;
        skills?: string[];
        values?: string[];
        preferredCountryCode?: string;
    } | null;
    jcfpmShareLevel?: ApplicationJcfpmShareLevel;
    sharedJcfpmPayload?: Record<string, any> | null;
}

const mapCandidateApplication = (row: any): CandidateApplicationSummary => ({
    id: String(row?.id || ''),
    job_id: row?.job_id,
    company_id: row?.company_id ?? undefined,
    status: row?.status ?? 'pending',
    submitted_at: row?.submitted_at ?? row?.created_at ?? row?.applied_at,
    updated_at: row?.updated_at ?? row?.submitted_at ?? row?.created_at ?? row?.applied_at,
    source: row?.source ?? undefined,
    has_cover_letter: Boolean(row?.has_cover_letter ?? row?.cover_letter),
    has_cv: Boolean(row?.has_cv ?? row?.cv_snapshot?.fileUrl ?? row?.cv_snapshot?.originalName ?? row?.cv_document_id),
    has_jcfpm: Boolean(row?.has_jcfpm ?? row?.shared_jcfpm_payload),
    jcfpm_share_level: row?.jcfpm_share_level ?? row?.jcfpmShareLevel ?? 'do_not_share',
    company_name: row?.company_name ?? undefined,
    company_website: row?.company_website ?? undefined,
    job_snapshot: row?.job_snapshot ?? undefined,
});

export const createJobApplication = async (
    jobId: string | number,
    source?: string,
    metadata?: Record<string, any>,
    details?: CreateJobApplicationDetails
): Promise<{ status: string; application_id?: string; application?: ApplicationDossier } | null> => {
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/jobs/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: Number(jobId),
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
        return await response.json();
    } catch {
        return null;
    }
};

export const fetchCompanyApplicationDetail = async (
    applicationId: string
): Promise<ApplicationDossier | null> => {
    if (!applicationId) return null;
    if (companyApplicationsApiUnavailable) {
        return await fetchCompanyApplicationDetailFallback(applicationId);
    }
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications/${applicationId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            if (shouldDisableCompanyApplicationsApi(response.status)) {
                companyApplicationsApiUnavailable = true;
            }
            return await fetchCompanyApplicationDetailFallback(applicationId);
        }
        const payload = await response.json();
        return payload?.application || null;
    } catch {
        companyApplicationsApiUnavailable = true;
        return await fetchCompanyApplicationDetailFallback(applicationId);
    }
};

export const fetchCandidateApplications = async (
    limit: number = 80
): Promise<CandidateApplicationSummary[]> => {
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/jobs/applications/me?limit=${Math.max(1, Math.min(200, Math.floor(limit || 80)))}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload?.applications)) return [];
        return payload.applications.map(mapCandidateApplication);
    } catch {
        return [];
    }
};

export const fetchCandidateApplicationDetail = async (
    applicationId: string
): Promise<CandidateApplicationDetail | null> => {
    if (!applicationId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/jobs/applications/${applicationId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return null;
        const payload = await response.json();
        if (!payload?.application) return null;
        return {
            ...mapCandidateApplication(payload.application),
            reviewed_at: payload.application.reviewed_at ?? null,
            reviewed_by: payload.application.reviewed_by ?? null,
            cover_letter: payload.application.cover_letter ?? null,
            cv_document_id: payload.application.cv_document_id ?? null,
            cv_snapshot: payload.application.cv_snapshot ?? null,
            candidate_profile_snapshot: payload.application.candidate_profile_snapshot ?? null,
            shared_jcfpm_payload: payload.application.shared_jcfpm_payload ?? null,
            application_payload: payload.application.application_payload ?? null,
        } as CandidateApplicationDetail;
    } catch {
        return null;
    }
};

export const withdrawCandidateApplication = async (
    applicationId: string
): Promise<MutationResult> => {
    if (!applicationId) return { ok: false, via: 'failed' };
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/jobs/applications/${applicationId}/withdraw`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        if (response.ok) return { ok: true, via: 'api' };
        return { ok: false, via: 'failed' };
    } catch {
        return { ok: false, via: 'failed' };
    }
};

const mapApplicationMessage = (row: any): ApplicationMessage => ({
    id: String(row?.id || ''),
    application_id: String(row?.application_id || ''),
    company_id: row?.company_id ?? null,
    candidate_id: row?.candidate_id ?? null,
    sender_user_id: row?.sender_user_id ?? null,
    sender_role: row?.sender_role === 'candidate' ? 'candidate' : 'recruiter',
    body: String(row?.body || ''),
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
    created_at: row?.created_at ?? new Date().toISOString(),
    read_by_candidate_at: row?.read_by_candidate_at ?? null,
    read_by_company_at: row?.read_by_company_at ?? null,
});

export const fetchCandidateApplicationMessages = async (
    applicationId: string
): Promise<ApplicationMessage[]> => {
    if (!applicationId) return [];
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/jobs/applications/${applicationId}/messages`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload?.messages)) return [];
        return payload.messages.map(mapApplicationMessage);
    } catch {
        return [];
    }
};

export const sendCandidateApplicationMessage = async (
    applicationId: string,
    payload: ApplicationMessageCreatePayload
): Promise<ApplicationMessage | null> => {
    if (!applicationId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/jobs/applications/${applicationId}/messages`,
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
        return data?.message ? mapApplicationMessage(data.message) : null;
    } catch {
        return null;
    }
};

export const fetchCompanyApplicationMessages = async (
    applicationId: string
): Promise<ApplicationMessage[]> => {
    if (!applicationId) return [];
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications/${applicationId}/messages`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload?.messages)) return [];
        return payload.messages.map(mapApplicationMessage);
    } catch {
        return [];
    }
};

export const sendCompanyApplicationMessage = async (
    applicationId: string,
    payload: ApplicationMessageCreatePayload
): Promise<ApplicationMessage | null> => {
    if (!applicationId) return null;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications/${applicationId}/messages`,
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
        return data?.message ? mapApplicationMessage(data.message) : null;
    } catch {
        return null;
    }
};

export const fetchCompanyApplications = async (
    companyId: string,
    jobId?: string,
    limit: number = 500
): Promise<CompanyApplicationRow[]> => {
    if (!companyId) return [];
    if (companyApplicationsApiUnavailable) {
        return await fetchCompanyApplicationsFallback(companyId, jobId, limit);
    }
    const params = new URLSearchParams({
        company_id: companyId,
        limit: String(limit)
    });
    if (jobId) params.set('job_id', jobId);

    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications?${params.toString()}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            if (shouldDisableCompanyApplicationsApi(response.status)) {
                companyApplicationsApiUnavailable = true;
            }
            return await fetchCompanyApplicationsFallback(companyId, jobId, limit);
        }
        const payload = await response.json();
        if (!Array.isArray(payload?.applications)) return [];
        return payload.applications.map(mapCompanyApplicationRow);
    } catch {
        companyApplicationsApiUnavailable = true;
        return await fetchCompanyApplicationsFallback(companyId, jobId, limit);
    }
};

export const updateCompanyApplicationStatus = async (
    applicationId: string,
    status: string
): Promise<MutationResult> => {
    if (!applicationId) return { ok: false, via: 'failed' };
    if (companyApplicationsApiUnavailable) {
        return await updateCompanyApplicationStatusFallback(applicationId, status);
    }
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications/${applicationId}/status`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            }
        );
        if (response.ok) return { ok: true, via: 'api' };
        if (shouldDisableCompanyApplicationsApi(response.status)) {
            companyApplicationsApiUnavailable = true;
        }
        return await updateCompanyApplicationStatusFallback(applicationId, status);
    } catch {
        companyApplicationsApiUnavailable = true;
        return await updateCompanyApplicationStatusFallback(applicationId, status);
    }
};

const mapCompanyApplicationRow = (row: any): CompanyApplicationRow => ({
    ...row,
    hasCoverLetter: row?.has_cover_letter ?? row?.hasCoverLetter ?? false,
    hasCv: row?.has_cv ?? row?.hasCv ?? false,
    jcfpmShareLevel: row?.jcfpm_share_level ?? row?.jcfpmShareLevel ?? 'do_not_share',
    hasJcfpm: row?.has_jcfpm ?? row?.hasJcfpm ?? false,
    candidateHeadline: row?.candidate_headline ?? row?.candidateHeadline ?? undefined,
    submitted_at: row?.submitted_at ?? row?.created_at ?? row?.applied_at,
}) as CompanyApplicationRow;

const fetchLinkedJobs = async (jobIds: Array<string | number>): Promise<Map<string, { title?: string | null }>> => {
    const unique = Array.from(new Set(jobIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (!supabase || unique.length === 0) return new Map();
    const { data, error } = await supabase.from('jobs').select('id,title').in('id', unique);
    if (error || !Array.isArray(data)) return new Map();
    return new Map(data.map((row: any) => [String(row.id), { title: row.title }]));
};

const fetchLinkedProfiles = async (profileIds: string[]): Promise<Map<string, { full_name?: string | null; email?: string | null }>> => {
    const unique = Array.from(new Set(profileIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (!supabase || unique.length === 0) return new Map();
    const { data, error } = await supabase.from('profiles').select('id,full_name,email').in('id', unique);
    if (error || !Array.isArray(data)) return new Map();
    return new Map(data.map((row: any) => [String(row.id), { full_name: row.full_name, email: row.email }]));
};

const fetchCompanyApplicationsFallback = async (
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

    return data.map((row: any) => mapCompanyApplicationRow({
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

const fetchCompanyApplicationDetailFallback = async (applicationId: string): Promise<ApplicationDossier | null> => {
    if (!supabase || !applicationId) return null;
    const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();
    if (error || !data) return null;

    const [jobMap, profileMap] = await Promise.all([
        fetchLinkedJobs(data.job_id ? [data.job_id] : []),
        fetchLinkedProfiles(data.candidate_id ? [String(data.candidate_id)] : [])
    ]);

    return {
        ...(mapCompanyApplicationRow({
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
            has_cover_letter: Boolean(data?.cover_letter),
            has_cv: Boolean(data?.cv_document_id || data?.cv_snapshot?.fileUrl || data?.cv_snapshot?.originalName),
            has_jcfpm: Boolean(data?.shared_jcfpm_payload)
        }) as unknown as CompanyApplicationRow),
        company_id: data.company_id,
        source: data.source ?? null,
        reviewed_at: data.reviewed_at ?? null,
        reviewed_by: data.reviewed_by ?? null,
        cover_letter: data.cover_letter ?? null,
        cv_document_id: data.cv_document_id ?? null,
        cv_snapshot: data.cv_snapshot ?? null,
        candidate_profile_snapshot: data.candidate_profile_snapshot ?? null,
        jcfpm_share_level: data.jcfpm_share_level ?? 'do_not_share',
        shared_jcfpm_payload: data.shared_jcfpm_payload ?? null,
        application_payload: data.application_payload ?? null
    } as ApplicationDossier;
};

const updateCompanyApplicationStatusFallback = async (
    applicationId: string,
    status: string
): Promise<MutationResult> => {
    if (!supabase || !applicationId) return { ok: false, via: 'failed' };
    const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', applicationId);
    return error
        ? { ok: false, via: 'failed' }
        : { ok: true, via: 'fallback' };
};
