import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { ApiRequestError, isMissingFeatureError } from './companyJobDraftService';

export interface CompanyActivityLogEntry {
    id: string;
    company_id?: string;
    event_type: string;
    subject_type?: string | null;
    subject_id?: string | null;
    payload?: Record<string, any> | null;
    actor_user_id?: string | null;
    created_at: string;
}

export interface CreateCompanyActivityEventInput {
    company_id: string;
    event_type: string;
    subject_type?: string | null;
    subject_id?: string | null;
    payload?: Record<string, any> | null;
}

let companyActivityApiUnavailable = false;

const jsonHeaders = { 'Content-Type': 'application/json' };
const shouldDisableCompanyActivityApi = (status: number): boolean =>
    [404, 409, 500, 501, 502, 503].includes(status);

const toJson = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ApiRequestError(response.status, detail || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
};

const markUnavailableIfNeeded = (error: unknown) => {
    if (
        isMissingFeatureError(error) ||
        (error instanceof ApiRequestError && shouldDisableCompanyActivityApi(error.status))
    ) {
        companyActivityApiUnavailable = true;
    }
};

export const listCompanyActivityLog = async (
    companyId: string,
    limit = 50
): Promise<CompanyActivityLogEntry[]> => {
    if (companyActivityApiUnavailable) {
        throw new ApiRequestError(409, 'Company activity API unavailable');
    }
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/activity-log?company_id=${encodeURIComponent(companyId)}&limit=${limit}`,
            { method: 'GET', headers: jsonHeaders }
        );
        const payload = await toJson<{ events: CompanyActivityLogEntry[] }>(response);
        return Array.isArray(payload?.events) ? payload.events : [];
    } catch (error) {
        markUnavailableIfNeeded(error);
        throw error;
    }
};

export const createCompanyActivityLogEvent = async (
    input: CreateCompanyActivityEventInput
): Promise<CompanyActivityLogEntry> => {
    if (companyActivityApiUnavailable) {
        throw new ApiRequestError(409, 'Company activity API unavailable');
    }
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/activity-log`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(input)
        });
        const payload = await toJson<{ event: CompanyActivityLogEntry }>(response);
        return payload.event;
    } catch (error) {
        markUnavailableIfNeeded(error);
        throw error;
    }
};
