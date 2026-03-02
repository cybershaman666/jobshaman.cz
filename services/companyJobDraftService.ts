import { BACKEND_URL } from '../constants';
import { JobDraft, JobValidationReport, JobVersion } from '../types';
import { authenticatedFetch } from './csrfService';

export class ApiRequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message || `Request failed: ${status}`);
        this.name = 'ApiRequestError';
        this.status = status;
    }
}

export interface CompanySchemaProbe {
    ready: boolean;
    sample_rows: number;
    issue?: string | null;
}

export interface CompanySchemaRolloutStatus {
    checked_at: string;
    all_ready: boolean;
    job_applications: CompanySchemaProbe;
    job_drafts: CompanySchemaProbe;
    job_versions: CompanySchemaProbe;
}

export interface JobLifecycleUpdateResult {
    ok: boolean;
    via: 'api' | 'unavailable' | 'failed';
}

export interface JobDraftUpsertInput {
    status?: JobDraft['status'];
    title?: string;
    role_summary?: string;
    team_intro?: string;
    responsibilities?: string;
    requirements?: string;
    nice_to_have?: string;
    benefits_structured?: string[];
    salary_from?: number | null;
    salary_to?: number | null;
    salary_currency?: string;
    salary_timeframe?: string;
    contract_type?: string | null;
    work_model?: string | null;
    workplace_address?: string | null;
    location_public?: string | null;
    application_instructions?: string;
    contact_email?: string | null;
    quality_report?: JobValidationReport | null;
    ai_suggestions?: Record<string, unknown> | null;
    editor_state?: Record<string, unknown> | null;
}

const jsonHeaders = { 'Content-Type': 'application/json' };
let jobDraftApiUnavailable = false;
let rolloutSchemaApiUnavailable = false;

const toJson = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ApiRequestError(response.status, detail || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
};

export const isMissingFeatureError = (error: unknown): boolean => {
    return error instanceof ApiRequestError && [404, 409, 501].includes(error.status);
};

const markDraftApiUnavailableIfNeeded = (error: unknown) => {
    if (isMissingFeatureError(error)) {
        jobDraftApiUnavailable = true;
        rolloutSchemaApiUnavailable = true;
    }
};

export const listCompanyJobDrafts = async (): Promise<JobDraft[]> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts`, {
            method: 'GET',
            headers: jsonHeaders
        });
        const payload = await toJson<{ drafts: JobDraft[] }>(response);
        return Array.isArray(payload?.drafts) ? payload.drafts : [];
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const getCompanyJobDraft = async (draftId: string): Promise<JobDraft | null> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts/${draftId}`, {
            method: 'GET',
            headers: jsonHeaders
        });
        const payload = await toJson<{ draft: JobDraft }>(response);
        return payload?.draft || null;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const createCompanyJobDraft = async (input: JobDraftUpsertInput): Promise<JobDraft> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(input)
        });
        const payload = await toJson<{ draft: JobDraft }>(response);
        return payload.draft;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const updateCompanyJobDraft = async (draftId: string, input: JobDraftUpsertInput): Promise<JobDraft> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts/${draftId}`, {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify(input)
        });
        const payload = await toJson<{ draft: JobDraft }>(response);
        return payload.draft;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const validateCompanyJobDraft = async (draftId: string): Promise<JobValidationReport> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts/${draftId}/validate`, {
            method: 'POST',
            headers: jsonHeaders
        });
        const payload = await toJson<{ validation: JobValidationReport }>(response);
        return payload.validation;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const publishCompanyJobDraft = async (
    draftId: string,
    changeSummary?: string
): Promise<{ status: string; job_id: string | number; version_number: number; validation: JobValidationReport }> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/job-drafts/${draftId}/publish`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ change_summary: changeSummary || null })
        });
        return toJson(response);
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const createEditDraftFromJob = async (jobId: string | number): Promise<JobDraft> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/jobs/${jobId}/edit-draft`, {
            method: 'POST',
            headers: jsonHeaders
        });
        const payload = await toJson<{ draft: JobDraft }>(response);
        return payload.draft;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const duplicateJobIntoDraft = async (jobId: string | number): Promise<JobDraft> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/jobs/${jobId}/duplicate`, {
            method: 'POST',
            headers: jsonHeaders
        });
        const payload = await toJson<{ draft: JobDraft }>(response);
        return payload.draft;
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const listJobVersions = async (jobId: string | number): Promise<JobVersion[]> => {
    if (jobDraftApiUnavailable) {
        throw new ApiRequestError(404, 'Job draft API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/jobs/${jobId}/versions`, {
            method: 'GET',
            headers: jsonHeaders
        });
        const payload = await toJson<{ versions: JobVersion[] }>(response);
        return Array.isArray(payload?.versions) ? payload.versions : [];
    } catch (error) {
        markDraftApiUnavailableIfNeeded(error);
        throw error;
    }
};

export const updateCompanyJobLifecycle = async (
    jobId: string | number,
    status: 'active' | 'paused' | 'closed' | 'archived'
): Promise<JobLifecycleUpdateResult> => {
    if (jobDraftApiUnavailable) {
        return { ok: false, via: 'unavailable' };
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/jobs/${jobId}/lifecycle`, {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            return { ok: true, via: 'api' };
        }
        const missingFeature = [404, 409, 501].includes(response.status);
        if (missingFeature) {
            markDraftApiUnavailableIfNeeded(new ApiRequestError(response.status, 'Job lifecycle API unavailable'));
            return { ok: false, via: 'unavailable' };
        }
        return { ok: false, via: 'failed' };
    } catch {
        return { ok: false, via: 'failed' };
    }
};

export const fetchCompanySchemaRolloutStatus = async (): Promise<CompanySchemaRolloutStatus | null> => {
    if (rolloutSchemaApiUnavailable || jobDraftApiUnavailable) return null;
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/schema/rollout-status`, {
            method: 'GET',
            headers: jsonHeaders
        });
        if (!response.ok) {
            if ([404, 409, 501].includes(response.status)) {
                rolloutSchemaApiUnavailable = true;
            }
            return null;
        }
        return await response.json() as CompanySchemaRolloutStatus;
    } catch {
        return null;
    }
};
