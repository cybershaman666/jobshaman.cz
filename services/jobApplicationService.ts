import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { CompanyApplicationRow } from '../types';

export const createJobApplication = async (
    jobId: string | number,
    source?: string,
    metadata?: Record<string, any>
): Promise<{ status: string; application_id?: string } | null> => {
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/jobs/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: Number(jobId),
                source: source || null,
                metadata: metadata || null
            })
        });
        if (!response.ok) return null;
        return await response.json();
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
        if (!response.ok) return [];
        const payload = await response.json();
        return Array.isArray(payload?.applications) ? payload.applications : [];
    } catch {
        return [];
    }
};

export const updateCompanyApplicationStatus = async (
    applicationId: string,
    status: string
): Promise<boolean> => {
    if (!applicationId) return false;
    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/applications/${applicationId}/status`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            }
        );
        return response.ok;
    } catch {
        return false;
    }
};
