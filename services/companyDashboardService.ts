import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

export interface CompanyJobViewsResponse {
    company_id: string;
    window_days: number;
    total: number;
    job_views: Array<{ job_id: string; views: number }>;
}

export const fetchCompanyJobViews = async (
    companyId: string,
    windowDays: number = 90,
    jobId?: string
): Promise<CompanyJobViewsResponse | null> => {
    if (!companyId) return null;
    const params = new URLSearchParams({
        company_id: companyId,
        window_days: String(windowDays)
    });
    if (jobId) params.set('job_id', jobId);

    try {
        const response = await authenticatedFetch(
            `${BACKEND_URL}/company/dashboard/job_views?${params.toString()}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
};
