import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const jsonHeaders = { 'Content-Type': 'application/json' };
const normalizeLookupJobId = (jobId: string | number): string => {
    const raw = String(jobId || '').trim();
    return raw.startsWith('db-') ? raw.slice(3) : raw;
};

export const fetchJobPayloadsByIds = async (jobIds: Array<string | number>): Promise<any[]> => {
    const unique = Array.from(new Set(jobIds.map((id) => normalizeLookupJobId(id)).filter(Boolean)));
    if (!unique.length) return [];
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/jobs/lookup`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ ids: unique }),
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json();
        return Array.isArray(payload?.jobs) ? payload.jobs : [];
    } catch {
        return [];
    }
};

export const fetchJobTitlesByIds = async (jobIds: Array<string | number>): Promise<Map<string, { title?: string | null }>> => {
    const rows = await fetchJobPayloadsByIds(jobIds);
    const out = new Map<string, { title?: string | null }>();
    rows.forEach((row: any) => {
        const normalizedId = String(row?.id || '').trim();
        if (!normalizedId) return;
        const summary = { title: row?.title ?? null };
        out.set(normalizedId, summary);
        out.set(`db-${normalizedId}`, summary);
    });
    return out;
};

export const fetchCompanyPublishedJobPayloads = async (): Promise<any[]> => {
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/company/jobs/published`, {
            method: 'GET',
            headers: jsonHeaders,
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json();
        return Array.isArray(payload?.jobs) ? payload.jobs : [];
    } catch {
        return [];
    }
};
