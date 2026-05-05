import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import ApiService from './apiService';

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

export interface V2CompanyDashboardRole {
    id: string;
    title: string;
    team: string;
    candidates: number;
    status: string;
    accent: string;
}

export interface V2CompanyDashboardCandidate {
    id: string;
    handshake_id: string;
    candidate_name: string;
    candidateName?: string;
    headline: string;
    status: string;
    score: number;
    matchPercent?: number;
    job_id: string;
    updated_at: string;
    submitted_at?: string | null;
}

export interface V2CompanyDashboardPayload {
    schema_version: 'company-dashboard-v1';
    company_id: string;
    metrics: {
        active_roles: number;
        candidates: number;
        handshakes_in_process: number;
        submitted: number;
        sandbox_sessions: number;
        sandbox_completed: number;
        average_evaluation: number;
        hire_success: number;
        team_resonance: number;
    };
    status_counts: Record<string, number>;
    active_roles: V2CompanyDashboardRole[];
    top_candidates: V2CompanyDashboardCandidate[];
    pipeline: Array<{ id: string; label: string; count: number; color: string }>;
    resonance: Array<{ id: string; label: string; value: number }>;
    composition: Array<{ id: string; label: string; value: number; color: string }>;
    radar_metrics: Array<{ label: string; teamValue: number; benchmarkValue: number }>;
    tip: string;
}

export const fetchV2CompanyDashboard = async (companyId: string): Promise<V2CompanyDashboardPayload | null> => {
    if (!companyId) return null;
    try {
        const response = await ApiService.get<{ status?: string; data?: V2CompanyDashboardPayload } | V2CompanyDashboardPayload>(
            `/company/${encodeURIComponent(companyId)}/dashboard`
        );
        if (response && typeof response === 'object' && 'data' in response) {
            return response.data || null;
        }
        return response as V2CompanyDashboardPayload;
    } catch {
        return null;
    }
};

export const fetchV2CompanyHandshakes = async (
    companyId: string,
    limit = 80,
): Promise<V2CompanyDashboardCandidate[]> => {
    if (!companyId) return [];
    try {
        const response = await ApiService.get<{ status?: string; data?: V2CompanyDashboardCandidate[] }>(
            `/company/${encodeURIComponent(companyId)}/handshakes?limit=${Math.max(1, Math.min(200, Math.floor(limit || 80)))}`
        );
        return Array.isArray(response.data) ? response.data : [];
    } catch {
        return [];
    }
};

export const fetchV2CompanyHandshakeReadout = async (
    companyId: string,
    handshakeId: string,
): Promise<Record<string, any> | null> => {
    if (!companyId || !handshakeId) return null;
    try {
        const response = await ApiService.get<{ status?: string; data?: { readout?: Record<string, any> } }>(
            `/company/${encodeURIComponent(companyId)}/handshakes/${encodeURIComponent(handshakeId)}/readout`
        );
        return response.data?.readout || null;
    } catch {
        return null;
    }
};
